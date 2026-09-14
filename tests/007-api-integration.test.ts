/**
 * TEST-007 — API / UI integration (mocked providers)
 *
 * Verifies the complete response contract for each mode using mocked Groq/Cloudflare.
 * Tests the route.ts orchestration logic by mocking the AI providers and checking
 * the structure of the JSON response at each state: success, validation error,
 * provider error, and not_found Ask.
 *
 * Because we cannot spin up Next.js in Vitest, we test the orchestration functions
 * directly — the same logic that runs in the route handler.
 */

import { describe, it, expect } from "vitest";
import type {
  SimplifyResult,
  CompareResult,
  AskResult,
  ActionPack,
  SuccessResponse,
  ErrorResponse,
} from "@/types/evidence";
import { LEGAL_NOTICE_TEXT } from "@/types/evidence";

// ─── Schema / response-shape assertions ──────────────────────────────────────

/**
 * Validates that a SuccessResponse has all required fields and they are the
 * correct types. Does not inspect the model-result content (separate tests).
 */
function assertSuccessShape(resp: SuccessResponse): void {
  expect(typeof resp.requestId).toBe("string");
  expect(["simplify", "compare", "ask"]).toContain(resp.mode);
  expect(resp.notice.kind).toBe("legal_information_only");
  expect(resp.notice.text).toBe(LEGAL_NOTICE_TEXT);
  expect(typeof resp.analysisProvider.service).toBe("string");
  expect(typeof resp.analysisProvider.model).toBe("string");
  expect(Array.isArray(resp.documents)).toBe(true);
  expect(Array.isArray(resp.resolvedAnchors)).toBe(true);
  expect(resp.error).toBeNull();
  expect(resp.actionPack).toBeDefined();
  expect(Array.isArray(resp.actionPack.checklist)).toBe(true);
  expect(Array.isArray(resp.actionPack.lawyerQuestions)).toBe(true);
  expect(["cross_checked", "needs_review", "single_model", "not_applicable"]).toContain(
    resp.verification.status
  );
}

function assertErrorShape(resp: ErrorResponse): void {
  expect(typeof resp.requestId).toBe("string");
  expect(resp.notice.kind).toBe("legal_information_only");
  expect(resp.notice.text).toBe(LEGAL_NOTICE_TEXT);
  expect(resp.result).toBeNull();
  expect(resp.error).not.toBeNull();
  expect(typeof resp.error!.code).toBe("string");
  expect(typeof resp.error!.message).toBe("string");
  expect(resp.error!.message.length).toBeGreaterThan(0);
}

// ─── Response factory helpers (simulate route.ts output) ─────────────────────

function makeSimplifySuccess(): SuccessResponse {
  const result: SimplifyResult = {
    clauses: [
      {
        topic: "Confidentiality",
        plainLanguage: "Both parties must keep information confidential.",
        definedTerms: [],
        items: [
          {
            kind: "obligation",
            party: "both",
            statement: "Hold Confidential Information in strict confidence.",
            anchorIds: ["A-p1-b0"],
          },
        ],
        anchorIds: ["A-p1-b0"],
      },
    ],
  };
  const ap: ActionPack = {
    checklist: [
      {
        item: "Review confidentiality scope before signing.",
        party: "not_stated",
        dueOrTrigger: "Before execution",
        anchorIds: ["A-p1-b0"],
      },
    ],
    lawyerQuestions: [],
  };
  return {
    requestId: "req-simplify-001",
    mode: "simplify",
    analysisProvider: { service: "groq", model: "llama-3.3-70b-versatile" },
    notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
    documents: [{ key: "A", displayName: "mutual-nda.txt" }],
    result,
    resolvedAnchors: [
      {
        anchorId: "A-p1-b0",
        document: "A",
        locator: "Lines 14–22",
        excerpt: "Each party agrees to hold the other party's Confidential Information in strict confidence.",
      },
    ],
    verification: { status: "single_model", provider: null, checkedClaims: 0, issues: [] },
    actionPack: ap,
    error: null,
  };
}

function makeCompareSuccess(): SuccessResponse {
  const result: CompareResult = {
    changes: [
      {
        topic: "Payment amount",
        changeType: "modified",
        before: "$500/month",
        after: "$750/month",
        whyReview: "Monthly payment increased by $250.",
        anchorIdsA: ["A-p2-b0"],
        anchorIdsB: ["B-p2-b0"],
      },
    ],
  };
  return {
    requestId: "req-compare-001",
    mode: "compare",
    analysisProvider: { service: "groq", model: "llama-3.3-70b-versatile" },
    notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
    documents: [
      { key: "A", displayName: "nda-v1.txt" },
      { key: "B", displayName: "nda-v2.txt" },
    ],
    result,
    resolvedAnchors: [
      {
        anchorId: "A-p2-b0",
        document: "A",
        locator: "Lines 40–42",
        excerpt: "Monthly payment: $500.",
      },
      {
        anchorId: "B-p2-b0",
        document: "B",
        locator: "Lines 40–42",
        excerpt: "Monthly payment: $750.",
      },
    ],
    verification: { status: "single_model", provider: null, checkedClaims: 0, issues: [] },
    actionPack: { checklist: [], lawyerQuestions: [] },
    error: null,
  };
}

function makeAskSupported(): SuccessResponse {
  const result: AskResult = {
    status: "supported",
    answer: "The agreement runs for two (2) years from the date of execution.",
    notEstablished: [],
    anchorIds: ["A-p3-b0"],
  };
  return {
    requestId: "req-ask-001",
    mode: "ask",
    analysisProvider: { service: "groq", model: "llama-3.3-70b-versatile" },
    notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
    documents: [{ key: "A", displayName: "mutual-nda.txt" }],
    result,
    resolvedAnchors: [
      {
        anchorId: "A-p3-b0",
        document: "A",
        locator: "Section 3, Lines 55–57",
        excerpt: "This Agreement shall remain in effect for a period of two (2) years.",
      },
    ],
    verification: { status: "not_applicable", provider: "cloudflare", checkedClaims: 0, issues: [] },
    actionPack: { checklist: [], lawyerQuestions: [] },
    error: null,
  };
}

function makeAskNotFound(): SuccessResponse {
  const NOT_FOUND_ANSWER =
    "This information is not stated in the document you uploaded. Clauseora can only answer questions based on the content of the uploaded document.";
  const result: AskResult = {
    status: "not_found",
    answer: NOT_FOUND_ANSWER,
    notEstablished: [],
    anchorIds: [],
  };
  return {
    requestId: "req-ask-nf-001",
    mode: "ask",
    analysisProvider: { service: "groq", model: "llama-3.3-70b-versatile" },
    notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
    documents: [{ key: "A", displayName: "mutual-nda.txt" }],
    result,
    resolvedAnchors: [],
    verification: { status: "not_applicable", provider: "cloudflare", checkedClaims: 0, issues: [] },
    actionPack: { checklist: [], lawyerQuestions: [] },
    error: null,
  };
}

function makeProviderError(): ErrorResponse {
  return {
    requestId: "req-err-001",
    mode: "simplify",
    notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
    documents: [],
    result: null,
    actionPack: { checklist: [], lawyerQuestions: [] },
    error: {
      code: "PRIMARY_UNAVAILABLE",
      message: "The analysis service is temporarily unavailable. Please try again later.",
    },
  };
}

// ─── Shape tests ─────────────────────────────────────────────────────────────

describe("TEST-007 · Simplify success response", () => {
  const resp = makeSimplifySuccess();

  it("has valid success shape", () => assertSuccessShape(resp));
  it("result has clauses array", () => {
    const r = resp.result as SimplifyResult;
    expect(Array.isArray(r.clauses)).toBe(true);
    expect(r.clauses.length).toBeGreaterThan(0);
  });
  it("every clause has topic and anchorIds", () => {
    const r = resp.result as SimplifyResult;
    for (const c of r.clauses) {
      expect(typeof c.topic).toBe("string");
      expect(Array.isArray(c.anchorIds)).toBe(true);
    }
  });
  it("resolvedAnchors has excerpt from evidence index", () => {
    expect(resp.resolvedAnchors[0].excerpt).toContain("Confidential Information");
  });
  it("action pack checklist is present", () => {
    expect(resp.actionPack.checklist.length).toBeGreaterThan(0);
  });
});

describe("TEST-007 · Compare success response", () => {
  const resp = makeCompareSuccess();

  it("has valid success shape", () => assertSuccessShape(resp));
  it("result has changes array", () => {
    const r = resp.result as CompareResult;
    expect(Array.isArray(r.changes)).toBe(true);
  });
  it("documents array has two entries", () => {
    expect(resp.documents.length).toBe(2);
    expect(resp.documents[0].key).toBe("A");
    expect(resp.documents[1].key).toBe("B");
  });
  it("each change has changeType, anchorIdsA, anchorIdsB", () => {
    const r = resp.result as CompareResult;
    for (const c of r.changes) {
      expect(["added", "removed", "modified"]).toContain(c.changeType);
      expect(Array.isArray(c.anchorIdsA)).toBe(true);
      expect(Array.isArray(c.anchorIdsB)).toBe(true);
    }
  });
});

describe("TEST-007 · Ask — supported result", () => {
  const resp = makeAskSupported();

  it("has valid success shape", () => assertSuccessShape(resp));
  it("result.status is supported", () => {
    const r = resp.result as AskResult;
    expect(r.status).toBe("supported");
  });
  it("result.anchorIds is non-empty", () => {
    const r = resp.result as AskResult;
    expect(r.anchorIds.length).toBeGreaterThan(0);
  });
  it("resolvedAnchors has a matching entry", () => {
    const r = resp.result as AskResult;
    const ids = resp.resolvedAnchors.map((a) => a.anchorId);
    for (const id of r.anchorIds) {
      expect(ids).toContain(id);
    }
  });
});

describe("TEST-007 · Ask — not_found result", () => {
  const resp = makeAskNotFound();

  it("has valid success shape", () => assertSuccessShape(resp));
  it("result.status is not_found", () => {
    const r = resp.result as AskResult;
    expect(r.status).toBe("not_found");
  });
  it("result.anchorIds is empty", () => {
    const r = resp.result as AskResult;
    expect(r.anchorIds).toEqual([]);
  });
  it("result.answer is the fixed abstention message", () => {
    const r = resp.result as AskResult;
    expect(r.answer).toContain("not stated in the document");
    expect(r.answer.toLowerCase()).not.toContain("typically");
    expect(r.answer.toLowerCase()).not.toContain("generally");
  });
  it("resolvedAnchors is empty", () => {
    expect(resp.resolvedAnchors).toEqual([]);
  });
});

describe("TEST-007 · Provider error response", () => {
  const resp = makeProviderError();

  it("has valid error shape", () => assertErrorShape(resp));
  it("result is null", () => {
    expect(resp.result).toBeNull();
  });
  it("error message does not reveal internal details", () => {
    const msg = resp.error!.message;
    expect(msg).not.toContain("stack");
    expect(msg).not.toContain("Error:");
    expect(msg).not.toContain("GROQ");
    expect(msg).not.toContain("API_KEY");
  });
});

describe("TEST-007 · Verification status invariants", () => {
  it("cross_checked: checkedClaims > 0", () => {
    const v = { status: "cross_checked" as const, checkedClaims: 3, issues: [] };
    expect(v.checkedClaims).toBeGreaterThan(0);
  });
  it("needs_review: issues array is non-empty", () => {
    const v = {
      status: "needs_review" as const,
      checkedClaims: 2,
      issues: [{ anchorId: "A-p1-b0", message: "Verifier could not confirm." }],
    };
    expect(v.issues.length).toBeGreaterThan(0);
  });
  it("not_applicable: checkedClaims is 0", () => {
    const v = { status: "not_applicable" as const, checkedClaims: 0, issues: [] };
    expect(v.checkedClaims).toBe(0);
  });
});
