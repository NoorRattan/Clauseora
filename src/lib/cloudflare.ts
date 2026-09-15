/**
 * Cloudflare Workers AI verifier adapter.
 * Pinned model: @cf/meta/llama-3.1-8b-instruct-fast
 *
 * Receives only selected high-impact claims + their cited excerpts.
 * Never receives the full document or filename.
 * Invalid/timeout/quota → graceful single_model degradation.
 */

import type { AnchorRef, Verification, VerificationIssue } from "@/types/evidence";

export const CF_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

/** High-impact claim kinds that trigger cross-checking. */
export const HIGH_IMPACT_KINDS = [
  "money",
  "deadline",
] as const;

/** Maximum claims sent to the verifier per request. */
export const CF_MAX_CLAIMS = 5;
/** Maximum excerpt chars sent per claim. */
export const CF_MAX_EXCERPT_CHARS = 400;

export type ClaimToVerify = {
  claimPath: string;
  claimText: string;
  excerpts: string[];
};

export type CfVerdict = "supports" | "contradicts" | "unclear";

export type CfResult =
  | { ok: true; verdicts: Array<{ claimPath: string; verdict: CfVerdict }> }
  | { ok: false; reason: "disabled" | "unavailable" | "invalid" | "quota" };

/**
 * Call the Cloudflare Workers AI verifier for a set of high-impact claims.
 * Returns gracefully degraded result on any failure.
 */
export async function callCloudflare(claims: ClaimToVerify[]): Promise<CfResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_TOKEN;

  if (!accountId || !token) {
    return { ok: false, reason: "disabled" };
  }
  if (claims.length === 0) {
    return { ok: true, verdicts: [] };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL}`;

  const prompt = buildVerificationPrompt(claims);

  let responsePayload: unknown;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: VERIFIER_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 512,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 429) return { ok: false, reason: "quota" };
    if (!res.ok) return { ok: false, reason: "unavailable" };

    const json = (await res.json()) as {
      result?: { response?: unknown };
      success?: boolean;
    };
    responsePayload = json.result?.response ?? "";
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  // Parse verdicts from the response
  try {
    const verdicts = parseVerifierResponse(responsePayload, claims);
    return { ok: true, verdicts };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/**
 * Select high-impact claims from resolved anchors for verification.
 * Only sends excerpt subsets — never the full document.
 */
export function selectClaimsForVerification(
  resolvedAnchors: AnchorRef[],
  highImpactAnchorIds: string[],
  claimTexts: Map<string, string>
): ClaimToVerify[] {
  const selected: ClaimToVerify[] = [];

  for (const anchorId of highImpactAnchorIds.slice(0, CF_MAX_CLAIMS)) {
    const anchor = resolvedAnchors.find((a) => a.anchorId === anchorId);
    if (!anchor) continue;
    const claimText = claimTexts.get(anchorId);
    if (!claimText) continue;

    selected.push({
      claimPath: anchorId,
      claimText: claimText.slice(0, 500),
      excerpts: [anchor.excerpt.slice(0, CF_MAX_EXCERPT_CHARS)],
    });
  }

  return selected;
}

/**
 * Derive the final Verification object from Cloudflare verdicts.
 */
export function deriveVerification(cfResult: CfResult): Verification {
  if (!cfResult.ok) {
    return {
      status: "single_model",
      provider: null,
      checkedClaims: 0,
      issues: [],
    };
  }

  if (cfResult.verdicts.length === 0) {
    return {
      status: "not_applicable",
      provider: "cloudflare",
      checkedClaims: 0,
      issues: [],
    };
  }

  const issues: VerificationIssue[] = cfResult.verdicts
    .filter((v) => v.verdict !== "supports")
    .map((v) => ({
      claimPath: v.claimPath,
      verdict: v.verdict as "contradicts" | "unclear",
      message: "A second model could not confirm this claim from the cited text.",
    }));

  return {
    status: issues.length > 0 ? "needs_review" : "cross_checked",
    provider: "cloudflare",
    checkedClaims: cfResult.verdicts.length,
    issues,
  };
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const VERIFIER_SYSTEM_PROMPT = `You are an evidence entailment checker. For each claim and its supporting text excerpt, decide whether the excerpt SUPPORTS, CONTRADICTS, or is UNCLEAR about the claim. 

Rules:
- Only use the provided excerpt, not general knowledge.
- SUPPORTS: The excerpt clearly backs the claim.
- CONTRADICTS: The excerpt clearly contradicts the claim.
- UNCLEAR: The excerpt is ambiguous or doesn't directly address the claim.

Respond with a JSON array: [{"id": "<claim id>", "verdict": "supports"|"contradicts"|"unclear"}]`;

function buildVerificationPrompt(claims: ClaimToVerify[]): string {
  const parts = claims.map((c, i) => `Claim ${i + 1} (id: "${c.claimPath}"): ${c.claimText}\nExcerpt: "${c.excerpts[0]}"`);
  return `Please verify these claims against their excerpts:\n\n${parts.join("\n\n")}`;
}

export function parseVerifierResponse(
  response: unknown,
  claims: ClaimToVerify[]
): Array<{ claimPath: string; verdict: CfVerdict }> {
  let parsed: unknown = response;
  if (typeof response === "string") {
    const match = response.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array in response");
    parsed = JSON.parse(match[0]);
  }
  if (!Array.isArray(parsed)) throw new Error("Verifier response is not an array");

  return parsed
    .filter((v): v is { id: string; verdict: string } => {
      if (!v || typeof v !== "object") return false;
      const candidate = v as { id?: unknown; verdict?: unknown };
      const validVerdicts = ["supports", "contradicts", "unclear"];
      const claimExists = claims.some((c) => c.claimPath === candidate.id);
      return (
        claimExists &&
        typeof candidate.id === "string" &&
        typeof candidate.verdict === "string" &&
        validVerdicts.includes(candidate.verdict)
      );
    })
    .map((v) => ({
      claimPath: v.id,
      verdict: v.verdict as CfVerdict,
    }));
}
