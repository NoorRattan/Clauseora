/**
 * TXT document extractor.
 * Preserves line ranges as locators.
 * No OCR, no external fetching.
 */

import { normalizeText, splitIntoBlocks, assignAnchors } from "./anchor";
import type { Segment } from "@/types/evidence";

/** Maximum characters extracted from a TXT file. */
export const TXT_MAX_CHARS = 120_000;
/** Maximum lines allowed. */
export const TXT_MAX_LINES = 5_000;

export type TxtExtractionResult =
  | { ok: true; segments: Segment[]; charCount: number; lineCount: number }
  | { ok: false; error: "NO_EXTRACTABLE_TEXT" | "DOCUMENT_TOO_LONG" };

/**
 * Extract segments from a plain-text buffer.
 * Groups lines into logical blocks and assigns anchor IDs.
 */
export function extractTxt(
  buffer: Buffer,
  document: "A" | "B"
): TxtExtractionResult {
  const raw = buffer.toString("utf-8");
  const normalized = normalizeText(raw);

  if (!normalized) {
    return { ok: false, error: "NO_EXTRACTABLE_TEXT" };
  }
  if (normalized.length > TXT_MAX_CHARS) {
    return { ok: false, error: "DOCUMENT_TOO_LONG" };
  }

  const allLines = normalized.split("\n");
  if (allLines.length > TXT_MAX_LINES) {
    return { ok: false, error: "DOCUMENT_TOO_LONG" };
  }

  // Group lines into paragraph-like chunks, tracking line numbers
  const located: Array<{ locator: string; blocks: string[] }> = [];
  let groupStart = 1;
  let groupLines: string[] = [];

  const flush = () => {
    if (!groupLines.length) return;
    const text = groupLines.join("\n").trim();
    if (!text) return;
    const endLine = groupStart + groupLines.length - 1;
    const locator =
      groupStart === endLine
        ? `Line ${groupStart}`
        : `Lines ${groupStart}–${endLine}`;
    located.push({ locator, blocks: splitIntoBlocks(text) });
  };

  let lineNum = 0;
  for (const line of allLines) {
    lineNum++;
    if (line.trim() === "") {
      flush();
      groupStart = lineNum + 1;
      groupLines = [];
    } else {
      if (groupLines.length === 0) groupStart = lineNum;
      groupLines.push(line);
    }
  }
  flush();

  const segments = assignAnchors(document, located);
  return {
    ok: true,
    segments,
    charCount: normalized.length,
    lineCount: allLines.length,
  };
}
