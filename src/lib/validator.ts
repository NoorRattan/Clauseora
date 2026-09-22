/**
 * Upload validator — the gatekeeper for all uploaded files.
 * Runs before any model call. Never returns partial data on failure.
 *
 * Admission sequence (per API contract):
 * byte size → extension allowlist → signature/MIME agreement →
 * parser safety limits → extractable text → configured budget
 */

import type { Mode, ErrorCode } from "@/types/evidence";
import { TextDecoder } from "node:util";

// ─── Limits ───────────────────────────────────────────────────────────────────

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_QUESTION_CHARS = 2_000;
export const MIN_QUESTION_CHARS = 1;

// Supported extension → expected MIME types
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  txt: ["text/plain", "application/octet-stream", "text/plain; charset=utf-8"],
};

// Magic bytes for signature checking
const MAGIC: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  docx: [[0x50, 0x4b, 0x03, 0x04]], // PK (ZIP)
  txt: [], // No reliable magic; checked by cross-type detection below
};

// Cross-type magic: if buffer starts with these bytes, it cannot be txt
const FORBIDDEN_IN_TXT: Array<{ magic: number[]; label: string }> = [
  { magic: [0x25, 0x50, 0x44, 0x46], label: "PDF" },  // %PDF
  { magic: [0x50, 0x4b, 0x03, 0x04], label: "ZIP/DOCX" }, // PK
  { magic: [0x50, 0x4b, 0x05, 0x06], label: "ZIP/DOCX" }, // PK empty
  { magic: [0xd0, 0xcf, 0x11, 0xe0], label: "OLE" }, // Old DOC
  { magic: [0xff, 0xd8, 0xff], label: "JPEG" },
  { magic: [0x89, 0x50, 0x4e, 0x47], label: "PNG" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidatedFile = {
  extension: "pdf" | "docx" | "txt";
  displayName: string;
};

export type ValidationError = {
  code: ErrorCode;
  message: string;
};

export type ValidationSuccess = {
  mode: Mode;
  fileA: ValidatedFile;
  fileB?: ValidatedFile;
  question?: string;
};

export type ValidationResult =
  | { ok: true; data: ValidationSuccess }
  | { ok: false; error: ValidationError };

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Validate a Next.js FormData object from the /api/process endpoint.
 * Returns a typed result; never throws.
 */
export function validateRequest(formData: FormData): ValidationResult {
  // 1. Mode
  const modeValues = formData.getAll("mode");
  const modeRaw = modeValues[0];
  if (
    modeValues.length !== 1 ||
    typeof modeRaw !== "string" ||
    !["simplify", "compare", "ask"].includes(modeRaw)
  ) {
    return err("INVALID_REQUEST", "mode must be simplify, compare, or ask.");
  }
  const mode = modeRaw as Mode;

  // 2. File count. Reject repeated named fields and file values in any
  // unexpected field; otherwise an attacker can smuggle an extra upload that
  // the route silently ignores.
  const documentAValues = formData.getAll("documentA");
  const documentBValues = formData.getAll("documentB");
  const allowedFileFields = new Set(
    mode === "compare" ? ["documentA", "documentB"] : ["documentA"],
  );
  const allowedFields = new Set([
    "mode",
    ...allowedFileFields,
    ...(mode === "ask" ? ["question"] : []),
  ]);
  for (const [field, value] of formData.entries()) {
    if (!allowedFields.has(field)) {
      return err("INVALID_REQUEST", "Unexpected form fields are not accepted.");
    }
    if (value instanceof File && !allowedFileFields.has(field)) {
      return err("WRONG_FILE_COUNT", "Only the required document fields are accepted.");
    }
  }

  if (documentAValues.length !== 1 || !(documentAValues[0] instanceof File)) {
    return err("WRONG_FILE_COUNT", "documentA is required.");
  }
  const fileA = documentAValues[0];

  if (mode === "compare" && (documentBValues.length !== 1 || !(documentBValues[0] instanceof File))) {
    return err("WRONG_FILE_COUNT", "Compare mode requires documentB.");
  }
  if (mode !== "compare" && documentBValues.length > 0) {
    return err("WRONG_FILE_COUNT", "Only one document is accepted for this mode.");
  }
  const fileB = documentBValues[0];

  // 3. Validate each file
  const validA = validateFile(fileA);
  if (!validA.ok) return { ok: false, error: validA.error };

  let validB: { ok: true; file: ValidatedFile } | { ok: false; error: ValidationError } | undefined;
  if (fileB instanceof File) {
    validB = validateFile(fileB);
    if (!validB.ok) return { ok: false, error: validB.error };
  }

  // 4. Question for Ask mode
  let question: string | undefined;
  const questionValues = formData.getAll("question");
  if (mode === "ask") {
    if (questionValues.length !== 1) {
      return err("INVALID_REQUEST", "Ask mode requires exactly one question.");
    }
    const q = questionValues[0];
    if (typeof q !== "string") {
      return err("INVALID_REQUEST", "question is required for Ask mode.");
    }
    const qCheck = validateQuestion(q);
    if (!qCheck.valid) {
      return err(
        qCheck.code || "INVALID_REQUEST",
        q.trim().length === 0
          ? "question must not be empty."
          : `question must be at most ${MAX_QUESTION_CHARS} characters.`
      );
    }
    question = qCheck.sanitized;
  } else if (questionValues.length > 0) {
    return err("INVALID_REQUEST", "question is only accepted in Ask mode.");
  }

  return {
    ok: true,
    data: {
      mode,
      fileA: validA.file,
      fileB: validB?.ok ? validB.file : undefined,
      question,
    },
  };
}

// ─── Per-file validation ──────────────────────────────────────────────────────

function validateFile(
  file: File
): { ok: true; file: ValidatedFile } | { ok: false; error: ValidationError } {
  // 1. Byte size
  if (file.size === 0) {
    return {
      ok: false,
      error: {
        code: "NO_EXTRACTABLE_TEXT",
        message: "The uploaded document is empty. Please choose a document with readable text.",
      },
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `File exceeds the 8 MB limit. Please upload a smaller document.`,
      },
    };
  }

  // 2. Extension allowlist — use only the sanitized basename
  const safeName = sanitizeDisplayName(file.name);
  const ext = safeName.split(".").pop()?.toLowerCase();
  if (!ext || !(ext in ALLOWED_EXTENSIONS)) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_FILE_TYPE",
        message: `Unsupported file type. Accepted: PDF, DOCX, TXT.`,
      },
    };
  }

  return {
    ok: true,
    file: {
      extension: ext as "pdf" | "docx" | "txt",
      displayName: safeName,
    },
  };
}

/**
 * Verify that the file buffer's magic bytes match the declared extension.
 * Must be called after the buffer is available.
 */
export function verifySignature(
  buffer: Buffer,
  extension: "pdf" | "docx" | "txt",
  declaredMime: string
): { ok: true } | { ok: false; error: ValidationError } {
  // MIME allowlist
  const allowedMimes = ALLOWED_EXTENSIONS[extension];
  const normalizedMime = declaredMime.split(";")[0].trim().toLowerCase();
  if (normalizedMime && !allowedMimes.includes(normalizedMime)) {
    return {
      ok: false,
      error: {
        code: "TYPE_MISMATCH",
        message: `The reported file type does not match the declared extension (${extension.toUpperCase()}).`,
      },
    };
  }

  // Magic bytes — check that buffer starts with the expected signature
  const magics = MAGIC[extension];
  if (magics.length > 0) {
    const matches = magics.some((magic) =>
      magic.every((byte, i) => buffer[i] === byte)
    );
    if (!matches) {
      return {
        ok: false,
        error: {
          code: "TYPE_MISMATCH",
          message: `File content does not match the declared type (${extension.toUpperCase()}).`,
        },
      };
    }
  }

  // Cross-type detection for TXT: reject binary formats masquerading as text
  if (extension === "txt") {
    for (const { magic, label } of FORBIDDEN_IN_TXT) {
      if (magic.every((byte, i) => buffer[i] === byte)) {
        return {
          ok: false,
          error: {
            code: "TYPE_MISMATCH",
            message: `File appears to be a ${label} file, not a plain text document. Please upload a .txt file.`,
          },
        };
      }
    }

    // Plain text has no magic number, so reject binary data and invalid UTF-8
    // before it reaches the text extractor or model prompt.
    if (buffer.includes(0)) {
      return {
        ok: false,
        error: {
          code: "TYPE_MISMATCH",
          message: "File content does not appear to be UTF-8 plain text.",
        },
      };
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return {
        ok: false,
        error: {
          code: "TYPE_MISMATCH",
          message: "File content does not appear to be UTF-8 plain text.",
        },
      };
    }
  }

  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip directory components and dangerous characters from a filename. */
export function sanitizeDisplayName(name: string): string {
  const basename = name.replace(/[/\\]/g, "_").replace(/[^\w.\-\s]/g, "_");
  return basename.slice(0, 200) || "document";
}

function err(code: ErrorCode, message: string): { ok: false; error: ValidationError } {
  return { ok: false, error: { code, message } };
}

/** Validate standalone question string for Ask mode */
export function validateQuestion(question: string): {
  valid: boolean;
  code?: ErrorCode;
  sanitized?: string;
} {
  const trimmed = question.trim();
  if (trimmed.length < MIN_QUESTION_CHARS) {
    return { valid: false, code: "INVALID_REQUEST" };
  }
  if (trimmed.length > MAX_QUESTION_CHARS) {
    return { valid: false, code: "INVALID_REQUEST" };
  }
  return { valid: true, sanitized: trimmed };
}
