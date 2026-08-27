"use client";

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
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Seasons</span>
        <div className="flex flex-wrap gap-1.5">
          {periods.map((p) => {
            const isExcluded = p.isAtypical ? !included.has(p.id) : excluded.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onTogglePeriod(p.id, isExcluded)}
                className="group flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-[11.5px] transition-colors hover:border-[var(--border-strong)]"
                style={{ opacity: isExcluded ? 0.5 : 1 }}
              >
                {p.periodLabel}
                {p.isAtypical && <Badge variant="warning">atypical</Badge>}
                <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">{isExcluded ? "Include" : "Exclude"}</span>
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
