"use client";

import React, { useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { AnchorRef } from "@/types/evidence";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Copy, Check, ShieldCheck, Bookmark } from "lucide-react";

interface EvidenceDrawerProps {
  anchor: AnchorRef | null;
  onClose: () => void;
}

export function EvidenceDrawer({ anchor, onClose }: EvidenceDrawerProps) {
  const [copied, setCopied] = useState(false);

  const dialogRef = useDialogFocus(onClose);

  if (!anchor) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(anchor.excerpt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-md"
          aria-hidden="true"
        />

        {/* Slide-over Panel */}
        <motion.div
          initial={{ x: "100%", opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg h-full bg-obsidian-900/95 border-l border-white/10 shadow-2xl flex flex-col backdrop-blur-2xl"
          role="dialog"
          ref={dialogRef}
          aria-modal="true"
          aria-label="Evidence Source Inspector"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Source Passage
                </h2>
                <div className="text-xs font-mono text-slate-400">
                  Document {anchor.document} • Anchor ID: {anchor.anchorId}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              aria-label="Close evidence drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Locator Tag */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="font-semibold">{anchor.locator}</span>
              </div>
              {anchor.heading && (
                <span className="text-amber-200/70 truncate max-w-[200px]">
                  § {anchor.heading}
                </span>
              )}
            </div>

            {/* Excerpt Container */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Verbatim Source Passage
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 font-medium transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy excerpt</span>
                    </>
                  )}
                </button>
              </div>

              {/* Raw Excerpt Block */}
              <div className="relative rounded-2xl bg-obsidian-950/80 border border-white/10 p-5 shadow-inner">
                <p className="font-mono text-sm leading-relaxed text-slate-200 whitespace-pre-wrap select-text">
                  {anchor.excerpt}
                </p>
              </div>
            </div>

            {/* Trust & Provenance Footnote */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 leading-relaxed flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-200">How this source link works:</span>{" "}
                Clauseora extracted this passage before AI analysis and assigned it a fixed location
                ID. The server rejects source IDs that do not exist in the uploaded document.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-obsidian-950/40 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              Close Inspector
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
