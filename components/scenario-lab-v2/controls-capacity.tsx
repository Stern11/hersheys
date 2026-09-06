/**
 * Capacity controls — the headline group (V2 §46, §53), expanded by default.
 * One target-utilisation control per line, and one available-hours control
 * per line per month, keyed exactly the way `applyScenarioToDataset` reads
 * them back (`capacityKey`).
 */

"use client";

import { useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { FieldRow } from "./field-row";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { capacityKey } from "@/lib/situations/scenario";
import { formatMonthLabel } from "@/lib/dataset/periods";
import { cn } from "@/lib/utils/cn";
import { fmtPct } from "@/lib/utils/format";
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
      // Closed by default: capacity is a supply-side answer to a demand-side
      // question, and opening it first put four lines of hours above the one
      // control the planner came for.
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
              <LineControls
                key={line.lineId}
                lineId={line.lineId}
                lineName={line.lineName}
                targetBaseline={firstCell.targetUtilizationPct}
                targetOverride={targetOverride}
                cells={cellsForLine}
                adjustments={adjustments}
                onTarget={(value) => setTargetUtilization(scenarioId, line.lineId, value)}
                onClearTarget={() => clearAdjustment(scenarioId, "targetUtilization", line.lineId)}
                onHours={(period, value) => setAvailableHours(scenarioId, line.lineId, period, value)}
                onClearHours={(key) => clearAdjustment(scenarioId, "availableHours", key)}
              />
            );
          })}
        </div>
      )}
    </CollapsibleGroup>
  );
}

/**
 * One line, opened on demand.
 *
 * Four lines each showing a target and five months meant twenty-four controls
 * the moment the group opened — a planner adjusting one line had to scroll
 * past three others to find it. Closed, a line still says the one thing that
 * decides whether it is worth opening: what its target currently is, and
 * whether anything on it has been changed.
 */
function LineControls({
  lineId,
  lineName,
  targetBaseline,
  targetOverride,
  cells,
  adjustments,
  onTarget,
  onClearTarget,
  onHours,
  onClearHours,
}: {
  lineId: string;
  lineName: string;
  targetBaseline: number;
  targetOverride: number | undefined;
  cells: PlanningSituation["capacityExposure"]["cells"];
  adjustments: ScenarioAdjustments;
  onTarget: (value: number) => void;
  onClearTarget: () => void;
  onHours: (period: string, value: number) => void;
  onClearHours: (key: string) => void;
}) {
  const changedCount =
    (targetOverride !== undefined ? 1 : 0) +
    cells.filter((c) => adjustments.availableHours[capacityKey(lineId, c.period)] !== undefined)
      .length;

  // A line the planner has already touched opens with the group, so their own
  // changes are never hidden behind a disclosure.
  const [open, setOpen] = useState(changedCount > 0);

  return (
    <div className="border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-[var(--radius-sm)] py-1 text-left transition-colors hover:bg-[var(--interaction-hover)]"
        style={{ transitionDuration: "var(--duration-fast)" }}
      >
        <ChevronRight
          className={cn("size-3.5 flex-none text-[var(--text-muted)] transition-transform", open && "rotate-90")}
          style={{ transitionDuration: "var(--duration-fast)" }}
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
          {lineName}
        </span>
        <span className="flex-none text-[11px] tabular-nums text-[var(--text-muted)]">
          {changedCount > 0 ? (
            <span className="font-medium text-[var(--state-scenario)]">
              {changedCount} changed
            </span>
          ) : (
            `target ${fmtPct(targetOverride ?? targetBaseline)}`
          )}
        </span>
      </button>

      {open ? (
        <div className="mt-1.5 flex flex-col gap-1.5 pl-5">
          <FieldRow
            label="Target utilisation"
            display="pct"
            baseline={targetBaseline}
            override={targetOverride}
            min={0.3}
            max={1.2}
            onCommit={onTarget}
            onClear={onClearTarget}
            slider
          />
          <div className="flex flex-col border-l border-[var(--border)] pl-3">
            {cells.map((cell) => {
              const key = capacityKey(lineId, cell.period);
              return (
                <FieldRow
                  key={cell.period}
                  label={formatMonthLabel(cell.period)}
                  display="num"
                  baseline={cell.availableHours}
                  override={adjustments.availableHours[key]}
                  min={0}
                  max={2000}
                  onCommit={(value) => onHours(cell.period, value)}
                  onClear={() => onClearHours(key)}
                  labelWidth={58}
                  inputWidth={68}
                  unit="h"
                  inlineBaseline
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
