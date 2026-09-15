"use client";

import React, { useState } from "react";
import type { Verification } from "@/types/evidence";
import { ShieldCheck, AlertTriangle, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VerificationBadgeProps {
  verification: Verification;
}

export function VerificationBadge({ verification }: VerificationBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const { status, checkedClaims, issues } = verification;

  if (status === "not_applicable") return null;

  const config = {
    cross_checked: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-950/20",
      text: "text-emerald-300",
      glow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.3)]",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      label: "Second Check Passed",
      description: `${checkedClaims} high-impact claim${
        checkedClaims !== 1 ? "s" : ""
      } independently corroborated by a secondary AI model.`,
    },
    needs_review: {
      border: "border-amber-500/40",
      bg: "bg-amber-950/30",
      text: "text-amber-300",
      glow: "shadow-[0_0_20px_-4px_rgba(245,158,11,0.3)]",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      label: "Review Recommended",
      description: `${issues.length} claim${
        issues.length !== 1 ? "s" : ""
      } could not be independently corroborated by the secondary model.`,
    },
    single_model: {
      border: "border-slate-700/50",
      bg: "bg-slate-900/40",
      text: "text-slate-300",
      glow: "",
      icon: <Shield className="w-4 h-4 text-slate-400" />,
      label: "Analyzed by One Model",
      description: "Secondary model verification was offline or skipped.",
    },
  }[status];

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} ${config.glow} p-4 backdrop-blur-xl transition-all duration-300`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-black/30 border border-white/10">
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
                {config.label}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              <span className="text-[11px] font-mono text-slate-400">
                Source links validated
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {config.description}{" "}
              <span className="text-slate-400 italic">
                A second-model check confirms source support, not legal correctness.
              </span>
            </p>
          </div>
        </div>

        {status === "needs_review" && issues.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-colors flex-shrink-0"
            aria-expanded={expanded}
          >
            <span>{issues.length} issues</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && status === "needs_review" && issues.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-3 pt-3 border-t border-amber-500/20"
          >
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
              Claims Requiring Verification
            </div>
            <ul className="space-y-1.5">
              {issues.map((issue, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-slate-300 bg-black/20 p-2 rounded-lg border border-amber-500/10"
                >
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
