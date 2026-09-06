/**
 * The effective-capacity matrix (V2 §47, §63).
 *
 * Lines down, months across. Each cell carries two numbers: what the formal
 * plan puts on the line, and what it looks like once unresolved business is
 * included. That contrast is the entire point — a line can read as
 * comfortable purely because the demand is missing.
 */

"use client";

import { useState } from "react";
import type { CapacityCell, CapacityExposure } from "@/types/situation";
import { formatMonthLabel } from "@/lib/dataset/periods";
import { fmtHours, fmtPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Risk is measured against the line's own target, not a fixed threshold —
 * a line run at 95% by design is not the same as one that has drifted there.
 */
function band(cell: CapacityCell): "clear" | "near" | "over" | "breach" {
  const ratio = cell.effectiveUtilization / (cell.targetUtilizationPct || 1);
  if (ratio >= 1.08) return "breach";
  if (ratio >= 1) return "over";
  if (ratio >= 0.9) return "near";
  return "clear";
}

/**
 * The escalation is carried by how much colour a cell takes, not by four
 * different fills. A warning-hue block at dark-theme lightness reads brown
 * rather than amber, so "approaching" tints the number and leaves the cell
 * alone; only a real breach earns a solid fill.
 */
const BAND_STYLE: Record<ReturnType<typeof band>, string> = {
  clear: "bg-[var(--surface)] text-[var(--text-secondary)]",
  near: "bg-[var(--surface)] text-[var(--risk-warning)]",
  over: "bg-[var(--risk-critical-soft)] text-[var(--risk-critical)]",
  breach: "bg-[var(--risk-critical)] text-[var(--text-on-accent)]",
};

export function CapacityMatrix({
  exposure,
  selected,
  onSelect,
}: {
  exposure: CapacityExposure;
  selected?: CapacityCell | null;
  onSelect?: (cell: CapacityCell) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const cellAt = (lineId: string, period: string) =>
    exposure.cells.find((c) => c.lineId === lineId && c.period === period);

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-[12px]">
        <thead>
          <tr>
            <th
              scope="col"
              style={{ width: 210 }}
              className="sticky left-0 z-10 bg-[var(--background)] pb-2 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
            >
              Line
            </th>
            {exposure.periods.map((period) => (
              <th
                key={period}
                scope="col"
                className="pb-2 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]"
              >
                {formatMonthLabel(period)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exposure.lines.map((line) => (
            <tr key={line.lineId}>
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap bg-[var(--background)] py-1 pr-4 text-left text-[12.5px] font-medium text-[var(--text-primary)]"
              >
                {line.lineName}
              </th>
              {exposure.periods.map((period) => {
                const cell = cellAt(line.lineId, period);
                if (!cell) {
                  return (
                    <td key={period} className="p-0.5">
                      <div className="flex h-[46px] items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                        —
                      </div>
                    </td>
                  );
                }
                const key = `${line.lineId}:${period}`;
                const isSelected = selected?.lineId === line.lineId && selected.period === period;
                const tone = band(cell);
                // The formal share is drawn as an underline so the reader can
                // see how much of the bar is real plan versus unresolved load.
                const formalShare = cell.effectiveUtilization > 0
                  ? Math.min(1, cell.formalUtilization / cell.effectiveUtilization)
                  : 0;
                return (
                  <td key={period} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelect?.(cell)}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                      title={`${fmtPct(cell.formalUtilization)} formal → ${fmtPct(cell.effectiveUtilization)} effective of ${fmtHours(cell.availableHours)}`}
                      className={cn(
                        "relative flex h-[52px] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[var(--radius-sm)] border transition-colors",
                        BAND_STYLE[tone],
                        isSelected
                          ? "border-[var(--interaction-selected-border)] ring-1 ring-[var(--ring)]"
                          : "border-[var(--border)]",
                        hover === key && !isSelected && "border-[var(--border-strong)]"
                      )}
                      style={{ transitionDuration: "var(--duration-fast)" }}
                    >
                      {/* How full the month is, as fill rather than as a
                          number to convert. A grid of grey percentages made
                          the reader do the comparison the chart should have
                          done for them. */}
                      <span
                        className="pointer-events-none absolute inset-x-0 bottom-0 bg-current opacity-[0.09]"
                        style={{ height: `${Math.min(100, cell.effectiveUtilization * 100)}%` }}
                        aria-hidden
                      />
                      <span className="relative text-[15px] font-semibold leading-none tabular-nums">
                        {fmtPct(cell.effectiveUtilization)}
                      </span>
                      {/* The split inside that fill: solid is committed plan,
                          the remainder is load nothing formally accounts for. */}
                      <span className="relative h-[3px] w-9 overflow-hidden rounded-full bg-current opacity-25">
                        <span
                          className="block h-full bg-current opacity-100"
                          style={{ width: `${formalShare * 100}%` }}
                        />
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--text-muted)]">
        <LegendSwatch className="bg-[var(--surface)] border border-[var(--border)]" label="Within target" />
        <LegendSwatch className="bg-[var(--risk-warning)]" label="Approaching target" />
        <LegendSwatch className="bg-[var(--risk-critical-soft)]" label="Over target" />
        <LegendSwatch className="bg-[var(--risk-critical)]" label="Well over target" />
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-6 rounded-full bg-[var(--text-secondary)] opacity-30">
            <span className="block h-full w-1/2 bg-[var(--text-secondary)] opacity-100" />
          </span>
          Solid portion is the formal plan; the rest is unresolved
        </span>
      </div>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[3px]", className)} aria-hidden />
      {label}
    </span>
  );
}

/** The decomposition shown when a cell is selected (V2 §48). */
export function CapacityCellDetail({ cell }: { cell: CapacityCell }) {
  const deductions = [
    { label: "Planned maintenance", hours: cell.plannedMaintenanceHours },
    { label: "Project downtime", hours: cell.projectDowntimeHours },
    { label: "Labour constraint", hours: cell.laborConstraintHours },
    { label: "Other constraint", hours: cell.otherConstraintHours },
  ].filter((d) => d.hours > 0);

  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-1 text-[12.5px]">
      <Row label="Base calendar" value={fmtHours(cell.baseCalendarHours)} />
      {deductions.map((d) => (
        <Row key={d.label} label={d.label} value={`−${fmtHours(d.hours)}`} muted />
      ))}
      {cell.customAdjustmentHours !== 0 ? (
        <Row label="Adjustment" value={`+${fmtHours(cell.customAdjustmentHours)}`} muted />
      ) : null}
      <Row label="Available hours" value={fmtHours(cell.availableHours)} strong />
      <Row label="Formal plan" value={fmtHours(cell.formalHours)} />
      <Row label="Unresolved" value={fmtHours(cell.unresolvedHours)} />
      <Row label="Effective required" value={fmtHours(cell.effectiveHours)} strong />
      <Row
        label="Effective utilisation"
        value={fmtPct(cell.effectiveUtilization)}
        strong
        tone={cell.effectiveUtilization > cell.targetUtilizationPct ? "critical" : "neutral"}
      />
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
  tone = "neutral",
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: "neutral" | "critical";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-1 last:border-b-0",
        strong && "border-[var(--border-strong)]"
      )}
    >
      <span className={cn("text-[var(--text-secondary)]", muted && "text-[var(--text-muted)]")}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-primary)]",
          muted && "font-normal text-[var(--text-muted)]",
          tone === "critical" && "text-[var(--risk-critical)]"
        )}
      >
        {value}
      </span>
    </div>
  );
}
