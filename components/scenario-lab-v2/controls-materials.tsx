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

  // One basis for the whole list when the materials agree, which they usually
  // do — the same three words on every row is a fact read once and then
  // scrolled past six more times.
  const bases = new Set(materialExposure.rows.map((r) => r.leadTimeBasis));
  const sharedBasis = bases.size === 1 ? [...bases][0] : undefined;
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
        // No per-material disclosure here, unlike capacity and allocation:
        // each material has exactly one control, so a collapse would add a
        // click to reveal a single field. What it needed was to stop taking
        // three lines to show one number.
        <div className="flex flex-col">
          {sharedBasis ? (
            <p className="mb-1 text-[11.5px] leading-snug text-[var(--text-muted)]">
              Every lead time below is on the{" "}
              <span className="text-[var(--text-secondary)]">
                {LEAD_TIME_BASIS_LABEL[sharedBasis]}
              </span>{" "}
              basis.
            </p>
          ) : null}
          {materialExposure.rows.map((row) => (
            <div
              key={row.materialId}
              className="flex flex-col gap-1 border-b border-[var(--border)] py-2 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                  {row.materialName}
                </span>
                {/* Where the baseline came from — the one thing a planner has
                    to know before overriding it. Printed per row only when the
                    materials disagree; when they all share a basis it is said
                    once above the list instead. */}
                {sharedBasis === undefined ? (
                  <span className="flex-none text-[11px] text-[var(--text-muted)]">
                    {LEAD_TIME_BASIS_LABEL[row.leadTimeBasis]}
                  </span>
                ) : null}
              </div>
              <FieldRow
                label=""
                display="num"
                baseline={row.leadTimeDays}
                override={adjustments.leadTimeDays[row.materialId]}
                min={0}
                max={730}
                unit="d"
                onCommit={(value) => setLeadTime(scenarioId, row.materialId, value)}
                onClear={() => clearAdjustment(scenarioId, "leadTimeDays", row.materialId)}
                labelWidth={0}
                inputWidth={64}
                inlineBaseline
              />
            </div>
          ))}
        </div>
      )}
    </CollapsibleGroup>
  );
}
