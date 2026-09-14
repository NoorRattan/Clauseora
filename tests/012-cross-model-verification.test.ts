/**
 * TEST-012 — Cross-model verification and disagreement
 *
 * Verifies:
 * - Claim selection limits: maximum 5 claims, excerpts truncated to 400 chars, never full document.
 * - Graceful degradation: quota (429), unavailable, network timeout, or invalid JSON downgrade
 *   to `single_model` without throwing or blocking response delivery.
 * - Verdict mapping:
 *   - All "supports" → `cross_checked`
 *   - Any "contradicts" or "unclear" → `needs_review` (no silent rewrites)
 *   - Zero claims → `not_applicable`
 * - No majority voting: if Cloudflare disagrees, both perspectives are surfaced to user.
 */

import { describe, it, expect } from "vitest";
import {
  selectClaimsForVerification,
  deriveVerification,
  CF_MAX_CLAIMS,
  CF_MAX_EXCERPT_CHARS,
  type CfResult,
} from "@/lib/cloudflare";
import type { AnchorRef } from "@/types/evidence";

describe("TEST-012 · Cross-model verification and disagreement", () => {
  describe("Claim selection and payload safety", () => {
    const mockAnchors: AnchorRef[] = [
      { anchorId: "A-001", document: "A", locator: "Lines 1-5", excerpt: "Excerpt 1 with short text." },
      { anchorId: "A-002", document: "A", locator: "Lines 6-10", excerpt: "E".repeat(1000) }, // huge excerpt
      { anchorId: "A-003", document: "A", locator: "Lines 11-15", excerpt: "Excerpt 3" },
      { anchorId: "A-004", document: "A", locator: "Lines 16-20", excerpt: "Excerpt 4" },
      { anchorId: "A-005", document: "A", locator: "Lines 21-25", excerpt: "Excerpt 5" },
      { anchorId: "A-006", document: "A", locator: "Lines 26-30", excerpt: "Excerpt 6" },
      { anchorId: "A-007", document: "A", locator: "Lines 31-35", excerpt: "Excerpt 7" },
    ];

    const claimTexts = new Map<string, string>([
      ["A-001", "Rent is $2,000 per month."],
      ["A-002", "Security deposit is non-refundable."],
      ["A-003", "Late fee is $50."],
      ["A-004", "Notice period is 30 days."],
      ["A-005", "Subletting is prohibited."],
      ["A-006", "Utilities included."],
      ["A-007", "Parking space #12."],
    ]);

    const highImpactIds = ["A-001", "A-002", "A-003", "A-004", "A-005", "A-006", "A-007"];

    it("enforces CF_MAX_CLAIMS limit (caps at 5 claims)", () => {
      const selected = selectClaimsForVerification(mockAnchors, highImpactIds, claimTexts);
      expect(selected.length).toBeLessThanOrEqual(CF_MAX_CLAIMS);
      expect(selected.length).toBe(5);
    });

    it("truncates excerpt length to CF_MAX_EXCERPT_CHARS", () => {
      const selected = selectClaimsForVerification(mockAnchors, highImpactIds, claimTexts);
      const claim2 = selected.find((c) => c.claimPath === "A-002");
      expect(claim2).toBeDefined();
      if (claim2) {
        expect(claim2.excerpts[0].length).toBeLessThanOrEqual(CF_MAX_EXCERPT_CHARS);
      }
    });

    it("does not include document buffers or filenames in verification payload", () => {
      const selected = selectClaimsForVerification(mockAnchors, highImpactIds, claimTexts);
      for (const item of selected) {
        // Must only contain claimPath, claimText, and excerpts
        expect(Object.keys(item).sort()).toEqual(["claimPath", "claimText", "excerpts"].sort());
      }
    });
  });

  describe("Verification status derivation", () => {
    it("maps all-supports verdicts to cross_checked", () => {
      const result: CfResult = {
        ok: true,
        verdicts: [
          { claimPath: "A-001", verdict: "supports" },
          { claimPath: "A-002", verdict: "supports" },
        ],
      };

      const verification = deriveVerification(result);
      expect(verification.status).toBe("cross_checked");
      expect(verification.provider).toBe("cloudflare");
      expect(verification.checkedClaims).toBe(2);
      expect(verification.issues.length).toBe(0);
    });

    it("maps contradiction verdict to needs_review", () => {
      const result: CfResult = {
        ok: true,
        verdicts: [
          { claimPath: "A-001", verdict: "supports" },
          { claimPath: "A-002", verdict: "contradicts" },
        ],
      };

      const verification = deriveVerification(result);
      expect(verification.status).toBe("needs_review");
      expect(verification.issues.length).toBe(1);
      expect(verification.issues[0].claimPath).toBe("A-002");
      expect(verification.issues[0].verdict).toBe("contradicts");
    });

    it("maps unclear verdict to needs_review", () => {
      const result: CfResult = {
        ok: true,
        verdicts: [
          { claimPath: "A-001", verdict: "unclear" },
        ],
      };

      const verification = deriveVerification(result);
      expect(verification.status).toBe("needs_review");
      expect(verification.issues.length).toBe(1);
      expect(verification.issues[0].verdict).toBe("unclear");
    });

    it("handles zero claims with not_applicable", () => {
      const result: CfResult = {
        ok: true,
        verdicts: [],
      };

      const verification = deriveVerification(result);
      expect(verification.status).toBe("not_applicable");
      expect(verification.checkedClaims).toBe(0);
    });

    it("gracefully degrades to single_model on provider failure (disabled, quota, unavailable, invalid)", () => {
      const reasons: Array<"disabled" | "unavailable" | "invalid" | "quota"> = [
        "disabled",
        "unavailable",
        "invalid",
        "quota",
      ];

      for (const reason of reasons) {
        const failedResult: CfResult = { ok: false, reason };
        const verification = deriveVerification(failedResult);
        expect(verification.status).toBe("single_model");
        expect(verification.provider).toBeNull();
        expect(verification.checkedClaims).toBe(0);
        expect(verification.issues.length).toBe(0);
      }
    });
  });
});
