"use client";

import { useEffect, useRef } from "react";

const STEPS = [
  "Reading document",
  "Creating evidence anchors",
  "Analyzing with AI",
  "Cross-checking key claims",
];

interface LoadingStateProps {
  stepIndex: number; // 0–3
  onCancel: () => void;
}

export function LoadingState({ stepIndex, onCancel }: LoadingStateProps) {
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Announce each step change to screen readers
    if (liveRef.current) {
      liveRef.current.textContent = `${STEPS[stepIndex]}…`;
    }
  }, [stepIndex]);

  return (
    <div className="loading-container" role="status">
      {/* Visually hidden live region for screen readers */}
      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <div className="loading-spinner" aria-hidden="true" />

      <div className="loading-steps" aria-hidden="true">
        {STEPS.map((step, i) => (
          <div
            key={step}
            className={`loading-step${i === stepIndex ? " active" : ""}`}
          >
            <span>{i < stepIndex ? "✓" : i === stepIndex ? "›" : "·"}</span>
            {step}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onCancel}
        aria-label="Cancel analysis"
      >
        Cancel
      </button>
    </div>
  );
}
