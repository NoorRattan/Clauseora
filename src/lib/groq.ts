/**
 * Groq primary analyzer adapter.
 * Default model: openai/gpt-oss-120b. Override with GROQ_MODEL when needed.
 * Tools are disabled. Temperature = 0 for reproducibility.
 * Strict JSON schema mode constrains the output shape.
 */

import Groq from "groq-sdk";
import type {
  Mode,
  Segment,
  SimplifyResult,
  CompareResult,
  AskResult,
  ActionPack,
} from "@/types/evidence";
import {
  actionPackSchema,
  askResponseSchema,
  compareResponseSchema,
  simplifyResponseSchema,
} from "@/lib/schemas";
import { CircuitBreaker } from "@/lib/circuit-breaker";

export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
/** Conservative token budget for the admitted document (free tier: 8K TPM) */
export const GROQ_MAX_INPUT_TOKENS = 6_000;
export const GROQ_MAX_OUTPUT_TOKENS = 4_096;
/** Keep the configured input + output ceiling below the documented 8K TPM tier. */
export const GROQ_MAX_TOTAL_TOKENS = 7_600;
export const GROQ_MIN_OUTPUT_TOKENS = 512;
export const GROQ_TIMEOUT_MS = 30_000;

const groqCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 30_000,
});

/** Rough character-to-token estimate (conservative: 3 chars per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export type GroqSuccess = {
  ok: true;
  result: SimplifyResult | CompareResult | AskResult;
  actionPack: ActionPack;
  model: string;
};
export type GroqError = {
  ok: false;
  error:
    | "MODEL_OUTPUT_INVALID"
    | "MODEL_REFUSAL"
    | "PRIMARY_QUOTA_EXHAUSTED"
    | "MODEL_TIMEOUT"
    | "PRIMARY_UNAVAILABLE"
    | "DOCUMENT_TOO_LONG";
  details?: string; // only for server logs, never exposed to client
};

export type GroqResult = GroqSuccess | GroqError;

/**
 * Call Groq with the appropriate mode prompt and segments.
 * Returns a typed result; never throws.
 */
export async function callGroq(
  mode: Mode,
  segments: Segment[],
  segmentsB: Segment[] | null,
  question: string | undefined,
  systemPrompt: string
): Promise<GroqResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "PRIMARY_UNAVAILABLE", details: "GROQ_API_KEY not set" };
  }
  // A single bounded attempt keeps the route inside its serverless deadline
  // and avoids silently duplicating a paid/provider request on retry.
  const client = new Groq({
    apiKey,
    timeout: GROQ_TIMEOUT_MS,
    maxRetries: 0,
  });

  // Build the user message: segments as labeled data
  const userMessage = buildUserMessage(mode, segments, segmentsB, question);

  // Token budget check
  const estimatedInput = estimateTokens(systemPrompt) + estimateTokens(userMessage);
  if (estimatedInput > GROQ_MAX_INPUT_TOKENS) {
    return { ok: false, error: "DOCUMENT_TOO_LONG", details: "Token budget exceeded before API call" };
  }
  const maxOutputTokens = getGroqOutputTokenBudget(estimatedInput);
  if (maxOutputTokens < GROQ_MIN_OUTPUT_TOKENS) {
    return { ok: false, error: "DOCUMENT_TOO_LONG", details: "Insufficient output budget" };
  }
  if (!groqCircuitBreaker.canRequest()) {
    return { ok: false, error: "PRIMARY_UNAVAILABLE", details: "provider circuit open" };
  }

  let rawContent: string;
  try {
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
      max_tokens: maxOutputTokens,
      response_format: { type: "json_object" },
    });

    rawContent = completion.choices[0]?.message?.content ?? "";
    groqCircuitBreaker.recordSuccess();

    if (!rawContent) {
      return { ok: false, error: "MODEL_REFUSAL" };
    }
  } catch (err: unknown) {
    const errorText = getErrorText(err);
    if (isTransientProviderError(err, errorText)) {
      groqCircuitBreaker.recordFailure();
    } else {
      // A non-transient provider response proves the endpoint is reachable;
      // it must not keep a half-open probe occupied.
      groqCircuitBreaker.recordSuccess();
    }
    if (isRateLimitError(err, errorText)) {
      return { ok: false, error: "PRIMARY_QUOTA_EXHAUSTED" };
    }
    if (isTimeoutError(err, errorText)) {
      return { ok: false, error: "MODEL_TIMEOUT" };
    }
    // Do not retain or expose provider bodies: they can contain request
    // metadata and are not needed to render the safe client error.
    return { ok: false, error: "PRIMARY_UNAVAILABLE", details: "provider request failed" };
  }

  // Parse JSON, then validate the schema and evidence invariants before the
  // result can reach the route handler.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return { ok: false, error: "MODEL_OUTPUT_INVALID", details: "JSON parse failed" };
  }

  const validated = validateModelOutput(mode, parsed);
  if (!validated.ok) {
    return { ok: false, error: "MODEL_OUTPUT_INVALID", details: validated.reason };
  }

  return {
    ok: true,
    result: validated.result,
    actionPack: validated.actionPack,
    model: GROQ_MODEL,
  };
}

// ─── User message construction ────────────────────────────────────────────────

function buildUserMessage(
  mode: Mode,
  segmentsA: Segment[],
  segmentsB: Segment[] | null,
  question: string | undefined
): string {
  const parts: string[] = [];

  parts.push("=== DOCUMENT A SEGMENTS (untrusted data) ===");
  for (const seg of segmentsA) {
    // The system prompt already carries the complete allowlist. Keep the
    // request payload limited to the ID needed for citation plus source text.
    parts.push(`[${seg.id}]\n${seg.text}`);
  }

  if (segmentsB && segmentsB.length > 0) {
    parts.push("\n=== DOCUMENT B SEGMENTS (untrusted data) ===");
    for (const seg of segmentsB) {
      parts.push(`[${seg.id}]\n${seg.text}`);
    }
  }

  if (mode === "ask" && question) {
    parts.push(`\n=== USER QUESTION (untrusted data) ===\n${question}`);
  }

  return parts.join("\n\n");
}

export function getGroqOutputTokenBudget(estimatedInputTokens: number): number {
  return Math.min(
    GROQ_MAX_OUTPUT_TOKENS,
    Math.max(0, GROQ_MAX_TOTAL_TOKENS - estimatedInputTokens),
  );
}

/** Estimate the exact prompt shape used by callGroq before making the request. */
export function estimateGroqInputTokens(
  mode: Mode,
  segmentsA: Segment[],
  segmentsB: Segment[] | null,
  question: string | undefined,
  systemPrompt: string,
): number {
  return estimateTokens(systemPrompt) + estimateTokens(
    buildUserMessage(mode, segmentsA, segmentsB, question),
  );
}

type ValidatedModelOutput = {
  ok: true;
  result: SimplifyResult | CompareResult | AskResult;
  actionPack: ActionPack;
};

type InvalidModelOutput = {
  ok: false;
  reason: string;
};

/**
 * Validate both the JSON shape and the cross-field invariants that a schema
 * alone cannot express (for example, Compare added vs. removed anchors).
 */
export function validateModelOutput(
  mode: Mode,
  parsed: unknown,
): ValidatedModelOutput | InvalidModelOutput {
  if (!isRecord(parsed)) return invalid("top-level output is not an object");

  const actionPack = actionPackSchema.safeParse(parsed.actionPack ?? {
    checklist: [],
    lawyerQuestions: [],
  });
  if (!actionPack.success) return invalid("action pack schema failed");

  if (mode === "simplify") {
    const result = simplifyResponseSchema.safeParse(parsed.result);
    if (!result.success || !isValidSimplifyResult(result.data)) {
      return invalid("simplify schema or evidence invariant failed");
    }
    return {
      ok: true,
      result: result.data as SimplifyResult,
      actionPack: actionPack.data,
    };
  }

  if (mode === "compare") {
    const result = compareResponseSchema.safeParse(parsed.result);
    if (!result.success || !isValidCompareResult(result.data)) {
      return invalid("compare schema or change invariant failed");
    }
    return {
      ok: true,
      result: {
        ...result.data,
        changes: result.data.changes.map((change) => ({
          ...change,
          before: change.before ?? null,
          after: change.after ?? null,
        })),
      } as CompareResult,
      actionPack: actionPack.data,
    };
  }

  const result = askResponseSchema.safeParse(parsed.result);
  if (!result.success) return invalid("ask schema failed");

  const citationIds = result.data.citations?.map((citation) => citation.anchorId) ?? [];
  if (
    result.data.anchorIds.length > 0 &&
    citationIds.some((anchorId) => !result.data.anchorIds.includes(anchorId))
  ) {
    return invalid("Ask anchorIds and citations disagree");
  }
  const anchorIds = dedupe(result.data.anchorIds.length ? result.data.anchorIds : citationIds);
  const normalizedAsk: AskResult = {
    status: result.data.status,
    answer: result.data.answer,
    notEstablished: result.data.notEstablished,
    anchorIds,
    citations: result.data.citations,
    confidence: result.data.confidence,
  };

  if (
    (normalizedAsk.status === "supported" || normalizedAsk.status === "partially_supported") &&
    normalizedAsk.anchorIds.length === 0
  ) {
    return invalid("supported Ask result has no evidence anchors");
  }
  if (
    normalizedAsk.status === "partially_supported" &&
    normalizedAsk.notEstablished.length === 0
  ) {
    return invalid("partially supported Ask result has no not-established facts");
  }
  if (normalizedAsk.status === "not_found" && (anchorIds.length > 0 || citationIds.length > 0)) {
    return invalid("not-found Ask result contains evidence anchors");
  }

  return { ok: true, result: normalizedAsk, actionPack: actionPack.data };
}

function isValidSimplifyResult(result: { clauses: Array<{
  anchorIds: string[];
  items: Array<{ anchorIds: string[] }>;
  definedTerms: Array<{ anchorIds?: string[] }>;
}>}): boolean {
  return result.clauses.every((clause) =>
    clause.anchorIds.length > 0 &&
    clause.items.every((item) => item.anchorIds.length > 0) &&
    clause.definedTerms.every((term) => (term.anchorIds?.length ?? 0) > 0),
  );
}

function isValidCompareResult(result: {
  changes: Array<{
    changeType: "added" | "removed" | "modified";
    before?: string | null;
    after?: string | null;
    anchorIdsA: string[];
    anchorIdsB: string[];
  }>;
}): boolean {
  return result.changes.every((change) => {
    if (change.changeType === "modified") {
      return (
        change.anchorIdsA.length > 0 &&
        change.anchorIdsB.length > 0 &&
        change.before != null &&
        change.after != null
      );
    }
    if (change.changeType === "added") {
      return (
        change.anchorIdsA.length === 0 &&
        change.anchorIdsB.length > 0 &&
        change.before == null &&
        change.after != null
      );
    }
    return (
      change.anchorIdsA.length > 0 &&
      change.anchorIdsB.length === 0 &&
      change.before != null &&
      change.after == null
    );
  });
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(reason: string): InvalidModelOutput {
  return { ok: false, reason };
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error).toLowerCase();
}

function isRateLimitError(error: unknown, errorText: string): boolean {
  const status = isRecord(error) && typeof error.status === "number" ? error.status : undefined;
  return status === 429 || /\b(429|rate limit|rate_limit|quota)\b/i.test(errorText);
}

function isTimeoutError(error: unknown, errorText: string): boolean {
  const name = isRecord(error) && typeof error.name === "string" ? error.name : "";
  return /timeout|timedout|etimedout|abort/i.test(`${name} ${errorText}`);
}

function isTransientProviderError(error: unknown, errorText: string): boolean {
  const status = isRecord(error) && typeof error.status === "number" ? error.status : undefined;
  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) return true;
  if (isTimeoutError(error, errorText)) return true;
  if (status === undefined) {
    return /network|fetch|socket|connection|econn|unavailable/i.test(errorText);
  }
  return false;
}
