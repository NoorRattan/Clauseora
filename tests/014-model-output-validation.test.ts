import { describe, expect, it } from "vitest";
import { validateModelOutput } from "@/lib/groq";
import type { AskResult } from "@/types/evidence";

const ANCHOR_A = "A-p001-b001";
const ANCHOR_B = "B-p001-b001";

describe("Model output validation", () => {
  it("rejects a simplify card with an ungrounded defined term", () => {
    const result = validateModelOutput("simplify", {
      result: {
        clauses: [
          {
            topic: "Confidentiality",
            plainLanguage: "Information must be protected.",
            definedTerms: [
              { term: "Confidential Information", meaningInContext: "Protected information." },
            ],
            items: [],
            anchorIds: [ANCHOR_A],
          },
        ],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });

    expect(result.ok).toBe(false);
  });

  it("enforces compare before/after and side-specific anchors", () => {
    const added = validateModelOutput("compare", {
      result: {
        changes: [
          {
            topic: "Payment",
            changeType: "added",
            before: "Payment was not stated.",
            after: "$500 is due monthly.",
            whyReview: "A payment term was added.",
            anchorIdsA: [],
            anchorIdsB: [ANCHOR_B],
          },
        ],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });

    expect(added.ok).toBe(false);

    const validRemoved = validateModelOutput("compare", {
      result: {
        changes: [
          {
            topic: "Payment",
            changeType: "removed",
            before: "$500 is due monthly.",
            after: null,
            whyReview: "The payment term is no longer present in version B.",
            anchorIdsA: [ANCHOR_A],
            anchorIdsB: [],
          },
        ],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });

    expect(validRemoved.ok).toBe(true);
  });

  it("rejects supported Ask output without anchors and normalizes citation anchors", () => {
    const unsupported = validateModelOutput("ask", {
      result: {
        status: "supported",
        answer: "The document states a two-year term.",
        notEstablished: [],
        anchorIds: [],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });
    expect(unsupported.ok).toBe(false);

    const cited = validateModelOutput("ask", {
      result: {
        status: "supported",
        answer: "The document states a two-year term.",
        notEstablished: [],
        citations: [{ anchorId: ANCHOR_A, relevance: "Term clause" }],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });

    expect(cited.ok).toBe(true);
    if (cited.ok) expect((cited.result as AskResult).anchorIds).toEqual([ANCHOR_A]);
  });
});
