import { type AxisScale, clampPct, linearAxis } from "./axis";

/**
 * View model for the planning-gap chart (historical actuals + expected
 * envelope + formal-plan reference line).
 *
 * Two defects of the same class as the capacity chart are fixed here:
 *   - the y scale was `dataMax * 1.22`, producing arbitrary gridline labels
 *     ("5.4M") that a planner cannot read a value off; it is now a nice axis.
 *   - the legend advertised "Historical actual" and "Expected range (P50
 *     marked)" unconditionally, even when no row carried an actual, a range,
 *     or a P50 point.
 * Plus label clamping: the range caption was positioned a fixed distance
 * above the band top and the formal-plan caption a fixed distance above its
 * line, so either could be pushed outside the plot box and clipped.
 */

export interface GapChartRowInput {
  period: string;
  actual?: number;
  low?: number;
  high?: number;
  base?: number;
}

export interface GapChartRowModel {
  period: string;
  /** Bar height as a % of the plot box, measured from the baseline. */
  actualHeightPct?: number;
  actual?: number;
  range?: {
    low: number;
    high: number;
    /** Distance from the TOP of the plot box, in %. */
    topPct: number;
    heightPct: number;
    /** P50 marker offset from the TOP OF THE BAND, in % of the plot box. */
    baseOffsetPct?: number;
    base?: number;
    /** Clamped so the caption can never render above the plot box. */
    labelTopPct: number;
  };
}

export interface GapChartLegend {
  historical: boolean;
  range: boolean;
  /** Only claim "P50 marked" when a P50 point is actually drawn. */
  base: boolean;
  formal: boolean;
}

export interface GapChartModel {
  axis: AxisScale;
  rows: GapChartRowModel[];
  formal: {
    value: number;
    topPct: number;
    /** True when the line sits so high that its caption must move below it. */
    labelBelow: boolean;
  };
  legend: GapChartLegend;
}

/** Caption height as a % of the plot box (≈26px of a 220px box). */
const LABEL_OFFSET_PCT = 12;

export function buildGapChartModel(
  data: GapChartRowInput[],
  formalValue: number,
  targetIntervals = 4
): GapChartModel {
  const dataMax = Math.max(0, formalValue, ...data.map((d) => Math.max(d.actual ?? 0, d.high ?? 0, d.base ?? 0)));
  // Headroom so the tallest band/caption is not flush against the top tick.
  const axis = linearAxis(dataMax * 1.12, targetIntervals);
  const topPct = (v: number) => clampPct(100 - (v / axis.max) * 100);
  const heightPct = (v: number) => clampPct((v / axis.max) * 100);

  const rows: GapChartRowModel[] = data.map((d) => {
    const row: GapChartRowModel = { period: d.period };
    if (d.actual != null) {
      row.actual = d.actual;
      row.actualHeightPct = heightPct(d.actual);
    }
    if (d.low != null && d.high != null) {
      const bandTop = topPct(d.high);
      const bandBottom = topPct(d.low);
      row.range = {
        low: d.low,
        high: d.high,
        topPct: bandTop,
        heightPct: Math.max(1.5, bandBottom - bandTop),
        labelTopPct: Math.max(0, bandTop - LABEL_OFFSET_PCT),
        ...(d.base != null ? { base: d.base, baseOffsetPct: clampPct(topPct(d.base) - bandTop) } : {}),
      };
    }
    return row;
  });

  const formalTopPct = topPct(formalValue);

  return {
    axis,
    rows,
    formal: {
      value: formalValue,
      topPct: formalTopPct,
      labelBelow: formalTopPct < LABEL_OFFSET_PCT,
    },
    legend: {
      historical: data.some((d) => d.actual != null),
      range: data.some((d) => d.low != null && d.high != null),
      base: data.some((d) => d.low != null && d.high != null && d.base != null),
      formal: Number.isFinite(formalValue) && formalValue > 0,
    },
  };
}
