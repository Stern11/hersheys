"use client";

export interface HistoricalVsSystemRow {
  label: "System assumption" | "Historical median" | "Historical P80" | "Scenario value";
  value: number;
  token: "--state-formal" | "--state-historical" | "--state-inferred" | "--state-scenario";
  active?: boolean;
}

/**
 * Signature Visual E (PRD-phase-2 §11E): System vs. Historical vs. Scenario
 * on one shared axis, so the gap between what the system assumes and what
 * execution actually shows is a length a planner can compare at a glance,
 * not four separate numbers to mentally subtract.
 */
export function HistoricalVsSystemChart({ rows, unit, sampleContext }: { rows: HistoricalVsSystemRow[]; unit: string; sampleContext: string }) {
  const max = Math.max(...rows.map((r) => r.value)) * 1.15;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className={`w-36 flex-none text-[12px] ${r.active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{r.label}</div>
            <div className="relative h-4 flex-1 rounded-[3px] bg-[var(--surface-sunken)]">
              <div className="h-full rounded-[3px]" style={{ width: `${(r.value / max) * 100}%`, background: `var(${r.token})`, opacity: r.active ? 1 : 0.55 }} />
            </div>
            <div className="w-20 flex-none text-right text-[12.5px] font-semibold tabular-nums">
              {r.value.toLocaleString()} {unit}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">{sampleContext}</p>
    </div>
  );
}
