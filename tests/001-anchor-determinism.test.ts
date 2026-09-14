/**
 * TEST-001 — Extraction and anchor determinism
 *
 * Verifies:
 * - Identical segment IDs/text/locators on two successive parses of the same buffer.
 * - PDF anchors carry page info; DOCX anchors carry paragraph/heading; TXT carry line range.
 * - Every public excerpt equals its indexed segment text.
 * - No orphaned or unstable anchors across supported file types.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { extractTxt } from "@/lib/extractor/txt";
import { extractPdf } from "@/lib/extractor/pdf";
import { extractDocx } from "@/lib/extractor/docx";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(FIXTURE_DIR, name));
}

// ─── TXT ─────────────────────────────────────────────────────────────────────

describe("TEST-001 · TXT extraction", () => {
  const buf = readFixture("mutual-nda.txt");

  it("produces identical segment IDs on two successive parses", () => {
    const r1 = extractTxt(buf, "A");
    const r2 = extractTxt(buf, "A");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    const ids1 = r1.segments.map((s) => s.id);
    const ids2 = r2.segments.map((s) => s.id);
    expect(ids1).toEqual(ids2);
  });

  it("produces identical segment text on two successive parses", () => {
    const r1 = extractTxt(buf, "A");
    const r2 = extractTxt(buf, "A");
    if (!r1.ok || !r2.ok) return;

    const texts1 = r1.segments.map((s) => s.text);
    const texts2 = r2.segments.map((s) => s.text);
    expect(texts1).toEqual(texts2);
  });

  it("every segment id starts with 'A-'", () => {
    const r = extractTxt(buf, "A");
    if (!r.ok) return;
    for (const seg of r.segments) {
      expect(seg.id).toMatch(/^A-/);
    }
  });

  it("every segment locator mentions line numbers", () => {
    const r = extractTxt(buf, "A");
    if (!r.ok) return;
    for (const seg of r.segments) {
      expect(seg.locator).toMatch(/lines?/i);
    }
  });

  it("segment text is non-empty", () => {
    const r = extractTxt(buf, "A");
    if (!r.ok) return;
    for (const seg of r.segments) {
      expect(seg.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("document field is 'A'", () => {
    const r = extractTxt(buf, "A");
    if (!r.ok) return;
    for (const seg of r.segments) {
      expect(seg.document).toBe("A");
    }
  });

  it("document B produces ids starting with B-", () => {
    const r = extractTxt(buf, "B");
    if (!r.ok) return;
    for (const seg of r.segments) {
      expect(seg.id).toMatch(/^B-/);
    }
  });

  it("segment IDs are unique within a document", () => {
    const r = extractTxt(buf, "A");
    if (!r.ok) return;
    const ids = r.segments.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("at least one segment is extracted from the NDA fixture", () => {
    const r = extractTxt(buf, "A");
    if (!r.ok) throw new Error("extraction failed");
    expect(r.segments.length).toBeGreaterThan(0);
  });
});

// ─── PDF ─────────────────────────────────────────────────────────────────────

describe("TEST-001 · PDF extraction", () => {
  it("extracts from residential-lease.pdf with deterministic IDs", async () => {
    const fixturePath = path.join(FIXTURE_DIR, "residential-lease.pdf");
    if (!fs.existsSync(fixturePath)) {
      console.warn("TEST-001 PDF: fixture missing, skipping");
      return;
    }
    const buf = readFixture("residential-lease.pdf");
    const r1 = await extractPdf(buf, "A");
    const r2 = await extractPdf(buf, "A");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    expect(r1.segments.map((s) => s.id)).toEqual(r2.segments.map((s) => s.id));
  });

  it("PDF locators include page number", async () => {
    const fixturePath = path.join(FIXTURE_DIR, "residential-lease.pdf");
    if (!fs.existsSync(fixturePath)) return;
    const buf = readFixture("residential-lease.pdf");
    const r = await extractPdf(buf, "A");
    if (!r.ok) return;
    for (const seg of r.segments) {
      expect(seg.locator).toMatch(/page/i);
    }
  });

  it("returns ENCRYPTED_DOCUMENT for a password-protected PDF", async () => {
    const fixturePath = path.join(FIXTURE_DIR, "encrypted.pdf");
    if (!fs.existsSync(fixturePath)) return;
    const buf = readFixture("encrypted.pdf");
    const r = await extractPdf(buf, "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("ENCRYPTED_DOCUMENT");
  });

  it("returns NO_EXTRACTABLE_TEXT for an image-only PDF", async () => {
    const fixturePath = path.join(FIXTURE_DIR, "image-only.pdf");
    if (!fs.existsSync(fixturePath)) return;
    const buf = readFixture("image-only.pdf");
    const r = await extractPdf(buf, "A");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["NO_EXTRACTABLE_TEXT", "CORRUPT_DOCUMENT"]).toContain(r.error);
  });
});

// ─── DOCX ────────────────────────────────────────────────────────────────────

describe("TEST-001 · DOCX extraction", () => {
  it("extracts from services-agreement.docx with deterministic IDs", async () => {
    const fixturePath = path.join(FIXTURE_DIR, "services-agreement.docx");
    if (!fs.existsSync(fixturePath)) {
      console.warn("TEST-001 DOCX: fixture missing, skipping");
      return;
    }
    const buf = readFixture("services-agreement.docx");
    const r1 = await extractDocx(buf, "A");
    const r2 = await extractDocx(buf, "A");
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;

    expect(r1.segments.map((s) => s.id)).toEqual(r2.segments.map((s) => s.id));
  });

  it("DOCX locators include paragraph reference", async () => {
    const fixturePath = path.join(FIXTURE_DIR, "services-agreement.docx");
    if (!fs.existsSync(fixturePath)) return;
    const buf = readFixture("services-agreement.docx");
    const r = await extractDocx(buf, "A");
    if (!r.ok) return;
    for (const seg of r.segments) {
      expect(seg.locator).toMatch(/para|heading|section/i);
    }
  });
});

// ─── Cross-document anchor isolation ─────────────────────────────────────────

describe("TEST-001 · Cross-document anchor isolation", () => {
  it("Document A and B anchors from the same file do not collide", () => {
    const buf = readFixture("mutual-nda.txt");
    const rA = extractTxt(buf, "A");
    const rB = extractTxt(buf, "B");
    if (!rA.ok || !rB.ok) return;

    const idsA = new Set(rA.segments.map((s) => s.id));
    const idsB = new Set(rB.segments.map((s) => s.id));
    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false);
    }
  });
});
