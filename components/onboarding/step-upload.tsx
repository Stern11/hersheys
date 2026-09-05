/**
 * Step 2 — Upload (V2 §12, §27, §36).
 *
 * Parsing happens entirely client-side: the workbook never leaves the
 * browser. `validateWorkbook` already turns a bad file into a normal
 * "unreadable workbook" issue rather than throwing, so this component only
 * has to handle the mechanics of getting bytes out of a `File`.
 */

"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StepUpload({
  file,
  validating,
  unreadableMessage,
  onFileSelected,
  onClearFile,
  onBack,
  onContinue,
  canContinue,
}: {
  file: File | null;
  validating: boolean;
  /** Set when the workbook could not be read at all — surfaced inline, no stack trace. */
  unreadableMessage: string | null;
  onFileSelected: (file: File) => void;
  onClearFile: () => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  };

  return (
    <div>
      <p className="max-w-[560px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        Upload the workbook you filled in. We&apos;ll check it right here before anything is used.
      </p>

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "mt-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed px-8 py-14 text-center transition-colors",
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--border)] hover:border-[var(--border-strong)]"
          )}
        >
          <span className="grid size-10 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
            <UploadCloud className="size-5" />
          </span>
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">
              Drag your file here, or click to browse
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">.xlsx workbook</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) onFileSelected(picked);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
          <span className="grid size-9 flex-none place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]">
            {validating ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{file.name}</p>
            <p className="text-[12px] text-[var(--text-muted)]">
              {formatBytes(file.size)} · {validating ? "Checking your file…" : "Checked"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClearFile} aria-label="Remove file">
            <X className="size-4" />
          </Button>
        </div>
      )}

      {unreadableMessage ? (
        <p className="mt-3 text-[13px] text-[var(--risk-critical)]">{unreadableMessage}</p>
      ) : null}

      <p className="mt-4 text-[12px] text-[var(--text-muted)]">
        Your data stays in this browser — nothing is uploaded to a server.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        {file && !validating && canContinue ? (
          <Button size="lg" onClick={onContinue}>
            Continue
          </Button>
        ) : null}
      </div>
    </div>
  );
}
