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
  if (buffer.length > PDF_MAX_BYTES) {
    return { ok: false, error: "DOCUMENT_TOO_LONG" };
  }

  // Dynamically import pdf-parse (CJS module) to keep this tree-shakeable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfModule: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfModule = require("pdf-parse");
  } catch {
    return { ok: false, error: "CORRUPT_DOCUMENT" };
  }

  // Per-page text accumulation
  const pageTexts: string[] = [];
  let numpages = 0;
  let parser:
    | {
        getText: () => Promise<{
          total?: number;
          pages?: Array<{ text?: string }>;
          text?: string;
        }>;
        destroy?: () => Promise<void> | void;
      }
    | undefined;

  try {
    if (pdfModule.PDFParse) {
      const pdfParser = new pdfModule.PDFParse({ data: buffer }) as {
        getText: () => Promise<{
          total?: number;
          pages?: Array<{ text?: string }>;
          text?: string;
        }>;
        destroy?: () => Promise<void> | void;
      };
      parser = pdfParser;
      const result = await pdfParser.getText();
      numpages = result.total || result.pages?.length || 1;
      if (numpages > PDF_MAX_PAGES) {
        return { ok: false, error: "DOCUMENT_TOO_LONG" };
      }
      if (Array.isArray(result.pages)) {
        for (const p of result.pages) {
          pageTexts.push(p.text || "");
        }
      } else if (result.text) {
        pageTexts.push(result.text);
      }
    } else if (typeof pdfModule === "function" || typeof pdfModule.default === "function") {
      const fn = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
      const options = {
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
        max: PDF_MAX_PAGES + 1,
      };
      const parsed = await fn(buffer, options);
      numpages = parsed.numpages;
    } else {
      return { ok: false, error: "CORRUPT_DOCUMENT" };
    }
  } catch (err: unknown) {
    const msg = String(err);
    if (
      (pdfModule.PasswordException && err instanceof pdfModule.PasswordException) ||
      msg.toLowerCase().includes("encrypt") ||
      msg.toLowerCase().includes("password")
    ) {
      return { ok: false, error: "ENCRYPTED_DOCUMENT" };
    }
    return { ok: false, error: "CORRUPT_DOCUMENT" };
  } finally {
    try {
      await parser?.destroy?.();
    } catch {
      // Parser cleanup must never change the safe extraction result.
    }
  }

  if (numpages > PDF_MAX_PAGES) {
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

  if (located.length === 0) {
    return { ok: false, error: "NO_EXTRACTABLE_TEXT" };
  }

  const segments = assignAnchors(document, located);
  return {
    ok: true,
    segments,
    pageCount: numpages,
    charCount: totalChars,
  };
}
