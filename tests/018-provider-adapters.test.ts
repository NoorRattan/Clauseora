import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Segment } from "@/types/evidence";

const groqSdkMock = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("groq-sdk", () => ({
  default: class MockGroq {
    chat = { completions: { create: groqSdkMock.create } };
  },
}));

import { callCloudflare, focusExcerpt, type ClaimToVerify } from "@/lib/cloudflare";
import { callGroq, getGroqOutputTokenBudget } from "@/lib/groq";
import { safeGroqMessage } from "@/lib/process-pipeline";

const segment: Segment = {
  id: "A-l001-b001",
  document: "A",
  locator: "Line 1",
  text: "Payment is due within 30 days.",
};

const claim: ClaimToVerify = {
  claimPath: segment.id,
  claimText: "Payment is due within 30 days.",
  excerpts: [segment.text],
};

describe("provider adapters", () => {
  beforeEach(() => {
    groqSdkMock.create.mockReset();
    vi.unstubAllGlobals();
    delete process.env.GROQ_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_AI_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not contact Groq without a server-side credential", async () => {
    const result = await callGroq("simplify", [segment], null, undefined, "system");

    expect(result).toMatchObject({ ok: false, error: "PRIMARY_UNAVAILABLE" });
    expect(groqSdkMock.create).not.toHaveBeenCalled();
  });

  it("parses and validates a successful Groq response", async () => {
    process.env.GROQ_API_KEY = "test-key";
    groqSdkMock.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              result: {
                status: "supported",
                answer: "Payment is due in 30 days.",
                notEstablished: [],
                anchorIds: [segment.id],
              },
              actionPack: { checklist: [], lawyerQuestions: [] },
            }),
          },
        },
      ],
    });

    const result = await callGroq(
      "ask",
      [segment],
      null,
      "When is payment due?",
      "Use only supplied evidence.",
    );

    expect(result).toMatchObject({
      ok: true,
      result: { status: "supported", anchorIds: [segment.id] },
    });
    expect(groqSdkMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: expect.any(Number),
      }),
    );
  });

  it("keeps the provider request below the configured total token budget", () => {
    expect(getGroqOutputTokenBudget(1_000)).toBe(4_096);
    expect(getGroqOutputTokenBudget(6_000)).toBe(1_600);
    expect(getGroqOutputTokenBudget(7_601)).toBe(0);
  });

  it("fails closed on invalid Groq JSON", async () => {
    process.env.GROQ_API_KEY = "test-key";
    groqSdkMock.create.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
    });

    const result = await callGroq("simplify", [segment], null, undefined, "system");
    expect(result).toMatchObject({ ok: false, error: "MODEL_OUTPUT_INVALID" });
  });

  it("does not contact Cloudflare without verifier credentials", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(callCloudflare([claim])).resolves.toEqual({ ok: false, reason: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only the selected claim payload and accepts a valid verdict", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_AI_TOKEN = "token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: { response: [{ id: segment.id, verdict: "supports" }] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callCloudflare([claim]);

    expect(result).toEqual({
      ok: true,
      verdicts: [{ claimPath: segment.id, verdict: "supports" }],
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.body).toContain(claim.claimText);
    expect(request.body).not.toContain("agreement.txt");
  });

  it("degrades cleanly when Cloudflare returns malformed verdicts", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_AI_TOKEN = "token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ result: { response: "not a verdict array" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(callCloudflare([claim])).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("focuses the bounded verifier excerpt near the claim terms", () => {
    const excerpt = `${"introductory text ".repeat(40)}The payment deadline is thirty days after invoice receipt.`;
    const focused = focusExcerpt(excerpt, "payment deadline", 80);
    expect(focused).toContain("payment deadline");
    expect(focused.length).toBe(80);
  });

  it("gives oversized documents a useful fixed provider message", () => {
    expect(safeGroqMessage("DOCUMENT_TOO_LONG")).toContain("too long");
  });
});
