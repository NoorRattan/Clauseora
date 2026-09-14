"use client";

import { useState, useRef, useCallback } from "react";
import type {
  Mode,
  AnchorRef,
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
} from "@/types/evidence";
import { LEGAL_NOTICE_TEXT } from "@/types/evidence";
import { UploadZone } from "./components/UploadZone";
import { LoadingState } from "./components/LoadingState";
import { ResultView } from "./components/ResultView";
import { EvidenceDrawer } from "./components/EvidenceDrawer";

// ─── Disclosure Modal ──────────────────────────────────────────────────────────

function DisclosureModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="drawer-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclosure-title"
        tabIndex={-1}
        style={{ maxWidth: "520px" }}
      >
        <div className="drawer-header">
          <h2 id="disclosure-title" style={{ fontSize: "1rem" }}>
            How your document is handled
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close"
            autoFocus
          >
            ✕
          </button>
        </div>
        <div className="drawer-content" style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>
          <section style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ fontWeight: 600, marginBottom: "0.375rem", color: "var(--text-primary)" }}>
              What Clauseora does with your file
            </h3>
            <p>Your document is sent to our server for processing. The server extracts text, assigns paragraph/page anchors in code, and sends the text to AI providers for analysis. Clauseora does not save your document to any database or storage.</p>
          </section>

          <section style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ fontWeight: 600, marginBottom: "0.375rem", color: "var(--text-primary)" }}>
              AI providers that receive your content
            </h3>
            <ul style={{ paddingLeft: "1.25rem" }}>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong>Groq</strong> (primary analyzer) — receives the full admitted document text. Groq states inference data is not retained by default. Verify their current policy for your use case.
              </li>
              <li>
                <strong>Cloudflare Workers AI</strong> (evidence verifier) — receives only selected high-impact claims and their cited excerpts. Not the full document. Cloudflare states customer content is not used to train models.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ fontWeight: 600, marginBottom: "0.375rem", color: "var(--text-primary)" }}>
              What this means for sensitive documents
            </h3>
            <p>This is a public prototype without accounts or authentication. Do not upload documents you are not authorized to share with the named AI providers. Consider redacting sensitive personal information before uploading.</p>
          </section>

          <section>
            <h3 style={{ fontWeight: 600, marginBottom: "0.375rem", color: "var(--text-primary)" }}>
              No stored history
            </h3>
            <p>Clauseora cannot retrieve or delete a past upload because it never stored one. Your browser holds the selected file in memory until you remove it, replace it, refresh the page, or close the tab.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [mode, setMode] = useState<Mode>("simplify");
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

    // Simulate loading step progression
    const stepTimer = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, 3));
    }, 2500);

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
          requestId: "client-error",
          mode,
          notice: { kind: "legal_information_only", text: LEGAL_NOTICE_TEXT },
          documents: [],
          result: null,
          actionPack: { checklist: [], lawyerQuestions: [] },
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "A network error occurred. Please check your connection and try again.",
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

  const MODES: { id: Mode; label: string; icon: string }[] = [
    { id: "simplify", label: "Simplify", icon: "📋" },
    { id: "compare", label: "Compare", icon: "⇄" },
    { id: "ask", label: "Ask", icon: "💬" },
  ];

  return (
    <>
      {/* ── Shell Header ── */}
      <header className="shell-header">
        <div className="shell-header-inner">
          <a href="/" className="logo" aria-label="Clauseora — Home">
            <div className="logo-icon" aria-hidden="true">⚖</div>
            <span>Clauseora</span>
            <span className="logo-tagline">Understand the words. Verify the evidence.</span>
          </a>
          <div className="header-spacer" />
          <button
            type="button"
            className="disclosure-link"
            onClick={() => setShowDisclosure(true)}
          >
            How your document is handled
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ padding: "2rem 1.25rem 4rem", maxWidth: "var(--max-width)", margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1>Evidence-First Legal Document Navigator</h1>
          <p className="text-muted" style={{ marginTop: "0.5rem", maxWidth: "56ch", margin: "0.5rem auto 0" }}>
            Every explanation is linked to the exact passage in your document.
            No confabulation. No invented facts. Just source-backed analysis.
          </p>
        </div>

        {/* Compact notice */}
        <div className="notice-banner" style={{ marginBottom: "1.5rem" }}>
          <strong>Legal information only.</strong> Clauseora analyzes your document. It is not legal advice and does not create an attorney-client relationship.{" "}
          <button
            type="button"
            style={{ background: "none", border: "none", color: "var(--blue-400)", cursor: "pointer", fontSize: "inherit", padding: 0 }}
            onClick={() => setShowDisclosure(true)}
          >
            How your document is handled ›
          </button>
        </div>

        {/* Mode Tabs */}
        <nav
          aria-label="Analysis mode"
          style={{ marginBottom: "1.5rem" }}
        >
          <div className="mode-tabs" role="tablist">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                id={`tab-${m.id}`}
                aria-selected={mode === m.id}
                aria-controls={`panel-${m.id}`}
                className={`tab-btn${mode === m.id ? " active" : ""}`}
                onClick={() => handleModeChange(m.id)}
                disabled={isLoading}
              >
                <span aria-hidden="true">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Upload Panel */}
        <div
          role="tabpanel"
          id={`panel-${mode}`}
          aria-labelledby={`tab-${mode}`}
        >
          {!isLoading && !apiResult && !apiError && (
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              {mode === "compare" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                  <UploadZone
                    label="Document A (original)"
                    docKey="A"
                    file={fileA}
                    onFileChange={setFileA}
                    disabled={isLoading}
                  />
                  <UploadZone
                    label="Document B (revised)"
                    docKey="B"
                    file={fileB}
                    onFileChange={setFileB}
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <UploadZone
                  docKey="A"
                  file={fileA}
                  onFileChange={setFileA}
                  disabled={isLoading}
                />
              )}

              {mode === "ask" && (
                <div style={{ marginTop: "1.25rem" }}>
                  <label htmlFor="question-input" style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    Your question
                  </label>
                  <textarea
                    id="question-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. What are the termination conditions?"
                    maxLength={2000}
                    rows={3}
                    disabled={isLoading}
                    style={{
                      width: "100%",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-dim)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--text-primary)",
                      padding: "0.75rem 1rem",
                      fontSize: "0.9375rem",
                      fontFamily: "inherit",
                      resize: "vertical",
                      outline: "none",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--blue-400)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-dim)")}
                    aria-describedby="question-hint"
                  />
                  <div id="question-hint" className="text-xs text-muted" style={{ marginTop: "0.25rem" }}>
                    {question.length}/2000 characters
                  </div>
                </div>
              )}

              {/* Privacy disclosure near the action button */}
              <div className="text-xs text-muted" style={{ marginTop: "1rem", padding: "0.75rem", background: "var(--bg-surface)", borderRadius: "var(--radius-md)", lineHeight: 1.6 }}>
                <strong>Processing disclosure:</strong> Clicking Analyze Document sends your file to our server. Groq receives the full document text for analysis. Cloudflare receives only high-impact claims with their cited passages.{" "}
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "var(--blue-400)", cursor: "pointer", fontSize: "inherit", padding: 0 }}
                  onClick={() => setShowDisclosure(true)}
                >
                  Full details ›
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary w-full"
                style={{ marginTop: "1rem", width: "100%" }}
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                aria-busy={isLoading}
              >
                <span aria-hidden="true">⚡</span>
                Analyze Document
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="card">
              <LoadingState stepIndex={loadingStep} onCancel={handleCancel} />
            </div>
          )}

          {/* Error */}
          {apiError && !isLoading && (
            <div>
              <div className="notice-banner" style={{ marginBottom: "1rem" }}>
                <strong>Legal information only.</strong> {LEGAL_NOTICE_TEXT}
              </div>
              <div
                ref={errorSummaryRef}
                className="error-card"
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
              >
                <div className="error-title">
                  Analysis could not be completed
                </div>
                <p style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
                  {apiError.error?.message}
                </p>
                <div style={{ marginTop: "0.875rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setApiError(null);
                    }}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {apiResult && !isLoading && (
            <div>
              <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setApiResult(null); setApiError(null); }}
                >
                  ← New analysis
                </button>
                <div className="text-xs text-muted">
                  Analysis by {apiResult.analysisProvider.service} / {apiResult.analysisProvider.model}
                </div>
              </div>
              <ResultView
                mode={apiResult.mode}
                result={apiResult.result}
                actionPack={apiResult.actionPack}
                verification={apiResult.verification}
                resolvedAnchors={apiResult.resolvedAnchors}
                onEvidenceClick={setOpenAnchor}
              />
            </div>
          )}
        </div>
      </main>

      {/* Evidence Drawer */}
      {openAnchor && (
        <EvidenceDrawer
          anchor={openAnchor}
          onClose={() => setOpenAnchor(null)}
        />
      )}

      {/* Disclosure Modal */}
      {showDisclosure && (
        <DisclosureModal onClose={() => setShowDisclosure(false)} />
      )}
    </>
  );
}
