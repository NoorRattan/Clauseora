/**
 * DOCX document extractor.
 * Preserves heading/paragraph structure as locators.
 * Does NOT execute macros, fetch remote resources, or process embedded objects.
 */

import { normalizeText, splitIntoBlocks, assignAnchors } from "./anchor";
import type { Segment } from "@/types/evidence";

export const DOCX_MAX_BYTES = 8 * 1024 * 1024;
export const DOCX_MAX_CHARS = 120_000;
const DOCX_MAX_ZIP_ENTRIES = 1_000;
const DOCX_MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;

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
  const zipSafety = validateDocxZip(buffer);
  if (zipSafety !== "ok") return { ok: false, error: zipSafety };

  let mammoth: {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
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

type ZipSafetyResult = "ok" | "CORRUPT_DOCUMENT" | "DOCUMENT_TOO_LONG";

/**
 * Inspect the ZIP central directory before Mammoth inflates any DOCX entry.
 * This bounds entry count/expansion and rejects path-shaped member names.
 */
function validateDocxZip(buffer: Buffer): ZipSafetyResult {
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocd = buffer.lastIndexOf(eocdSignature);
  if (eocd < 0 || eocd + 22 > buffer.length) return "CORRUPT_DOCUMENT";

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff) return "DOCUMENT_TOO_LONG";
  if (
    entryCount > DOCX_MAX_ZIP_ENTRIES ||
    centralDirectoryOffset + centralDirectorySize > buffer.length
  ) {
    return entryCount > DOCX_MAX_ZIP_ENTRIES
      ? "DOCUMENT_TOO_LONG"
      : "CORRUPT_DOCUMENT";
  }

  let offset = centralDirectoryOffset;
  let totalUncompressed = 0;
  let hasDocumentXml = false;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      return "CORRUPT_DOCUMENT";
    }

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > buffer.length) return "CORRUPT_DOCUMENT";

    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name === "word/document.xml") hasDocumentXml = true;
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").some((part) => part === "..") ||
      name.includes("\u0000")
    ) {
      return "CORRUPT_DOCUMENT";
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > DOCX_MAX_UNCOMPRESSED_BYTES) {
      return "DOCUMENT_TOO_LONG";
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > 1_000) {
      return "DOCUMENT_TOO_LONG";
    }

    offset = nextOffset;
  }

  return hasDocumentXml ? "ok" : "CORRUPT_DOCUMENT";
}
