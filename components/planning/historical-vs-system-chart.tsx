"use client";

import { anchorTransform, labelAnchor, linearAxis } from "@/lib/charts/axis";

export interface HistoricalVsSystemRow {
  label: "System assumption" | "Historical median" | "Historical P80" | "Scenario value";
  value: number;
  token: "--state-formal" | "--state-historical" | "--state-inferred" | "--state-scenario";
  active?: boolean;
}

/**
 * Signature Visual E (PRD-phase-2 §11E): System vs. Historical vs. Scenario on
 * one shared axis, so the gap between what the system assumes and what
 * execution actually shows is a length a planner can compare at a glance, not
 * four separate numbers to mentally subtract.
 *
 * The caption said "one shared axis" but no axis was ever drawn — bars were
 * scaled by `max * 1.15`, an arbitrary factor that put every bar at an
 * unreadable fraction of an invisible ceiling. The scale now comes from
 * `linearAxis()` (unit tested) and is rendered with labelled ticks, so a bar's
 * length is readable as a value and the differences between rows are
 * measurable against gridlines.
 */
export function HistoricalVsSystemChart({ rows, unit, sampleContext }: { rows: HistoricalVsSystemRow[]; unit: string; sampleContext: string }) {
  const axis = linearAxis(Math.max(0, ...rows.map((r) => r.value)) * 1.08, 4);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex w-full min-w-0 flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className={`w-36 flex-none text-[12px] ${r.active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{r.label}</div>
            <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
              {axis.ticks.slice(1, -1).map((t) => (
                <div key={t} className="absolute inset-y-0 w-px bg-[var(--border)]" style={{ left: `${(t / axis.max) * 100}%` }} />
              ))}
              <div
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{ width: `${(r.value / axis.max) * 100}%`, background: `var(${r.token})`, opacity: r.active ? 1 : 0.55 }}
                title={`${r.label}: ${r.value.toLocaleString()} ${unit}`}
              />
            </div>
            <div className="w-20 flex-none text-right text-[12.5px] font-semibold tabular-nums">
              {r.value.toLocaleString()} {unit}
            </div>
          </div>
        ))}
      </div>

      {/* shared axis — aligned to the bar track (label column + value column) */}
      <div className="flex items-start gap-3">
        <div className="w-36 flex-none" />
        <div className="relative h-[18px] min-w-0 flex-1 border-t border-[var(--border-strong)]">
          {axis.ticks.map((t, i) => {
            const pct = (t / axis.max) * 100;
            return (
              <div key={t} className="absolute top-0" style={{ left: `${pct}%` }}>
                <span className="absolute top-0 block h-1 w-px bg-[var(--border-strong)]" />
                <span className="absolute top-[5px] block whitespace-nowrap text-[10px] tabular-nums text-[var(--text-muted)]" style={{ transform: anchorTransform(labelAnchor(pct)) }}>
                  {t.toLocaleString()}
                  {i === axis.ticks.length - 1 ? ` ${unit}` : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="w-20 flex-none" />
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">{sampleContext}</p>
    </div>
  );
}
