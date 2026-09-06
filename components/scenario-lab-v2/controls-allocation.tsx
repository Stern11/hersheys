/**
 * Line allocation controls (V2 §52). One row per item/family-to-line
 * mapping that actually matters to this situation — its line appears in the
 * situation's capacity exposure, and its item/family/base-pack key belongs
 * to one of the situation's candidate items.
 */

"use client";

import { useMemo } from "react";
import { useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { FieldRow } from "./field-row";
import { cn } from "@/lib/utils/cn";
import { fmtPct } from "@/lib/utils/format";
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
        <div className="flex flex-col">
          {mappings.map((mapping) => {
            const key = mappingKey(mapping.itemOrFamilyId, mapping.lineId);
            return (
              <MappingControls
                key={mapping.id}
                itemOrFamilyId={mapping.itemOrFamilyId}
                lineId={mapping.lineId}
                allocationBaseline={mapping.allocationPct ?? 1}
                allocationOverride={adjustments.allocation[key]}
                runRateBaseline={mapping.runRateUnitsPerHour}
                runRateOverride={adjustments.runRate[key]}
                onAllocation={(value) =>
                  setAllocation(scenarioId, mapping.itemOrFamilyId, mapping.lineId, value)
                }
                onClearAllocation={() => clearAdjustment(scenarioId, "allocation", key)}
                onRunRate={(value) =>
                  setRunRate(scenarioId, mapping.itemOrFamilyId, mapping.lineId, value)
                }
                onClearRunRate={() => clearAdjustment(scenarioId, "runRate", key)}
              />
            );
          })}
        </div>
      )}
    </CollapsibleGroup>
  );
}

/**
 * One product-to-line mapping, opened on demand.
 *
 * Same reasoning as the capacity lines: a dozen mappings each showing an
 * allocation slider and a run rate is a wall of controls to scroll past to
 * reach the one being changed. Closed, the row still says the thing that
 * decides whether it is worth opening — what share of this product runs here.
 */
function MappingControls({
  itemOrFamilyId,
  lineId,
  allocationBaseline,
  allocationOverride,
  runRateBaseline,
  runRateOverride,
  onAllocation,
  onClearAllocation,
  onRunRate,
  onClearRunRate,
}: {
  itemOrFamilyId: string;
  lineId: string;
  allocationBaseline: number;
  allocationOverride: number | undefined;
  runRateBaseline: number;
  runRateOverride: number | undefined;
  onAllocation: (value: number) => void;
  onClearAllocation: () => void;
  onRunRate: (value: number) => void;
  onClearRunRate: () => void;
}) {
  const changedCount =
    (allocationOverride !== undefined ? 1 : 0) + (runRateOverride !== undefined ? 1 : 0);
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
          className={cn(
            "size-3.5 flex-none text-[var(--text-muted)] transition-transform",
            open && "rotate-90"
          )}
          style={{ transitionDuration: "var(--duration-fast)" }}
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
          {itemOrFamilyId}
          <span className="ml-1.5 font-normal text-[var(--text-muted)]">on {lineId}</span>
        </span>
        <span className="flex-none text-[11px] tabular-nums text-[var(--text-muted)]">
          {changedCount > 0 ? (
            <span className="font-medium text-[var(--state-scenario)]">{changedCount} changed</span>
          ) : (
            fmtPct(allocationOverride ?? allocationBaseline)
          )}
        </span>
      </button>

      {open ? (
        <div className="mt-1.5 flex flex-col gap-1.5 pl-5">
          <FieldRow
            label="Allocation"
            display="pct"
            baseline={allocationBaseline}
            override={allocationOverride}
            min={0}
            max={1}
            onCommit={onAllocation}
            onClear={onClearAllocation}
            slider
          />
          <FieldRow
            label="Run rate"
            display="num"
            baseline={runRateBaseline}
            override={runRateOverride}
            min={1}
            max={500_000}
            unit="/h"
            onCommit={onRunRate}
            onClear={onClearRunRate}
            labelWidth={72}
            inputWidth={84}
            inlineBaseline
          />
        </div>
      ) : null}
    </div>
  );
}
