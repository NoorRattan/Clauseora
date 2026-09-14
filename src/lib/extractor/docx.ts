/**
 * DOCX document extractor.
 * Preserves heading/paragraph structure as locators.
 * Does NOT execute macros, fetch remote resources, or process embedded objects.
 */

import { normalizeText, splitIntoBlocks, assignAnchors } from "./anchor";
import type { Segment } from "@/types/evidence";

export const DOCX_MAX_BYTES = 8 * 1024 * 1024;
export const DOCX_MAX_CHARS = 120_000;

export type DocxExtractionResult =
  | { ok: true; segments: Segment[]; charCount: number; paragraphCount: number }
  | {
      ok: false;
      error:
        | "NO_EXTRACTABLE_TEXT"
        | "DOCUMENT_TOO_LONG"
        | "CORRUPT_DOCUMENT";
    };

/**
 * Extract text with paragraph/heading locators from a DOCX buffer.
 * Uses mammoth's raw messages to extract structured content.
 */
export async function extractDocx(
  buffer: Buffer,
  document: "A" | "B"
): Promise<DocxExtractionResult> {
  let mammoth: {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
    convertToHtml: (opts: { buffer: Buffer }, opts2?: object) => Promise<{ value: string; messages: unknown[] }>;
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mammoth = require("mammoth");
  } catch {
    return { ok: false, error: "CORRUPT_DOCUMENT" };
  }

  let rawResult: { value: string; messages: unknown[] };
  try {
    rawResult = await mammoth.extractRawText({ buffer });
  } catch {
    return { ok: false, error: "CORRUPT_DOCUMENT" };
  }

  if (!rawResult.value || !rawResult.value.trim()) {
    return { ok: false, error: "NO_EXTRACTABLE_TEXT" };
  }

  const normalized = normalizeText(rawResult.value);
  if (!normalized) return { ok: false, error: "NO_EXTRACTABLE_TEXT" };
  if (normalized.length > DOCX_MAX_CHARS) return { ok: false, error: "DOCUMENT_TOO_LONG" };

  // Split into paragraphs and track heading state for locators
  const rawParagraphs = normalized.split(/\n\n+/);
  const located: Array<{ locator: string; heading?: string; blocks: string[] }> = [];
  let paragraphNum = 0;
  let currentHeading: string | undefined;

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    paragraphNum++;

    // Heuristic: short all-caps or title-case lines without punctuation are headings
    const isHeading =
      trimmed.length <= 120 &&
      !trimmed.endsWith(".") &&
      (trimmed === trimmed.toUpperCase() ||
        /^[A-Z][^.!?]*$/.test(trimmed));

    if (isHeading) {
      currentHeading = trimmed;
    }

    const locator = `Paragraph ${paragraphNum}`;
    located.push({
      locator,
      heading: currentHeading,
      blocks: splitIntoBlocks(trimmed),
    });
  }

  if (located.length === 0) return { ok: false, error: "NO_EXTRACTABLE_TEXT" };

  const segments = assignAnchors(document, located);
  return {
    ok: true,
    segments,
    charCount: normalized.length,
    paragraphCount: paragraphNum,
  };
}
