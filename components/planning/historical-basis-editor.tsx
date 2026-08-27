"use client";

import { Check } from "lucide-react";
import type { HistoricalPeriod } from "@/types/planning";
import type { HistoricalBasisOverride } from "@/types/scenario";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AssumptionControl } from "@/components/scenario/assumption-control";

/**
 * The reusable Planning Basis Editor for seasonal/event forecasting (PRD-
 * phase-2 §15's worked example): which seasons are included, their
 * recent-weighting, and the growth assumption layered on top — each change
 * is an explicit scenario override, never a silent mutation of history.
 */
export function HistoricalBasisEditor({
  periods,
  override,
  onSetLookback,
  onTogglePeriod,
  onSetGrowth,
  defaultGrowthPct,
  growthOverridePct,
}: {
  periods: HistoricalPeriod[]; // most-recent-first, already includes atypical years
  override: HistoricalBasisOverride | undefined;
  onSetLookback: (n: number) => void;
  onTogglePeriod: (periodId: string, include: boolean) => void;
  onSetGrowth: (pct: number) => void;
  defaultGrowthPct: number;
  growthOverridePct: number | undefined;
}) {
  const lookback = override?.seasonsOrYears ?? periods.filter((p) => !p.isAtypical).length;
  const excluded = new Set(override?.excludedPeriodIds ?? []);
  const included = new Set(override?.includedPeriodIds ?? []);
  const growth = growthOverridePct ?? defaultGrowthPct;

  return (
    <div className="flex flex-col gap-3">
      <AssumptionControl label="Historical lookback" baseline={`${periods.filter((p) => !p.isAtypical).length} seasons`} scenario={`${lookback} seasons`} changed={override?.seasonsOrYears != null}>
        <Input type="number" min={1} max={periods.length} value={lookback} onChange={(e) => onSetLookback(Number(e.target.value))} className="w-24" />
      </AssumptionControl>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Seasons in basis</span>
          <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
            {periods.filter((p) => !(p.isAtypical ? !included.has(p.id) : excluded.has(p.id))).length} of {periods.length}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {periods.map((p) => {
            const isExcluded = p.isAtypical ? !included.has(p.id) : excluded.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onTogglePeriod(p.id, isExcluded)}
                aria-pressed={!isExcluded}
                title={isExcluded ? `Click to include ${p.periodLabel}` : `Click to exclude ${p.periodLabel}`}
                className={`flex items-center gap-2 rounded-[var(--radius-sm)] border px-2 py-1.5 text-[11.5px] transition-colors ${
                  isExcluded
                    ? "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                    : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                }`}
              >
                <span className={`flex size-3.5 flex-none items-center justify-center rounded-[3px] border ${isExcluded ? "border-[var(--border-strong)]" : "border-[var(--accent)] bg-[var(--accent)]"}`}>
                  {!isExcluded && <Check className="size-2.5 text-[var(--text-on-accent)]" />}
                </span>
                <span className={`flex-1 text-left ${isExcluded ? "line-through" : "font-medium"}`}>{p.periodLabel}</span>
                {p.isAtypical && <Badge variant="warning">atypical</Badge>}
              </button>
            );
          })}
        </div>
      </div>

      <AssumptionControl
        label="Growth assumption"
        baseline={`+${Math.round(defaultGrowthPct * 100)}%`}
        scenario={`+${Math.round(growth * 100)}%`}
        delta={growthOverridePct != null ? `${growth >= defaultGrowthPct ? "+" : ""}${Math.round((growth - defaultGrowthPct) * 100)}pp` : undefined}
        changed={growthOverridePct != null}
      >
        <Input type="number" step={1} value={Math.round(growth * 100)} onChange={(e) => onSetGrowth(Number(e.target.value) / 100)} className="w-24" />
      </AssumptionControl>
    </div>
  );
}
