"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  Mode,
  AnchorRef,
  SimplifyResult,
  CompareResult,
  AskResult,
  ActionPack,
  Verification,
  ClauseItem,
} from "@/types/evidence";
import { VerificationBadge } from "./VerificationBadge";
import { LEGAL_NOTICE_TEXT } from "@/types/evidence";
import {
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Scale,
  DollarSign,
  Clock,
  HelpCircle,
  CheckSquare,
  Square,
  Bookmark,
  Sparkles,
} from "lucide-react";

interface ResultViewProps {
  mode: Mode;
  result: SimplifyResult | CompareResult | AskResult;
  actionPack: ActionPack;
  verification: Verification;
  resolvedAnchors: AnchorRef[];
  onEvidenceClick: (anchor: AnchorRef) => void;
}

// ─── Shared Evidence Chip ──────────────────────────────────────────────────────

function EvidenceChip({
  anchorId,
  resolvedAnchors,
  onEvidenceClick,
}: {
  anchorId: string;
  resolvedAnchors: AnchorRef[];
  onEvidenceClick: (anchor: AnchorRef) => void;
}) {
  const anchor = resolvedAnchors.find((a) => a.anchorId === anchorId);
  if (!anchor) return null;
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      type="button"
      onClick={() => onEvidenceClick(anchor)}
      aria-label={`Evidence: ${anchor.locator}`}
      title={`Click to view verbatim source excerpt: ${anchor.locator}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400 shadow-sm transition-all duration-200"
    >
      <Bookmark className="w-3 h-3 text-amber-400" />
      <span>{anchor.locator}</span>
    </motion.button>
  );
}

function EvidenceChips({
  ids,
  resolvedAnchors,
  onEvidenceClick,
}: {
  ids: string[];
  resolvedAnchors: AnchorRef[];
  onEvidenceClick: (anchor: AnchorRef) => void;
}) {
  if (!ids?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
      <span className="text-[11px] font-mono text-slate-500 mr-0.5">Anchors:</span>
      {ids.map((id) => (
        <EvidenceChip
          key={id}
          anchorId={id}
          resolvedAnchors={resolvedAnchors}
          onEvidenceClick={onEvidenceClick}
        />
      ))}
    </div>
  );
}

// ─── Kind Badge ────────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<
  ClauseItem["kind"],
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  obligation: {
    label: "Obligation",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    border: "border-cyan-500/30",
    icon: <Scale className="w-3 h-3 text-cyan-400" />,
  },
  deadline: {
    label: "Deadline",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    border: "border-amber-500/30",
    icon: <Clock className="w-3 h-3 text-amber-400" />,
  },
  money: {
    label: "Financial",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    icon: <DollarSign className="w-3 h-3 text-emerald-400" />,
  },
  condition: {
    label: "Condition",
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    border: "border-purple-500/30",
    icon: <HelpCircle className="w-3 h-3 text-purple-400" />,
  },
  review_flag: {
    label: "Review Flag",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    border: "border-rose-500/30",
    icon: <AlertTriangle className="w-3 h-3 text-rose-400" />,
  },
};

function KindBadge({ kind }: { kind: ClauseItem["kind"] }) {
  const conf = KIND_CONFIG[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium tracking-wide uppercase ${conf.bg} ${conf.text} border ${conf.border}`}
      aria-label={`Item type: ${conf.label}`}
    >
      {conf.icon}
      {conf.label}
    </span>
  );
}

// ─── Simplify View ─────────────────────────────────────────────────────────────

function SimplifyView({
  result,
  resolvedAnchors,
  onEvidenceClick,
}: {
  result: SimplifyResult;
  resolvedAnchors: AnchorRef[];
  onEvidenceClick: (anchor: AnchorRef) => void;
}) {
  const [openClauses, setOpenClauses] = useState<Set<number>>(new Set([0]));

  const toggleClause = (i: number) => {
    setOpenClauses((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const expandAll = () => {
    setOpenClauses(new Set(result.clauses.map((_, i) => i)));
  };

  const collapseAll = () => {
    setOpenClauses(new Set());
  };

  if (!result.clauses?.length) {
    return (
      <div className="p-8 text-center rounded-2xl border border-white/10 bg-obsidian-900/60">
        <p className="text-slate-400 text-sm">No clauses were identified in this document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View controls */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-mono text-slate-400">
          Showing {result.clauses.length} structured clause section
          {result.clauses.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-xs font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10 transition-colors"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {result.clauses.map((clause, i) => {
          const isOpen = openClauses.has(i);
          return (
            <motion.div
              key={i}
              initial={false}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                isOpen
                  ? "border-white/20 bg-obsidian-900/90 shadow-glass-elevated"
                  : "border-white/10 bg-obsidian-900/50 hover:border-white/20 hover:bg-obsidian-850/60"
              } backdrop-blur-xl`}
            >
              {/* Card Header Accordion Trigger */}
              <button
                type="button"
                className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors"
                aria-expanded={isOpen}
                aria-controls={`clause-body-${i}`}
                onClick={() => toggleClause(i)}
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <span className="text-xs font-mono text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                    § 0{i + 1}
                  </span>
                  <span className="text-base font-bold text-white tracking-tight truncate">
                    {clause.topic}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {clause.items?.length > 0 && (
                    <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
                      {clause.items.length} item{clause.items.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
              </button>

              {/* Card Body with Framer Motion AnimatePresence */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    id={`clause-body-${i}`}
                  >
                    <div className="px-6 pb-6 pt-2 border-t border-white/5 space-y-5">
                      {/* Plain Language Synthesis */}
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                          In Plain Language
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed font-sans">
                          {clause.plainLanguage}
                        </p>
                        <EvidenceChips
                          ids={clause.anchorIds}
                          resolvedAnchors={resolvedAnchors}
                          onEvidenceClick={onEvidenceClick}
                        />
                      </div>

                      {/* Defined Terms */}
                      {clause.definedTerms?.length > 0 && (
                        <div className="p-4 rounded-xl bg-obsidian-950/60 border border-white/5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2 font-mono flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Defined Legal Terms</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {clause.definedTerms.map((dt, di) => (
                              <div
                                key={di}
                                className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs leading-normal"
                              >
                                <span className="font-bold text-cyan-300 font-mono">
                                  {dt.term}
                                </span>
                                <span className="text-slate-400"> — {dt.meaningInContext}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Itemized Terms / Specific Obligations */}
                      {clause.items?.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                            Key Details and Conditions
                          </div>
                          <div className="space-y-2">
                            {clause.items.map((item, ii) => (
                              <div
                                key={ii}
                                className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                              >
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <KindBadge kind={item.kind} />
                                  {item.party && item.party !== "not_stated" && (
                                    <span className="text-xs font-semibold text-slate-300 bg-white/5 px-2 py-0.5 rounded">
                                      Party: {item.party}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-slate-200 leading-relaxed font-sans">
                                  {item.statement}
                                </div>
                                <EvidenceChips
                                  ids={item.anchorIds}
                                  resolvedAnchors={resolvedAnchors}
                                  onEvidenceClick={onEvidenceClick}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Compare View ──────────────────────────────────────────────────────────────

type ChangeFilter = "all" | "added" | "removed" | "modified";

function CompareView({
  result,
  resolvedAnchors,
  onEvidenceClick,
}: {
  result: CompareResult;
  resolvedAnchors: AnchorRef[];
  onEvidenceClick: (anchor: AnchorRef) => void;
}) {
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const filters: ChangeFilter[] = ["all", "added", "removed", "modified"];

  const changes = result.changes ?? [];
  const filtered = filter === "all" ? changes : changes.filter((c) => c.changeType === filter);

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter changes">
        {filters.map((f) => {
          const count =
            f === "all" ? changes.length : changes.filter((c) => c.changeType === f).length;
          const isActive = filter === f;
          return (
            <button
              key={f}
              type="button"
              className={`px-3 py-1.5 rounded-xl text-xs font-medium font-mono transition-all duration-200 ${
                isActive
                  ? "bg-amber-500 text-obsidian-950 font-bold shadow-glow-amber"
                  : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
              onClick={() => setFilter(f)}
              aria-pressed={isActive}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
              <span className="opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-white/10 bg-obsidian-900/60">
          <p className="text-slate-300 font-medium">No substantive changes match this filter.</p>
          <p className="text-xs text-slate-500 mt-1">
            Important content may have been missed. Always verify against source documents.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((change, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border ${
                change.changeType === "added"
                  ? "border-emerald-500/30 bg-emerald-950/10"
                  : change.changeType === "removed"
                  ? "border-rose-500/30 bg-rose-950/10"
                  : "border-amber-500/30 bg-amber-950/10"
              } backdrop-blur-xl p-6 space-y-4 shadow-glass-subtle`}
            >
              {/* Change Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold font-mono uppercase tracking-wider ${
                      change.changeType === "added"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : change.changeType === "removed"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {change.changeType}
                  </span>
                  <span className="text-base font-bold text-white tracking-tight">
                    {change.topic}
                  </span>
                </div>
              </div>

              {/* Side-by-Side Comparison Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Before: Document A */}
                <div className="p-4 rounded-xl bg-obsidian-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-400">
                    <span>Document A (Before)</span>
                    <span className="text-slate-600">Original</span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      change.before ? "text-slate-200" : "text-slate-500 italic"
                    }`}
                  >
                    {change.before ?? "Not present in original version"}
                  </p>
                  <EvidenceChips
                    ids={change.anchorIdsA}
                    resolvedAnchors={resolvedAnchors}
                    onEvidenceClick={onEvidenceClick}
                  />
                </div>

                {/* After: Document B */}
                <div className="p-4 rounded-xl bg-obsidian-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-400">
                    <span>Document B (After)</span>
                    <span className="text-slate-600">Revised</span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      change.after ? "text-slate-200" : "text-slate-500 italic"
                    }`}
                  >
                    {change.after ?? "Removed from revised version"}
                  </p>
                  <EvidenceChips
                    ids={change.anchorIdsB}
                    resolvedAnchors={resolvedAnchors}
                    onEvidenceClick={onEvidenceClick}
                  />
                </div>
              </div>

              {/* Why Review Callout */}
              {change.whyReview && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 leading-relaxed flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300">Review Rationale:</span>{" "}
                    {change.whyReview}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ask View ──────────────────────────────────────────────────────────────────

function AskView({
  result,
  resolvedAnchors,
  onEvidenceClick,
}: {
  result: AskResult;
  resolvedAnchors: AnchorRef[];
  onEvidenceClick: (anchor: AnchorRef) => void;
}) {
  const statusConfig = {
    supported: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-950/20",
      text: "text-emerald-300",
      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
      label: "Directly Supported by Document",
    },
    partially_supported: {
      border: "border-amber-500/30",
      bg: "bg-amber-950/20",
      text: "text-amber-300",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      label: "Partially Supported / Contextual",
    },
    not_found: {
      border: "border-slate-700/50",
      bg: "bg-slate-900/30",
      text: "text-slate-300",
      icon: <HelpCircle className="w-4 h-4 text-slate-400" />,
      label: "Not Stated in Document",
    },
  }[result.status];

  return (
    <div className="space-y-4">
      {/* Status Pill */}
      <div
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wide uppercase ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}
      >
        {statusConfig.icon}
        <span>{statusConfig.label}</span>
      </div>

      {/* Answer Box */}
      <div className="rounded-2xl border border-white/10 bg-obsidian-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-glass-elevated space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
          Answer From the Document
        </div>
        <p className="text-slate-100 text-base leading-relaxed font-sans">{result.answer}</p>
        {result.status !== "not_found" && (
          <EvidenceChips
            ids={result.anchorIds}
            resolvedAnchors={resolvedAnchors}
            onEvidenceClick={onEvidenceClick}
          />
        )}
      </div>

      {/* Not Established List */}
      {result.notEstablished?.length > 0 && (
        <div className="p-5 rounded-2xl border border-white/10 bg-obsidian-950/60 space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Not Established by this Document
          </div>
          <ul className="space-y-1.5">
            {result.notEstablished.map((item, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-slate-600 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Action Pack ───────────────────────────────────────────────────────────────

function ActionPackSection({
  actionPack,
  resolvedAnchors,
  onEvidenceClick,
}: {
  actionPack: ActionPack;
  resolvedAnchors: AnchorRef[];
  onEvidenceClick: (anchor: AnchorRef) => void;
}) {
  const [completedItems, setCompletedItems] = useState<Set<number>>(new Set());

  const toggleItem = (idx: number) => {
    setCompletedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const hasChecklist = actionPack.checklist?.length > 0;
  const hasQuestions = actionPack.lawyerQuestions?.length > 0;

  if (!hasChecklist && !hasQuestions) return null;

  return (
    <div className="mt-8 pt-8 border-t border-white/10 space-y-6">
      {/* Section Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <CheckSquare className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Action Pack</h2>
          <p className="text-xs text-slate-400">
            Document-based checklist and questions to discuss with a legal professional
          </p>
        </div>
      </div>

      {/* Interactive Checklist */}
      {hasChecklist && (
        <section aria-labelledby="checklist-heading" className="space-y-3">
          <h3 id="checklist-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Document Checklist ({completedItems.size}/{actionPack.checklist.length} completed)
          </h3>
          <div className="space-y-2">
            {actionPack.checklist.map((item, i) => {
              const isChecked = completedItems.has(i);
              return (
                <div
                  key={i}
                  onClick={() => toggleItem(i)}
                  className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isChecked
                      ? "border-white/5 bg-white/[0.01] opacity-60"
                      : "border-white/10 bg-obsidian-900/60 hover:border-white/20 hover:bg-obsidian-850/60"
                  } backdrop-blur-xl flex items-start gap-3`}
                >
                  <button
                    type="button"
                    aria-label={isChecked ? "Mark incomplete" : "Mark complete"}
                    className="mt-0.5 text-amber-400 focus:outline-none"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <div
                      className={`text-sm font-medium ${
                        isChecked ? "line-through text-slate-500" : "text-slate-200"
                      }`}
                    >
                      {item.item}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      {item.party && item.party !== "not_stated" && (
                        <span>Party: <strong className="text-slate-300">{item.party}</strong></span>
                      )}
                      {item.dueOrTrigger && item.dueOrTrigger !== "not_stated" && (
                        <span>Due: <strong className="text-amber-300 font-mono">{item.dueOrTrigger}</strong></span>
                      )}
                    </div>
                    <EvidenceChips
                      ids={item.anchorIds}
                      resolvedAnchors={resolvedAnchors}
                      onEvidenceClick={onEvidenceClick}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Lawyer Questions */}
      {hasQuestions && (
        <section aria-labelledby="questions-heading" className="space-y-3">
          <h3 id="questions-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Questions for Legal Counsel
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {actionPack.lawyerQuestions.map((q, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-white/10 bg-obsidian-900/60 backdrop-blur-xl space-y-2"
              >
                <div className="text-sm font-bold text-slate-100 leading-snug">
                  {q.question}
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">{q.reason}</div>
                <EvidenceChips
                  ids={q.anchorIds}
                  resolvedAnchors={resolvedAnchors}
                  onEvidenceClick={onEvidenceClick}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Main ResultView ───────────────────────────────────────────────────────────

export function ResultView({
  mode,
  result,
  actionPack,
  verification,
  resolvedAnchors,
  onEvidenceClick,
}: ResultViewProps) {
  return (
    <div className="space-y-6">
      {/* Fixed legal notice — always first */}
      <div
        className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl text-xs text-slate-300 leading-relaxed"
        role="note"
        aria-label="Legal information notice"
      >
        <strong className="text-amber-400">Legal information only:</strong> {LEGAL_NOTICE_TEXT}
      </div>

      {/* Verification Badge */}
      <VerificationBadge verification={verification} />

      {/* Mode View */}
      <section aria-label={`${mode} results`}>
        {mode === "simplify" && (
          <SimplifyView
            result={result as SimplifyResult}
            resolvedAnchors={resolvedAnchors}
            onEvidenceClick={onEvidenceClick}
          />
        )}
        {mode === "compare" && (
          <CompareView
            result={result as CompareResult}
            resolvedAnchors={resolvedAnchors}
            onEvidenceClick={onEvidenceClick}
          />
        )}
        {mode === "ask" && (
          <AskView
            result={result as AskResult}
            resolvedAnchors={resolvedAnchors}
            onEvidenceClick={onEvidenceClick}
          />
        )}
      </section>

      {/* Action Pack */}
      <ActionPackSection
        actionPack={actionPack}
        resolvedAnchors={resolvedAnchors}
        onEvidenceClick={onEvidenceClick}
      />

      {/* Limitations Reminder */}
      <div
        className="p-4 rounded-xl border border-white/5 bg-white/[0.01] text-xs text-slate-500 leading-relaxed font-mono"
        role="note"
      >
        <strong className="text-slate-400">Limitation:</strong> Absence from Clauseora output never
        means absence from the document. Always verify critical terms against the original contract.
      </div>
    </div>
  );
}
