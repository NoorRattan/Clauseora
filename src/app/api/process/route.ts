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
  NOT_FOUND_ABSTENTION_TEXT,
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
import {
  callGroq,
  estimateGroqInputTokens,
  GROQ_MAX_INPUT_TOKENS,
  GROQ_MODEL,
} from "@/lib/groq";
import {
  callCloudflare,
  deriveVerification,
  selectClaimsForVerification,
} from "@/lib/cloudflare";
import { getSimplifyPrompt } from "@/lib/prompts/simplify";
import { getComparePrompt } from "@/lib/prompts/compare";
import { getAskPrompt } from "@/lib/prompts/ask";
import { buildClaimTexts } from "@/lib/verification-claims";
import { checkRateLimit, isSameOriginRequest } from "@/lib/request-security";

const EMPTY_ACTION_PACK: ActionPack = { checklist: [], lawyerQuestions: [] };

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_SEGMENTS_PER_DOCUMENT = 500;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  if (!isSameOriginRequest(req)) {
    return errorResponse(
      requestId,
      null,
      "INVALID_REQUEST",
      "Cross-origin requests are not permitted.",
    );
  }

  const rateLimit = checkRateLimit(req.headers);
  if (!rateLimit.allowed) {
    return errorResponse(
      requestId,
      null,
      "RATE_LIMITED",
      "Too many analysis requests. Please wait before trying again.",
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  try {
    return await processRequest(req, requestId);
  } catch {
    // Keep unexpected parser/provider failures inside the fixed response
    // contract. No upstream error body, stack, filename, or document text is
    // returned to the browser.
    return errorResponse(
      requestId,
      null,
      "SERVICE_UNAVAILABLE",
      "The analysis service is temporarily unavailable. Please try again later.",
    );
  }
}

async function processRequest(req: NextRequest, requestId: string): Promise<NextResponse> {
  const requestStartedAt = performance.now();
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
  const fileABlob = formData.get("documentA");
  if (!(fileABlob instanceof File)) {
    return errorResponse(requestId, mode, "WRONG_FILE_COUNT", "documentA is required.");
  }

  let fileBBlob: File | null = null;
  if (validatedB) {
    const candidate = formData.get("documentB");
    if (!(candidate instanceof File)) {
      return errorResponse(requestId, mode, "WRONG_FILE_COUNT", "Compare mode requires documentB.");
    }
    fileBBlob = candidate;
  }

  const readStartedAt = performance.now();
  const [arrayBufferA, arrayBufferB] = await Promise.all([
    fileABlob.arrayBuffer(),
    fileBBlob ? fileBBlob.arrayBuffer() : Promise.resolve(null),
  ]);
  const readDuration = performance.now() - readStartedAt;
  const bufA = Buffer.from(arrayBufferA);
  const bufB = arrayBufferB ? Buffer.from(arrayBufferB) : null;

  const sigCheckA = verifySignature(bufA, validatedA.extension, fileABlob.type);
  if (!sigCheckA.ok) {
    return errorResponse(requestId, mode, sigCheckA.error.code, sigCheckA.error.message);
  }

  if (validatedB && fileBBlob && bufB) {
    const sigCheckB = verifySignature(bufB, validatedB.extension, fileBBlob.type);
    if (!sigCheckB.ok) {
      return errorResponse(requestId, mode, sigCheckB.error.code, sigCheckB.error.message);
    }
  }

  // ─── 3. Extract segments with deterministic anchors ────────────────────────
  const extractionStartedAt = performance.now();
  const [extractionA, extractionB] = await Promise.all([
    extractBuffer(bufA, validatedA.extension, "A"),
    bufB && validatedB
      ? extractBuffer(bufB, validatedB.extension, "B")
      : Promise.resolve(null),
  ]);
  const extractionDuration = performance.now() - extractionStartedAt;
  if (!extractionA.ok) {
    return errorResponse(requestId, mode, extractionA.error, safeExtractMessage(extractionA.error));
  }

  let segmentsB: Segment[] | null = null;
  let pageCountB: number | undefined;
  if (extractionB) {
    if (!extractionB.ok) {
      return errorResponse(requestId, mode, extractionB.error, safeExtractMessage(extractionB.error));
    }
    segmentsB = extractionB.segments;
    pageCountB = extractionB.pageCount;
  }

  const segmentsA = extractionA.segments;
  if (segmentsA.length > MAX_SEGMENTS_PER_DOCUMENT) {
    return errorResponse(
      requestId,
      mode,
      "DOCUMENT_TOO_LONG",
      "The document contains too many separate passages for the current processing limit. Please upload a shorter document or a subset of pages.",
    );
  }
  if (segmentsB && segmentsB.length > MAX_SEGMENTS_PER_DOCUMENT) {
    return errorResponse(
      requestId,
      mode,
      "DOCUMENT_TOO_LONG",
      "The documents contain too many separate passages for the current processing limit. Please upload shorter documents or a subset of pages.",
    );
  }
  const evidenceIndex: EvidenceIndex = new Map();
  for (const seg of segmentsA) evidenceIndex.set(seg.id, seg);
  if (segmentsB) for (const seg of segmentsB) evidenceIndex.set(seg.id, seg);

  // ─── 4. Token budget check ─────────────────────────────────────────────────
  const anchorIdsA = segmentsA.map((s) => s.id);
  const anchorIdsB = segmentsB?.map((s) => s.id) ?? [];
  const allAnchorIds = [...anchorIdsA, ...anchorIdsB];

  const systemPrompt = getSystemPrompt(mode, anchorIdsA, anchorIdsB);
  const estimatedTokens = estimateGroqInputTokens(
    mode,
    segmentsA,
    segmentsB,
    question,
    systemPrompt,
  );

  if (estimatedTokens > GROQ_MAX_INPUT_TOKENS) {
    return errorResponse(
      requestId,
      mode,
      "DOCUMENT_TOO_LONG",
      "The document is too long for the current processing limit. Please upload a shorter document or a subset of pages."
    );
  }

  // ─── 5. Call Groq primary ──────────────────────────────────────────────────
  const primaryStartedAt = performance.now();
  const groqResult = await callGroq(mode, segmentsA, segmentsB, question, systemPrompt);
  const primaryDuration = performance.now() - primaryStartedAt;
  if (!groqResult.ok) {
    return errorResponse(requestId, mode, groqResult.error, safeGroqMessage(groqResult.error));
  }

  // ─── 6. Validate schema + anchor allowlist ─────────────────────────────────
  let modeResult = groqResult.result;
  const actionPack = groqResult.actionPack;

  // Apply the fixed abstention before resolving anchors so a not_found answer
  // can never return stale evidence from model-supplied IDs.
  if (mode === "ask") {
    const askResult = modeResult as AskResult;
    if (askResult.status === "not_found") {
      modeResult = {
        ...askResult,
        answer: NOT_FOUND_ABSTENTION_TEXT,
        anchorIds: [],
      };
    }
  }

  const allUsedIds = collectAllAnchorIds(modeResult, actionPack, mode);
  const anchorValidation = validateAnchors(
    modeResult,
    allUsedIds,
    allAnchorIds,
    mode,
    anchorIdsA,
    anchorIdsB,
  );
  if (!anchorValidation.ok) {
    return errorResponse(requestId, mode, "MODEL_OUTPUT_INVALID", "The analysis result could not be verified and was withheld for your safety.");
  }

  // ─── 7. Resolve anchor IDs → canonical excerpts ────────────────────────────
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

  // ─── 8. Cloudflare verification ────────────────────────────────────────────
  const highImpactIds = selectHighImpactIds(modeResult, mode);
  const claimTexts = buildClaimTexts(modeResult, mode);
  const claimsToVerify = selectClaimsForVerification(resolvedAnchors, highImpactIds, claimTexts);
  const verifierStartedAt = performance.now();
  const cfResult = await callCloudflare(claimsToVerify);
  const verifierDuration = performance.now() - verifierStartedAt;

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
    headers: {
      ...securityHeaders(),
      "Server-Timing": formatServerTiming({
        read: readDuration,
        extract: extractionDuration,
        primary: primaryDuration,
        verify: verifierDuration,
        total: performance.now() - requestStartedAt,
      }),
    },
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

/** Validate that all anchor IDs in the model output exist in the allowlist. */
function validateAnchors(
  result: SimplifyResult | CompareResult | AskResult,
  usedIds: string[],
  allowedIds: string[],
  mode: Mode,
  allowedIdsA: string[] = [],
  allowedIdsB: string[] = [],
): { ok: boolean } {
  const allowed = new Set(allowedIds);
  for (const id of usedIds) {
    if (!allowed.has(id)) return { ok: false };
  }

  // Compare output has two independent evidence namespaces. A combined
  // allowlist is not enough: a model must not cite a B passage as the A-side
  // "before" evidence, or vice versa.
  if (mode === "compare") {
    const allowedA = new Set(allowedIdsA);
    const allowedB = new Set(allowedIdsB);
    for (const change of (result as CompareResult).changes) {
      if (change.anchorIdsA.some((id) => !allowedA.has(id))) return { ok: false };
      if (change.anchorIdsB.some((id) => !allowedB.has(id))) return { ok: false };
    }
  }

  return { ok: true };
}

function formatServerTiming(durations: Record<string, number>): string {
  return Object.entries(durations)
    .map(([name, duration]) => `${name};dur=${Math.max(0, duration).toFixed(1)}`)
    .join(", ");
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
      for (const dt of clause.definedTerms ?? []) ids.push(...(dt.anchorIds ?? []));
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
    // Verify changes that could materially affect money, timing, termination,
    // liability, indemnity, or governing-law language.
    const HIGH_IMPACT_RE = /\$|\b\d+[,.]?\d*\s*(usd|eur|gbp|month|mo\.?|year|yr\.?|day|week)\b|\b(payment|retainer|fee|deposit|salary|compensation|penalty|damages|liabilit|indemnif|cap|limit|venue|jurisdiction|governing\s+law)\b|\b\d+[-\s]day|\b(due|deadline|expir|terminat|notice|renew|surviv)/i;
    for (const change of r.changes ?? []) {
      const text = [change.after ?? "", change.before ?? "", change.whyReview ?? ""].join(" ");
      if (HIGH_IMPACT_RE.test(text)) {
        highImpact.push(...(change.anchorIdsA ?? []));
        highImpact.push(...(change.anchorIdsB ?? []));
      }
    }
  }
  // Ask mode: no Cloudflare verification (citations are validated, but entailment is not independently checked)

  return [...new Set(highImpact)].slice(0, 5);
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
  message: string,
  extraHeaders: Record<string, string> = {},
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
  return NextResponse.json(body, {
    status,
    headers: { ...securityHeaders(), ...extraHeaders },
  });
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

export function securityHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'",
  };
}
