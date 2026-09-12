/**
 * The baseline-vs-scenario delta list (V2 §13.13, §53).
 *
 * `diffAdjustments` covers capacity and line-allocation categories directly
 * against `dataset`, but it has no way to know a material's *baseline* lead
 * time — that figure only exists once `buildSituations` has run (system
 * assumption vs historical median/P80 selection lives in
 * `lib/situations/build.ts`, not in the raw dataset). So lead-time diffs are
 * computed here instead, against the already-built baseline situation, and
 * merged with everything else `diffAdjustments` reports.
 */

"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { diffAdjustments } from "@/lib/situations/scenario";
import { fmtPct, fmtUnits } from "@/lib/utils/format";
import type { PlanningDataset } from "@/types/dataset";
import type { AdjustmentDiff, PlanningSituation, ScenarioAdjustments } from "@/types/situation";

function formatValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  if (unit === "%") return fmtPct(value);
  if (unit === "h") return `${Math.round(value)}h`;
  if (unit === "/h") return `${Math.round(value)}/h`;
  if (unit === "d") return `${Math.round(value)}d`;
  if (unit === "u") return fmtUnits(Math.round(value));
  return String(Math.round(value));
}

function formatDelta(delta: number, unit: string): string {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) return "no change";
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  if (unit === "%") return `${sign}${Math.round(abs * 100)}pts`;
  return `${sign}${formatValue(abs, unit)}`;
}

/**
 * Diffs for the two categories whose baseline is resolved inside
 * `buildSituations` rather than being a dataset column — lead time (system vs
 * observed median vs P80) and carry-forward volume (the season basis and its
 * growth). Computed here because this is where the resolved baseline lives.
 */
function withResolvedDiffs(
  base: AdjustmentDiff[],
  baseline: PlanningSituation,
  adjustments: ScenarioAdjustments
): AdjustmentDiff[] {
  const leadTime: AdjustmentDiff[] = Object.entries(adjustments.leadTimeDays).flatMap(([materialId, scenario]) => {
    const row = baseline.materialExposure.rows.find((r) => r.materialId === materialId);
    const baselineValue = row?.leadTimeDays ?? scenario;
    if (Math.abs(scenario - baselineValue) < 0.5) return [];
    return [
      {
        category: "leadTimeDays" as const,
        key: materialId,
        label: `${row?.materialName ?? materialId} lead time`,
        baseline: baselineValue,
        scenario,
        delta: scenario - baselineValue,
        unit: "d",
      },
    ];
  });
  const volume: AdjustmentDiff[] = Object.entries(adjustments.volumeUnits ?? {}).flatMap(
    ([candidateId, scenario]) => {
      const item = baseline.candidateItems.find((c) => c.id === candidateId);
      if (!item) return [];
      // Measured against what the basis implied, not the historical actual —
      // the actual is a different number and would show every row as changed.
      const baselineValue = item.plannedBasis.inferredUnits;
      if (Math.abs(scenario - baselineValue) < 0.5) return [];
      return [
        {
          category: "volumeUnits" as const,
          key: candidateId,
          label: `${item.itemName} carries forward`,
          baseline: baselineValue,
          scenario,
          delta: scenario - baselineValue,
          unit: "u",
        },
      ];
    }
  );

  return [
    ...base.filter((d) => d.category !== "leadTimeDays" && d.category !== "volumeUnits"),
    ...volume,
    ...leadTime,
  ];
}

export function ChangesList({
  scenarioId,
  dataset,
  baseline,
  adjustments,
}: {
  /** Undefined when no scenario is active yet — clearing is then a no-op. */
  scenarioId?: string;
  dataset: PlanningDataset;
  baseline: PlanningSituation;
  adjustments: ScenarioAdjustments;
}) {
  const clearAdjustment = useSituationScenarioStore((s) => s.clearAdjustment);

  const diffs = useMemo(
    () => withResolvedDiffs(diffAdjustments(dataset, adjustments), baseline, adjustments),
    [dataset, adjustments, baseline]
  );

  if (diffs.length === 0) {
    return <p className="text-[12.5px] text-[var(--text-muted)]">This scenario matches the baseline.</p>;
  }

  return (
    <div className="flex flex-col">
      {diffs.map((d) => (
        <div
          key={`${d.category}:${d.key}`}
          className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-2 last:border-b-0"
        >
          <span className="min-w-0 truncate text-[12.5px] text-[var(--text-primary)]">{d.label}</span>
          <span className="flex-none whitespace-nowrap text-[12px] tabular-nums text-[var(--text-muted)]">
            Baseline {formatValue(d.baseline, d.unit)} · Scenario {formatValue(d.scenario, d.unit)} ·{" "}
            {formatDelta(d.delta, d.unit)}
          </span>
          <button
            type="button"
            onClick={() => scenarioId && clearAdjustment(scenarioId, d.category, d.key)}
            title="Clear this change"
            className="flex-none text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
