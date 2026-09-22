"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Trash2, Sparkles, FileCheck } from "lucide-react";

interface UploadZoneProps {
  label?: string;
  docKey: "A" | "B";
  accept?: string;
  onFileChange: (file: File | null) => void;
  file: File | null;
  disabled?: boolean;
}

export function UploadZone({
  label,
  docKey,
  accept = ".pdf,.docx,.txt",
  onFileChange,
  file,
  disabled,
}: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    onFileChange(selected);
    // Clear the native input so selecting the same file again still emits a
    // change event after a retry or replacement.
    e.currentTarget.value = "";
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const loadSample = async (
    sampleId: string,
    filename: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (disabled) return;
    setLoadingPreset(sampleId);
    setSampleError(null);
    try {
      const res = await fetch(`/api/sample?id=${sampleId}`);
      if (!res.ok) throw new Error("Failed to fetch sample fixture");
      const blob = await res.blob();
      const sampleFile = new File([blob], filename, {
        type:
          blob.type ||
          (filename.endsWith(".pdf") ? "application/pdf" : "text/plain"),
      });
      onFileChange(sampleFile);
    } catch {
      setSampleError(
        "The sample could not be loaded. Please try again or choose a file.",
      );
    } finally {
      setLoadingPreset(null);
    }
  };

  const zoneId = `upload-zone-${docKey}`;
  const inputId = `upload-input-${docKey}`;

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            {label}
          </span>
          <span className="text-[11px] font-mono text-muted-accessible">
            {docKey === "A" ? "Document A" : "Document B"}
          </span>
        </div>
      )}

      {/* Main Drop Surface with spring motion */}
      <motion.div
        id={zoneId}
        role={file ? "group" : "button"}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-busy={loadingPreset !== null}
        aria-describedby={`${zoneId}-description`}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-labelledby={`${zoneId}-label`}
        whileHover={
          !disabled ? { scale: 1.006, transition: { duration: 0.2 } } : {}
        }
        whileTap={!disabled ? { scale: 0.995 } : {}}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer ${
          disabled
            ? "cursor-not-allowed opacity-50 bg-obsidian-950/40 border-white/5"
            : dragOver
              ? "border-cyan-400 bg-cyan-950/20 shadow-glow-cyan"
              : file
                ? "border-amber-500/40 bg-obsidian-900/80 shadow-glow-amber"
                : "border-white/10 bg-obsidian-900/50 hover:border-white/20 hover:bg-obsidian-850/60"
        } backdrop-blur-xl p-6 sm:p-8 min-h-[220px] flex flex-col items-center justify-center text-center`}
      >
        {/* Subtle ambient gradient sheen */}
        <div
          className="pointer-events-none absolute -inset-px opacity-20 transition-opacity duration-300 group-hover:opacity-40"
          style={{
            background:
              "radial-gradient(600px circle at var(--x, 50%) var(--y, 50%), rgba(245, 158, 11, 0.15), transparent 40%)",
          }}
        />

        <AnimatePresence mode="wait">
          {file ? (
            /* Selected File State */
            <motion.div
              key="file-active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center w-full z-10"
              id={`${zoneId}-label`}
            >
              <div className="relative mb-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-glow-amber">
                  <FileCheck className="w-7 h-7" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-obsidian-950 flex items-center justify-center text-[10px] font-bold">
                  ✓
                </div>
              </div>

              <div className="font-semibold text-slate-100 text-base max-w-[90%] truncate">
                {file.name}
              </div>
              <p id={`${zoneId}-description`} className="sr-only">
                Selected document {file.name}. Press Enter or Space to choose a different file.
              </p>

              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                <span className="font-mono">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <span>•</span>
                <span className="text-amber-400/90 font-medium">
                  Ready for verification
                </span>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                >
                  Change file
                </button>
              </div>
            </motion.div>
          ) : (
            /* Empty Upload State */
            <motion.div
              key="file-empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center z-10"
              id={`${zoneId}-label`}
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 mb-3 group-hover:text-amber-400 group-hover:border-amber-400/30 transition-colors">
                <UploadCloud className="w-7 h-7" />
              </div>

              <div className="text-sm font-semibold text-slate-200 mb-1">
                Drop document here or{" "}
                <span className="text-amber-400 underline underline-offset-2">
                  browse
                </span>
              </div>

              <p
                id={`${zoneId}-description`}
                className="text-xs text-slate-400 max-w-xs leading-relaxed"
              >
                PDF, DOCX, or TXT • Max 8 MB • 150 pages • 100% In-Memory
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Accessible Input */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          aria-label={label ?? "Upload document"}
          onChange={handleChange}
          disabled={disabled}
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
          tabIndex={-1}
        />
      </motion.div>

      {/* 1-Click Agency Pre-loaded Fixture Bar */}
      {sampleError && (
        <p role="alert" aria-live="assertive" className="mt-2 text-xs text-rose-300">
          {sampleError}
        </p>
      )}
      {!file && (
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Try synthetic demo:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={disabled || !!loadingPreset}
              onClick={(e) =>
                loadSample("mutual-nda", "Mutual-NDA-Standard.txt", e)
              }
              className="px-2.5 py-1.5 min-h-6 rounded-md text-[11px] font-mono text-slate-300 bg-white/5 hover:bg-amber-500/10 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 transition-all disabled:opacity-50"
            >
              {loadingPreset === "mutual-nda" ? "Loading..." : "Mutual NDA"}
            </button>
            <button
              type="button"
              disabled={disabled || !!loadingPreset}
              onClick={(e) =>
                loadSample(
                  docKey === "B"
                    ? "services-agreement-v2"
                    : "services-agreement-v1",
                  docKey === "B"
                    ? "Services-Agreement-v2.txt"
                    : "Services-Agreement-v1.txt",
                  e,
                )
              }
              className="px-2.5 py-1.5 min-h-6 rounded-md text-[11px] font-mono text-slate-300 bg-white/5 hover:bg-cyan-500/10 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 transition-all disabled:opacity-50"
            >
              {loadingPreset?.startsWith("services")
                ? "Loading..."
                : docKey === "B"
                  ? "Services v2"
                  : "Services v1"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
