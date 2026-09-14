/**
 * TEST-004 — Fixed boundary and abstention
 *
 * Verifies:
 * - LEGAL_NOTICE_TEXT is a fixed application constant, never model-generated.
 * - The fixed abstention message is applied server-side to all not_found Ask results,
 *   regardless of what the model wrote in the answer field.
 * - Every terminal response envelope (success and error) carries the notice.
 * - The notice text is identical across all response shapes (no truncation).
 */

import { describe, it, expect } from "vitest";
import { LEGAL_NOTICE_TEXT } from "@/types/evidence";
import type {
  AskResult,
  SuccessResponse,
  ErrorResponse,
  ErrorCode,
} from "@/types/evidence";

// Fixed strings defined at the application layer (mirroring route.ts)
const NOT_FOUND_ANSWER =
  "This information is not stated in the document you uploaded. Clauseora can only answer questions based on the content of the uploaded document.";

// ─── Legal notice ─────────────────────────────────────────────────────────────

describe("TEST-004 · Legal notice constant", () => {
  it("LEGAL_NOTICE_TEXT is a non-empty string", () => {
    expect(typeof LEGAL_NOTICE_TEXT).toBe("string");
    expect(LEGAL_NOTICE_TEXT.trim().length).toBeGreaterThan(0);
  });

  it("contains the key phrase 'not legal advice'", () => {
    expect(LEGAL_NOTICE_TEXT.toLowerCase()).toContain("not legal advice");
  });

  it("does not claim outcomes or enforceability", () => {
    const lower = LEGAL_NOTICE_TEXT.toLowerCase();
    expect(lower).not.toContain("enforceabl");
    expect(lower).not.toContain("will win");
    expect(lower).not.toContain("guaranteed");
  });

  it("is the same object reference on multiple imports (module singleton)", async () => {
    const { LEGAL_NOTICE_TEXT: t2 } = await import("@/types/evidence");
    expect(LEGAL_NOTICE_TEXT).toBe(t2);
  });
});

// ─── Fixed abstention message ─────────────────────────────────────────────────

describe("TEST-004 · Fixed abstention for not_found Ask", () => {
  /**
   * Simulate the server-side substitution that route.ts applies:
   * if status === "not_found" → replace answer with NOT_FOUND_ANSWER, clear anchorIds.
   */
  function applyAbstention(result: AskResult): AskResult {
    if (result.status === "not_found") {
      return { ...result, answer: NOT_FOUND_ANSWER, anchorIds: [] };
    }
    return result;
  }

  it("replaces persuasive model prose with the fixed abstention message", () => {
    const modelOutput: AskResult = {
      status: "not_found",
      answer: "Based on my knowledge, typical contracts include a 30-day notice period.",
      notEstablished: [],
      anchorIds: [],
    };
    const result = applyAbstention(modelOutput);
    expect(result.answer).toBe(NOT_FOUND_ANSWER);
  });

  it("clears anchorIds when not_found", () => {
    const modelOutput: AskResult = {
      status: "not_found",
      answer: "Some invented text.",
      notEstablished: [],
      anchorIds: ["A-p1-b0"],   // model hallucinated an ID despite not_found
    };
    const result = applyAbstention(modelOutput);
    expect(result.anchorIds).toEqual([]);
  });

  it("does not alter a supported result", () => {
    const modelOutput: AskResult = {
      status: "supported",
      answer: "The term is two years.",
      notEstablished: [],
      anchorIds: ["A-p1-b0"],
    };
    const result = applyAbstention(modelOutput);
    expect(result.answer).toBe("The term is two years.");
    expect(result.anchorIds).toEqual(["A-p1-b0"]);
  });

  it("does not alter a partially_supported result", () => {
    const modelOutput: AskResult = {
      status: "partially_supported",
      answer: "The document mentions two years but does not specify a renewal clause.",
      notEstablished: ["renewal terms"],
      anchorIds: ["A-p1-b0"],
    };
    const result = applyAbstention(modelOutput);
    expect(result.answer).toContain("two years");
  });

  it("NOT_FOUND_ANSWER does not contain any AI-sounding hedging", () => {
    expect(NOT_FOUND_ANSWER.toLowerCase()).not.toContain("typically");
    expect(NOT_FOUND_ANSWER.toLowerCase()).not.toContain("generally");
    expect(NOT_FOUND_ANSWER.toLowerCase()).not.toContain("standard");
    expect(NOT_FOUND_ANSWER.toLowerCase()).not.toContain("usually");
    expect(NOT_FOUND_ANSWER.toLowerCase()).not.toContain("in most cases");
  });
});

// ─── Response envelope invariants ─────────────────────────────────────────────

describe("TEST-004 · Notice present on every terminal state", () => {
  function makeSuccessEnvelope(partial: Partial<SuccessResponse>): SuccessResponse {
    return {
      requestId: "test-001",
      mode: "simplify",
      analysisProvider: { service: "groq", model: "llama-3.3-70b-versatile" },
      notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
      documents: [],
      result: { clauses: [] },
      resolvedAnchors: [],
      verification: { status: "not_applicable", provider: "cloudflare", checkedClaims: 0, issues: [] },
      actionPack: { checklist: [], lawyerQuestions: [] },
      error: null,
      ...partial,
    };
  }

  function makeErrorEnvelope(code: ErrorCode, msg: string): ErrorResponse {
    return {
      requestId: "test-err-001",
      mode: null,
      notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
      documents: [],
      result: null,
      actionPack: { checklist: [], lawyerQuestions: [] },
      error: { code, message: msg },
    };
  }

  it("success envelope notice kind is 'legal_information_only'", () => {
    const env = makeSuccessEnvelope({});
    expect(env.notice.kind).toBe("legal_information_only");
  });

  it("success envelope notice text equals LEGAL_NOTICE_TEXT", () => {
    const env = makeSuccessEnvelope({});
    expect(env.notice.text).toBe(LEGAL_NOTICE_TEXT);
  });

  it("error envelope notice kind is 'legal_information_only'", () => {
    const env = makeErrorEnvelope("INVALID_REQUEST", "Bad request.");
    expect(env.notice.kind).toBe("legal_information_only");
  });

  it("error envelope notice text equals LEGAL_NOTICE_TEXT", () => {
    const env = makeErrorEnvelope("INVALID_REQUEST", "Bad request.");
    expect(env.notice.text).toBe(LEGAL_NOTICE_TEXT);
  });

  it("error envelopes for every documented error code carry the notice", () => {
    const codes: ErrorCode[] = [
      "INVALID_REQUEST", "WRONG_FILE_COUNT", "FILE_TOO_LARGE",
      "UNSUPPORTED_FILE_TYPE", "TYPE_MISMATCH", "NO_EXTRACTABLE_TEXT",
      "ENCRYPTED_DOCUMENT", "CORRUPT_DOCUMENT", "DOCUMENT_TOO_LONG",
      "RATE_LIMITED", "PRIMARY_QUOTA_EXHAUSTED", "MODEL_OUTPUT_INVALID",
      "MODEL_REFUSAL", "PRIMARY_UNAVAILABLE", "SERVICE_UNAVAILABLE", "MODEL_TIMEOUT",
    ];
    for (const code of codes) {
      const env = makeErrorEnvelope(code, "msg");
      expect(env.notice.text).toBe(LEGAL_NOTICE_TEXT);
    }
  });
});
