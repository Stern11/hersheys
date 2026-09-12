/**
 * Scenario Lab's main visual (V2 §13.3, §23.6).
 *
 * A metric band always compares baseline to scenario, regardless of which
 * one is on screen below — the planner should never have to hold last
 * screen's numbers in their head. The capacity visual itself can only show
 * one state at a time, so it follows the same baseline/scenario toggle that
 * appears in the toolbar (`viewMode` in the scenario store) — that axis is
 * separate from, and independent of, the pull-forward chart's own
 * Before/After toggle (baseline-vs-scenario is "which plan"; Before/After is
 * "with or without pulling production forward on top of that plan").
 */

"use client";

import { useMemo, useState } from "react";
import { CapacityCellDetail } from "@/components/v2/capacity-matrix";
import { CapacityPullForward } from "@/components/v2/capacity-pull-forward";
import { MetricRow, NotAvailable, SectionRule, type MetricItem, type MetricTone } from "@/components/v2/page";
import { formatMonthLabel, weeksBetween } from "@/lib/dataset/periods";
import { fmtDateShort, fmtPct, fmtUnits } from "@/lib/utils/format";
import type { CapacityExposure, PlanningSituation } from "@/types/situation";

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

/** The line whose load is tightest relative to its own capacity right now. */
function defaultLineId(exposure: CapacityExposure): string | undefined {
  if (exposure.peak) return exposure.peak.lineId;
  return exposure.lines[0]?.lineId;
}

/** The month a line is tightest in — where the chart and decomposition open. */
function defaultPeriodFor(exposure: CapacityExposure, lineId: string | undefined): string | undefined {
  if (!lineId) return undefined;
  const cells = exposure.cells.filter((c) => c.lineId === lineId);
  if (cells.length === 0) return undefined;
  return cells.reduce((worst, c) => (c.effectiveHours > worst.effectiveHours ? c : worst)).period;
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
  const [focusLineId, setFocusLineId] = useState<string | null>(null);
  const [focusPeriod, setFocusPeriod] = useState<string | null>(null);

  const activeSituation = viewMode === "scenario" ? scenario : baseline;
  const activeExposure: CapacityExposure = activeSituation.capacityExposure;

  const lineId =
    focusLineId && activeExposure.lines.some((l) => l.lineId === focusLineId)
      ? focusLineId
      : defaultLineId(activeExposure);
  const period =
    focusPeriod && activeExposure.cells.some((c) => c.lineId === lineId && c.period === focusPeriod)
      ? focusPeriod
      : defaultPeriodFor(activeExposure, lineId);

  const selectedCell = useMemo(
    () => activeExposure.cells.find((c) => c.lineId === lineId && c.period === period),
    [activeExposure, lineId, period]
  );

  // Every unit a candidate carries forward, keyed by candidate id — the
  // pull-forward chart's only way to turn hours into a headline unit figure,
  // and it needs nothing new: this is the same `plannedUnits` every other
  // page already reads.
  const candidateUnitsById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of activeSituation.candidateItems) out[c.id] = c.plannedUnits;
    return out;
  }, [activeSituation]);

  // The longest lead time among components any candidate loading this line
  // actually needs — a real, derived number, just applied uniformly across
  // the line's months rather than varying month to month, since the material
  // model has no finer-grained mapping than "this component feeds this line's
  // items" to read a per-month figure from. Drives the drop-dead lane below
  // the chart; when nothing resolves, the lane simply doesn't render.
  const lineLeadTimeDays = useMemo(() => {
    if (!lineId) return undefined;
    const candidateIds = new Set<string>();
    for (const cell of activeExposure.cells) {
      if (cell.lineId !== lineId) continue;
      for (const contributor of cell.contributors) candidateIds.add(contributor.candidateId);
    }
    if (candidateIds.size === 0) return undefined;
    if (!activeSituation.materialExposure.available) return undefined;
    let max: number | undefined;
    for (const row of activeSituation.materialExposure.rows) {
      const relevant = row.contributors.some((c) => candidateIds.has(c.candidateId));
      if (!relevant) continue;
      if (max === undefined || row.leadTimeDays > max) max = row.leadTimeDays;
    }
    return max;
  }, [activeExposure, lineId, activeSituation]);

  const leadTimeDaysFor = useMemo(
    () => (lineLeadTimeDays !== undefined ? () => lineLeadTimeDays : undefined),
    [lineLeadTimeDays]
  );

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
            Change an assumption and only what it affects will appear here.
          </span>
        </div>
      ) : (
        <MetricRow items={moved.map((m) => m.item)} />
      )}

      {/* The Baseline/Scenario toggle lives once, in the toolbar — a second
          copy of the same control on the same screen is not a shortcut, it is
          two things to keep in sync by eye. */}
      <SectionRule
        label="Load vs. capacity"
        action={
          activeExposure.available && activeExposure.lines.length > 1 ? (
            <LinePicker
              lines={activeExposure.lines}
              exposedLineIds={activeExposure.exposedLineIds}
              value={lineId}
              onChange={(id) => {
                setFocusLineId(id);
                setFocusPeriod(null);
              }}
            />
          ) : null
        }
      />

      {!activeExposure.available ? (
        <NotAvailable
          title="Capacity exposure not available"
          detail={activeExposure.unavailableReason ?? "The required line and calendar data was not provided."}
        />
      ) : !lineId ? (
        <p className="text-[13px] text-[var(--text-muted)]">No line data for this situation.</p>
      ) : (
        <>
          <CapacityPullForward
            exposure={activeExposure}
            lineId={lineId}
            candidateUnitsById={candidateUnitsById}
            leadTimeDaysFor={leadTimeDaysFor}
            selectedPeriod={period}
            onSelectPeriod={setFocusPeriod}
          />

          <SectionRule
            label={selectedCell ? `Decomposition · ${selectedCell.lineName} · ${formatMonthLabel(selectedCell.period)}` : "Decomposition"}
          />
          {selectedCell ? (
            <CapacityCellDetail cell={selectedCell} />
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">Select a month in the chart above to see its build-up.</p>
          )}
        </>
      )}
    </div>
  );
}

function LinePicker({
  lines,
  exposedLineIds,
  value,
  onChange,
}: {
  lines: { lineId: string; lineName: string }[];
  exposedLineIds: string[];
  value: string | undefined;
  onChange: (lineId: string) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 max-w-full truncate rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--text-primary)]"
    >
      {lines.map((l) => (
        <option key={l.lineId} value={l.lineId}>
          {l.lineName}
          {exposedLineIds.includes(l.lineId) ? " · exposed" : ""}
        </option>
      ))}
    </select>
  );
}
