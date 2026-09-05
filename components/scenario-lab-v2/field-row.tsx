/**
 * One editable assumption: a label, a number input, and the baseline-vs-
 * scenario shape the whole left column depends on (V2 §46, §53):
 *
 *   Baseline 820 · Scenario 720 · −100
 *
 * Local state commits on blur / Enter rather than on every keystroke, so
 * typing a value does not trigger a full `buildSituations()` recompute per
 * character — only the committed value does.
 */

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fmtUnits } from "@/lib/utils/format";

export type FieldDisplay = "pct" | "num" | "units";

function formatValue(value: number, display: FieldDisplay): string {
  if (display === "pct") return `${Math.round(value * 100)}%`;
  // Volumes run to seven figures. Printed raw they are unreadable at a glance
  // and overflow the column, so the summary line is compact even though the
  // input itself still edits the exact number.
  if (display === "units") return fmtUnits(value);
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatSigned(value: number, display: FieldDisplay): string {
  const epsilon = display === "pct" ? 0.0005 : display === "units" ? 0.5 : 0.05;
  if (Math.abs(value) < epsilon) return formatValue(0, display);
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatValue(Math.abs(value), display)}`;
}

/** What the input box itself edits: whole percent points, or the raw number. */
function toInputValue(value: number, display: FieldDisplay): number {
  if (display === "pct") return Math.round(value * 1000) / 10;
  if (display === "units") return Math.round(value);
  return Math.round(value * 100) / 100;
}

function fromInputValue(value: number, display: FieldDisplay): number {
  return display === "pct" ? value / 100 : value;
}

export function FieldRow({
  label,
  baseline,
  override,
  onCommit,
  onClear,
  display = "num",
  min,
  max,
  labelWidth = 104,
  inputWidth = 68,
}: {
  label: string;
  baseline: number;
  /** The raw scenario-store value for this key, undefined when not overridden. */
  override: number | undefined;
  onCommit: (value: number) => void;
  onClear: () => void;
  display?: FieldDisplay;
  min?: number;
  max?: number;
  /** Narrower when the row's subject is already named above it. */
  labelWidth?: number;
  /** Wider for seven-figure volumes, which do not fit the default box. */
  inputWidth?: number;
}) {
  const effective = override ?? baseline;
  const isOverridden = override !== undefined;

  const [text, setText] = useState(() => String(toInputValue(effective, display)));

  useEffect(() => {
    setText(String(toInputValue(effective, display)));
    // Only resync when the value this row represents actually changes —
    // typing should never be clobbered by our own re-render.
  }, [effective, display]);

  const commit = () => {
    const parsed = Number(text);
    if (Number.isNaN(parsed)) {
      setText(String(toInputValue(effective, display)));
      return;
    }
    let next = fromInputValue(parsed, display);
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (Math.abs(next - effective) < 1e-9) {
      setText(String(toInputValue(effective, display)));
      return;
    }
    onCommit(next);
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="flex-none truncate text-[12px] text-[var(--text-secondary)]"
        style={{ width: labelWidth }}
      >
        {label}
      </span>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        inputMode="decimal"
        className="h-7 flex-none text-right"
        style={{ width: inputWidth }}
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-muted)]">
        {isOverridden ? (
          <>
            Baseline {formatValue(baseline, display)} · Scenario {formatValue(effective, display)} ·{" "}
            {formatSigned(effective - baseline, display)}
          </>
        ) : (
          `Baseline ${formatValue(baseline, display)}`
        )}
      </span>
      {isOverridden ? (
        <button
          type="button"
          onClick={onClear}
          title="Clear override"
          className="flex-none text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="size-3" />
        </button>
      ) : (
        <span className="size-3 flex-none" aria-hidden />
      )}
    </div>
  );
}
