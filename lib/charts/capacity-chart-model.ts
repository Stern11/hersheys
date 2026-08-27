import type { CapacityImpactByLine } from "@/types/scenario";
import { type AxisScale, linearAxis, pctOfAxis } from "./axis";
import { lineDisplay } from "./line-label";

/**
 * View model for the effective-capacity bar chart.
 *
 * The browser audit found that per-row arithmetic was correct but
 * cross-row comparison was impossible: every bar was drawn against a shared
 * hours scale while the number printed beside it was that row's OWN
 * utilization, with no axis anywhere to reconcile the two. Nothing errored —
 * it just quietly implied three different scales.
 *
 * The fix is structural, so it is asserted here rather than eyeballed:
 *   - ONE `AxisScale` in hours for the whole chart (`model.axis`), which the
 *     component renders as a labelled tick axis. Every segment, ceiling and
 *     target position is a percentage of THAT axis.
 *   - Each row also carries `loadHours` / `ceilingHours` / `targetHours` so
 *     the rendered percentage is arithmetically checkable from the same row
 *     (`effectiveUtilization === loadHours / ceilingHours`).
 *   - Series that are zero on every row are dropped from `visibleSeries`, so
 *     the legend never advertises a colour that has no segment anywhere.
 *
 * Pure: no React, no DOM.
 */

export type CapacitySeriesKey = "formal" | "validated" | "inferred" | "scenario";

export interface CapacitySeriesDef {
  key: CapacitySeriesKey;
  label: string;
  /** Planning-STATE token (`--state-*`). Never a `--risk-*` token: these are
   *  data series, not status. Risk tokens are used only for the utilization
   *  figure and the risk dot. */
  token: string;
}

/** Stack order, bottom(left)-to-top(right). */
export const CAPACITY_SERIES: readonly CapacitySeriesDef[] = [
  { key: "formal", label: "Formal", token: "--state-formal" },
  { key: "validated", label: "Validated unresolved", token: "--state-validated" },
  { key: "inferred", label: "AI inferred", token: "--state-inferred" },
  { key: "scenario", label: "Scenario adjustment", token: "--state-scenario" },
] as const;

export function seriesHours(d: CapacityImpactByLine, key: CapacitySeriesKey): number {
  switch (key) {
    case "formal":
      return d.formalLoadHours;
    case "validated":
      return d.validatedUnresolvedLoadHours;
    case "inferred":
      return d.aiInferredLoadHours;
    case "scenario":
      return d.scenarioAdjustmentHours;
  }
}

export function totalLoadHours(d: CapacityImpactByLine): number {
  return CAPACITY_SERIES.reduce((sum, s) => sum + Math.max(0, seriesHours(d, s.key)), 0);
}

/**
 * Only the series that actually contribute somewhere. `scenarioAdjustmentHours`
 * is zero on every row unless a capacity override carries
 * `prebuildQuantityUnits`, which no UI control currently sets — so its legend
 * swatch was permanently pointing at a 0px segment.
 */
export function visibleCapacitySeries(rows: CapacityImpactByLine[]): CapacitySeriesDef[] {
  return CAPACITY_SERIES.filter((s) => rows.some((r) => Math.max(0, seriesHours(r, s.key)) > 0));
}

export interface CapacitySegmentModel extends CapacitySeriesDef {
  hours: number;
  /** Left edge as a % of the shared hours axis. */
  leftPct: number;
  /** Width as a % of the shared hours axis. */
  widthPct: number;
}

export interface CapacityRowModel {
  key: string;
  lineId: string;
  lineLabel: string;
  plant: string | null;
  period: string;
  segments: CapacitySegmentModel[];
  loadHours: number;
  ceilingHours: number;
  targetHours: number;
  targetUtilization: number;
  effectiveUtilization: number;
  formalUtilization: number;
  riskLevel: CapacityImpactByLine["riskLevel"];
  loadPct: number;
  ceilingPct: number;
  targetPct: number;
}

export interface CapacityChartModel {
  axis: AxisScale;
  rows: CapacityRowModel[];
  visibleSeries: CapacitySeriesDef[];
}

/** Headroom so the tallest ceiling marker never lands exactly on the axis edge. */
const AXIS_HEADROOM = 1.02;

export function buildCapacityChartModel(rows: CapacityImpactByLine[]): CapacityChartModel {
  const dataMax = Math.max(0, ...rows.map((r) => Math.max(r.ceilingHours, totalLoadHours(r))));
  const axis = linearAxis(dataMax * AXIS_HEADROOM, 5);

  return {
    axis,
    visibleSeries: visibleCapacitySeries(rows),
    rows: rows.map((r) => {
      const display = lineDisplay(r.lineId);
      let cursor = 0;
      const segments: CapacitySegmentModel[] = [];
      for (const s of CAPACITY_SERIES) {
        const hours = Math.max(0, seriesHours(r, s.key));
        // A zero-hour series contributes no DOM node at all — a 0px div with
        // a background is invisible but still reads as "present" to anyone
        // inspecting the chart, and it is what made the dead scenario series
        // look real.
        if (hours <= 0) continue;
        segments.push({
          ...s,
          hours,
          leftPct: pctOfAxis(cursor, axis.max),
          widthPct: pctOfAxis(hours, axis.max),
        });
        cursor += hours;
      }
      const loadHours = cursor;
      return {
        key: `${r.lineId}-${r.period}`,
        lineId: r.lineId,
        lineLabel: display.name,
        plant: display.plant,
        period: r.period,
        segments,
        loadHours,
        ceilingHours: r.ceilingHours,
        targetHours: Math.round(r.ceilingHours * r.targetUtilization * 10) / 10,
        targetUtilization: r.targetUtilization,
        effectiveUtilization: r.effectiveUtilization,
        formalUtilization: r.formalUtilization,
        riskLevel: r.riskLevel,
        loadPct: pctOfAxis(loadHours, axis.max),
        ceilingPct: pctOfAxis(r.ceilingHours, axis.max),
        targetPct: pctOfAxis(r.ceilingHours * r.targetUtilization, axis.max),
      };
    }),
  };
}

/** Risk tokens are status, never a data series — kept in one place. */
export function riskToken(risk: CapacityImpactByLine["riskLevel"]): string {
  return risk === "critical" ? "--risk-critical" : risk === "warning" ? "--risk-warning" : "--risk-positive";
}
