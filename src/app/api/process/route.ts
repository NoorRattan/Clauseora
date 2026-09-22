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
  type AskResult,
  type ActionPack,
  type SuccessResponse,
  type ErrorResponse,
  type ErrorCode,
} from "@/types/evidence";

import { MAX_FILE_BYTES, validateRequest, verifySignature } from "@/lib/validator";
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
import { buildClaimTexts } from "@/lib/verification-claims";
import { PiiTokenVault } from "@/lib/pii-tokenizer";
import { checkRateLimit, isSameOriginRequest } from "@/lib/request-security";
import {
  collectAllAnchorIds,
  extractBuffer,
  formatServerTiming,
  getSystemPrompt,
  safeExtractMessage,
  safeGroqMessage,
  selectHighImpactIds,
  validateAnchors,
} from "@/lib/process-pipeline";

const EMPTY_ACTION_PACK: ActionPack = { checklist: [], lawyerQuestions: [] };
const MAX_MULTIPART_REQUEST_BYTES = MAX_FILE_BYTES * 2 + 512 * 1024;

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
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const normalizedContentLength = contentLengthHeader.trim();
    if (!/^\d+$/.test(normalizedContentLength)) {
      return errorResponse(requestId, null, "INVALID_REQUEST", "Invalid request length.");
    }
    const contentLength = Number(normalizedContentLength);
    if (!Number.isSafeInteger(contentLength)) {
      return errorResponse(requestId, null, "INVALID_REQUEST", "Invalid request length.");
    }
    if (contentLength > MAX_MULTIPART_REQUEST_BYTES) {
      return errorResponse(
        requestId,
        null,
        "FILE_TOO_LARGE",
        "The uploaded request exceeds the 8 MB per-document limit.",
      );
    }
  }
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

  // ─── 4. Protect direct identifiers before any provider boundary ───────────
  // Anchor IDs and the evidence index remain based on the original text. Only
  // provider payload copies are protected; the final evidence drawer still
  // shows the canonical source passage the user uploaded.
  const piiVault = new PiiTokenVault();
  const providerSegmentsA = piiVault.protectSegments(segmentsA);
  const providerSegmentsB = segmentsB ? piiVault.protectSegments(segmentsB) : null;
  const providerQuestion = question ? piiVault.protectText(question) : question;

  // ─── 5. Token budget check ─────────────────────────────────────────────────
  const anchorIdsA = segmentsA.map((s) => s.id);
  const anchorIdsB = segmentsB?.map((s) => s.id) ?? [];
  const allAnchorIds = [...anchorIdsA, ...anchorIdsB];

  const systemPrompt = getSystemPrompt(mode, anchorIdsA, anchorIdsB);
  const estimatedTokens = estimateGroqInputTokens(
    mode,
    providerSegmentsA,
    providerSegmentsB,
    providerQuestion,
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

  // ─── 6. Call Groq primary ──────────────────────────────────────────────────
  const primaryStartedAt = performance.now();
  const groqResult = await callGroq(
    mode,
    providerSegmentsA,
    providerSegmentsB,
    providerQuestion,
    systemPrompt,
  );
  const primaryDuration = performance.now() - primaryStartedAt;
  if (!groqResult.ok) {
    return errorResponse(requestId, mode, groqResult.error, safeGroqMessage(groqResult.error));
  }

  // ─── 7. Restore only ordinary model text; evidence remains server-owned ───
  let modeResult = piiVault.restoreValue(groqResult.result);
  const actionPack = piiVault.restoreValue(groqResult.actionPack);

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

  // ─── 8. Resolve anchor IDs → canonical excerpts ────────────────────────────
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

  // ─── 9. Cloudflare verification ────────────────────────────────────────────
  const highImpactIds = selectHighImpactIds(modeResult, mode);
  const claimTexts = buildClaimTexts(modeResult, mode);
  const claimsToVerify = selectClaimsForVerification(resolvedAnchors, highImpactIds, claimTexts);
  const providerClaims = claimsToVerify.map((claim) => ({
    ...claim,
    claimText: piiVault.protectText(claim.claimText),
    excerpts: claim.excerpts.map((excerpt) => piiVault.protectText(excerpt)),
  }));
  const verifierStartedAt = performance.now();
  const cfResult = await callCloudflare(providerClaims);
  const verifierDuration = performance.now() - verifierStartedAt;

  // ─── 10. Derive verification status ───────────────────────────────────────
  const verification = deriveVerification(cfResult);

  // ─── 11. Return safe response ──────────────────────────────────────────────
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-DNS-Prefetch-Control": "off",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'",
  };
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }
  return headers;
}
