"use client";

import type { AnchorRef } from "@/types/evidence";

interface EvidenceDrawerProps {
  anchor: AnchorRef | null;
  onClose: () => void;
}

export function EvidenceDrawer({ anchor, onClose }: EvidenceDrawerProps) {
  if (!anchor) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="drawer-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Evidence source"
        tabIndex={-1}
      >
        <div className="drawer-header">
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>Evidence Source</div>
            <div className="text-muted text-sm" style={{ marginTop: "0.125rem" }}>
              Document {anchor.document}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close evidence drawer"
            autoFocus
          >
            ✕
          </button>
        </div>

        <div className="drawer-content">
          {/* Locator tag */}
          <div className="locator-tag" role="note" aria-label={`Source location: ${anchor.locator}`}>
            <span aria-hidden="true">📄</span>
            {anchor.locator}
            {anchor.heading && <> · {anchor.heading}</>}
          </div>

          {/* Excerpt — rendered as inert text, never as HTML */}
          <div
            className="excerpt-block"
            aria-label="Source text excerpt"
          >
            {anchor.excerpt}
          </div>

          <div
            className="text-xs text-muted mt-4"
            style={{ lineHeight: 1.5, marginTop: "1rem" }}
          >
            This excerpt is from the original document you uploaded and was
            identified before AI analysis. The AI referenced this passage; it
            did not write it.
          </div>
        </div>
      </div>
    </div>
  );
}
