/**
 * Groq primary analyzer adapter.
 * Pinned model: llama-3.3-70b-versatile (best free-tier Groq model).
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

export const GROQ_MODEL = "llama-3.3-70b-versatile";
/** Conservative token budget for the admitted document (free tier: 8K TPM) */
export const GROQ_MAX_INPUT_TOKENS = 6_000;
export const GROQ_MAX_OUTPUT_TOKENS = 4_096;

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

  const client = new Groq({ apiKey });

  // Build the user message: segments as labeled data
  const userMessage = buildUserMessage(mode, segments, segmentsB, question);

  // Token budget check
  const estimatedInput = estimateTokens(systemPrompt) + estimateTokens(userMessage);
  if (estimatedInput > GROQ_MAX_INPUT_TOKENS) {
    return { ok: false, error: "DOCUMENT_TOO_LONG", details: "Token budget exceeded before API call" };
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
      max_tokens: GROQ_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
    });

    rawContent = completion.choices[0]?.message?.content ?? "";

    if (!rawContent) {
      return { ok: false, error: "MODEL_REFUSAL" };
    }
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("429") || msg.includes("rate") || msg.includes("quota")) {
      return { ok: false, error: "PRIMARY_QUOTA_EXHAUSTED" };
    }
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      return { ok: false, error: "MODEL_TIMEOUT" };
    }
    return { ok: false, error: "PRIMARY_UNAVAILABLE", details: msg };
  }

  // Parse JSON — schema validation happens in the route handler
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return { ok: false, error: "MODEL_OUTPUT_INVALID", details: "JSON parse failed" };
  }

  // Extract mode result and action pack from the parsed object
  const obj = parsed as Record<string, unknown>;

  const result = obj.result as SimplifyResult | CompareResult | AskResult;
  const actionPack: ActionPack = (obj.actionPack as ActionPack) ?? {
    checklist: [],
    lawyerQuestions: [],
  };

  if (!result) {
    return { ok: false, error: "MODEL_OUTPUT_INVALID", details: "Missing result field" };
  }

  return { ok: true, result, actionPack, model: GROQ_MODEL };
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
    parts.push(
      `[${seg.id}] ${seg.locator}${seg.heading ? ` | ${seg.heading}` : ""}\n${seg.text}`
    );
  }

  if (segmentsB && segmentsB.length > 0) {
    parts.push("\n=== DOCUMENT B SEGMENTS (untrusted data) ===");
    for (const seg of segmentsB) {
      parts.push(
        `[${seg.id}] ${seg.locator}${seg.heading ? ` | ${seg.heading}` : ""}\n${seg.text}`
      );
    }
  }

  if (mode === "ask" && question) {
    parts.push(`\n=== USER QUESTION (untrusted data) ===\n${question}`);
  }

  return parts.join("\n\n");
}
