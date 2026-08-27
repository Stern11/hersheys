import type { CapacityImpactByLine } from "@/types/scenario";
import { type AxisScale, linearAxis, pctOfAxis } from "./axis";
import { lineDisplay } from "./line-label";
import type { SeriesToken, StatusToken } from "./tooltip-model";

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
 * The hover pass added a second class of derived value: everything a tooltip
 * needs in order to ADD information rather than restate the label — the units
 * behind the hours (via the row's own run rate), each segment's share of the
 * ceiling, the cumulative load through a segment, and above all the
 * FORMAL-ONLY vs EFFECTIVE contrast (`formalUtilization` -> `effectiveUtilization`,
 * `utilizationDelta`, `unresolvedHours`). That contrast is the entire point of
 * the section — "formal load looks safe, effective load tells a different
 * story" — so it is computed and tested here, not assembled inline in JSX.
 *
 * Nothing here fabricates: `unresolvedUnits` / `segment.units` are `null`
 * whenever the engine did not supply a usable run rate, and the component
 * simply drops the row from the tooltip.
 *
 * Pure: no React, no DOM.
 */

export type CapacitySeriesKey = "formal" | "validated" | "inferred" | "scenario";

export interface CapacitySeriesDef {
  key: CapacitySeriesKey;
  label: string;
  /** Planning-STATE token (`--state-*`). Never a `--risk-*` token: these are
   *  data series, not status. Risk tokens are used only for the utilization
   *  figure, the row flag and the risk dot. Typed as `SeriesToken` so a risk
   *  token will not compile here. */
  token: SeriesToken;
  /**
   * What the series MEANS in planning terms. A tooltip that only repeats
   * "AI inferred 26.4h" tells the planner nothing they cannot already see on
   * the bar; this is the sentence that makes the segment decodable.
   */
  meaning: string;
}

/**
 * Stack order, bottom(left)-to-top(right).
 *
 * The order is a PROVENANCE-CERTAINTY GRADIENT, not an arbitrary choice:
 * what the formal system already commits -> what a planner has confirmed but
 * has not written back -> what Heizen inferred and nobody has validated ->
 * what this scenario is proposing. Reading left to right along the bar is
 * therefore reading from most certain to least certain, and the boundary
 * between the first segment and the rest is exactly the formal-only mark.
 *
 * That is why the order is NOT changed to fix the dark-mode contrast problem
 * (`--state-formal` is near-white in dark and the palest fill in the stack).
 * Reordering would destroy the gradient and would still leave two adjacent
 * fills to separate in the OTHER theme. Separability is instead handled by the
 * renderer drawing a 1px inset separator in the TRACK colour between adjacent
 * segments — `--surface-sunken` is dark in dark mode and light in light mode,
 * so it contrasts against every series fill in both themes.
 */
export const CAPACITY_SERIES: readonly CapacitySeriesDef[] = [
  {
    key: "formal",
    label: "Formal",
    token: "--state-formal",
    meaning: "Load the formal planning stack already commits on this line. This is all the ERP/APS can see.",
  },
  {
    key: "validated",
    label: "Validated unresolved",
    token: "--state-validated",
    meaning: "Demand a planner has confirmed is real, but which has not yet been written back into the formal plan.",
  },
  {
    key: "inferred",
    label: "AI inferred",
    token: "--state-inferred",
    meaning: "Load from demand Heizen inferred from analogue seasons. Not yet validated by a planner, and invisible to the formal plan.",
  },
  {
    key: "scenario",
    label: "Scenario adjustment",
    token: "--state-scenario",
    meaning: "Net hours this scenario's capacity overrides add or remove (shift change, prebuild, reallocation).",
  },
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

/* ---------------------------------------------------------------------- *
 * Run rate — the bridge from hours back to units
 * ---------------------------------------------------------------------- */

/**
 * The rate `rccp()` actually divided by, or `null` when the row did not carry
 * one (hand-built fixtures). Never defaulted to a plausible number: a tooltip
 * that invents a run rate invents the unit figure derived from it.
 */
export function capacityRunRate(d: CapacityImpactByLine): number | null {
  const rate = d.runRateUnitsPerHour;
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
}

const RUN_RATE_SOURCE_LABEL: Record<NonNullable<CapacityImpactByLine["runRateSource"]>, string> = {
  scenario_value: "scenario override",
  observed_median: "observed median",
  line_period_rate: "line rate for this period",
  line_standard: "line standard rate",
};

/** Human phrase for where the run rate came from, or `null` when unknown. */
export function runRateSourceLabel(d: CapacityImpactByLine): string | null {
  if (capacityRunRate(d) === null) return null;
  return d.runRateSource ? RUN_RATE_SOURCE_LABEL[d.runRateSource] : null;
}

/** Hours -> units at the row's own run rate. `null` when the rate is unknown. */
export function unitsAtRunRate(hours: number, rate: number | null): number | null {
  if (rate === null || !Number.isFinite(hours)) return null;
  return Math.round(hours * rate);
}

/* ---------------------------------------------------------------------- *
 * Row / segment models
 * ---------------------------------------------------------------------- */

export interface CapacitySegmentModel extends CapacitySeriesDef {
  hours: number;
  /** Position in the rendered stack, 0-based. Index 0 draws no separator. */
  index: number;
  /** Left edge as a % of the shared hours axis. */
  leftPct: number;
  /** Width as a % of the shared hours axis. */
  widthPct: number;
  /** This segment's hours as a share of the row's ceiling, 0-1. */
  shareOfCeiling: number | null;
  /** Load through this segment's RIGHT edge — i.e. the running total. */
  cumulativeHours: number;
  /** `cumulativeHours / ceilingHours` — the utilization reached at this edge. */
  cumulativeUtilization: number | null;
  /** Units these hours represent at the row's run rate; `null` when unknown. */
  units: number | null;
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

  /** The formal-vs-effective contrast, precomputed so the row can lead with it. */
  formalHours: number;
  /** Everything the formal plan cannot see: validated + inferred + scenario. */
  unresolvedHours: number;
  /** `unresolvedHours` expressed in units, or `null` without a run rate. */
  unresolvedUnits: number | null;
  /** `effectiveUtilization - formalUtilization`, in utilization points (0-1). */
  utilizationDelta: number;

  /** `ceilingHours - loadHours`. Negative when the load is over the ceiling. */
  headroomHours: number;
  /** `max(0, loadHours - targetHours)`. */
  overTargetHours: number;
  /** `max(0, loadHours - ceilingHours)`. */
  overCeilingHours: number;
  crossesTarget: boolean;
  crossesCeiling: boolean;
  /**
   * Whether formal load ALONE would already breach the target. When this is
   * false but `crossesTarget` is true, the line only looks safe because the
   * unresolved demand is missing from the formal plan — the situation the
   * section exists to surface.
   */
  formalCrossesTarget: boolean;
  /** Convenience for the row's status treatment: risk is warning or critical. */
  atRisk: boolean;

  riskLevel: CapacityImpactByLine["riskLevel"];
  /** Status token for this row. Never used to fill a data series. */
  risk: StatusToken;

  loadPct: number;
  ceilingPct: number;
  targetPct: number;
  /** Where formal-only load ends on the shared axis. */
  formalPct: number;

  runRateUnitsPerHour: number | null;
  runRateSource: string | null;
  runRateBasis: CapacityImpactByLine["runRateBasis"] | null;
}

export interface CapacityChartModel {
  axis: AxisScale;
  rows: CapacityRowModel[];
  visibleSeries: CapacitySeriesDef[];
  /** True when at least one row carries a warning/critical risk level. */
  anyAtRisk: boolean;
}

/** Headroom so the tallest ceiling marker never lands exactly on the axis edge. */
const AXIS_HEADROOM = 1.02;

function share(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return part / whole;
}

export function buildCapacityChartModel(rows: CapacityImpactByLine[]): CapacityChartModel {
  const dataMax = Math.max(0, ...rows.map((r) => Math.max(r.ceilingHours, totalLoadHours(r))));
  const axis = linearAxis(dataMax * AXIS_HEADROOM, 5);

  const built = rows.map((r) => {
    const display = lineDisplay(r.lineId);
    const rate = capacityRunRate(r);
    let cursor = 0;
    const segments: CapacitySegmentModel[] = [];
    for (const s of CAPACITY_SERIES) {
      const hours = Math.max(0, seriesHours(r, s.key));
      // A zero-hour series contributes no DOM node at all — a 0px div with
      // a background is invisible but still reads as "present" to anyone
      // inspecting the chart, and it is what made the dead scenario series
      // look real.
      if (hours <= 0) continue;
      const cumulativeHours = cursor + hours;
      segments.push({
        ...s,
        hours,
        index: segments.length,
        leftPct: pctOfAxis(cursor, axis.max),
        widthPct: pctOfAxis(hours, axis.max),
        shareOfCeiling: share(hours, r.ceilingHours),
        cumulativeHours,
        cumulativeUtilization: share(cumulativeHours, r.ceilingHours),
        units: unitsAtRunRate(hours, rate),
      });
      cursor = cumulativeHours;
    }

    const loadHours = cursor;
    const formalHours = Math.max(0, r.formalLoadHours);
    const unresolvedHours = Math.max(0, loadHours - formalHours);
    const targetHours = Math.round(r.ceilingHours * r.targetUtilization * 10) / 10;

    return {
      key: `${r.lineId}-${r.period}`,
      lineId: r.lineId,
      lineLabel: display.name,
      plant: display.plant,
      period: r.period,
      segments,

      loadHours,
      ceilingHours: r.ceilingHours,
      targetHours,
      targetUtilization: r.targetUtilization,
      effectiveUtilization: r.effectiveUtilization,
      formalUtilization: r.formalUtilization,

      formalHours,
      unresolvedHours,
      unresolvedUnits: unitsAtRunRate(unresolvedHours, rate),
      utilizationDelta: r.effectiveUtilization - r.formalUtilization,

      headroomHours: r.ceilingHours - loadHours,
      overTargetHours: Math.max(0, loadHours - targetHours),
      overCeilingHours: Math.max(0, loadHours - r.ceilingHours),
      crossesTarget: loadHours > targetHours,
      crossesCeiling: loadHours > r.ceilingHours,
      formalCrossesTarget: formalHours > targetHours,
      atRisk: r.riskLevel !== "positive",

      riskLevel: r.riskLevel,
      risk: riskToken(r.riskLevel),

      loadPct: pctOfAxis(loadHours, axis.max),
      ceilingPct: pctOfAxis(r.ceilingHours, axis.max),
      targetPct: pctOfAxis(r.ceilingHours * r.targetUtilization, axis.max),
      formalPct: pctOfAxis(formalHours, axis.max),

      runRateUnitsPerHour: rate,
      runRateSource: runRateSourceLabel(r),
      runRateBasis: r.runRateBasis ?? null,
    } satisfies CapacityRowModel;
  });

  return {
    axis,
    visibleSeries: visibleCapacitySeries(rows),
    rows: built,
    anyAtRisk: built.some((r) => r.atRisk),
  };
}

/** Risk tokens are status, never a data series — kept in one place. */
export function riskToken(risk: CapacityImpactByLine["riskLevel"]): StatusToken {
  return risk === "critical" ? "--risk-critical" : risk === "warning" ? "--risk-warning" : "--risk-positive";
}

/**
 * The sentence under the formal-vs-effective contrast chip. It is derived,
 * not decorative: the "only looks safe" claim is asserted ONLY when formal
 * load alone stays under the target while effective load does not — the exact
 * condition the section's subtitle describes. Any other row gets a neutral
 * explanation of what the two percentages mean.
 */
export function formalContrastNote(
  r: Pick<CapacityRowModel, "crossesTarget" | "formalCrossesTarget" | "crossesCeiling" | "unresolvedHours">
): string {
  if (r.unresolvedHours <= 0) {
    return "Every hour on this line is already in the formal plan, so formal-only and effective utilization are the same number.";
  }
  if (r.crossesCeiling && !r.formalCrossesTarget) {
    return "The formal plan alone stays under the target, but the unresolved demand pushes this line past its ceiling — the line only looks safe because that demand is missing from the formal plan.";
  }
  if (r.crossesTarget && !r.formalCrossesTarget) {
    return "The formal plan alone stays under the target; adding the unresolved demand breaches it. The line only looks safe because that demand is missing from the formal plan.";
  }
  if (r.crossesTarget) {
    return "This line is over target on the formal plan alone — the unresolved demand widens an exposure that the formal system can already see.";
  }
  return "Formal-only is what the ERP/APS reports today. Effective adds the validated-unresolved and AI-inferred demand that has not reached the formal plan yet.";
}

/**
 * How the engine set this row's risk level (`capacity.ts::rccp`), in one
 * sentence. Shown on hover over the row flag so the tint is decodable rather
 * than just "a coloured row".
 */
export function riskLevelExplanation(risk: CapacityImpactByLine["riskLevel"]): string {
  switch (risk) {
    case "critical":
      return "Effective load is above the capacity ceiling — this period cannot be produced on this line as planned.";
    case "warning":
      return "Effective load is above this line's target utilization, so the buffer for changeovers and variability is gone.";
    case "positive":
      return "Effective load stays under this line's target utilization.";
  }
}
