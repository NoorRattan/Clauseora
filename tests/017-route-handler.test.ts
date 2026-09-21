import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { NOT_FOUND_ABSTENTION_TEXT } from "@/types/evidence";

const providerMocks = vi.hoisted(() => ({
  callGroq: vi.fn(),
  callCloudflare: vi.fn(),
}));

vi.mock("@/lib/groq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/groq")>();
  return { ...actual, callGroq: providerMocks.callGroq };
});

vi.mock("@/lib/cloudflare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cloudflare")>();
  return { ...actual, callCloudflare: providerMocks.callCloudflare };
});

import { POST } from "@/app/api/process/route";

let clientSequence = 0;

function makeRequest(
  mode: "simplify" | "ask" = "simplify",
  options: { origin?: string; question?: string } = {},
): NextRequest {
  const form = new FormData();
  form.set("mode", mode);
  form.set(
    "documentA",
    new File(
      ["Payment is due within 30 days of receiving an invoice."],
      "agreement.txt",
      { type: "text/plain" },
    ),
  );
  if (mode === "ask") form.set("question", options.question ?? "When is payment due?");

  clientSequence += 1;
  return new NextRequest("https://clauseora.example/api/process", {
    method: "POST",
    body: form,
    headers: {
      origin: options.origin ?? "https://clauseora.example",
      "x-forwarded-for": `203.0.113.${clientSequence}`,
    },
  });
}

describe("POST /api/process production orchestration", () => {
  beforeEach(() => {
    providerMocks.callGroq.mockReset();
    providerMocks.callCloudflare.mockReset();
    providerMocks.callCloudflare.mockResolvedValue({ ok: true, verdicts: [] });
  });

  it("returns canonical server-resolved evidence and defensive headers", async () => {
    providerMocks.callGroq.mockResolvedValue({
      ok: true,
      model: "test-model",
      result: {
        clauses: [
          {
            topic: "Payment",
            plainLanguage: "Payment is due in 30 days.",
            definedTerms: [],
            items: [
              {
                kind: "obligation",
                party: "not_stated",
                statement: "Pay within 30 days.",
                anchorIds: ["A-l001-b001"],
              },
            ],
            anchorIds: ["A-l001-b001"],
          },
        ],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("server-timing")).toMatch(/read;dur=.*total;dur=/);
    expect(body.resolvedAnchors).toEqual([
      expect.objectContaining({
        anchorId: "A-l001-b001",
        excerpt: "Payment is due within 30 days of receiving an invoice.",
      }),
    ]);
    expect(providerMocks.callGroq).toHaveBeenCalledOnce();
  });

  it("withholds a model response that invents an anchor", async () => {
    providerMocks.callGroq.mockResolvedValue({
      ok: true,
      model: "test-model",
      result: {
        clauses: [
          {
            topic: "Payment",
            plainLanguage: "Invented output.",
            definedTerms: [],
            items: [],
            anchorIds: ["INVENTED-ANCHOR"],
          },
        ],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.result).toBeNull();
    expect(body.error.code).toBe("MODEL_OUTPUT_INVALID");
    expect(providerMocks.callCloudflare).not.toHaveBeenCalled();
  });

  it("enforces the fixed Ask abstention and removes model citations", async () => {
    providerMocks.callGroq.mockResolvedValue({
      ok: true,
      model: "test-model",
      result: {
        status: "not_found",
        answer: "A speculative model answer.",
        notEstablished: [],
        anchorIds: [],
      },
      actionPack: { checklist: [], lawyerQuestions: [] },
    });

    const response = await POST(makeRequest("ask"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.answer).toBe(NOT_FOUND_ABSTENTION_TEXT);
    expect(body.result.anchorIds).toEqual([]);
    expect(body.resolvedAnchors).toEqual([]);
  });

  it("rejects browser cross-origin requests before processing the upload", async () => {
    const response = await POST(
      makeRequest("simplify", { origin: "https://attacker.example" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(providerMocks.callGroq).not.toHaveBeenCalled();
  });
});
