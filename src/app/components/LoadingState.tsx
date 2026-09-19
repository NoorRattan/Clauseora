"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Cpu, Sparkles, XCircle } from "lucide-react";

const STEPS = [
  {
    title: "Parsing document structure",
    detail: "Reading the text in your document",
  },
  {
    title: "Linking source passages",
    detail: "Preparing links so you can inspect the original wording",
  },
  {
    title: "Explaining your document",
    detail: "Synthesizing plain-language interpretations with strict evidence links",
  },
  {
    title: "Optional source check",
    detail: "An additional source check may run when available",
  },
];

interface LoadingStateProps {
  stepIndex: number; // 0–3
  onCancel: () => void;
}

export function LoadingState({ stepIndex, onCancel }: LoadingStateProps) {
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.textContent = `${STEPS[stepIndex]?.title}…`;
    }
  }, [stepIndex]);

  const progressPercent = Math.min(100, Math.round(((stepIndex + 1) / STEPS.length) * 100));

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-obsidian-900/90 backdrop-blur-2xl p-8 sm:p-12 shadow-glass-elevated flex flex-col items-center text-center"
      role="status"
      aria-label="Analyzing document"
    >
      {/* Visually hidden live region for screen readers */}
      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* Holographic Radar Scanner */}
      <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
        {/* Outer glowing pulsing ring */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full border border-amber-500/30 bg-amber-500/5 shadow-glow-amber"
        />

        {/* Inner rotating radar line */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-2 rounded-full border border-dashed border-cyan-400/30"
        />

        {/* Center icon */}
        <div className="relative z-10 w-14 h-14 rounded-xl bg-obsidian-800 border border-white/10 flex items-center justify-center text-amber-400 shadow-inner-light">
          <Cpu className="w-7 h-7 animate-pulse" />
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
        {STEPS[stepIndex]?.title}
      </h3>
      <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
        {STEPS[stepIndex]?.detail}
      </p>

      {/* Progress Track */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
          <span className="flex items-center gap-1 text-amber-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Processing your document</span>
          </span>
          <span>Timing varies</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-400 rounded-full shadow-glow-amber"
          />
        </div>
      </div>

      {/* Timeline Steps List */}
      <div className="w-full max-w-md space-y-3 mb-8 text-left" aria-hidden="true">
        {STEPS.map((step, idx) => {
          const isDone = idx < stepIndex;
          const isCurrent = idx === stepIndex;
          return (
            <div
              key={step.title}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                isCurrent
                  ? "border-amber-500/40 bg-amber-500/5 text-slate-100 shadow-glow-amber"
                  : isDone
                  ? "border-white/5 bg-white/[0.02] text-slate-400"
                  : "border-transparent text-slate-600"
              }`}
            >
              <div className="flex-shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-700" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{step.title}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        aria-label="Cancel analysis"
      >
        <XCircle className="w-3.5 h-3.5" />
        Cancel Analysis
      </button>
    </div>
  );
}
