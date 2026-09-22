import { extractDocx } from "@/lib/extractor/docx";
import { extractPdf } from "@/lib/extractor/pdf";
import { extractTxt } from "@/lib/extractor/txt";
import { getAskPrompt } from "@/lib/prompts/ask";
import { getComparePrompt } from "@/lib/prompts/compare";
import { getSimplifyPrompt } from "@/lib/prompts/simplify";
import type {
  ActionPack,
  AskResult,
  CompareResult,
  ErrorCode,
  Mode,
  Segment,
  SimplifyResult,
} from "@/types/evidence";

type ModeResult = SimplifyResult | CompareResult | AskResult;

export async function extractBuffer(
  buffer: Buffer,
  extension: "pdf" | "docx" | "txt",
  document: "A" | "B",
): Promise<
  | { ok: true; segments: Segment[]; pageCount?: number }
  | { ok: false; error: ErrorCode }
> {
  if (extension === "txt") {
    const result = extractTxt(buffer, document);
    return result.ok
      ? { ok: true, segments: result.segments }
      : { ok: false, error: result.error };
  }
  if (extension === "pdf") {
    const result = await extractPdf(buffer, document);
    return result.ok
      ? { ok: true, segments: result.segments, pageCount: result.pageCount }
      : { ok: false, error: result.error };
  }
  if (extension === "docx") {
    const result = await extractDocx(buffer, document);
    return result.ok
      ? { ok: true, segments: result.segments }
      : { ok: false, error: result.error };
  }
  return { ok: false, error: "UNSUPPORTED_FILE_TYPE" };
}

export function getSystemPrompt(
  mode: Mode,
  anchorIdsA: string[],
  anchorIdsB: string[],
): string {
  if (mode === "simplify") return getSimplifyPrompt(anchorIdsA);
  if (mode === "compare") return getComparePrompt(anchorIdsA, anchorIdsB);
  return getAskPrompt(anchorIdsA);
}

/** Fail closed when a model cites an unknown or cross-document anchor. */
export function validateAnchors(
  result: ModeResult,
  usedIds: string[],
  allowedIds: string[],
  mode: Mode,
  allowedIdsA: string[] = [],
  allowedIdsB: string[] = [],
): { ok: boolean } {
  const allowed = new Set(allowedIds);
  if (usedIds.some((id) => !allowed.has(id))) return { ok: false };

  if (mode === "compare") {
    const allowedA = new Set(allowedIdsA);
    const allowedB = new Set(allowedIdsB);
    for (const change of (result as CompareResult).changes) {
      if (change.anchorIdsA.some((id) => !allowedA.has(id))) return { ok: false };
      if (change.anchorIdsB.some((id) => !allowedB.has(id))) return { ok: false };
    }
  }

  return { ok: true };
}

export function formatServerTiming(durations: Record<string, number>): string {
  return Object.entries(durations)
    .map(([name, duration]) => `${name};dur=${Math.max(0, duration).toFixed(1)}`)
    .join(", ");
}

export function collectAllAnchorIds(
  result: ModeResult,
  actionPack: ActionPack,
  mode: Mode,
): string[] {
  const ids: string[] = [];

  if (mode === "simplify") {
    for (const clause of (result as SimplifyResult).clauses ?? []) {
      ids.push(...(clause.anchorIds ?? []));
      for (const item of clause.items ?? []) ids.push(...(item.anchorIds ?? []));
      for (const term of clause.definedTerms ?? []) ids.push(...(term.anchorIds ?? []));
    }
  } else if (mode === "compare") {
    for (const change of (result as CompareResult).changes ?? []) {
      ids.push(...(change.anchorIdsA ?? []), ...(change.anchorIdsB ?? []));
    }
  } else {
    ids.push(...((result as AskResult).anchorIds ?? []));
  }

  for (const item of actionPack.checklist ?? []) ids.push(...(item.anchorIds ?? []));
  for (const question of actionPack.lawyerQuestions ?? []) {
    ids.push(...(question.anchorIds ?? []));
  }

  return [...new Set(ids)];
}

export function selectHighImpactIds(result: ModeResult, mode: Mode): string[] {
  const highImpact: string[] = [];

  if (mode === "simplify") {
    for (const clause of (result as SimplifyResult).clauses ?? []) {
      for (const item of clause.items ?? []) {
        if (item.kind === "money" || item.kind === "deadline") {
          highImpact.push(...(item.anchorIds ?? []));
        }
      }
    }
  } else if (mode === "compare") {
    const highImpactPattern = /\$|\b\d+[,.]?\d*\s*(usd|eur|gbp|months?|mo\.?|years?|yr\.?|days?|weeks?)\b|\b(payment|retainer|fee|deposit|salary|compensation|penalty|damages|liabilit|indemnif|cap|limit|venue|jurisdiction|governing\s+law)\b|\b\d+[-\s](?:days?|weeks?|months?|years?)\b|\b(due|deadline|expir|terminat|notice|renew|surviv)/i;
    for (const change of (result as CompareResult).changes ?? []) {
      const text = [change.after ?? "", change.before ?? "", change.whyReview ?? ""].join(" ");
      if (highImpactPattern.test(text)) {
        highImpact.push(...(change.anchorIdsA ?? []), ...(change.anchorIdsB ?? []));
      }
    }
  }

  return [...new Set(highImpact)].slice(0, 5);
}

export function safeExtractMessage(code: ErrorCode): string {
  const messages: Partial<Record<ErrorCode, string>> = {
    NO_EXTRACTABLE_TEXT:
      "No readable text was found in this document. Please upload a text-layer PDF, DOCX, or TXT file. Scanned image PDFs are not supported.",
    DOCUMENT_TOO_LONG:
      "This document exceeds the processing limit. Please upload a shorter document.",
    ENCRYPTED_DOCUMENT:
      "This document is password-protected. Please upload an unencrypted version.",
    CORRUPT_DOCUMENT:
      "This document could not be read. It may be corrupted or in an unsupported format.",
  };
  return messages[code] ?? "The document could not be processed.";
}

export function safeGroqMessage(code: string): string {
  const messages: Record<string, string> = {
    DOCUMENT_TOO_LONG:
      "This document is too long for the current analysis budget. Please upload a shorter document or a subset of pages.",
    PRIMARY_QUOTA_EXHAUSTED:
      "The analysis service is temporarily at capacity. Please try again in a few minutes.",
    MODEL_TIMEOUT:
      "The analysis took too long. Please try again with a shorter document.",
    MODEL_REFUSAL:
      "The analysis service could not process this request. Please try again.",
    PRIMARY_UNAVAILABLE:
      "The analysis service is temporarily unavailable. Please try again later.",
  };
  return messages[code] ?? "An error occurred during analysis. Please try again.";
}
