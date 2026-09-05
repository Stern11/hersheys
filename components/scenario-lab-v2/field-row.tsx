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

export type FieldDisplay = "pct" | "num";

function formatValue(value: number, display: FieldDisplay): string {
  if (display === "pct") return `${Math.round(value * 100)}%`;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatSigned(value: number, display: FieldDisplay): string {
  if (Math.abs(value) < (display === "pct" ? 0.0005 : 0.05)) return formatValue(0, display);
  const sign = value > 0 ? "+" : "−";
  return `${sign}${formatValue(Math.abs(value), display)}`;
}

/** What the input box itself edits: whole percent points, or the raw number. */
function toInputValue(value: number, display: FieldDisplay): number {
  return display === "pct" ? Math.round(value * 1000) / 10 : Math.round(value * 100) / 100;
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
      <span className="w-[104px] flex-none truncate text-[12px] text-[var(--text-secondary)]">{label}</span>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        inputMode="decimal"
        className="h-7 w-[68px] flex-none text-right"
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
