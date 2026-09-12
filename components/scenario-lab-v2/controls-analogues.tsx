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
 *
 * The mix sliders are linked, not independent: each one's position *is* its
 * share of the blend (not a raw weight later renormalized), so a slider can
 * never sit somewhere that disagrees with the number next to it — that
 * mismatch was read as "broken". Dragging one redistributes the remainder
 * across the others in proportion to their current shares, live, so moving
 * one visibly moves the rest in the same motion instead of requiring a
 * second look to notice anything changed.
 */

"use client";

import { RotateCcw } from "lucide-react";
import { CollapsibleGroup } from "./collapsible-group";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils/cn";
import type {
  AnalogueMatch,
  CandidateItem,
  MaterialExposure,
  PlanningSituation,
  ScenarioAdjustments,
} from "@/types/situation";

export function ControlsAnalogues({
  scenarioId,
  baseline,
  scenarioMaterialExposure,
  adjustments,
  focusItemId,
}: {
  scenarioId: string;
  baseline: PlanningSituation;
  /** The scenario's *current* material exposure — used only to show what an
   *  analogue-weight change did to the inferred BOM, right where it was
   *  changed. Falls back to the baseline's own exposure when not supplied. */
  scenarioMaterialExposure?: MaterialExposure;
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

  const materialExposure = scenarioMaterialExposure ?? baseline.materialExposure;

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
          ? `${focused.itemName} has no bill of materials yet. Its components are read from the products below — drag the mix.`
          : "These items have no bill of materials yet. Their components are read from the products below — drag the mix."}
      </p>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <ItemAnalogues
            key={item.id}
            item={item}
            overrides={overrides}
            showName={!focused}
            focused={item.id === focusItemId}
            materialExposure={materialExposure}
            baselineMaterialExposure={baseline.materialExposure}
            onWeights={(weights) => {
              for (const [analogueId, weight] of Object.entries(weights)) {
                setAnalogueWeight(scenarioId, item.id, analogueId, weight);
              }
            }}
          />
        ))}
      </div>
    </CollapsibleGroup>
  );
}

/** `${itemId}::${analogueId}` — matches `ScenarioAdjustments.analogueWeights`. */
function overrideKey(itemId: string, analogueId: string): string {
  return `${itemId}::${analogueId}`;
}

/** This analogue's live share: the override if set, else its baseline weight. */
function currentWeight(itemId: string, analogue: AnalogueMatch, overrides: Record<string, number>): number {
  return overrides[overrideKey(itemId, analogue.candidateId)] ?? analogue.weight;
}

/**
 * Move `draggedId` to `newShare` (0-1) and spread the remainder across the
 * other included analogues in proportion to their current shares — the
 * standard "linked sliders that sum to 1" redistribution. Excluded analogues
 * (weight 0, taken out of the blend) are left alone; they are not part of the
 * pool being redistributed.
 */
function redistribute(
  itemId: string,
  analogues: AnalogueMatch[],
  overrides: Record<string, number>,
  draggedId: string,
  newShare: number
): Record<string, number> {
  const included = analogues.filter((a) => !a.excluded);
  const others = included.filter((a) => a.candidateId !== draggedId);
  const remaining = Math.max(0, 1 - newShare);
  const result: Record<string, number> = { [draggedId]: newShare };

  if (others.length === 0) return result;

  const othersTotal = others.reduce((sum, a) => sum + currentWeight(itemId, a, overrides), 0);
  if (othersTotal <= 0) {
    const each = remaining / others.length;
    for (const o of others) result[o.candidateId] = each;
  } else {
    for (const o of others) {
      const share = currentWeight(itemId, o, overrides) / othersTotal;
      result[o.candidateId] = remaining * share;
    }
  }
  return result;
}

function ItemAnalogues({
  item,
  overrides,
  showName,
  focused,
  materialExposure,
  baselineMaterialExposure,
  onWeights,
}: {
  item: CandidateItem;
  overrides: Record<string, number>;
  showName: boolean;
  focused: boolean;
  materialExposure: MaterialExposure;
  baselineMaterialExposure: MaterialExposure;
  onWeights: (weights: Record<string, number>) => void;
}) {
  const included = item.analogues.filter((a) => !a.excluded);
  const totalWeight = included.reduce((sum, a) => sum + currentWeight(item.id, a, overrides), 0);

  const impactRows = componentImpact(item.id, materialExposure, baselineMaterialExposure);

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
              share={
                totalWeight > 0 && !analogue.excluded
                  ? currentWeight(item.id, analogue, overrides) / totalWeight
                  : 0
              }
              changed={overrides[overrideKey(item.id, analogue.candidateId)] !== undefined}
              onShare={(share) =>
                onWeights(redistribute(item.id, item.analogues, overrides, analogue.candidateId, share))
              }
            />
          ))}
        </div>
      )}

      {impactRows.length > 0 ? (
        <div className="mt-2.5 border-t border-[var(--border)] pt-2">
          <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            What this blend changes
          </div>
          <div className="flex flex-col gap-0.5">
            {impactRows.map((row) => (
              <div key={row.materialId} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-[var(--text-secondary)]">{row.materialName}</span>
                <span
                  className={cn(
                    "flex-none tabular-nums",
                    row.changed ? "font-medium text-[var(--state-scenario)]" : "text-[var(--text-muted)]"
                  )}
                >
                  {row.beforeLabel} → {row.afterLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ImpactRow {
  materialId: string;
  materialName: string;
  beforeLabel: string;
  afterLabel: string;
  changed: boolean;
}

/**
 * What changing this item's analogue mix did to the components it reaches —
 * confidence and readiness, side by side with what they were before the
 * blend moved. This is what makes a slider drag visible as more than a
 * number moving on the control itself.
 */
function componentImpact(
  candidateId: string,
  scenario: MaterialExposure,
  baseline: MaterialExposure
): ImpactRow[] {
  if (!scenario.available || !baseline.available) return [];
  const baselineById = new Map(baseline.rows.map((r) => [r.materialId, r]));

  return scenario.rows
    .filter((row) => row.contributors.some((c) => c.candidateId === candidateId))
    .slice(0, 4)
    .map((row) => {
      const before = baselineById.get(row.materialId);
      const beforeConfidence = before ? Math.round(before.analogueCoverage * 100) : undefined;
      const afterConfidence = Math.round(row.analogueCoverage * 100);
      const changed = before ? before.status !== row.status || beforeConfidence !== afterConfidence : true;
      return {
        materialId: row.materialId,
        materialName: row.materialName,
        beforeLabel: before ? `${STATUS_LABEL[before.status]} · ${beforeConfidence}%` : "—",
        afterLabel: `${STATUS_LABEL[row.status]} · ${afterConfidence}%`,
        changed,
      };
    });
}

const STATUS_LABEL: Record<string, string> = {
  PLAN_NOW: "Plan now",
  REVIEW: "Review",
  WAIT: "Wait",
};

function AnalogueRow({
  analogue,
  share,
  changed,
  onShare,
}: {
  analogue: AnalogueMatch;
  share: number;
  changed: boolean;
  onShare: (share: number) => void;
}) {
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
        {/* The slider's own value IS the share shown beside it — no separate
            raw-weight scale to disagree with the label. Every analogue's
            handle sits exactly where its percentage says it does. */}
        <Slider
          value={[Math.round(share * 100)]}
          min={0}
          max={100}
          step={1}
          disabled={analogue.excluded}
          onValueChange={([v]) => onShare((v ?? 0) / 100)}
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
