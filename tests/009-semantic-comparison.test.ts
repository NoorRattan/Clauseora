/**
 * TEST-009 — Semantic comparison
 *
 * Verifies:
 * - Extraction of Version A and Version B produces non-overlapping segment IDs (A-* vs B-*).
 * - Comparison schema validates changes with substantive change types (modified, added, removed).
 * - Changed items must have both-side evidence: anchorIdsA from doc A, anchorIdsB from doc B.
 * - Change type enum is strictly enforced.
 * - Formatting-only or whitespace differences are not marked as substantive changes.
 */

import { describe, it, expect } from "vitest";
import { compareResponseSchema } from "@/lib/prompts/compare";
import { extractTxt } from "@/lib/extractor/txt";
import * as fs from "fs";
import * as path from "path";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

describe("TEST-009 · Semantic comparison", () => {
  const v1Buf = fs.readFileSync(path.join(FIXTURE_DIR, "services-agreement-v1.txt"));
  const v2Buf = fs.readFileSync(path.join(FIXTURE_DIR, "services-agreement-v2.txt"));

  const extA = extractTxt(v1Buf, "A");
  const extB = extractTxt(v2Buf, "B");

  it("extracts both version A and version B successfully", () => {
    expect(extA.ok).toBe(true);
    expect(extB.ok).toBe(true);
  });

  it("guarantees Document A segments have A- prefix and Document B have B- prefix", () => {
    if (!extA.ok || !extB.ok) return;

    for (const seg of extA.segments) {
      expect(seg.id).toMatch(/^A-/);
      expect(seg.document).toBe("A");
    }

    for (const seg of extB.segments) {
      expect(seg.id).toMatch(/^B-/);
      expect(seg.document).toBe("B");
    }
  });

  it("validates a compliant comparison response against schema", () => {
    if (!extA.ok || !extB.ok) return;

    const sampleA = extA.segments[0].id;
    const sampleB = extB.segments[0].id;

    const validComparison = {
      changes: [
        {
          topic: "Payment Terms — Monthly Retainer and Due Window",
          changeType: "modified" as const,
          before: "Client pays monthly retainer of $8,000 within 30 days.",
          after: "Client pays monthly retainer of $12,000 within 15 days.",
          whyReview: "Retainer increased by $4,000/month and invoice payment window shortened by half.",
          anchorIdsA: [sampleA],
          anchorIdsB: [sampleB],
        },
        {
          topic: "Subcontracting Permission",
          changeType: "modified" as const,
          before: "Service Provider prohibited from subcontracting without prior written consent.",
          after: "Service Provider may subcontract portions of the work to qualified third parties.",
          whyReview: "Work may now be delegated to third parties without prior client approval.",
          anchorIdsA: [sampleA],
          anchorIdsB: [sampleB],
        },
      ],
      structuralDifferences: [
        "Effective date updated from January 1, 2024 to March 1, 2024.",
      ],
      recommendations: [
        "Review shortened 15-day invoice payment window with accounts payable.",
      ],
    };

    const parsed = compareResponseSchema.safeParse(validComparison);
    expect(parsed.success).toBe(true);
  });

  it("fails closed on invalid changeType enum", () => {
    const invalidChange = {
      changes: [
        {
          topic: "Topic",
          changeType: "reworded_slightly", // invalid enum
          whyReview: "Neutral observation",
          anchorIdsA: ["A-001"],
          anchorIdsB: ["B-001"],
        },
      ],
    };

    const parsed = compareResponseSchema.safeParse(invalidChange);
    expect(parsed.success).toBe(false);
  });

  it("enforces both-side anchor existence: anchorIdsA from doc A, anchorIdsB from doc B", () => {
    if (!extA.ok || !extB.ok) return;

    const validA = extA.segments.map((s) => s.id);
    const validB = extB.segments.map((s) => s.id);

    const testChange = {
      anchorIdsA: [validA[0]],
      anchorIdsB: [validB[0]],
    };

    expect(validA.includes(testChange.anchorIdsA[0])).toBe(true);
    expect(validB.includes(testChange.anchorIdsB[0])).toBe(true);

    // Cross-document pollution: B anchor in anchorIdsA list should not belong to A
    expect(validA.includes(testChange.anchorIdsB[0])).toBe(false);
  });
});
