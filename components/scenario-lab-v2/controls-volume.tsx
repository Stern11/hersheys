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
  onClearFocus,
}: {
  scenarioId: string;
  baseline: PlanningSituation;
  adjustments: ScenarioAdjustments;
  /** Item the lab was opened on. When set, this control shows only that one. */
  focusItemId?: string;
  /** Widens the control back to the whole programme. */
  onClearFocus?: () => void;
}) {
  const setVolumeUnits = useSituationScenarioStore((s) => s.setVolumeUnits);
  const clearAdjustment = useSituationScenarioStore((s) => s.clearAdjustment);
  const resetCategory = useSituationScenarioStore((s) => s.resetCategory);

  const overrides = adjustments.volumeUnits ?? {};
  const hasOverrides = Object.keys(overrides).length > 0;

  // Only items that actually bear load. Listing every candidate put twenty
  // greyed-out rows a planner cannot act on above the five they can, and a
  // control whose rows mostly do nothing is worse than a shorter one.
  const carrying = [...baseline.candidateItems]
    .filter(bearsLoad)
    .sort((a, b) => b.plannedUnits - a.plannedUnits);

  // Opened on a product, the lab is about that product. Showing every other
  // item's volume beside it made a SKU-scoped scenario look like a season one
  // and left the planner to find their own row.
  const focused = focusItemId ? carrying.find((c) => c.id === focusItemId) : undefined;
  const items = focused ? [focused] : carrying;
  const hiddenCount = focused ? carrying.length - 1 : 0;
  const notCarrying = baseline.candidateItems.length - carrying.length;

  // One rate for the whole basis when the rows agree, which they do unless a
  // planner has overridden one by hand.
  const rates = new Set(
    items
      .filter((c) => c.plannedBasis.kind !== "planner_override")
      .map((c) => c.plannedBasis.growthPct.toFixed(4))
  );
  const shared = rates.size === 1 ? Number([...rates][0]) : undefined;
  const basisLabel =
    shared === undefined
      ? undefined
      : Math.abs(shared) < 0.0005
        ? "Carrying last season's volume forward with no growth applied."
        : `Carrying last season's volume forward at ${shared > 0 ? "+" : ""}${(shared * 100).toFixed(1)}%.`;

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
          Nothing is carrying forward yet, so there is no volume to change. Mark an item carry
          forward on Reconcile first.
        </p>
      ) : (
        <div className="flex flex-col">
          {basisLabel ? (
            <p className="mb-2 text-[11.5px] leading-snug text-[var(--text-muted)]">{basisLabel}</p>
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
          {hiddenCount > 0 && onClearFocus ? (
            <button
              type="button"
              onClick={onClearFocus}
              className="mt-2.5 self-start text-[11.5px] text-[var(--text-secondary)] underline-offset-2 transition-colors hover:text-[var(--text-primary)] hover:underline"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Show the other {hiddenCount} product{hiddenCount === 1 ? "" : "s"} in{" "}
              {baseline.title}
            </button>
          ) : null}
          {!focused && notCarrying > 0 ? (
            <p className="mt-2.5 text-[11px] leading-snug text-[var(--text-muted)]">
              {notCarrying} other prior item{notCarrying === 1 ? "" : "s"} bear no load. Carry one
              forward on Reconcile to change its volume here.
            </p>
          ) : null}
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
  // The basis figure is what the row is measured against — not the historical
  // actual, which is a different number and would make every untouched row
  // look changed.
  const basisUnits = item.plannedBasis.inferredUnits;
  const changed = override !== undefined && Math.abs(override - basisUnits) >= 0.5;

  return (
    <div
      id={`volume-${item.id}`}
      className={cn(
        "border-b border-[var(--border)] px-2 py-2.5 last:border-b-0 transition-colors",
        focused && "bg-[var(--interaction-selected)]",
        changed && !focused && "bg-[var(--state-scenario-soft)]"
      )}
      style={{ transitionDuration: "var(--duration-medium)" }}
    >
      <div className="mb-1.5 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
        {item.itemName}
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

      {/* The growth rate is the same for every row on one basis, so it is
          stated once above the list rather than on each. What differs per row
          is what the product actually sold. */}
      <div className="mt-1 text-[11px] tabular-nums text-[var(--text-secondary)]">
        Sold {fmtUnits(item.actualUnits)}
      </div>
    </div>
  );
}

function bearsLoad(item: CandidateItem): boolean {
  return item.disposition === "carry_forward";
}
