/**
 * PDF document extractor.
 * Extracts text layer preserving page numbers as locators.
 * Does NOT support image-only/scanned PDFs (no OCR).
 * Does NOT execute embedded JavaScript or fetch remote resources.
 */

import { normalizeText, splitIntoBlocks, assignAnchors } from "./anchor";
import type { Segment } from "@/types/evidence";

export const PDF_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const PDF_MAX_PAGES = 150;
export const PDF_MAX_CHARS = 120_000;

export type PdfExtractionResult =
  | { ok: true; segments: Segment[]; pageCount: number; charCount: number }
  | {
      ok: false;
      error:
        | "NO_EXTRACTABLE_TEXT"
        | "DOCUMENT_TOO_LONG"
        | "ENCRYPTED_DOCUMENT"
        | "CORRUPT_DOCUMENT";
    };

/**
 * Extract text segments from a PDF buffer with page-level locators.
 */
export async function extractPdf(
  buffer: Buffer,
  document: "A" | "B"
): Promise<PdfExtractionResult> {
  // Dynamically import pdf-parse (CJS module) to keep this tree-shakeable
  let pdfParse: (buffer: Buffer, options?: object) => Promise<{
    numpages: number;
    text: string;
    // pdf-parse provides per-page text via a render callback
  }>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfParse = require("pdf-parse");
  } catch {
    return { ok: false, error: "CORRUPT_DOCUMENT" };
  }

  // Per-page text accumulation using pdf-parse's pagerender option
  const pageTexts: string[] = [];

  const options = {
    // Render each page separately so we can attach page locators
    pagerender: (pageData: {
      getTextContent: () => Promise<{
        items: Array<{ str: string; hasEOL?: boolean }>;
      }>;
    }) => {
      return pageData.getTextContent().then(
        (tc: { items: Array<{ str: string; hasEOL?: boolean }> }) => {
          const lines: string[] = [];
          let line = "";
          for (const item of tc.items) {
            line += item.str;
            if (item.hasEOL) {
              lines.push(line);
              line = "";
            }
          }
          if (line.trim()) lines.push(line);
          pageTexts.push(lines.join("\n"));
          return lines.join("\n");
        }
      );
    },
    max: PDF_MAX_PAGES + 1, // +1 so we can detect over-limit
  };

  let parsed: { numpages: number; text: string };
  try {
    parsed = await pdfParse(buffer, options);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("encrypt") || msg.includes("password")) {
      return { ok: false, error: "ENCRYPTED_DOCUMENT" };
    }
    return { ok: false, error: "CORRUPT_DOCUMENT" };
  }

  if (parsed.numpages > PDF_MAX_PAGES) {
    return { ok: false, error: "DOCUMENT_TOO_LONG" };
  }

  // Build per-page segments
  const located: Array<{ locator: string; heading?: string; blocks: string[] }> = [];
  let totalChars = 0;

  for (let i = 0; i < pageTexts.length; i++) {
    const normalized = normalizeText(pageTexts[i]);
    if (!normalized) continue;
    totalChars += normalized.length;
    if (totalChars > PDF_MAX_CHARS) {
      return { ok: false, error: "DOCUMENT_TOO_LONG" };
    }
    const locator = `Page ${i + 1}`;
    located.push({ locator, blocks: splitIntoBlocks(normalized) });
  }

  // Fallback: if pagerender didn't collect anything, use the combined text
  if (located.length === 0 && parsed.text) {
    const normalized = normalizeText(parsed.text);
    if (!normalized) return { ok: false, error: "NO_EXTRACTABLE_TEXT" };
    if (normalized.length > PDF_MAX_CHARS) return { ok: false, error: "DOCUMENT_TOO_LONG" };
    located.push({ locator: "Page 1", blocks: splitIntoBlocks(normalized) });
    totalChars = normalized.length;
  }

  if (located.length === 0) {
    return { ok: false, error: "NO_EXTRACTABLE_TEXT" };
  }

  const segments = assignAnchors(document, located);
  return {
    ok: true,
    segments,
    pageCount: parsed.numpages,
    charCount: totalChars,
  };
}
