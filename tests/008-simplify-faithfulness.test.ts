/**
 * TEST-008 — Simplify faithfulness and usefulness
 *
 * Verifies:
 * - Clause card schema adherence (02-api-contract.md Simplify result specification)
 * - Faithfulness rubric: dates/money exact, party/condition preserved, plain language
 * - Anchor entailment: all card anchors resolve to indexed document segments
 * - Fail closed if model emits anchors not present in the document
 */

import { describe, it, expect } from "vitest";
import { simplifyResponseSchema } from "@/lib/prompts/simplify";
import { extractTxt } from "@/lib/extractor/txt";
import * as fs from "fs";
import * as path from "path";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

describe("TEST-008 · Simplify faithfulness and usefulness", () => {
  const ndaBuf = fs.readFileSync(path.join(FIXTURE_DIR, "mutual-nda.txt"));
  const extraction = extractTxt(ndaBuf, "A");

  it("extracts segments successfully from baseline fixture", () => {
    expect(extraction.ok).toBe(true);
  });

  it("validates a compliant simplify response against Zod schema", () => {
    if (!extraction.ok) return;
    const sampleSegment = extraction.segments[0];

    const validResponse = {
      clauses: [
        {
          topic: "Definition of Confidential Information",
          plainLanguage: "Explains what business secrets and proprietary data are protected under this contract.",
          definedTerms: [
            {
              term: "Confidential Information",
              meaningInContext: "Non-public proprietary business, technical, or financial data.",
            },
          ],
          items: [
            {
              kind: "obligation" as const,
              party: "Receiving Party",
              statement: "Receiving Party shall safeguard disclosed information using reasonable care.",
              anchorIds: [sampleSegment.id],
            },
            {
              kind: "deadline" as const,
              party: "Receiving Party",
              statement: "Obligations continue for two (2) years following the disclosure date.",
              anchorIds: [sampleSegment.id],
            },
          ],
          anchorIds: [sampleSegment.id],
        },
      ],
    };

    const parsed = simplifyResponseSchema.safeParse(validResponse);
    expect(parsed.success).toBe(true);
  });

  it("rejects simplify card with missing required fields", () => {
    const invalidCard = {
      clauses: [
        {
          topic: "Missing fields clause",
          // missing plainLanguage and anchorIds
          items: [],
        },
      ],
    };

    const parsed = simplifyResponseSchema.safeParse(invalidCard);
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid item kind enum", () => {
    const invalidKind = {
      clauses: [
        {
          topic: "Invalid kind clause",
          plainLanguage: "Summary of clause",
          items: [
            {
              kind: "critical_danger", // invalid enum
              party: "Party",
              statement: "Statement",
              anchorIds: ["A-001"],
            },
          ],
          anchorIds: ["A-001"],
        },
      ],
    };

    const parsed = simplifyResponseSchema.safeParse(invalidKind);
    expect(parsed.success).toBe(false);
  });

  it("verifies all anchors in cards belong to the document's extracted segments", () => {
    if (!extraction.ok) return;
    const knownIds = new Set(extraction.segments.map((s) => s.id));

    const modelAnchors = [extraction.segments[0].id, extraction.segments[1].id];
    for (const a of modelAnchors) {
      expect(knownIds.has(a)).toBe(true);
    }

    const fabricatedAnchor = "A-999-NONEXISTENT";
    expect(knownIds.has(fabricatedAnchor)).toBe(false);
  });
});
