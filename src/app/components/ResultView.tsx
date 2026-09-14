"use client";

import { useState } from "react";
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
    <button
      type="button"
      className="evidence-chip"
      onClick={() => onEvidenceClick(anchor)}
      aria-label={`Evidence: ${anchor.locator}`}
      title={anchor.locator}
    >
      <span aria-hidden="true">📄</span>
      {anchor.locator}
    </button>
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
    <div className="flex flex-wrap gap-1" style={{ marginTop: "0.5rem" }}>
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

const KIND_LABELS: Record<ClauseItem["kind"], string> = {
  obligation: "Obligation",
  deadline: "Deadline",
  money: "Money",
  condition: "Condition",
  review_flag: "Review",
};

function KindBadge({ kind }: { kind: ClauseItem["kind"] }) {
  return (
    <span className={`kind-badge kind-${kind}`} aria-label={`Item type: ${KIND_LABELS[kind]}`}>
      {KIND_LABELS[kind]}
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

  if (!result.clauses?.length) {
    return (
      <p className="text-muted" style={{ padding: "1rem 0" }}>
        No clauses were identified in this document.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {result.clauses.map((clause, i) => {
        const isOpen = openClauses.has(i);
        return (
          <div key={i} className="clause-card">
            <button
              type="button"
              className="clause-header"
              aria-expanded={isOpen}
              aria-controls={`clause-body-${i}`}
              onClick={() => toggleClause(i)}
            >
              <span className="clause-topic">{clause.topic}</span>
              <span aria-hidden="true" style={{ color: "var(--text-muted)", transition: "transform 0.2s", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                ›
              </span>
            </button>

            {isOpen && (
              <div className="clause-body" id={`clause-body-${i}`}>
                <p style={{ fontSize: "0.9375rem", marginBottom: "0.875rem", color: "var(--text-primary)" }}>
                  {clause.plainLanguage}
                </p>

                <EvidenceChips ids={clause.anchorIds} resolvedAnchors={resolvedAnchors} onEvidenceClick={onEvidenceClick} />

                {clause.definedTerms?.length > 0 && (
                  <div style={{ marginTop: "0.875rem" }}>
                    <div className="text-xs text-muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem" }}>
                      Defined Terms
                    </div>
                    {clause.definedTerms.map((dt, di) => (
                      <div key={di} style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--blue-400)" }}>{dt.term}</span>
                        {" — "}
                        {dt.meaningInContext}
                      </div>
                    ))}
                  </div>
                )}

                {clause.items?.length > 0 && (
                  <div style={{ marginTop: "0.875rem" }}>
                    {clause.items.map((item, ii) => (
                      <div key={ii} className="item-row">
                        <KindBadge kind={item.kind} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.9rem" }}>
                            {item.party && item.party !== "not_stated" && (
                              <span style={{ fontWeight: 600, color: "var(--text-secondary)", marginRight: "0.375rem" }}>
                                {item.party}:
                              </span>
                            )}
                            {item.statement}
                          </div>
                          <EvidenceChips ids={item.anchorIds} resolvedAnchors={resolvedAnchors} onEvidenceClick={onEvidenceClick} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
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
    <div>
      {/* Filter tabs */}
      <div className="filter-tabs mb-4" role="group" aria-label="Filter changes">
        {filters.map((f) => {
          const count = f === "all" ? changes.length : changes.filter((c) => c.changeType === f).length;
          return (
            <button
              key={f}
              type="button"
              className={`filter-btn${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
              <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <p>No substantive changes were identified by Clauseora.</p>
          <p className="text-xs mt-2" style={{ marginTop: "0.5rem" }}>
            Important content may have been missed. Verify important points in the source document.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((change, i) => (
            <div key={i} className={`change-card change-${change.changeType}`}>
              <div className="change-header">
                <span
                  className={`kind-badge kind-${change.changeType === "added" ? "money" : change.changeType === "removed" ? "review_flag" : "condition"}`}
                  style={{ flexShrink: 0 }}
                >
                  {change.changeType.toUpperCase()}
                </span>
                <span style={{ fontWeight: 600 }}>{change.topic}</span>
              </div>

              <div className="change-columns">
                <div>
                  <div className="change-col-label">Document A (Before)</div>
                  <p style={{ fontSize: "0.9rem", color: change.before ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {change.before ?? "Not present in this version"}
                  </p>
                  <EvidenceChips ids={change.anchorIdsA} resolvedAnchors={resolvedAnchors} onEvidenceClick={onEvidenceClick} />
                </div>
                <div>
                  <div className="change-col-label">Document B (After)</div>
                  <p style={{ fontSize: "0.9rem", color: change.after ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {change.after ?? "Not present in this version"}
                  </p>
                  <EvidenceChips ids={change.anchorIdsB} resolvedAnchors={resolvedAnchors} onEvidenceClick={onEvidenceClick} />
                </div>
              </div>

              {change.whyReview && (
                <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border-subtle)", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Why review: </span>
                  {change.whyReview}
                </div>
              )}
            </div>
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
    supported: { className: "ask-status-badge ask-supported", icon: "✓", label: "Supported by document" },
    partially_supported: { className: "ask-status-badge ask-partial", icon: "◐", label: "Partially supported" },
    not_found: { className: "ask-status-badge ask-not-found", icon: "✕", label: "Not stated in this document" },
  }[result.status];

  return (
    <div>
      <div className={statusConfig.className} style={{ marginBottom: "1rem" }}>
        <span aria-hidden="true">{statusConfig.icon}</span>
        {statusConfig.label}
      </div>

      <div className="card-elevated" style={{ marginBottom: "1rem" }}>
        <p style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}>{result.answer}</p>
        {result.status !== "not_found" && (
          <EvidenceChips ids={result.anchorIds} resolvedAnchors={resolvedAnchors} onEvidenceClick={onEvidenceClick} />
        )}
      </div>

      {result.notEstablished?.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div className="text-xs text-muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Not established by this document
          </div>
          <ul style={{ paddingLeft: "1.25rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            {result.notEstablished.map((item, i) => <li key={i}>{item}</li>)}
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
  const hasChecklist = actionPack.checklist?.length > 0;
  const hasQuestions = actionPack.lawyerQuestions?.length > 0;

  if (!hasChecklist && !hasQuestions) return null;

  return (
    <div className="action-pack-section">
      {hasChecklist && (
        <section aria-labelledby="checklist-heading">
          <h2 id="checklist-heading" className="action-pack-header">
            <span aria-hidden="true">✅</span> Action Checklist
          </h2>
          {actionPack.checklist.map((item, i) => (
            <div key={i} className="checklist-item">
              <div className="checklist-bullet" aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>{item.item}</div>
                {item.party && item.party !== "not_stated" && (
                  <div className="text-sm text-muted">Party: {item.party}</div>
                )}
                {item.dueOrTrigger && item.dueOrTrigger !== "not_stated" && (
                  <div className="text-sm text-muted">When: {item.dueOrTrigger}</div>
                )}
                <EvidenceChips ids={item.anchorIds} resolvedAnchors={resolvedAnchors} onEvidenceClick={onEvidenceClick} />
              </div>
            </div>
          ))}
        </section>
      )}

      {hasQuestions && (
        <section aria-labelledby="questions-heading" style={{ marginTop: hasChecklist ? "1.5rem" : 0 }}>
          <h2 id="questions-heading" className="action-pack-header">
            <span aria-hidden="true">⚖️</span> Questions for a Lawyer
          </h2>
          {actionPack.lawyerQuestions.map((q, i) => (
            <div key={i} className="card-elevated" style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{q.question}</div>
              <div className="text-sm text-muted">{q.reason}</div>
              <EvidenceChips ids={q.anchorIds} resolvedAnchors={resolvedAnchors} onEvidenceClick={onEvidenceClick} />
            </div>
          ))}
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
    <div>
      {/* Fixed legal notice — always first */}
      <div className="notice-banner mb-6" role="note" aria-label="Legal information notice">
        <strong>Legal information only:</strong>{" "}
        {LEGAL_NOTICE_TEXT}
      </div>

      {/* Verification badge */}
      <div style={{ marginBottom: "1rem" }}>
        <VerificationBadge verification={verification} />
      </div>

      {/* Mode result */}
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

      {/* Limitations reminder */}
      <div
        className="text-xs text-muted"
        style={{ marginTop: "2rem", padding: "0.75rem", borderTop: "1px solid var(--border-subtle)", lineHeight: 1.6 }}
        role="note"
      >
        <strong>Limitation:</strong> Important terms may have been missed. Absence from Clauseora
        output never means absence from the document. Verify important points in the source.
      </div>
    </div>
  );
}
