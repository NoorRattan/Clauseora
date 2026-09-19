import { describe, expect, it } from "vitest";
import { splitIntoBlocks } from "@/lib/extractor/anchor";
import { checkRateLimit, isSameOriginRequest } from "@/lib/request-security";
import { validateRequest, verifySignature } from "@/lib/validator";

function makeFile(name: string, content: string | Buffer, type: string): File {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;
  return new File([new Uint8Array(buffer)], name, { type });
}

describe("Defensive request and extraction boundaries", () => {
  it("never emits a text block larger than the configured bound", () => {
    const blocks = splitIntoBlocks("A".repeat(5_001), 1_200);
    expect(blocks.length).toBeGreaterThan(1);
    expect(Math.max(...blocks.map((block) => block.length))).toBeLessThanOrEqual(1_200);
  });

  it("preserves trailing text after a sentence boundary", () => {
    const blocks = splitIntoBlocks("First sentence. Trailing words without punctuation", 30);
    expect(blocks.join(" ")).toContain("Trailing words without punctuation");
  });

  it("rejects repeated or extra multipart file fields", () => {
    const form = new FormData();
    form.append("mode", "simplify");
    form.append("documentA", makeFile("a.txt", "one", "text/plain"));
    form.append("documentA", makeFile("b.txt", "two", "text/plain"));
    expect(validateRequest(form)).toMatchObject({ ok: false, error: { code: "WRONG_FILE_COUNT" } });

    const withExtra = new FormData();
    withExtra.append("mode", "simplify");
    withExtra.append("documentA", makeFile("a.txt", "one", "text/plain"));
    withExtra.append("attachment", makeFile("b.txt", "two", "text/plain"));
    expect(validateRequest(withExtra)).toMatchObject({ ok: false, error: { code: "WRONG_FILE_COUNT" } });
  });

  it("rejects a valid signature paired with a mismatched reported MIME", () => {
    const result = verifySignature(Buffer.from("%PDF-1.7"), "pdf", "text/plain");
    expect(result).toMatchObject({ ok: false, error: { code: "TYPE_MISMATCH" } });
  });

  it("allows same-origin requests and rejects cross-origin browser requests", () => {
    expect(
      isSameOriginRequest({
        url: "https://clauseora.example/api/process",
        headers: new Headers({ origin: "https://clauseora.example" }),
      }),
    ).toBe(true);
    expect(
      isSameOriginRequest({
        url: "https://clauseora.example/api/process",
        headers: new Headers({ origin: "https://attacker.example" }),
      }),
    ).toBe(false);
  });

  it("bounds repeated requests in the same rate-limit window", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.42" });
    const start = 10_000_000;
    for (let i = 0; i < 10; i += 1) {
      expect(checkRateLimit(headers, start)).toEqual({ allowed: true });
    }
    expect(checkRateLimit(headers, start)).toMatchObject({ allowed: false });
    expect(checkRateLimit(headers, start + 10 * 60 * 1000 + 1)).toEqual({ allowed: true });
  });
});

