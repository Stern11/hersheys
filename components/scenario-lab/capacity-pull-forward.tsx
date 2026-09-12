/**
 * Capacity pull-forward — the one capacity lever a planner actually has
 * (V2 §46, PRD §7.9, §14.4).
 *
 * Replaces the effective-utilisation matrix as Scenario Lab's primary
 * capacity visual. One line at a time: a bar per month (committed load,
 * absent/unresolved load, overflow above the ceiling), a Before/After
 * toggle, and a "max production pull-forward" slider that redistributes
 * overload into earlier months with headroom (`lib/situations/pull-forward.ts`).
 *
 * This never edits the dataset or a scenario override — it is a lens over
 * the already-computed `CapacityExposure`, recomputed on every render.
 */

"use client";

import { useMemo, useState } from "react";
import { simulatePullForward, type PullForwardCell } from "@/lib/situations/pull-forward";
import { formatMonthLabel } from "@/lib/dataset/periods";
import { fmtDateShort, fmtHours, fmtPct, fmtUnits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CapacityExposure } from "@/types/situation";

/** Rounds a scale ceiling up to a readable step (nearest 100/500/1000...). */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}

const CHART_H = 220;

export function CapacityPullForward({
  exposure,
  lineId,
  candidateUnitsById,
  leadTimeDaysFor,
  selectedPeriod,
  onSelectPeriod,
}: {
  exposure: CapacityExposure;
  lineId: string;
  candidateUnitsById: Record<string, number>;
  leadTimeDaysFor?: (period: string) => number | undefined;
  selectedPeriod?: string;
  onSelectPeriod?: (period: string) => void;
}) {
  const [mode, setMode] = useState<"before" | "after">("before");
  const [maxWeeks, setMaxWeeks] = useState(6);

  const result = useMemo(
    () => simulatePullForward(exposure, lineId, mode === "after" ? maxWeeks : 0, candidateUnitsById, leadTimeDaysFor),
    [exposure, lineId, mode, maxWeeks, candidateUnitsById, leadTimeDaysFor]
  );

  if (!result || result.cells.length === 0) {
    return <p className="text-[13px] text-[var(--text-muted)]">No capacity data for this line.</p>;
  }

  const focusPeriod = selectedPeriod && result.cells.some((c) => c.period === selectedPeriod)
    ? selectedPeriod
    : peakPeriod(result.cells);
  const focusCell = result.cells.find((c) => c.period === focusPeriod);
  const unitsPerHour = unitsPerHourOf(result);

  // `remainingAfterHours` already carries any pulled-in hours added into it,
  // and `overflowAfterHours` is a subset of this same total rather than an
  // amount on top of it — so the true stack height is just these two figures
  // summed, not three.
  const chartMax = niceMax(
    Math.max(...result.cells.flatMap((c) => [c.availableHours, c.committedHours + c.remainingAfterHours])) * 1.12
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-medium text-[var(--text-primary)]">
            Load vs. capacity — {result.lineName}
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-muted)]">
            Absent load is unresolved business converted to line hours. Click a month to inspect it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ModeToggle mode={mode} onChange={setMode} />
          <label className="flex items-center gap-2 text-[11.5px] text-[var(--text-secondary)]">
            Max pull-forward
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={maxWeeks}
              disabled={mode === "before"}
              onChange={(e) => setMaxWeeks(Number(e.target.value))}
              className="w-28 accent-[var(--accent)] disabled:opacity-40"
            />
            <span className="w-14 flex-none tabular-nums text-[var(--text-primary)]">{maxWeeks} wks</span>
          </label>
        </div>
      </div>

      {focusCell ? (
        <FocusMetrics mode={mode} cell={focusCell} unitsPerHour={unitsPerHour} maxWeeks={maxWeeks} />
      ) : null}

      {/* A bar has no numeric meaning without a scale next to it, so the
          y-axis is drawn first and the bars sit in the space it leaves —
          the same left-label-column pattern used by the readiness curve. */}
      <div className="relative mt-6" style={{ height: CHART_H }}>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 flex-col justify-between text-[10px] text-[var(--text-muted)]">
          <span>{fmtHours(chartMax)}</span>
          <span>{fmtHours(chartMax / 2)}</span>
          <span>0h</span>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-11 right-0">
          <div className="absolute inset-x-0 top-0 border-t border-[var(--border)]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-[var(--border)]" />
          <div className="absolute inset-x-0 bottom-0 border-t border-[var(--border-strong)]" />
        </div>
        <div className="flex h-full gap-1.5 pl-11 sm:gap-2">
          {result.cells.map((cell) => (
            <MonthBar
              key={cell.period}
              cell={cell}
              chartMax={chartMax}
              capacity={cell.availableHours}
              selected={cell.period === focusPeriod}
              onClick={() => onSelectPeriod?.(cell.period)}
            />
          ))}
        </div>
      </div>

      {/* A separate row, not inside the fixed-height plot box above — so a
          month's bar height never has to compete with its own label for the
          same pixel budget. */}
      <div className="flex gap-1.5 pl-11 sm:gap-2">
        {result.cells.map((cell) => (
          <button
            key={cell.period}
            type="button"
            onClick={() => onSelectPeriod?.(cell.period)}
            className={cn(
              "min-w-0 flex-1 truncate pt-1.5 text-center text-[10.5px]",
              cell.period === focusPeriod
                ? "font-medium text-[var(--text-primary)] underline decoration-1 underline-offset-4"
                : "text-[var(--text-muted)]"
            )}
          >
            {formatMonthLabel(cell.period)}
          </button>
        ))}
      </div>

      <DropDeadLane cells={result.cells} mode={mode} focusPeriod={focusPeriod} maxWeeks={maxWeeks} />

      {mode === "after" ? <PullForwardPills cells={result.cells} maxWeeks={maxWeeks} /> : null}

      <Legend mode={mode} capacityHoursPerMonth={commonCapacity(result.cells)} />
    </div>
  );
}

/** The shared monthly capacity figure, when every visible month agrees on one. */
function commonCapacity(cells: { availableHours: number }[]): number | undefined {
  const first = cells[0]?.availableHours;
  if (first === undefined) return undefined;
  return cells.every((c) => Math.abs(c.availableHours - first) < 0.5) ? first : undefined;
}

function unitsPerHourOf(result: { totalPulledHours: number; unitsSecured: number }): number {
  return result.totalPulledHours > 0 ? result.unitsSecured / result.totalPulledHours : 0;
}

function peakPeriod(cells: PullForwardCell[]): string {
  let peak = cells[0]!;
  for (const c of cells) {
    if (c.committedHours + c.remainingAfterHours > peak.committedHours + peak.remainingAfterHours) peak = c;
  }
  return peak.period;
}

function ModeToggle({ mode, onChange }: { mode: "before" | "after"; onChange: (m: "before" | "after") => void }) {
  return (
    <div className="flex rounded-[var(--radius-sm)] border border-[var(--border)] p-0.5 text-[12px]">
      {(["before", "after"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-[3px] px-3 py-1 font-medium capitalize transition-colors",
            mode === m
              ? "bg-[var(--text-primary)] text-[var(--text-on-accent)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--interaction-hover)]"
          )}
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metric tiles                                                        */
/* ------------------------------------------------------------------ */

type TileTone = "neutral" | "positive" | "critical" | "highlight";

interface Tile {
  label: string;
  value: string;
  tone: TileTone;
}

// The same `color/opacity` arbitrary-value syntax `components/workspace/runway.tsx`
// already uses for its runway band — Tailwind resolves it via color-mix, so
// it works on an arbitrary CSS-variable colour where `bg-opacity-*` would not
// (that utility only affects colours defined through Tailwind's own rgba
// pipeline, and silently does nothing to a `var(--...)` colour).
const TILE_BOX: Record<TileTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface)]",
  positive: "border-[var(--risk-positive)]/30 bg-[var(--risk-positive)]/[0.06]",
  critical: "border-[var(--risk-critical)]/30 bg-[var(--risk-critical)]/[0.06]",
  highlight: "border-[var(--accent)]/40 bg-[var(--accent)]/[0.06]",
};

const TILE_VALUE: Record<TileTone, string> = {
  neutral: "text-[var(--text-primary)]",
  positive: "text-[var(--risk-positive)]",
  critical: "text-[var(--risk-critical)]",
  highlight: "text-[var(--text-primary)]",
};

function FocusMetrics({
  mode,
  cell,
  unitsPerHour,
  maxWeeks,
}: {
  mode: "before" | "after";
  cell: PullForwardCell;
  unitsPerHour: number;
  maxWeeks: number;
}) {
  const monthLabel = formatMonthLabel(cell.period);
  const overflowBeforePct = cell.availableHours > 0 ? cell.overflowBeforeHours / cell.availableHours : 0;
  const overflowAfterPct = cell.availableHours > 0 ? cell.overflowAfterHours / cell.availableHours : 0;
  const resolved = cell.overflowBeforeHours > 0 && cell.overflowAfterHours <= 0.5;

  const tiles: Tile[] =
    mode === "before"
      ? [
          {
            label: `${monthLabel} · committed utilisation`,
            value: fmtPct(cell.availableHours > 0 ? cell.committedHours / cell.availableHours : 0),
            tone: "neutral",
          },
          {
            label: "Capacity overflow",
            value: cell.overflowBeforeHours > 0 ? `+${fmtPct(overflowBeforePct)}` : "0%",
            tone: cell.overflowBeforeHours > 0 ? "critical" : "positive",
          },
          {
            label: "Additional hours needed",
            value: fmtHours(cell.overflowBeforeHours),
            tone: cell.overflowBeforeHours > 0 ? "critical" : "neutral",
          },
          {
            label: "Units at risk",
            value: unitsPerHour > 0 && cell.overflowBeforeHours > 0 ? fmtUnits(cell.overflowBeforeHours * unitsPerHour, true) : "—",
            tone: cell.overflowBeforeHours > 0 ? "critical" : "neutral",
          },
        ]
      : [
          {
            label: `${monthLabel} · capacity overflow`,
            value: `${fmtPct(overflowBeforePct)} → ${fmtPct(overflowAfterPct)}`,
            tone: resolved ? "highlight" : overflowAfterPct < overflowBeforePct ? "positive" : "neutral",
          },
          {
            label: "Production pulled earlier",
            value: fmtHours(cell.pulledOutHours),
            tone: cell.pulledOutHours > 0 ? "positive" : "neutral",
          },
          {
            label: "Additional hours still needed",
            value: fmtHours(cell.overflowAfterHours),
            tone: cell.overflowAfterHours > 0 ? "critical" : "positive",
          },
          {
            label: "Units secured",
            value: unitsPerHour > 0 && cell.pulledOutHours > 0 ? fmtUnits(cell.pulledOutHours * unitsPerHour, true) : "0",
            tone: cell.pulledOutHours > 0 ? "positive" : "neutral",
          },
        ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={i} className={cn("rounded-[var(--radius-sm)] border px-3 py-2.5", TILE_BOX[t.tone])}>
            <div className="text-[10.5px] font-medium uppercase leading-tight tracking-wide text-[var(--text-muted)]">
              {t.label}
            </div>
            <div className={cn("mt-1.5 text-[19px] font-semibold leading-none tabular-nums", TILE_VALUE[t.tone])}>
              {t.value}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">
        {takeawayFor(cell, mode, unitsPerHour, maxWeeks)}
      </p>
    </div>
  );
}

/** The one sentence a planner reads for the focused month — branches on what actually happened to it. */
function takeawayFor(cell: PullForwardCell, mode: "before" | "after", unitsPerHour: number, maxWeeks: number): string {
  const monthLabel = formatMonthLabel(cell.period);

  if (mode === "before") {
    return cell.overflowBeforeHours > 0
      ? `${monthLabel}: ${fmtHours(cell.overflowBeforeHours)} over capacity.`
      : `${monthLabel}: no overflow — absent load fits within capacity.`;
  }

  if (cell.pulledOutHours > 0 && cell.overflowAfterHours <= 0.5) {
    const units = unitsPerHour > 0 ? ` ≈${fmtUnits(cell.pulledOutHours * unitsPerHour, true)} secured with no extra capacity.` : "";
    const dropDead =
      cell.dropDeadBefore && cell.dropDeadAfter && cell.dropDeadAfter !== cell.dropDeadBefore
        ? " These items' drop-dead dates shift with it, shown in the lane below."
        : "";
    return `${monthLabel}: ${fmtHours(cell.pulledOutHours)} of production moves up to ${maxWeeks} wks earlier.${dropDead}${units}`;
  }
  if (cell.pulledOutHours > 0 && cell.overflowAfterHours > 0.5) {
    return `${monthLabel}: ${fmtHours(cell.pulledOutHours)} pulled ${maxWeeks} wks earlier, but ${fmtHours(cell.overflowAfterHours)} still needs additional capacity.`;
  }
  if (cell.overflowBeforeHours > 0) {
    return `${monthLabel}: ${fmtHours(cell.overflowAfterHours)} still needs additional capacity — no earlier month had enough headroom to take it.`;
  }
  return `${monthLabel}: no overflow — absent load fits within capacity.`;
}

/* ------------------------------------------------------------------ */
/* Bars                                                                 */
/* ------------------------------------------------------------------ */

/**
 * One month's bar, inside the fixed-height plot box.
 *
 * Every ancestor down to the plot box has a *definite* pixel height
 * (`CHART_H`, then `h-full` all the way down) — that chain is what lets each
 * coloured segment's percentage `height` resolve to something real. It broke
 * once before (a percentage height inside an auto-sized flex item resolves to
 * nothing) and the only visible symptom was a plain rectangle where a bar
 * should have been, so the chain is kept unbroken deliberately rather than
 * mixed with pixel math that could drift out of sync with `chartMax`. The
 * selected-month highlight is a *subtle* full-column tint behind the bar
 * (not the bar's own colour), so it can never compete with the bar for
 * visibility the way an opaque highlight once did.
 */
function MonthBar({
  cell,
  chartMax,
  capacity,
  selected,
  onClick,
}: {
  cell: PullForwardCell;
  chartMax: number;
  capacity: number;
  selected: boolean;
  onClick: () => void;
}) {
  const pct = (hours: number) => Math.max(0, (hours / chartMax) * 100);
  const capacityPct = pct(capacity);

  // Bottom to top: committed, then this month's own absent load, then
  // whatever it absorbed from a later month. `overflowAfterHours` is not a
  // fourth segment stacked on top of these — it is a *subset* of them (the
  // slice already sitting above the capacity line), so drawing it again as
  // its own block used to double the bar's real height. The dashed capacity
  // line is what actually says "this part is over" — a colour for it would
  // only repeat what the line and the "+Xh" chip already say.
  const pulledIn = cell.pulledInHours;
  const ownAbsent = Math.max(0, cell.remainingAfterHours - pulledIn);
  const totalStackPct = pct(cell.committedHours) + pct(ownAbsent) + pct(pulledIn);
  const overflow = cell.overflowAfterHours;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
      title={`${formatMonthLabel(cell.period)} · ${fmtHours(cell.committedHours + cell.remainingAfterHours)} of ${fmtHours(capacity)}`}
    >
      {/* A faint full-column tint marks the selected month without ever
          competing with the bar's own colour for visibility. */}
      {selected ? (
        <span className="pointer-events-none absolute inset-0 rounded-t-[3px] bg-[var(--interaction-selected)] opacity-40" aria-hidden />
      ) : null}

      {overflow > 0.5 ? (
        <span
          className="absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tabular-nums text-[var(--risk-critical)]"
          style={{ bottom: `calc(${totalStackPct}% + 4px)` }}
        >
          +{fmtHours(overflow)} over
        </span>
      ) : pulledIn > 0.5 ? (
        <span
          className="absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium tabular-nums text-[var(--risk-positive)]"
          style={{ bottom: `calc(${totalStackPct}% + 4px)` }}
        >
          +{fmtHours(pulledIn)}
        </span>
      ) : null}

      {/* Capacity ceiling — the line that says "over" beyond this point, so
          the stack above it never needs its own colour to repeat that. */}
      <span
        className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-[var(--risk-critical)]"
        style={{ bottom: `${capacityPct}%` }}
        aria-hidden
      />

      {/* `flex-col-reverse` stacks from the bottom, so the first child here
          is the bottom of the bar: committed, then absent load, then
          whatever this month pulled in from later — bottom to top, in that
          order, not the reverse. */}
      <div className="relative z-[1] flex h-full w-full max-w-[34px] flex-col-reverse overflow-visible rounded-[2px]">
        <span
          className={cn("w-full", selected ? "bg-[var(--text-primary)]" : "bg-[var(--state-formal)]")}
          style={{ height: `${pct(cell.committedHours)}%` }}
          aria-hidden
        />
        {ownAbsent > 0 ? (
          <span className="w-full bg-[var(--state-inferred)]" style={{ height: `${pct(ownAbsent)}%` }} aria-hidden />
        ) : null}
        {pulledIn > 0 ? (
          <span className="w-full bg-[var(--risk-positive)]" style={{ height: `${pct(pulledIn)}%` }} aria-hidden />
        ) : null}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Drop-dead lane                                                       */
/* ------------------------------------------------------------------ */

/**
 * One dot per month, aligned under its bar — every month's material decision
 * date, at a glance. The focused month gets its date spelled out; in After
 * mode, a month whose build actually moved earlier shows both dates, so the
 * shift this scenario buys is visible without opening the decomposition.
 */
function DropDeadLane({
  cells,
  mode,
  focusPeriod,
  maxWeeks,
}: {
  cells: PullForwardCell[];
  mode: "before" | "after";
  focusPeriod: string;
  maxWeeks: number;
}) {
  const hasAnyDate = cells.some((c) => c.dropDeadBefore);
  if (!hasAnyDate) return null;

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        Drop-dead date, by month
      </div>
      <div className="flex gap-1.5 pl-11 sm:gap-2">
        {cells.map((cell) => {
          const focused = cell.period === focusPeriod;
          const shifted =
            mode === "after" && cell.dropDeadBefore && cell.dropDeadAfter && cell.dropDeadAfter !== cell.dropDeadBefore;
          const activeDate = mode === "after" ? cell.dropDeadAfter : cell.dropDeadBefore;

          return (
            <div key={cell.period} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "rounded-full",
                  focused ? "size-2.5" : "size-1.5",
                  shifted ? "bg-[var(--risk-positive)]" : focused ? "bg-[var(--text-primary)]" : "bg-[var(--text-muted)]"
                )}
                aria-hidden
              />
              {focused && activeDate ? (
                <div className="text-center text-[10px] leading-tight">
                  <div className={cn("font-medium tabular-nums", shifted ? "text-[var(--risk-positive)]" : "text-[var(--text-primary)]")}>
                    {fmtDateShort(activeDate)}
                    {shifted ? ` · ${maxWeeks}wk earlier` : ""}
                  </div>
                  {shifted && cell.dropDeadBefore ? (
                    <div className="text-[var(--text-muted)] line-through decoration-[var(--text-muted)]">
                      was {fmtDateShort(cell.dropDeadBefore)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pull-forward pills                                                   */
/* ------------------------------------------------------------------ */

/** Every month a pull-forward actually touches, not just the focused one — so the whole shape of the scenario is visible without clicking through each month. */
function PullForwardPills({ cells, maxWeeks }: { cells: PullForwardCell[]; maxWeeks: number }) {
  const pills = cells
    .map((cell) => {
      const parts: string[] = [];
      if (cell.pulledOutHours > 0.5) parts.push(`build ${fmtHours(cell.pulledOutHours)} ~${maxWeeks}wk earlier`);
      if (cell.overflowAfterHours > 0.5) parts.push(`${fmtHours(cell.overflowAfterHours)} short`);
      if (parts.length === 0) return null;
      return {
        period: cell.period,
        text: `${formatMonthLabel(cell.period)}: ${parts.join(" + ")}`,
        short: cell.overflowAfterHours > 0.5,
      };
    })
    .filter((p): p is { period: string; text: string; short: boolean } => p !== null);

  if (pills.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {pills.map((p) => (
        <span
          key={p.period}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
            p.short
              ? "border-[var(--risk-critical)] text-[var(--risk-critical)]"
              : "border-[var(--risk-positive)] text-[var(--risk-positive)]"
          )}
        >
          {p.text}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend                                                               */
/* ------------------------------------------------------------------ */

function Legend({ mode, capacityHoursPerMonth }: { mode: "before" | "after"; capacityHoursPerMonth?: number }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--text-muted)]">
      <Swatch className="bg-[var(--state-formal)]" label="Committed" />
      <Swatch className="bg-[var(--state-inferred)]" label="Absent load" />
      {mode === "after" ? <Swatch className="bg-[var(--risk-positive)]" label="Pulled earlier" /> : null}
      <span className="flex items-center gap-1.5">
        <span className="h-px w-6 border-t border-dashed border-[var(--risk-critical)]" aria-hidden />
        Line capacity{capacityHoursPerMonth !== undefined ? ` · ${fmtHours(capacityHoursPerMonth)}/mo` : ""} — anything above is over
      </span>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[2px]", className)} aria-hidden />
      {label}
    </span>
  );
}
