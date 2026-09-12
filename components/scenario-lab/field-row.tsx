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
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils/cn";
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
  slider = false,
  inlineBaseline = false,
  unit,
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
  /** Adds a slider beside the field. Requires both `min` and `max`. */
  slider?: boolean;
  /**
   * Puts the baseline on the same row instead of below it. Halves the height
   * of a long list; opt-in rather than a width heuristic, because it only
   * fits where the label is short.
   */
  inlineBaseline?: boolean;
  /**
   * Unit suffix for a plain number — "h", "/h". Percentages and unit counts
   * carry their own, so this is only for `display="num"`, where a bare 488
   * says nothing about what it counts.
   */
  unit?: string;
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

  // A bounded value is easier to move than to type. Sliders are offered where
  // the range is real (a utilisation target, a share) and the exact digit
  // rarely matters; a seven-figure volume still gets a field, because dragging
  // to 1,154,921 is not a thing anyone wants to do.
  const sliderRange =
    slider && min !== undefined && max !== undefined ? { min, max } : undefined;

  // A bare 488 — or a bare 4237007 — says nothing about what it counts, so a
  // plain number carries its unit and a unit-count carries the word "units"
  // (fmtUnits's own M/K compaction is a magnitude, not a unit of measure —
  // "4.24M" alone doesn't say units, dollars, or anything else). Only a
  // percentage already carries its own suffix inline.
  const suffix = display === "num" ? (unit ?? "") : display === "units" ? "units" : "";
  // A single-letter/short abbreviation reads fine glued to the number ("120h",
  // "6wks" elsewhere in this app); a whole word does not ("4.54Munits").
  const show = (value: number) => (suffix ? `${formatValue(value, display)}${display === "units" ? " " : ""}${suffix}` : formatValue(value, display));

  const summary = isOverridden ? (
    <>
      Baseline {show(baseline)} → {show(effective)}{" "}
      <span className="font-medium text-[var(--state-scenario)]">
        {formatSigned(effective - baseline, display)}
      </span>
    </>
  ) : (
    <>Baseline {show(baseline)}</>
  );

  // Inline halves the height of a long list, but a slider already eats the
  // row and an override needs room for "x → y  Δ" without truncating into
  // "Baseline 78 · Scen…".
  const inline = inlineBaseline && !sliderRange && !isOverridden;

  return (
    <div className={cn("flex flex-col", !inline && "gap-1")}>
      <div className="flex items-center gap-2">
        {labelWidth > 0 ? (
          <span
            className="flex-none truncate text-[12px] text-[var(--text-secondary)]"
            style={{ width: labelWidth }}
          >
            {label}
          </span>
        ) : null}

        {sliderRange ? (
          <Slider
            value={[toInputValue(effective, display)]}
            min={toInputValue(sliderRange.min, display)}
            max={toInputValue(sliderRange.max, display)}
            step={display === "pct" ? 1 : 5}
            onValueChange={([v]) => onCommit(fromInputValue(v ?? 0, display))}
            className="min-w-0 flex-1"
            aria-label={label || "value"}
          />
        ) : null}

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          inputMode="decimal"
          aria-label={label || "value"}
          className="h-7 flex-none text-right"
          style={{ width: inputWidth }}
        />
        {suffix ? (
          <span className="flex-none text-[11px] text-[var(--text-muted)]">{suffix}</span>
        ) : null}

        {inline ? (
          <span className="min-w-0 flex-1 truncate text-right text-[11px] tabular-nums text-[var(--text-muted)]">
            {summary}
          </span>
        ) : null}

        {/* A 12px glyph is not a hit area. The button is padded to something a
            planner can actually land on, and only appears once there is an
            override to clear. */}
        {isOverridden ? (
          <button
            type="button"
            onClick={onClear}
            title="Clear override"
            aria-label="Clear override"
            className="-mr-1 flex size-7 flex-none items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--interaction-hover)] hover:text-[var(--text-primary)]"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <span className="size-7 flex-none" aria-hidden />
        )}
      </div>

      {!inline ? (
        <div
          className="text-[11px] tabular-nums text-[var(--text-muted)]"
          style={{ paddingLeft: labelWidth > 0 ? labelWidth + 8 : 0 }}
        >
          {summary}
        </div>
      ) : null}
    </div>
  );
}
