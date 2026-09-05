/**
 * Material lead-time controls (V2 §52, §15).
 *
 * One row per material in the baseline material exposure. The baseline value
 * already carries its basis (system assumption, historical median/P80) —
 * this control only ever overrides that figure with a scenario value, it
 * never edits the historical figure itself (V2 §18.4).
 */

"use client";

import { RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { FieldRow } from "./field-row";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import type { MaterialExposureRow, PlanningSituation, ScenarioAdjustments } from "@/types/situation";

const LEAD_TIME_BASIS_LABEL: Record<MaterialExposureRow["leadTimeBasis"], string> = {
  system: "System assumption",
  historical_median: "Historical median",
  historical_p80: "Historical P80",
  scenario: "Scenario value",
};

export function ControlsMaterials({
  scenarioId,
  baseline,
  adjustments,
}: {
  scenarioId: string;
  baseline: PlanningSituation;
  adjustments: ScenarioAdjustments;
}) {
  const setLeadTime = useSituationScenarioStore((s) => s.setLeadTime);
  const clearAdjustment = useSituationScenarioStore((s) => s.clearAdjustment);
  const resetCategory = useSituationScenarioStore((s) => s.resetCategory);

  const { materialExposure } = baseline;
  const hasOverrides = Object.keys(adjustments.leadTimeDays).length > 0;

  return (
    <CollapsibleGroup
      title="Materials"
      action={
        hasOverrides ? (
          <button
            type="button"
            onClick={() => resetCategory(scenarioId, "leadTimeDays")}
            className="flex flex-none items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="size-2.5" />
            Reset
          </button>
        ) : null
      }
    >
      {!materialExposure.available ? (
        <p className="text-[12px] text-[var(--text-muted)]">
          {materialExposure.unavailableReason ?? "Material data not available for this situation."}
        </p>
      ) : materialExposure.rows.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)]">No materials apply to this situation.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {materialExposure.rows.map((row) => (
            <div key={row.materialId} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                  {row.materialName}
                </span>
                <span className="flex-none text-[11px] text-[var(--text-muted)]">
                  {LEAD_TIME_BASIS_LABEL[row.leadTimeBasis]}
                </span>
              </div>
              <FieldRow
                label="Lead time (d)"
                display="num"
                baseline={row.leadTimeDays}
                override={adjustments.leadTimeDays[row.materialId]}
                min={0}
                max={730}
                onCommit={(value) => setLeadTime(scenarioId, row.materialId, value)}
                onClear={() => clearAdjustment(scenarioId, "leadTimeDays", row.materialId)}
              />
            </div>
          ))}
        </div>
      )}
    </CollapsibleGroup>
  );
}
