"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type UploadState = "idle" | "ready" | "uploading" | "done" | "error";

export interface UploadZoneProps {
  label: string;
  hint: string;
  accept?: string;
  file: File | null;
  state: UploadState;
  error?: string | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
}

export function UploadZone({
  label,
  hint,
  accept,
  file,
  state,
  error,
  onFile,
  disabled,
}: UploadZoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled)
            inputRef.current?.click();
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-accent bg-accent/10"
            : "border-border bg-bg-soft/50 hover:border-accent/40",
          disabled && "cursor-not-allowed opacity-50",
          state === "done" && "border-emerald-500/50 bg-emerald-500/5",
          state === "error" && "border-red-500/50 bg-red-500/5"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          disabled={disabled}
        />
        <div className="text-2xl">
          {state === "done" ? "✅" : state === "error" ? "⚠️" : "⬆️"}
        </div>
        <p className="mt-2 text-sm font-semibold text-white">{label}</p>
        {file ? (
          <p className="mt-1 max-w-full truncate text-xs text-accent">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">{hint}</p>
        )}
        {state === "uploading" && (
          <p className="mt-2 text-xs text-accent">Uploading…</p>
        )}
        {state === "error" && (
          <p className="mt-2 text-xs text-red-300">{error ?? "Upload failed"}</p>
        )}
      </div>
    </div>
  );
}
