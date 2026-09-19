import type { Mode, SimplifyResult, CompareResult, AskResult } from "@/types/evidence";

/** Build a map from anchor ID to the claim text that references it. */
export function buildClaimTexts(
  result: SimplifyResult | CompareResult | AskResult,
  mode: Mode
): Map<string, string> {
  const map = new Map<string, string>();

  if (mode === "simplify") {
    const r = result as SimplifyResult;
    for (const clause of r.clauses ?? []) {
      for (const item of clause.items ?? []) {
        if (item.kind === "money" || item.kind === "deadline") {
          for (const id of item.anchorIds ?? []) {
            map.set(id, item.statement);
          }
        }
      }
    }
  } else if (mode === "compare") {
    const r = result as CompareResult;
    for (const change of r.changes ?? []) {
      for (const id of change.anchorIdsA ?? []) {
        if (change.before && !map.has(id)) map.set(id, change.before);
      }
      for (const id of change.anchorIdsB ?? []) {
        if (change.after && !map.has(id)) map.set(id, change.after);
      }
    }
  }

  return map;
}

