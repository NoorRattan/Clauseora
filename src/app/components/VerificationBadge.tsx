"use client";

import type { Verification } from "@/types/evidence";

interface VerificationBadgeProps {
  verification: Verification;
}

export function VerificationBadge({ verification }: VerificationBadgeProps) {
  const { status, checkedClaims, issues } = verification;

  if (status === "not_applicable") return null;

  const config = {
    cross_checked: {
      className: "verification-badge verified-cross-checked",
      icon: "✓",
      label: "Cross-checked",
      description: `${checkedClaims} high-impact claim${checkedClaims !== 1 ? "s" : ""} supported by a second AI model.`,
    },
    needs_review: {
      className: "verification-badge verified-needs-review",
      icon: "⚠",
      label: "Needs review",
      description: `${issues.length} claim${issues.length !== 1 ? "s" : ""} could not be confirmed by a second model.`,
    },
    single_model: {
      className: "verification-badge verified-single-model",
      icon: "○",
      label: "Single-model result",
      description: "Cross-checking was unavailable or disabled.",
    },
  }[status];

  return (
    <div>
      <div className={config.className} role="status" aria-label={config.label}>
        <span aria-hidden="true">{config.icon}</span>
        {config.label}
      </div>
      <div
        className="text-xs text-muted mt-1"
        style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "var(--text-muted)" }}
      >
        {config.description}{" "}
        <span style={{ fontStyle: "italic" }}>
          Cross-checked means source agreement only — not legally correct or unbiased.
        </span>
      </div>
      {status === "needs_review" && issues.length > 0 && (
        <ul
          style={{
            marginTop: "0.5rem",
            paddingLeft: "1.25rem",
            fontSize: "0.8125rem",
            color: "var(--yellow-400)",
          }}
          aria-label="Claims needing review"
        >
          {issues.map((issue, i) => (
            <li key={i}>{issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
