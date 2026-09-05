/**
 * Capacity controls — the headline group (V2 §46, §53), expanded by default.
 * One target-utilisation control per line, and one available-hours control
 * per line per month, keyed exactly the way `applyScenarioToDataset` reads
 * them back (`capacityKey`).
 */

"use client";

import { RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { FieldRow } from "./field-row";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { capacityKey } from "@/lib/situations/scenario";
import { formatMonthLabel } from "@/lib/dataset/periods";
import type { PlanningSituation, ScenarioAdjustments } from "@/types/situation";

export function ControlsCapacity({
  scenarioId,
  baseline,
  adjustments,
}: {
  scenarioId: string;
  baseline: PlanningSituation;
  adjustments: ScenarioAdjustments;
}) {
  const setAvailableHours = useSituationScenarioStore((s) => s.setAvailableHours);
  const setTargetUtilization = useSituationScenarioStore((s) => s.setTargetUtilization);
  const clearAdjustment = useSituationScenarioStore((s) => s.clearAdjustment);
  const resetCategory = useSituationScenarioStore((s) => s.resetCategory);

  const { capacityExposure } = baseline;
  const hasOverrides =
    Object.keys(adjustments.availableHours).length > 0 || Object.keys(adjustments.targetUtilization).length > 0;

  return (
    <CollapsibleGroup
      title="Capacity"
      defaultOpen
      action={
        hasOverrides ? (
          <button
            type="button"
            onClick={() => {
              resetCategory(scenarioId, "availableHours");
              resetCategory(scenarioId, "targetUtilization");
            }}
            className="flex flex-none items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="size-2.5" />
            Reset
          </button>
        ) : null
      }
    >
      {!capacityExposure.available ? (
        <p className="text-[12px] text-[var(--text-muted)]">
          {capacityExposure.unavailableReason ?? "Capacity data not available for this situation."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {capacityExposure.lines.map((line) => {
            const cellsForLine = capacityExposure.cells.filter((c) => c.lineId === line.lineId);
            const firstCell = cellsForLine[0];
            if (!firstCell) return null;
            const targetOverride = adjustments.targetUtilization[line.lineId];

            return (
              <div key={line.lineId} className="flex flex-col gap-2">
                <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{line.lineName}</div>
                <FieldRow
                  label="Target utilisation"
                  display="pct"
                  baseline={firstCell.targetUtilizationPct}
                  override={targetOverride}
                  min={0.3}
                  max={1.2}
                  onCommit={(value) => setTargetUtilization(scenarioId, line.lineId, value)}
                  onClear={() => clearAdjustment(scenarioId, "targetUtilization", line.lineId)}
                />
                <div className="flex flex-col gap-1.5 border-l border-[var(--border)] pl-3">
                  {cellsForLine.map((cell) => {
                    const key = capacityKey(line.lineId, cell.period);
                    return (
                      <FieldRow
                        key={cell.period}
                        label={formatMonthLabel(cell.period)}
                        display="num"
                        baseline={cell.availableHours}
                        override={adjustments.availableHours[key]}
                        min={0}
                        max={2000}
                        onCommit={(value) => setAvailableHours(scenarioId, line.lineId, cell.period, value)}
                        onClear={() => clearAdjustment(scenarioId, "availableHours", key)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleGroup>
  );
}
