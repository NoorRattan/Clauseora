"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { motion, AnimatePresence } from "framer-motion";
import type {
  Mode,
  AnchorRef,
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
} from "@/types/evidence";
import { LEGAL_NOTICE_TEXT } from "@/types/evidence";
import { UploadZone } from "./UploadZone";
import { LoadingState } from "./LoadingState";
import { ResultView } from "./ResultView";
import { EvidenceDrawer } from "./EvidenceDrawer";

import {
  Scale,
  ShieldCheck,
  FileText,
  GitCompare,
  MessageSquareQuote,
  Zap,
  Sparkles,
  Lock,
  Database,
  Layers,
  X,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

// ─── Disclosure Modal ──────────────────────────────────────────────────────────

function DisclosureModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-obsidian-950/85 backdrop-blur-md"
          aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-obsidian-900/95 backdrop-blur-3xl p-6 sm:p-8 shadow-glass-elevated"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclosure-title"
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="disclosure-title"
                  className="text-lg font-bold text-white tracking-tight"
                >
                  Zero-Persistence Architecture
                </h2>
                <p className="text-xs text-slate-400">
                  Data lifecycle and AI provider disclosure
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              aria-label="Close modal"

            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-6 space-y-6 text-sm leading-relaxed text-slate-300">
            <section className="space-y-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <span>What Clauseora does with your files</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your uploaded contract is buffered strictly in volatile system
                RAM during active request execution. It is never persisted to
                disk, stored in any SQL/NoSQL database, or cached in any cloud
                object bucket.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>AI Providers & Token Routing</span>
              </h3>
              <div className="p-3.5 rounded-xl bg-obsidian-950/70 border border-white/10 space-y-2.5 text-xs">
                <div>
                  <strong className="text-amber-300">
                    1. Groq (Primary Analysis):
                  </strong>{" "}
                  Receives the extracted document passages needed to explain
                  terms and identify obligations.
                </div>
                <div className="pt-2 border-t border-white/5">
                  <strong className="text-cyan-300">
                    2. Cloudflare Workers AI (Optional Check):
                  </strong>{" "}
                  When configured, receives only selected high-impact claims
                  alongside their cited passages. Your use of both providers is
                  also subject to their current data policies.
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Anchors & Integrity</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Before sending prompts to any model, the server pre-indexes
                every paragraph and assigns deterministic anchors (e.g.{" "}
                <code>A-p001-b001</code>). When AI models return citations, the
                server maps them against this ground-truth index. Any
                hallucinated or unrecognized citations are automatically
                stripped.
              </p>
            </section>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-obsidian-950 bg-white hover:bg-slate-200 transition-colors"
            >
              I Understand
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function AnalysisWorkspace({
  initialMode = "simplify",
}: {
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [question, setQuestion] = useState("");

  const [loadingStep, setLoadingStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResult, setApiResult] = useState<SuccessResponse | null>(null);
  const [apiError, setApiError] = useState<ErrorResponse | null>(null);

  const [openAnchor, setOpenAnchor] = useState<AnchorRef | null>(null);
  const [showDisclosure, setShowDisclosure] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setApiResult(null);
    setApiError(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!fileA) return;
    if (mode === "compare" && !fileB) return;
    if (mode === "ask" && !question.trim()) return;

    setIsLoading(true);
    setLoadingStep(0);
    setApiResult(null);
    setApiError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const form = new FormData();
    form.append("mode", mode);
    form.append("documentA", fileA);
    if (mode === "compare" && fileB) form.append("documentB", fileB);
    if (mode === "ask") form.append("question", question.trim());

    // Step progression ticker
    const stepTimer = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, 3));
    }, 2200);

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      clearInterval(stepTimer);

      const data: ApiResponse = await res.json();

      if ("error" in data && data.error) {
        setApiError(data as ErrorResponse);
        setTimeout(() => errorSummaryRef.current?.focus(), 100);
      } else {
        setApiResult(data as SuccessResponse);
      }
    } catch (err) {
      clearInterval(stepTimer);
      if ((err as Error).name !== "AbortError") {
        setApiError({
          requestId: "client-network-error",
          mode,
          notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
          documents: [],
          result: null,
          actionPack: { checklist: [], lawyerQuestions: [] },
          error: {
            code: "SERVICE_UNAVAILABLE",
            message:
              "A network error occurred. Please check your connection and try again.",
          },
        });
        setTimeout(() => errorSummaryRef.current?.focus(), 100);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [mode, fileA, fileB, question]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const canSubmit =
    !!fileA &&
    (mode !== "compare" || !!fileB) &&
    (mode !== "ask" || question.trim().length > 0);

  const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
    {
      id: "simplify",
      label: "Simplify",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: "compare",
      label: "Compare Versions",
      icon: <GitCompare className="w-4 h-4" />,
    },
    {
      id: "ask",
      label: "Ask Questions",
      icon: <MessageSquareQuote className="w-4 h-4" />,
    },
  ];

  return (
    <div className="workspace-shell min-h-screen flex flex-col relative text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* 3D WebGL Holographic Monolith Canvas */}

      {/* Subtle Noise Texture Overlay */}
      <div className="pointer-events-none fixed inset-0 ambient-noise opacity-40 -z-5" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-obsidian-950/70 backdrop-blur-2xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none"
            aria-label="Clauseora Home"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-obsidian-950 shadow-glow-amber group-hover:scale-105 transition-transform duration-200">
              <Scale className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-white font-sans">
                  Clauseora
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Workspace
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Evidence-First Legal Document Intelligence
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDisclosure(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">
                Data Privacy & Architecture
              </span>
              <span className="sm:hidden">Privacy</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* Hero Section */}
        {!apiResult && !isLoading && (
          <div className="text-center space-y-4 max-w-2xl mx-auto pt-2 sm:pt-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-300 backdrop-blur-xl">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Source-linked legal document assistance</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Understand the words. <br />
              <span className="text-gradient-gold">Verify the evidence.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-sans">
              Every explanation links back to the exact document passage that
              supports it, so you can check important details for yourself.
            </p>

            {/* Architecture Highlights Pill Row */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap pt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% In-Memory</span>
              </div>
              <span className="text-slate-700">•</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Deterministic Anchors</span>
              </div>
              <span className="text-slate-700">•</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Optional Second-Model Check</span>
              </div>
            </div>
          </div>
        )}

        {/* Mode Switcher Segmented Pill Bar */}
        {!isLoading && !apiResult && (
          <nav aria-label="Analysis mode" className="flex justify-center">
            <div
              className="relative p-1.5 rounded-2xl bg-obsidian-900/80 border border-white/10 backdrop-blur-2xl flex items-center gap-1 shadow-glass-subtle"
              role="tablist"
            >
              {MODES.map((m) => {
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    id={`tab-${m.id}`}
                    tabIndex={isActive ? 0 : -1}
                    aria-selected={isActive}
                    aria-controls={`panel-${m.id}`}
                    onClick={() => handleModeChange(m.id)}
                    onKeyDown={(event) => {
                      const index = MODES.findIndex((item) => item.id === m.id);
                      const next =
                        event.key === "ArrowRight"
                          ? (index + 1) % MODES.length
                          : event.key === "ArrowLeft"
                            ? (index + MODES.length - 1) % MODES.length
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? MODES.length - 1
                                : -1;
                      if (next < 0) return;
                      event.preventDefault();
                      handleModeChange(MODES[next].id);
                      document.getElementById(`tab-${MODES[next].id}`)?.focus();
                    }}
                    disabled={isLoading}
                    className={`relative px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 ${
                      isActive
                        ? "text-obsidian-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeModePill"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.4,
                        }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 shadow-glow-amber"
                      />
                    )}
                    <span className="relative z-10">{m.icon}</span>
                    <span className="relative z-10">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Main Interaction Surface */}
        <div
          role="tabpanel"
          id={`panel-${mode}`}
          aria-labelledby={`tab-${mode}`}
          className="space-y-6"
        >
          {/* Document Upload & Input Area */}
          {!isLoading && !apiResult && !apiError && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-white/10 bg-obsidian-900/70 backdrop-blur-2xl p-6 sm:p-8 shadow-glass-elevated space-y-6"
            >
              {mode === "compare" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UploadZone
                    label="Original Version (Document A)"
                    docKey="A"
                    file={fileA}
                    onFileChange={setFileA}
                    disabled={isLoading}
                  />
                  <UploadZone
                    label="Revised Version (Document B)"
                    docKey="B"
                    file={fileB}
                    onFileChange={setFileB}
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <UploadZone
                  label="Target Document"
                  docKey="A"
                  file={fileA}
                  onFileChange={setFileA}
                  disabled={isLoading}
                />
              )}

              {/* Mode: Ask Input */}
              {mode === "ask" && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="question-input"
                      className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono"
                    >
                      Your Inquiry for this Document
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      {question.length}/2000
                    </span>
                  </div>
                  <textarea
                    id="question-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. What are the termination notice windows and non-compete liabilities?"
                    maxLength={2000}
                    rows={3}
                    disabled={isLoading}
                    className="w-full rounded-2xl bg-obsidian-950/80 border border-white/10 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 p-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all resize-vertical font-sans"
                    aria-label="Your question about the document"
                  />
                </div>
              )}

              {/* Processing Disclosure Bar */}
              <div className="p-4 rounded-xl bg-obsidian-950/60 border border-white/5 flex items-start justify-between gap-3 text-xs text-slate-400 leading-relaxed">
                <div>
                  <strong className="text-slate-300">
                    Before you analyze:
                  </strong>{" "}
                  Your document text is sent to Groq for analysis and is not
                  saved by Clauseora. If the optional Cloudflare verifier is
                  configured, it receives only selected high-impact claims and
                  their cited passages.
                </div>
                <button
                  type="button"
                  onClick={() => setShowDisclosure(true)}
                  className="text-amber-400 hover:text-amber-300 font-semibold whitespace-nowrap"
                >
                  Architecture details ›
                </button>
              </div>

              {/* Magnetic Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                aria-busy={isLoading}
                className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                  canSubmit && !isLoading
                    ? "bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-obsidian-950 shadow-glow-amber hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] hover:scale-[1.006] active:scale-[0.995]"
                    : "bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed"
                }`}
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Analyze Document</span>
              </button>
            </motion.div>
          )}

          {/* Loading Radar */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingState stepIndex={loadingStep} onCancel={handleCancel} />
            </motion.div>
          )}

          {/* Error Alert */}
          {apiError && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              ref={errorSummaryRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
              className="rounded-2xl border border-rose-500/30 bg-rose-950/20 backdrop-blur-2xl p-6 sm:p-8 space-y-4 shadow-glass-elevated"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Analysis Could Not Complete
                  </h2>
                  <div className="text-xs font-mono text-rose-400">
                    Error Code: {apiError.error?.code ?? "UNKNOWN"}
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {apiError.error?.message}
              </p>

              <button
                type="button"
                onClick={() => setApiError(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 transition-colors"
              >
                Reset & Try Again
              </button>
            </motion.div>
          )}

          {/* Success Results View */}
          {apiResult && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Back / Reset Ribbon */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiResult(null);
                    setApiError(null);
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Analyze Another Document</span>
                </button>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    Provider: {apiResult.analysisProvider.service} /{" "}
                    {apiResult.analysisProvider.model}
                  </span>
                </div>
              </div>

              {/* Complete Result View */}
              <ResultView
                mode={apiResult.mode}
                result={apiResult.result}
                actionPack={apiResult.actionPack}
                verification={apiResult.verification}
                resolvedAnchors={apiResult.resolvedAnchors}
                onEvidenceClick={setOpenAnchor}
              />
            </motion.div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 bg-obsidian-950/80 backdrop-blur-2xl py-8 px-4 sm:px-6 mt-16 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Scale className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-300">Clauseora</span>
            <span>• Evidence-First Legal Intelligence</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowDisclosure(true)}
              className="hover:text-slate-300 transition-colors"
            >
              Privacy & Retention
            </button>
            <span>•</span>
            <span>Keyboard-friendly controls</span>
          </div>
        </div>
      </footer>

      {/* Slide-over Evidence Ground Truth Drawer */}
      {openAnchor && (
        <EvidenceDrawer
          anchor={openAnchor}
          onClose={() => setOpenAnchor(null)}
        />
      )}

      {/* Privacy & Architecture Modal */}
      {showDisclosure && (
        <DisclosureModal onClose={() => setShowDisclosure(false)} />
      )}
    </div>
  );
}

