import type { Metadata } from "next";
import AnalysisWorkspace from "../components/AnalysisWorkspace";
export const metadata: Metadata = {
  title: "Document workspace — Clauseora",
  description:
    "Simplify contracts, compare versions, and ask questions with source-linked evidence.",
};
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return (
    <AnalysisWorkspace
      key={mode}
      initialMode={mode === "compare" || mode === "ask" ? mode : "simplify"}
    />
  );
}
