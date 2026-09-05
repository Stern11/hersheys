/**
 * Line allocation controls (V2 §52). One row per item/family-to-line
 * mapping that actually matters to this situation — its line appears in the
 * situation's capacity exposure, and its item/family/base-pack key belongs
 * to one of the situation's candidate items.
 */

"use client";

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { FieldRow } from "./field-row";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { mappingKey } from "@/lib/situations/scenario";
import type { PlanningDataset, ItemLineMappingRow } from "@/types/dataset";
import type { PlanningSituation, ScenarioAdjustments } from "@/types/situation";

function relevantMappings(dataset: PlanningDataset, baseline: PlanningSituation): ItemLineMappingRow[] {
  const lineIds = new Set(baseline.capacityExposure.lines.map((l) => l.lineId));
  if (lineIds.size === 0) return [];
  const keys = new Set<string>();
  for (const candidate of baseline.candidateItems) {
    keys.add(candidate.itemId.toLowerCase());
    if (candidate.productFamily) keys.add(candidate.productFamily.toLowerCase());
    if (candidate.basePack) keys.add(candidate.basePack.toLowerCase());
  }
  return dataset.itemLineMappings.filter(
    (m) => lineIds.has(m.lineId) && keys.has(m.itemOrFamilyId.toLowerCase())
  );
}

export function ControlsAllocation({
  scenarioId,
  dataset,
  baseline,
  adjustments,
}: {
  scenarioId: string;
  dataset: PlanningDataset;
  baseline: PlanningSituation;
  adjustments: ScenarioAdjustments;
}) {
  const setAllocation = useSituationScenarioStore((s) => s.setAllocation);
  const setRunRate = useSituationScenarioStore((s) => s.setRunRate);
  const clearAdjustment = useSituationScenarioStore((s) => s.clearAdjustment);
  const resetCategory = useSituationScenarioStore((s) => s.resetCategory);

  const mappings = useMemo(() => relevantMappings(dataset, baseline), [dataset, baseline]);
  const hasOverrides =
    Object.keys(adjustments.allocation).length > 0 || Object.keys(adjustments.runRate).length > 0;

  return (
    <CollapsibleGroup
      title="Line allocation"
      action={
        hasOverrides ? (
          <button
            type="button"
            onClick={() => {
              resetCategory(scenarioId, "allocation");
              resetCategory(scenarioId, "runRate");
            }}
            className="flex flex-none items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="size-2.5" />
            Reset
          </button>
        ) : null
      }
    >
      {mappings.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)]">No line mappings apply to this situation.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {mappings.map((mapping) => {
            const key = mappingKey(mapping.itemOrFamilyId, mapping.lineId);
            return (
              <div key={mapping.id} className="flex flex-col gap-2">
                <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                  {mapping.itemOrFamilyId}
                  <span className="ml-1.5 font-normal text-[var(--text-muted)]">on {mapping.lineId}</span>
                </div>
                <FieldRow
                  label="Allocation"
                  display="pct"
                  baseline={mapping.allocationPct ?? 1}
                  override={adjustments.allocation[key]}
                  min={0}
                  max={1}
                  onCommit={(value) => setAllocation(scenarioId, mapping.itemOrFamilyId, mapping.lineId, value)}
                  onClear={() => clearAdjustment(scenarioId, "allocation", key)}
                />
                <FieldRow
                  label="Run rate /h"
                  display="num"
                  baseline={mapping.runRateUnitsPerHour}
                  override={adjustments.runRate[key]}
                  min={1}
                  max={500_000}
                  onCommit={(value) => setRunRate(scenarioId, mapping.itemOrFamilyId, mapping.lineId, value)}
                  onClear={() => clearAdjustment(scenarioId, "runRate", key)}
                />
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleGroup>
  );
}
