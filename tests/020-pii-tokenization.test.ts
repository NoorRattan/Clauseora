import { describe, expect, it } from "vitest";
import { PiiTokenVault } from "@/lib/pii-tokenizer";

describe("request-scoped PII protection", () => {
  it("protects common direct identifiers and restores them exactly", () => {
    const vault = new PiiTokenVault();
    const original =
      "Contact alex@example.com or +1 (415) 555-2671. SSN 123-45-6789; card 4111 1111 1111 1111; IP 192.0.2.7.";

    const protectedText = vault.protectText(original);

    expect(protectedText).not.toContain("alex@example.com");
    expect(protectedText).not.toContain("415");
    expect(protectedText).not.toContain("123-45-6789");
    expect(protectedText).not.toContain("4111 1111 1111 1111");
    expect(protectedText).not.toContain("192.0.2.7");
    expect(protectedText).toMatch(/\[\[CLAUSEORA_PII_[A-Z]+_\d+\]\]/);
    expect(vault.restoreText(protectedText)).toBe(original);
  });

  it("does not redact ordinary legal dates or amounts", () => {
    const vault = new PiiTokenVault();
    const text = "The term begins on 2026-09-22 and the fee is $1,500 per month.";

    expect(vault.protectText(text)).toBe(text);
  });

  it("does not mistake a short legal duration for an account identifier", () => {
    const vault = new PiiTokenVault();
    const text = "The account is payable within 30 days of the invoice.";

    expect(vault.protectText(text)).toBe(text);
  });

  it("restores nested provider output without changing anchors", () => {
    const vault = new PiiTokenVault();
    const protectedText = vault.protectText("Email alex@example.com");
    const output = {
      result: { answer: protectedText, anchorIds: ["A-l001-b001"] },
      actionPack: { checklist: [{ item: protectedText }] },
    };

    expect(vault.restoreValue(output)).toEqual({
      result: { answer: "Email alex@example.com", anchorIds: ["A-l001-b001"] },
      actionPack: { checklist: [{ item: "Email alex@example.com" }] },
    });
  });
});
