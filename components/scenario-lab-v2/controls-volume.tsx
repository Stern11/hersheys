/**
 * Carry-forward volume controls (V2 §52, §13.5).
 *
 * The lever the lab was missing, and the reason it read as unusable: every
 * other control here is supply-side — hours, run rates, lead times — but the
 * question a planner opens the lab with is a demand one. *Last season this
 * sold 100 and it is not in the plan. The basis says carry 108. What if I
 * carry 130?*
 *
 * One row per item that bears load, showing what it actually sold, what the
 * season basis implies, and the planner's own number. The prior actual is
 * never editable: it is a fact, and the scenario value is a decision about
 * what to do with it.
 */

"use client";

import { RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { FieldRow } from "./field-row";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { cn } from "@/lib/utils/cn";
import { fmtUnits } from "@/lib/utils/format";
import type { CandidateItem, PlanningSituation, ScenarioAdjustments } from "@/types/situation";

export function ControlsVolume({
  scenarioId,
  baseline,
  adjustments,
  focusItemId,
}: {
  scenarioId: string;
  baseline: PlanningSituation;
  adjustments: ScenarioAdjustments;
  /** Item deep-linked from the SKU drawer, scrolled to and outlined on arrival. */
  focusItemId?: string;
}) {
  const setVolumeUnits = useSituationScenarioStore((s) => s.setVolumeUnits);
  const clearAdjustment = useSituationScenarioStore((s) => s.clearAdjustment);
  const resetCategory = useSituationScenarioStore((s) => s.resetCategory);

  const overrides = adjustments.volumeUnits ?? {};
  const hasOverrides = Object.keys(overrides).length > 0;

  // Items that bear load come first — they are what a scenario actually moves.
  // The rest stay reachable, because raising a volume is often the reason a
  // planner changes their mind about carrying an item at all.
  const items = [...baseline.candidateItems].sort((a, b) => {
    const load = Number(bearsLoad(b)) - Number(bearsLoad(a));
    if (load !== 0) return load;
    return b.plannedUnits - a.plannedUnits;
  });

  const carrying = items.filter(bearsLoad);

  return (
    <CollapsibleGroup
      title="Carry-forward volume"
      defaultOpen
      action={
        hasOverrides ? (
          <button
            type="button"
            onClick={() => resetCategory(scenarioId, "volumeUnits")}
            className="flex flex-none items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="size-2.5" />
            Reset
          </button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <p className="text-[12px] leading-snug text-[var(--text-muted)]">
          No prior-season items to carry forward.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {carrying.length === 0 ? (
            <p className="mb-2 text-[12px] leading-snug text-[var(--text-muted)]">
              Nothing is marked carry forward yet, so a volume change moves nothing. Set a decision
              on Reconcile first.
            </p>
          ) : null}

          {items.map((item) => (
            <VolumeRow
              key={item.id}
              item={item}
              override={overrides[item.id]}
              focused={item.id === focusItemId}
              onCommit={(value) => setVolumeUnits(scenarioId, item.id, value)}
              onClear={() => clearAdjustment(scenarioId, "volumeUnits", item.id)}
            />
          ))}
        </div>
      )}
    </CollapsibleGroup>
  );
}

function VolumeRow({
  item,
  override,
  focused,
  onCommit,
  onClear,
}: {
  item: CandidateItem;
  override: number | undefined;
  focused: boolean;
  onCommit: (value: number) => void;
  onClear: () => void;
}) {
  const loadBearing = bearsLoad(item);
  // The basis figure is what the row is measured against — not the historical
  // actual, which is a different number and would make every untouched row
  // look changed.
  const basisUnits = item.plannedBasis.inferredUnits;

  return (
    <div
      id={`volume-${item.id}`}
      className={cn(
        "rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors",
        focused && "bg-[var(--interaction-selected)] ring-1 ring-[var(--interaction-selected-border)]",
        !loadBearing && "opacity-60"
      )}
      style={{ transitionDuration: "var(--duration-medium)" }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">
          {item.itemName}
        </span>
        {!loadBearing ? (
          <span className="flex-none text-[10.5px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            no load
          </span>
        ) : null}
      </div>

      <FieldRow
        label=""
        baseline={basisUnits}
        override={override}
        onCommit={onCommit}
        onClear={onClear}
        display="units"
        min={0}
        labelWidth={0}
        inputWidth={96}
      />

      <div className="mt-0.5 text-[10.5px] tabular-nums text-[var(--text-muted)]">
        Sold {fmtUnits(item.actualUnits)} · basis {fmtUnits(basisUnits)}
        {item.plannedBasis.growthPct !== 0
          ? ` (${item.plannedBasis.growthPct > 0 ? "+" : ""}${(item.plannedBasis.growthPct * 100).toFixed(1)}%)`
          : ""}
      </div>
    </div>
  );
}

function bearsLoad(item: CandidateItem): boolean {
  return item.disposition === "carry_forward";
}
