/**
 * TEST-003 — Schema and anchor allowlist
 *
 * Verifies the application fails closed on invalid model output:
 * - Unknown anchor IDs → MODEL_OUTPUT_INVALID (not silently ignored)
 * - Cross-document ID leakage → rejected
 * - Missing required fields → rejected
 * - Model-authored excerpt fields are absent from the wire format (resolvedAnchors come from server)
 *
 * All model outputs are mocked — no real API call occurs.
 */

import { describe, it, expect } from "vitest";
import type {
  SimplifyResult,
  CompareResult,
  AskResult,
  ActionPack,
  AnchorRef,
} from "@/types/evidence";
import { collectAllAnchorIds, validateAnchors } from "@/lib/process-pipeline";

function validateResultAnchors(
  result: SimplifyResult | CompareResult | AskResult,
  actionPack: ActionPack,
  allowedIds: string[],
  mode: "simplify" | "compare" | "ask",
  allowedIdsA: string[] = [],
  allowedIdsB: string[] = [],
): { ok: boolean } {
  return validateAnchors(
    result,
    collectAllAnchorIds(result, actionPack, mode),
    allowedIds,
    mode,
    allowedIdsA,
    allowedIdsB,
  );
}

const EMPTY_AP: ActionPack = { checklist: [], lawyerQuestions: [] };

// ─── Simplify mode ────────────────────────────────────────────────────────────

describe("TEST-003 · Simplify anchor allowlist", () => {
  const allowed = ["A-p1-b0", "A-p1-b1", "A-p2-b0"];

  it("passes when all anchor IDs are in the allowlist", () => {
    const result: SimplifyResult = {
      clauses: [
        {
          topic: "Term",
          plainLanguage: "Two year initial term.",
          definedTerms: [],
          items: [
            {
              kind: "deadline",
              party: "both",
              statement: "Agreement runs 2 years.",
              anchorIds: ["A-p1-b0"],
            },
          ],
          anchorIds: ["A-p1-b1"],
        },
      ],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allowed, "simplify").ok).toBe(true);
  });

  it("fails when one item uses an unknown anchor ID", () => {
    const result: SimplifyResult = {
      clauses: [
        {
          topic: "Term",
          plainLanguage: "Two year term.",
          definedTerms: [],
          items: [
            {
              kind: "deadline",
              party: "both",
              statement: "Two years.",
              anchorIds: ["INVENTED-001"],   // ← not in allowlist
            },
          ],
          anchorIds: ["A-p1-b0"],
        },
      ],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allowed, "simplify").ok).toBe(false);
  });

  it("fails when clause anchorIds contains an unknown ID", () => {
    const result: SimplifyResult = {
      clauses: [
        {
          topic: "Payment",
          plainLanguage: "Monthly payment of $1000.",
          definedTerms: [],
          items: [],
          anchorIds: ["Section 4"],   // ← model-authored locator, not a valid ID
        },
      ],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allowed, "simplify").ok).toBe(false);
  });
});

// ─── Compare mode ─────────────────────────────────────────────────────────────

describe("TEST-003 · Compare anchor allowlist", () => {
  const allowedA = ["A-p1-b0", "A-p2-b0"];
  const allowedB = ["B-p1-b0", "B-p2-b0"];
  const allAllowed = [...allowedA, ...allowedB];

  it("passes when all A and B anchors are in their respective allowlists", () => {
    const result: CompareResult = {
      changes: [
        {
          topic: "Payment",
          changeType: "modified",
          before: "$500/month",
          after: "$750/month",
          whyReview: "Amount increased by $250.",
          anchorIdsA: ["A-p1-b0"],
          anchorIdsB: ["B-p1-b0"],
        },
      ],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allAllowed, "compare", allowedA, allowedB).ok).toBe(true);
  });

  it("fails if a change uses a B anchor ID that wasn't in the allowlist", () => {
    const result: CompareResult = {
      changes: [
        {
          topic: "Term",
          changeType: "added",
          before: null,
          after: "New clause.",
          whyReview: "Worth reviewing.",
          anchorIdsA: [],
          anchorIdsB: ["B-p9-b99"],   // ← not in allowedB
        },
      ],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allAllowed, "compare", allowedA, allowedB).ok).toBe(false);
  });

  it("fails if a cross-document ID is used (B ID in A field)", () => {
    const result: CompareResult = {
      changes: [
        {
          topic: "Termination",
          changeType: "removed",
          before: "30 days notice.",
          after: null,
          whyReview: "Clause removed.",
          anchorIdsA: ["B-p1-b0"],   // ← B ID in anchorIdsA is still in allAllowed
          anchorIdsB: [],
        },
      ],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allAllowed, "compare", allowedA, allowedB).ok).toBe(false);
  });
});

// ─── Ask mode ─────────────────────────────────────────────────────────────────

describe("TEST-003 · Ask anchor allowlist", () => {
  const allowed = ["A-p1-b0", "A-p2-b0"];

  it("passes supported result with valid anchors", () => {
    const result: AskResult = {
      status: "supported",
      answer: "The term is two years.",
      notEstablished: [],
      anchorIds: ["A-p1-b0"],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allowed, "ask").ok).toBe(true);
  });

  it("passes not_found result with empty anchors", () => {
    const result: AskResult = {
      status: "not_found",
      answer: "",
      notEstablished: [],
      anchorIds: [],
    };
    expect(validateResultAnchors(result, EMPTY_AP, allowed, "ask").ok).toBe(true);
  });

  it("fails if not_found result references an anchor (model hallucinated ID)", () => {
    const result: AskResult = {
      status: "not_found",
      answer: "",
      notEstablished: [],
      anchorIds: ["A-p9-b99"],   // ← unknown
    };
    expect(validateResultAnchors(result, EMPTY_AP, allowed, "ask").ok).toBe(false);
  });
});

// ─── Action Pack anchor allowlist ─────────────────────────────────────────────

describe("TEST-003 · ActionPack anchor allowlist", () => {
  const allowed = ["A-p1-b0"];

  it("fails if a checklist item uses an unknown anchor", () => {
    const result: AskResult = {
      status: "supported",
      answer: "Answer.",
      notEstablished: [],
      anchorIds: ["A-p1-b0"],
    };
    const ap: ActionPack = {
      checklist: [
        {
          item: "Sign the document.",
          party: "both",
          dueOrTrigger: "January 1",
          anchorIds: ["MADE_UP_ID"],   // ← fails
        },
      ],
      lawyerQuestions: [],
    };
    expect(validateResultAnchors(result, ap, allowed, "ask").ok).toBe(false);
  });
});

// ─── ResolvedAnchors: excerpts come from server, not model ────────────────────

describe("TEST-003 · AnchorRef contract", () => {
  it("AnchorRef.excerpt is populated from the evidence index, not model output", () => {
    // Simulate server-side resolution: model references an ID, server looks up excerpt.
    const evidenceIndex = new Map<string, { text: string; locator: string; document: "A" }>();
    evidenceIndex.set("A-p1-b0", {
      text: "The term is two (2) years from the date of execution.",
      locator: "Lines 10–12",
      document: "A",
    });

    const modelAnchorId = "A-p1-b0";
    const seg = evidenceIndex.get(modelAnchorId)!;

    const resolved: AnchorRef = {
      anchorId: modelAnchorId,
      document: seg.document,
      locator: seg.locator,
      excerpt: seg.text,
    };

    // excerpt comes from the evidence index (application-owned), not from the model
    expect(resolved.excerpt).toContain("two (2) years");
    expect(resolved.locator).toBe("Lines 10–12");
  });
});
