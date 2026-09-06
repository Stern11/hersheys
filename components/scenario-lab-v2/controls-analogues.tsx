/**
 * Which comparable products an unspecified item is read from (V2 §17.3, §52).
 *
 * Only appears when there is something to answer for: an item carrying load
 * whose bill of materials does not exist yet. The planner's judgement about
 * what is genuinely comparable is usually better than an attribute score, so
 * the score proposes and they dispose.
 *
 * Excluding an analogue re-blends the inferred BOM, which moves the component
 * requirements, their confidence, and therefore what can be ordered — the
 * whole point of showing it here rather than as a read-only footnote.
 */

"use client";

import { RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils/cn";
import type { AnalogueMatch, CandidateItem, PlanningSituation, ScenarioAdjustments } from "@/types/situation";

export function ControlsAnalogues({
  scenarioId,
  baseline,
  adjustments,
  focusItemId,
}: {
  scenarioId: string;
  baseline: PlanningSituation;
  adjustments: ScenarioAdjustments;
  focusItemId?: string;
}) {
  const setAnalogueWeight = useSituationScenarioStore((s) => s.setAnalogueWeight);
  const resetCategory = useSituationScenarioStore((s) => s.resetCategory);

  const overrides = adjustments.analogueWeights ?? {};
  const hasOverrides = Object.keys(overrides).length > 0;

  const all = baseline.candidateItems.filter(
    (c) => c.disposition === "carry_forward" && c.derivation === "analogue"
  );
  // Scoped to the product the lab was opened on, like every other control —
  // otherwise "these items have no bill of materials" named a set the planner
  // had not asked about.
  const focused = focusItemId ? all.find((c) => c.id === focusItemId) : undefined;
  const items = focusItemId ? (focused ? [focused] : []) : all;
  if (items.length === 0) return null;

  return (
    <CollapsibleGroup
      title="Comparable products"
      defaultOpen={false}
      action={
        hasOverrides ? (
          <button
            type="button"
            onClick={() => resetCategory(scenarioId, "analogueWeights")}
            className="flex flex-none items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="size-2.5" />
            Reset
          </button>
        ) : null
      }
    >
      <p className="mb-3 text-[11.5px] leading-snug text-[var(--text-muted)]">
        {focused
          ? `${focused.itemName} has no bill of materials yet. Its components are read from the products below — set one to zero to take it out of the blend.`
          : "These items have no bill of materials yet. Their components are read from the products below — set one to zero to take it out of the blend."}
      </p>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <ItemAnalogues
            key={item.id}
            item={item}
            overrides={overrides}
            showName={!focused}
            focused={item.id === focusItemId}
            onWeight={(analogueId, weight) => setAnalogueWeight(scenarioId, item.id, analogueId, weight)}
          />
        ))}
      </div>
    </CollapsibleGroup>
  );
}

function ItemAnalogues({
  item,
  overrides,
  showName,
  focused,
  onWeight,
}: {
  item: CandidateItem;
  overrides: Record<string, number>;
  showName: boolean;
  focused: boolean;
  onWeight: (analogueId: string, weight: number) => void;
}) {
  const included = item.analogues.filter((a) => !a.excluded && a.weight > 0);
  const totalWeight = included.reduce((sum, a) => sum + a.weight, 0);

  return (
    <div
      id={`analogues-${item.id}`}
      className={cn(
        "rounded-[var(--radius-sm)] px-2 py-2 transition-colors",
        focused && "bg-[var(--interaction-selected)]"
      )}
      style={{ transitionDuration: "var(--duration-medium)" }}
    >
      {showName ? (
        <div className="mb-2 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
          {item.itemName}
        </div>
      ) : null}

      {item.analogues.length === 0 ? (
        <p className="text-[11.5px] text-[var(--text-muted)]">
          No comparable product with a bill of materials was found.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {item.analogues.map((analogue) => (
            <AnalogueRow
              key={analogue.candidateId}
              analogue={analogue}
              share={totalWeight > 0 && !analogue.excluded ? analogue.weight / totalWeight : 0}
              override={overrides[`${item.id}::${analogue.candidateId}`]}
              onWeight={(w) => onWeight(analogue.candidateId, w)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnalogueRow({
  analogue,
  share,
  override,
  onWeight,
}: {
  analogue: AnalogueMatch;
  share: number;
  override: number | undefined;
  onWeight: (weight: number) => void;
}) {
  const weight = override ?? analogue.weight;
  const changed = override !== undefined;

  return (
    <div className={cn(analogue.excluded && "opacity-55")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[11.5px] text-[var(--text-primary)]">
          {analogue.itemName}
        </span>
        <span className="flex-none text-[10.5px] tabular-nums text-[var(--text-muted)]">
          {analogue.period}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2.5">
        <Slider
          value={[Math.round(weight * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={([v]) => onWeight((v ?? 0) / 100)}
          className="flex-1"
        />
        <span
          className={cn(
            "w-[62px] flex-none text-right text-[10.5px] tabular-nums",
            changed ? "font-medium text-[var(--state-scenario)]" : "text-[var(--text-muted)]"
          )}
        >
          {analogue.excluded ? "excluded" : `${Math.round(share * 100)}% mix`}
        </span>
      </div>

      <div className="mt-0.5 text-[10.5px] text-[var(--text-muted)]">
        {Math.round(analogue.similarity * 100)}% of compared attributes agree
        {analogue.different.length > 0 ? ` · differs on ${analogue.different.join(", ")}` : ""}
      </div>
    </div>
  );
}
