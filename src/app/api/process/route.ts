/**
 * POST /api/process — the single serverless endpoint for Clauseora.
 *
 * Admission sequence:
 * 1. Validate request (mode, file count, question)
 * 2. Read file buffers and verify signatures
 * 3. Extract text with deterministic anchors
 * 4. Check token budget
 * 5. Call Groq primary analyzer
 * 6. Validate schema + anchor allowlist (fail closed on unknown IDs)
 * 7. Resolve anchor IDs → canonical excerpts
 * 8. Select high-impact claims → call Cloudflare verifier
 * 9. Derive verification status
 * 10. Return safe JSON response with fixed legal notice
 *
 * Security properties:
 * - No document text in logs
 * - No raw model output to client
 * - No silent truncation or partial results
 * - Fixed legal notice on every terminal state
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import {
  LEGAL_NOTICE_TEXT,
  type Mode,
  type EvidenceIndex,
  type Segment,
  type AnchorRef,
  type SimplifyResult,
  type CompareResult,
  type AskResult,
  type ActionPack,
  type SuccessResponse,
  type ErrorResponse,
  type ErrorCode,
} from "@/types/evidence";

import { validateRequest, verifySignature } from "@/lib/validator";
import { extractTxt } from "@/lib/extractor/txt";
import { extractPdf } from "@/lib/extractor/pdf";
import { extractDocx } from "@/lib/extractor/docx";
import { callGroq, estimateTokens, GROQ_MAX_INPUT_TOKENS, GROQ_MODEL } from "@/lib/groq";
import {
  callCloudflare,
  deriveVerification,
  selectClaimsForVerification,
} from "@/lib/cloudflare";
import { getSimplifyPrompt } from "@/lib/prompts/simplify";
import { getComparePrompt } from "@/lib/prompts/compare";
import { getAskPrompt } from "@/lib/prompts/ask";

// Fixed abstention message for not_found Ask results (never model-generated)
const NOT_FOUND_ANSWER =
  "This information is not stated in the document you uploaded. Clauseora can only answer questions based on the content of the uploaded document.";

const EMPTY_ACTION_PACK: ActionPack = { checklist: [], lawyerQuestions: [] };

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  // ─── Parse multipart form ───────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse(requestId, null, "INVALID_REQUEST", "Invalid form data.");
  }

  // ─── 1. Validate request ────────────────────────────────────────────────────
  const validation = validateRequest(formData);
  if (!validation.ok) {
    return errorResponse(
      requestId,
      null,
      validation.error.code,
      validation.error.message
    );
  }

  const { mode, fileA: validatedA, fileB: validatedB, question } = validation.data;

  // ─── 2. Read buffers + verify signatures ───────────────────────────────────
  const fileABlob = formData.get("documentA") as File;
  const bufA = Buffer.from(await fileABlob.arrayBuffer());

  const sigCheckA = verifySignature(bufA, validatedA.extension, fileABlob.type);
  if (!sigCheckA.ok) {
    return errorResponse(requestId, mode, sigCheckA.error.code, sigCheckA.error.message);
  }

  let bufB: Buffer | null = null;
  if (validatedB) {
    const fileBBlob = formData.get("documentB") as File;
    bufB = Buffer.from(await fileBBlob.arrayBuffer());
    const sigCheckB = verifySignature(bufB, validatedB.extension, fileBBlob.type);
    if (!sigCheckB.ok) {
      return errorResponse(requestId, mode, sigCheckB.error.code, sigCheckB.error.message);
    }
  }

  // ─── 3. Extract segments with deterministic anchors ────────────────────────
  const extractionA = await extractBuffer(bufA, validatedA.extension, "A");
  if (!extractionA.ok) {
    return errorResponse(requestId, mode, extractionA.error, safeExtractMessage(extractionA.error));
  }

  let segmentsB: Segment[] | null = null;
  let pageCountB: number | undefined;
  if (bufB && validatedB) {
    const extractionB = await extractBuffer(bufB, validatedB.extension, "B");
    if (!extractionB.ok) {
      return errorResponse(requestId, mode, extractionB.error, safeExtractMessage(extractionB.error));
    }
    segmentsB = extractionB.segments;
    pageCountB = extractionB.pageCount;
  }

  const segmentsA = extractionA.segments;
  const evidenceIndex: EvidenceIndex = new Map();
  for (const seg of segmentsA) evidenceIndex.set(seg.id, seg);
  if (segmentsB) for (const seg of segmentsB) evidenceIndex.set(seg.id, seg);

  // ─── 4. Token budget check ─────────────────────────────────────────────────
  const anchorIdsA = segmentsA.map((s) => s.id);
  const anchorIdsB = segmentsB?.map((s) => s.id) ?? [];
  const allAnchorIds = [...anchorIdsA, ...anchorIdsB];

  const systemPrompt = getSystemPrompt(mode, anchorIdsA, anchorIdsB);
  const userPreview = buildUserPreview(segmentsA, segmentsB, question);
  const estimatedTokens = estimateTokens(systemPrompt) + estimateTokens(userPreview);

  if (estimatedTokens > GROQ_MAX_INPUT_TOKENS) {
    return errorResponse(
      requestId,
      mode,
      "DOCUMENT_TOO_LONG",
      "The document is too long for the current processing limit. Please upload a shorter document or a subset of pages."
    );
  }

  // ─── 5. Call Groq primary ──────────────────────────────────────────────────
  const groqResult = await callGroq(mode, segmentsA, segmentsB, question, systemPrompt);
  if (!groqResult.ok) {
    return errorResponse(requestId, mode, groqResult.error, safeGroqMessage(groqResult.error));
  }

  // ─── 6. Validate schema + anchor allowlist ─────────────────────────────────
  const modeResult = groqResult.result;
  const actionPack = groqResult.actionPack;

  const anchorValidation = validateAnchors(modeResult, actionPack, allAnchorIds, mode);
  if (!anchorValidation.ok) {
    return errorResponse(requestId, mode, "MODEL_OUTPUT_INVALID", "The analysis result could not be verified and was withheld for your safety.");
  }

  // ─── 7. Resolve anchor IDs → canonical excerpts ────────────────────────────
  const allUsedIds = collectAllAnchorIds(modeResult, actionPack, mode);
  const resolvedAnchors: AnchorRef[] = [];
  for (const id of allUsedIds) {
    const seg = evidenceIndex.get(id);
    if (!seg) continue; // already validated, should not happen
    resolvedAnchors.push({
      anchorId: id,
      document: seg.document,
      locator: seg.locator,
      heading: seg.heading,
      excerpt: seg.text,
    });
  }

  // Apply not_found fixed abstention
  if (mode === "ask") {
    const askResult = modeResult as AskResult;
    if (askResult.status === "not_found") {
      askResult.answer = NOT_FOUND_ANSWER;
      askResult.anchorIds = [];
    }
  }

  // ─── 8. Cloudflare verification ────────────────────────────────────────────
  const highImpactIds = selectHighImpactIds(modeResult, mode);
  const claimTexts = buildClaimTexts(modeResult, mode);
  const claimsToVerify = selectClaimsForVerification(resolvedAnchors, highImpactIds, claimTexts);
  const cfResult = await callCloudflare(claimsToVerify);

  // ─── 9. Derive verification status ────────────────────────────────────────
  const verification = deriveVerification(cfResult);

  // ─── 10. Return safe response ──────────────────────────────────────────────
  const documents: import("@/types/evidence").DocumentMeta[] = [
    {
      key: "A" as const,
      displayName: validatedA.displayName,
      pageCount: extractionA.pageCount,
    },
  ];
  if (validatedB) {
    documents.push({
      key: "B" as const,
      displayName: validatedB.displayName,
      pageCount: pageCountB,
    });
  }

  const response: SuccessResponse = {
    requestId,
    mode,
    analysisProvider: { service: "groq", model: GROQ_MODEL },
    notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
    documents,
    result: modeResult,
    resolvedAnchors,
    verification,
    actionPack,
    error: null,
  };

  return NextResponse.json(response, {
    status: 200,
    headers: securityHeaders(),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function extractBuffer(
  buffer: Buffer,
  ext: "pdf" | "docx" | "txt",
  doc: "A" | "B"
): Promise<
  | { ok: true; segments: Segment[]; pageCount?: number }
  | { ok: false; error: ErrorCode }
> {
  if (ext === "txt") {
    const r = extractTxt(buffer, doc);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, segments: r.segments };
  }
  if (ext === "pdf") {
    const r = await extractPdf(buffer, doc);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, segments: r.segments, pageCount: r.pageCount };
  }
  if (ext === "docx") {
    const r = await extractDocx(buffer, doc);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, segments: r.segments };
  }
  return { ok: false, error: "UNSUPPORTED_FILE_TYPE" };
}

function getSystemPrompt(
  mode: Mode,
  anchorIdsA: string[],
  anchorIdsB: string[]
): string {
  if (mode === "simplify") return getSimplifyPrompt(anchorIdsA);
  if (mode === "compare") return getComparePrompt(anchorIdsA, anchorIdsB);
  return getAskPrompt(anchorIdsA);
}

function buildUserPreview(
  segmentsA: Segment[],
  segmentsB: Segment[] | null,
  question?: string
): string {
  const parts = segmentsA.map((s) => s.text).join(" ");
  const partsB = segmentsB?.map((s) => s.text).join(" ") ?? "";
  return parts + partsB + (question ?? "");
}

/** Validate that all anchor IDs in the model output exist in the allowlist. */
function validateAnchors(
  result: SimplifyResult | CompareResult | AskResult,
  actionPack: ActionPack,
  allowedIds: string[],
  mode: Mode
): { ok: boolean } {
  const allowed = new Set(allowedIds);
  const usedIds = collectAllAnchorIds(result, actionPack, mode);
  for (const id of usedIds) {
    if (!allowed.has(id)) return { ok: false };
  }
  return { ok: true };
}

/** Collect every anchor ID referenced in the model output. */
function collectAllAnchorIds(
  result: SimplifyResult | CompareResult | AskResult,
  actionPack: ActionPack,
  mode: Mode
): string[] {
  const ids: string[] = [];

  if (mode === "simplify") {
    const r = result as SimplifyResult;
    for (const clause of r.clauses ?? []) {
      ids.push(...(clause.anchorIds ?? []));
      for (const item of clause.items ?? []) ids.push(...(item.anchorIds ?? []));
      for (const dt of clause.definedTerms ?? []) ids.push(...((dt as unknown as { anchorIds?: string[] }).anchorIds ?? []));
    }
  } else if (mode === "compare") {
    const r = result as CompareResult;
    for (const change of r.changes ?? []) {
      ids.push(...(change.anchorIdsA ?? []));
      ids.push(...(change.anchorIdsB ?? []));
    }
  } else {
    const r = result as AskResult;
    ids.push(...(r.anchorIds ?? []));
  }

  for (const item of actionPack.checklist ?? []) ids.push(...(item.anchorIds ?? []));
  for (const q of actionPack.lawyerQuestions ?? []) ids.push(...(q.anchorIds ?? []));

  return [...new Set(ids)];
}

/** Select high-impact anchor IDs for Cloudflare verification. */
function selectHighImpactIds(
  result: SimplifyResult | CompareResult | AskResult,
  mode: Mode
): string[] {
  const highImpact: string[] = [];

  if (mode === "simplify") {
    const r = result as SimplifyResult;
    for (const clause of r.clauses ?? []) {
      for (const item of clause.items ?? []) {
        if (item.kind === "money" || item.kind === "deadline") {
          highImpact.push(...(item.anchorIds ?? []));
        }
      }
    }
  } else if (mode === "compare") {
    const r = result as CompareResult;
    // Verify anchor IDs from changes that involve monetary or deadline terms
    const MONEY_DEADLINE_RE = /\$|\b\d+[,.]?\d*\s*(usd|eur|gbp|month|mo\.?|year|yr\.?|day|week)\b|\b(payment|retainer|fee|deposit|salary|compensation|penalty|damages)\b|\b\d+[-\s]day|\b(due|deadline|expir|terminat|notice|renew)/i;
    for (const change of r.changes ?? []) {
      const text = [change.after ?? "", change.before ?? "", change.whyReview ?? ""].join(" ");
      if (MONEY_DEADLINE_RE.test(text)) {
        highImpact.push(...(change.anchorIdsA ?? []));
        highImpact.push(...(change.anchorIdsB ?? []));
      }
    }
  }
  // Ask mode: no Cloudflare verification (answer is already grounded by allowlist)

  return [...new Set(highImpact)].slice(0, 5);
}

/** Build a map from anchor ID to the claim text that references it. */
function buildClaimTexts(
  result: SimplifyResult | CompareResult | AskResult,
  mode: Mode
): Map<string, string> {
  const map = new Map<string, string>();

  if (mode === "simplify") {
    const r = result as SimplifyResult;
    for (const clause of r.clauses ?? []) {
      for (const item of clause.items ?? []) {
        if (item.kind === "money" || item.kind === "deadline") {
          for (const id of item.anchorIds ?? []) {
            map.set(id, item.statement);
          }
        }
      }
    }
  } else if (mode === "compare") {
    const r = result as CompareResult;
    for (const change of r.changes ?? []) {
      // Use the "after" (revised) text as the claim for verification
      const claimText = [
        change.topic,
        change.after ?? change.before ?? "",
      ]
        .filter(Boolean)
        .join(": ")
        .slice(0, 400);
      for (const id of [...(change.anchorIdsA ?? []), ...(change.anchorIdsB ?? [])]) {
        if (!map.has(id)) map.set(id, claimText);
      }
    }
  }

  return map;
}

function safeExtractMessage(code: ErrorCode): string {
  const messages: Record<string, string> = {
    NO_EXTRACTABLE_TEXT:
      "No readable text was found in this document. Please upload a text-layer PDF, DOCX, or TXT file. Scanned image PDFs are not supported.",
    DOCUMENT_TOO_LONG:
      "This document exceeds the processing limit. Please upload a shorter document.",
    ENCRYPTED_DOCUMENT:
      "This document is password-protected. Please upload an unencrypted version.",
    CORRUPT_DOCUMENT:
      "This document could not be read. It may be corrupted or in an unsupported format.",
  };
  return messages[code] ?? "The document could not be processed.";
}

function safeGroqMessage(code: string): string {
  const messages: Record<string, string> = {
    PRIMARY_QUOTA_EXHAUSTED:
      "The analysis service is temporarily at capacity. Please try again in a few minutes.",
    MODEL_TIMEOUT:
      "The analysis took too long. Please try again with a shorter document.",
    MODEL_REFUSAL:
      "The analysis service could not process this request. Please try again.",
    PRIMARY_UNAVAILABLE:
      "The analysis service is temporarily unavailable. Please try again later.",
  };
  return messages[code] ?? "An error occurred during analysis. Please try again.";
}

function errorResponse(
  requestId: string,
  mode: Mode | null,
  code: ErrorCode,
  message: string
): NextResponse {
  const body: ErrorResponse = {
    requestId,
    mode,
    notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
    documents: [],
    result: null,
    actionPack: EMPTY_ACTION_PACK,
    error: { code, message },
  };
  const status = HTTP_STATUS[code] ?? 500;
  return NextResponse.json(body, { status, headers: securityHeaders() });
}

const HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  WRONG_FILE_COUNT: 400,
  FILE_TOO_LARGE: 413,
  DOCUMENT_TOO_LONG: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  TYPE_MISMATCH: 415,
  NO_EXTRACTABLE_TEXT: 422,
  ENCRYPTED_DOCUMENT: 422,
  CORRUPT_DOCUMENT: 422,
  RATE_LIMITED: 429,
  PRIMARY_QUOTA_EXHAUSTED: 429,
  MODEL_OUTPUT_INVALID: 502,
  MODEL_REFUSAL: 502,
  PRIMARY_UNAVAILABLE: 503,
  SERVICE_UNAVAILABLE: 503,
  MODEL_TIMEOUT: 504,
};

function securityHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'",
  };
}
