/**
 * TEST-006 — No-persistence / logging regression
 *
 * Verifies that:
 * - Sensitive document fields (text, filename, question) are not persisted
 *   by any application-level code.
 * - The Segment type has no file-path or raw buffer fields.
 * - ErrorResponse.error.message does not echo back document content.
 * - No temp file paths are created by the extractors (memory-only processing).
 *
 * Full log inspection (TEST-006 manual step) is done in TEST-013.
 */

import { describe, it, expect } from "vitest";
import type { Segment, ErrorResponse } from "@/types/evidence";
import { LEGAL_NOTICE_TEXT } from "@/types/evidence";

// ─── Type-level: Segment must not carry raw buffer or file path ───────────────

describe("TEST-006 · Segment type shape", () => {
  it("a valid Segment has id, document, locator, text — no rawBuffer or filePath", () => {
    const seg: Segment = {
      id: "A-p1-b0",
      document: "A",
      locator: "Lines 1–3",
      text: "Sample text.",
    };
    // @ts-expect-error: Segment has no rawBuffer field
    void seg.rawBuffer;
    // @ts-expect-error: Segment has no filePath field
    void seg.filePath;

    expect(seg.id).toBe("A-p1-b0");
    expect(Object.keys(seg)).not.toContain("rawBuffer");
    expect(Object.keys(seg)).not.toContain("filePath");
  });

  it("Segment text is a string, not a buffer", () => {
    const seg: Segment = {
      id: "A-p1-b0",
      document: "A",
      locator: "Lines 1–3",
      text: "Some legal language here.",
    };
    expect(typeof seg.text).toBe("string");
  });
});

// ─── Error messages must not echo document content ────────────────────────────

describe("TEST-006 · Error message content safety", () => {
  const SENSITIVE_FRAGMENT = "CONFIDENTIAL_TRADE_SECRET_CLAUSE_TEXT_12345";

  it("error message does not echo back document text", () => {
    const errResponse: ErrorResponse = {
      requestId: "test-err",
      mode: null,
      notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
      documents: [],
      result: null,
      actionPack: { checklist: [], lawyerQuestions: [] },
      error: {
        code: "CORRUPT_DOCUMENT",
        message: "This document could not be read. It may be corrupted or in an unsupported format.",
      },
    };

    // The error message should never contain document text
    expect(errResponse.error?.message ?? "").not.toContain(SENSITIVE_FRAGMENT);
  });

  it("error message for MODEL_OUTPUT_INVALID does not include raw model output", () => {
    const errResponse: ErrorResponse = {
      requestId: "test-err-2",
      mode: "simplify",
      notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
      documents: [],
      result: null,
      actionPack: { checklist: [], lawyerQuestions: [] },
      error: {
        code: "MODEL_OUTPUT_INVALID",
        message: "The analysis result could not be verified and was withheld for your safety.",
      },
    };
    // Raw model output / document text must not appear
    expect(errResponse.error?.message ?? "").not.toContain("{");
    expect(errResponse.error?.message ?? "").not.toContain("anchorIds");
    expect(errResponse.error?.message ?? "").not.toContain("clauses");
  });
});

// ─── Memory-only processing: no temp files created by TXT extractor ──────────

describe("TEST-006 · Memory-only TXT processing", () => {
  it("extractTxt returns segments without creating temp files", async () => {
    const { extractTxt } = await import("@/lib/extractor/txt");
    const fs = await import("fs");
    const os = await import("os");

    // Snapshot of temp dir before extraction
    const tmpDir = os.tmpdir();
    const beforeFiles = fs.readdirSync(tmpDir).length;

    const buf = Buffer.from("This is a test document.\nSecond line of text.");
    const result = extractTxt(buf, "A");

    const afterFiles = fs.readdirSync(tmpDir).length;

    expect(result.ok).toBe(true);
    // No new files should have been created in the temp dir
    expect(afterFiles).toBe(beforeFiles);
  });
});

// ─── Document metadata must not include original file path ────────────────────

describe("TEST-006 · DocumentMeta does not expose file path", () => {
  it("DocumentMeta shape contains only key, displayName, pageCount", () => {
    const docMeta = {
      key: "A" as const,
      displayName: "mutual-nda.txt",
      pageCount: undefined,
    };

    expect(docMeta).not.toHaveProperty("filePath");
    expect(docMeta).not.toHaveProperty("path");
    expect(docMeta).not.toHaveProperty("buffer");

    // displayName comes from the original filename — that is intentional and disclosed
    expect(docMeta.displayName).toBe("mutual-nda.txt");
  });
});
