/**
 * Scenario Lab's main visual (V2 §13.3, §23.6).
 *
 * A metric band always compares baseline to scenario, regardless of which
 * one is on screen below — the planner should never have to hold last
 * screen's numbers in their head. The capacity matrix itself can only show
 * one state at a time, so it follows the same baseline/scenario toggle that
 * appears in the toolbar (`viewMode` in the scenario store), never a toggle
 * of its own.
 */

"use client";

import { useMemo, useState } from "react";
import { CapacityCellDetail, CapacityMatrix } from "@/components/v2/capacity-matrix";
import { MetricRow, NotAvailable, SectionRule, type MetricItem, type MetricTone } from "@/components/v2/page";
import type { CapacityExposure, PlanningSituation } from "@/types/situation";
import { formatMonthLabel, weeksBetween } from "@/lib/dataset/periods";
import { fmtDateShort, fmtPct, fmtUnits } from "@/lib/utils/format";

/** Lower/higher-is-better tone against a no-change epsilon. */
function toneOf(delta: number | undefined, higherIsBetter: boolean, epsilon: number): MetricTone {
  if (delta === undefined || Math.abs(delta) <= epsilon) return "muted";
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? "positive" : "critical";
}

/**
 * A metric is "changed" when its own sub-line says so. Each metric already
 * decides that in one place to write its caption, so reading it back beats a
 * second comparison that could disagree with the words on screen.
 */
function metric(item: MetricItem): ScenarioMetric {
  const sub = typeof item.sub === "string" ? item.sub : "";
  return { item, changed: sub !== "" && !/^No change|^No exposed/.test(sub) };
}

/** A metric plus whether the scenario actually moved it. */
interface ScenarioMetric {
  item: MetricItem;
  changed: boolean;
}

function buildMetrics(
  baseline: PlanningSituation,
  scenario: PlanningSituation
): ScenarioMetric[] {
  const items: ScenarioMetric[] = [];

  // Peak effective utilisation — lower is better.
  {
    const b = baseline.capacityExposure.available ? baseline.capacityExposure.peak : undefined;
    const s = scenario.capacityExposure.available ? scenario.capacityExposure.peak : undefined;
    const delta = b && s ? s.effectiveUtilization - b.effectiveUtilization : undefined;
    items.push(metric({
      label: "Peak effective utilisation",
      value: b && s ? `${fmtPct(b.effectiveUtilization)} → ${fmtPct(s.effectiveUtilization)}` : "—",
      sub:
        delta === undefined
          ? "No exposed line"
          : Math.abs(delta) < 0.001
            ? "No change vs baseline"
            : `${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta * 100))}pts vs baseline`,
      tone: toneOf(delta, false, 0.001),
    }));
  }

  // Lines exposed — lower is better.
  {
    const b = baseline.capacityExposure.available ? baseline.capacityExposure.exposedLineIds.length : undefined;
    const s = scenario.capacityExposure.available ? scenario.capacityExposure.exposedLineIds.length : undefined;
    const delta = b !== undefined && s !== undefined ? s - b : undefined;
    items.push(metric({
      label: "Lines exposed",
      value: b !== undefined && s !== undefined ? `${b} → ${s}` : "—",
      sub: delta === undefined ? "Not available" : delta === 0 ? "No change vs baseline" : `${delta > 0 ? "+" : ""}${delta} vs baseline`,
      tone: toneOf(delta, false, 0),
    }));
  }

  // Earliest decision date — later is better (more runway).
  {
    const bd = baseline.materialExposure.available ? baseline.materialExposure.earliestDecisionDate : undefined;
    const sd = scenario.materialExposure.available ? scenario.materialExposure.earliestDecisionDate : undefined;
    const deltaWeeks = bd && sd ? weeksBetween(bd, sd) : undefined;
    items.push(metric({
      label: "Earliest decision date",
      value: bd && sd ? `${fmtDateShort(bd)} → ${fmtDateShort(sd)}` : bd ? fmtDateShort(bd) : "—",
      sub:
        deltaWeeks === undefined
          ? "No material exposure"
          : deltaWeeks === 0
            ? "No change vs baseline"
            : `${deltaWeeks > 0 ? "+" : ""}${deltaWeeks}w vs baseline`,
      tone: toneOf(deltaWeeks, true, 0),
    }));
  }

  // Plan-now count — more actionable components is better.
  {
    const b = baseline.materialExposure.available ? baseline.materialExposure.planNowCount : undefined;
    const s = scenario.materialExposure.available ? scenario.materialExposure.planNowCount : undefined;
    const delta = b !== undefined && s !== undefined ? s - b : undefined;
    items.push(metric({
      label: "Plan-now count",
      value: b !== undefined && s !== undefined ? `${b} → ${s}` : "—",
      sub: delta === undefined ? "Not available" : delta === 0 ? "No change vs baseline" : `${delta > 0 ? "+" : ""}${delta} vs baseline`,
      tone: toneOf(delta, true, 0),
    }));
  }

  // Validated units — carried forward by planner disposition, not by scenario adjustments.
  {
    const b = baseline.bridge.validatedUnits;
    const s = scenario.bridge.validatedUnits;
    const delta = s - b;
    items.push(metric({
      label: "Validated units",
      value: `${fmtUnits(b, true)} → ${fmtUnits(s, true)}`,
      sub: Math.abs(delta) < 0.5 ? "No change vs baseline" : `${delta > 0 ? "+" : "−"}${fmtUnits(Math.abs(delta), true)} vs baseline`,
      tone: toneOf(delta, true, 0.5),
    }));
  }

  return items;
}

export function ImpactPanel({
  baseline,
  scenario,
  viewMode,
}: {
  baseline: PlanningSituation;
  scenario: PlanningSituation;
  viewMode: "baseline" | "scenario";
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const activeExposure: CapacityExposure =
    viewMode === "scenario" ? scenario.capacityExposure : baseline.capacityExposure;

  const selectedCell = useMemo(() => {
    if (!activeExposure.available) return undefined;
    if (selectedKey) {
      const found = activeExposure.cells.find((c) => `${c.lineId}::${c.period}` === selectedKey);
      if (found) return found;
    }
    return activeExposure.peak;
  }, [activeExposure, selectedKey]);

  const metrics = useMemo(() => buildMetrics(baseline, scenario), [baseline, scenario]);

  // Five metrics all reading "no change vs baseline" is five things to read
  // that say nothing. What a planner needs from an untouched scenario is the
  // one sentence "nothing has moved"; what they need from a changed one is
  // only the figures that actually moved.
  const moved = metrics.filter((m) => m.changed);

  return (
    <div>
      {moved.length === 0 ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-1">
          <span className="text-[15px] font-medium text-[var(--text-primary)]">
            Nothing has moved yet
          </span>
          <span className="text-[12.5px] text-[var(--text-muted)]">
            Change an assumption on the left and only what it affects will appear here.
          </span>
        </div>
      ) : (
        <MetricRow items={moved.map((m) => m.item)} />
      )}

      {/* The Baseline/Scenario toggle lives once, in the toolbar — a second
          copy of the same control on the same screen is not a shortcut, it is
          two things to keep in sync by eye. */}
      <SectionRule label="Effective utilisation by line and month" />

      {!activeExposure.available ? (
        <NotAvailable
          title="Capacity exposure not available"
          detail={activeExposure.unavailableReason ?? "The required line and calendar data was not provided."}
        />
      ) : (
        <>
          <CapacityMatrix
            exposure={activeExposure}
            selected={selectedCell}
            onSelect={(cell) => setSelectedKey(`${cell.lineId}::${cell.period}`)}
          />

          <SectionRule
            label={
              selectedCell
                ? `Decomposition · ${selectedCell.lineName} · ${formatMonthLabel(selectedCell.period)}`
                : "Decomposition"
            }
          />
          {selectedCell ? (
            <CapacityCellDetail cell={selectedCell} />
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">Select a cell in the matrix above to see its build-up.</p>
          )}
        </>
      )}
    </div>
  );
}
