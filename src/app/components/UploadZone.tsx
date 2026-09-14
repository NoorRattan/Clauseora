"use client";

import { useState, useRef } from "react";

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
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const zoneId = `upload-zone-${docKey}`;
  const inputId = `upload-input-${docKey}`;

  return (
    <div>
      {label && (
        <div
          className="text-sm font-600 mb-2"
          style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}
        >
          {label}
        </div>
      )}
      {/* Drag-and-drop zone (also clickable) */}
      <div
        id={zoneId}
        className={`upload-zone${dragOver ? " drag-over" : ""}${file ? " has-file" : ""}`}
        role="group"
        aria-labelledby={`${zoneId}-label`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}
      >
        <div className="upload-icon" aria-hidden="true">
          {file ? "✓" : "⬆"}
        </div>

        {file ? (
          <div id={`${zoneId}-label`}>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
              {file.name}
            </div>
            <div className="upload-hint">
              {(file.size / 1024).toFixed(0)} KB
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-3"
              onClick={handleRemove}
              aria-label={`Remove ${file.name}`}
            >
              Remove file
            </button>
          </div>
        ) : (
          <div id={`${zoneId}-label`}>
            <div style={{ fontWeight: 500, marginBottom: "0.25rem" }}>
              Drop file here or click to browse
            </div>
            <div className="upload-hint">
              PDF, DOCX, TXT · Max 8 MB · 150 pages · Text-layer only
            </div>
          </div>
        )}

        {/* Always-visible file input (a11y: keyboard users) */}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          aria-label={label ?? "Upload document"}
          onChange={handleChange}
          disabled={disabled}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
          tabIndex={-1}
        />
      </div>

      {/* Accessible file input always reachable by keyboard */}
      <label
        htmlFor={inputId}
        className="btn btn-ghost btn-sm mt-2"
        style={{ display: "inline-flex", marginTop: "0.5rem" }}
      >
        <span aria-hidden="true">📎</span>
        {file ? "Change file" : "Browse files"}
      </label>
    </div>
  );
}
