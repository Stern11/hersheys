import { type AxisScale, clampPct, linearAxis } from "./axis";

/**
 * View model for the planning-gap chart — the product's signature visual:
 * historical actuals, the expected envelope for the coming season, the current
 * formal plan as a reference line, and **the shortfall between them**.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE SHORTFALL IS GEOMETRY, NOT A CAPTION
 * ─────────────────────────────────────────────────────────────────────────
 * The previous version drew the formal plan as a dashed rule and the expected
 * season as a small floating band, and left the planner to subtract the two by
 * eye. That subtraction IS the product. So the model now emits the shortfall
 * as a first-class band — `GapShortfall` — with its own geometry, its own
 * uncertainty (the shortfall measured against the low and the high end of the
 * envelope), and its own caption placement. The component renders it; it never
 * computes it.
 *
 * Three further defects of the same class as the capacity chart are fixed here:
 *   - the y scale was `dataMax * 1.22`, producing arbitrary gridline labels
 *     ("5.4M") that a planner cannot read a value off; it is now a nice axis
 *     with enough intervals that a value can actually be read off a gridline.
 *   - the legend advertised "Historical actual" and "Expected range (P50
 *     marked)" unconditionally, even when no row carried an actual, a range,
 *     or a P50 point.
 *   - the range caption sat a fixed distance above the band top and the
 *     formal-plan caption a fixed distance above its line, so the two collided
 *     in the top-right corner whenever the formal plan landed near the
 *     envelope. Caption placement is now a resolved, tested decision
 *     (`resolveFormalLabel`) rather than a fixed offset.
 *
 * The expected season is also now a FULL-WIDTH column (0 → the expected point)
 * split at the formal-plan line, so it is mass-comparable to the historical
 * bars beside it instead of reading as a floating marker. Uncertainty is
 * preserved as an envelope whisker over the column top, per the product rule
 * that a single-point estimate is never shown alone.
 *
 * No React, no DOM, no data imports.
 */

export interface GapChartRowInput {
  period: string;
  actual?: number;
  low?: number;
  high?: number;
  base?: number;
}

/* ---------------------------------------------------------------------------
 * Caption sizing — all expressed as a % of the plot box (the chart is 220px
 * tall, so 12% ≈ 26px ≈ two 11px lines).
 * ------------------------------------------------------------------------- */

/** Height of a two-line caption (the envelope caption, the formal-plan chip). */
export const LABEL_OFFSET_PCT = 12;
/** Height of a one-line delta chip sitting above a historical bar. */
export const TREND_LABEL_OFFSET_PCT = 8;
/** Clear height the shortfall band needs to carry its value AND its word. */
export const SHORTFALL_LABEL_FULL_PCT = 11;
/** Clear height the shortfall band needs to carry just its value. */
export const SHORTFALL_LABEL_COMPACT_PCT = 6;
/**
 * How much of a MARK, measured down from its own top edge, a caption must stay
 * out of.
 *
 * `resolveFormalLabel` used to treat only other CAPTIONS as obstacles, so when
 * the right end of the reference line was blocked it fell back to the left and
 * landed squarely on the left-most bar — the reported defect, where the
 * "Formal plan: 3.8M units" chip covered the top-left of the Halloween 2024
 * bar in both themes and at both widths, hiding the one edge a planner reads a
 * bar's height off. A bar's body may be crossed by a reference-line caption
 * (that is conventional); its TOP EDGE may not.
 */
export const MARK_TOP_GUARD_PCT = LABEL_OFFSET_PCT;

/** The band a caption must not enter if `topPct`'s top edge is to stay readable. */
export function markTopGuard(topPct: number, guardPct: number = MARK_TOP_GUARD_PCT): LabelBand {
  return { topPct, heightPct: guardPct };
}

const EPS = 1e-9;

/* ---------------------------------------------------------------------------
 * Label anti-collision
 * ------------------------------------------------------------------------- */

/** A caption's vertical footprint inside the plot box, in % from the top. */
export interface LabelBand {
  topPct: number;
  heightPct: number;
}

/** True when two captions in the same horizontal region would overlap. */
export function bandsOverlap(a: LabelBand, b: LabelBand): boolean {
  return a.topPct < b.topPct + b.heightPct - EPS && b.topPct < a.topPct + a.heightPct - EPS;
}

export type LabelSide = "left" | "right";

export interface FormalLabelPlacement {
  /** True when the line sits so high that its caption must move below it. */
  labelBelow: boolean;
  /** Which end of the reference line the caption is anchored to. */
  labelSide: LabelSide;
}

/**
 * Where the formal-plan caption goes so that it collides with nothing.
 *
 * The reference line spans the whole plot, so its caption can be anchored at
 * either end; what it can collide with is whatever is drawn at the same end —
 * the captions anchored there (the envelope and shortfall captions over the
 * right-most column, the first bar's delta chip over the left-most) AND the
 * top edge of that end's own bar/column, passed in as `markTopGuard` bands.
 * Bars must be obstacles: with captions alone, a blocked right end fell back
 * to the left and put the chip on the left-most bar's top edge.
 *
 * Preference order: right of the line (the conventional place for a reference
 * label) → left → flip to the other side of the line → left as the last
 * resort. The vertical decision (`labelBelow`) is made first and only revisited
 * if both ends are blocked, because a caption above its own line is what a
 * planner expects to read.
 */
export function resolveFormalLabel(
  formalTopPct: number,
  rightObstacles: readonly LabelBand[] = [],
  leftObstacles: readonly LabelBand[] = [],
  offsetPct: number = LABEL_OFFSET_PCT
): FormalLabelPlacement {
  const below = formalTopPct < offsetPct;
  const bandFor = (isBelow: boolean): LabelBand => ({
    topPct: isBelow ? formalTopPct : formalTopPct - offsetPct,
    heightPct: offsetPct,
  });
  const blocked = (band: LabelBand, obstacles: readonly LabelBand[]) => obstacles.some((o) => bandsOverlap(band, o));

  const preferred = bandFor(below);
  if (!blocked(preferred, rightObstacles)) return { labelBelow: below, labelSide: "right" };
  if (!blocked(preferred, leftObstacles)) return { labelBelow: below, labelSide: "left" };

  // Both ends blocked at the preferred vertical position — try the other side
  // of the line, but only if the caption still fits inside the plot box.
  const flipped = bandFor(!below);
  if (flipped.topPct >= -EPS && flipped.topPct + flipped.heightPct <= 100 + EPS) {
    if (!blocked(flipped, rightObstacles)) return { labelBelow: !below, labelSide: "right" };
    if (!blocked(flipped, leftObstacles)) return { labelBelow: !below, labelSide: "left" };
  }
  return { labelBelow: below, labelSide: "left" };
}

/* ---------------------------------------------------------------------------
 * Trend across the historical seasons
 * ------------------------------------------------------------------------- */

export type TrendDirection = "up" | "down" | "flat";

/** Season-over-season change, attached to the later of the two seasons. */
export interface GapTrendDelta {
  prevPeriod: string;
  prevActual: number;
  /** `actual - prevActual`. */
  delta: number;
  /** Fractional change, e.g. `0.0582`. `0` when the prior season was not > 0. */
  pctChange: number;
  direction: TrendDirection;
  /** Top of the one-line delta chip, % from the top of the plot box. */
  labelTopPct: number;
}

/** A point in the plot box, both axes as a % (x from left, y from top). */
export interface ChartPoint {
  xPct: number;
  yPct: number;
}

export interface GapTrendPath {
  /** Tops of the historical bars, left → right. Empty unless there are >= 2. */
  actual: ChartPoint[];
  /**
   * Connector from the last historical actual to the expected point. This is a
   * connector between two plotted values, NOT an extrapolation — the expected
   * point comes from the engine, not from the slope of this line.
   */
  projection: readonly [ChartPoint, ChartPoint] | null;
}

/** What the historical series as a whole says — the planner's actual insight. */
export interface GapTrendSummary {
  seasons: number;
  firstPeriod: string;
  firstActual: number;
  lastPeriod: string;
  lastActual: number;
  /** `lastActual - firstActual`. */
  totalDelta: number;
  /** Compound growth per season across the historical actuals. */
  cagr: number;
  direction: TrendDirection;
  /** How many historical seasons already came in above the current formal plan. */
  seasonsAboveFormal: number;
}

/* ---------------------------------------------------------------------------
 * The expected column and the shortfall
 * ------------------------------------------------------------------------- */

export interface GapExpectedColumn {
  /** The plotted point — the P50 when present, otherwise the envelope high. */
  point: number;
  /** True when `point` is a real P50 rather than a fallback to the high end. */
  pointIsBase: boolean;
  /** Full column height, baseline → point. */
  heightPct: number;
  /** The point's own rule, % from the TOP of the plot box. */
  pointTopPct: number;
  /** The part of the expected season the formal plan already covers. */
  coveredValue: number;
  coveredHeightPct: number;
}

export type ShortfallLabelFit = "full" | "compact" | "none";

/**
 * The unrepresented volume: how far the formal plan sits below the expected
 * point, with the same quantity measured against both ends of the envelope so
 * the planner sees the shortfall's own uncertainty rather than one number.
 */
export interface GapShortfall {
  /** `point - formal`. Always > 0 (absent when the plan already covers it). */
  value: number;
  /** The shortfall measured against the low / high end of the envelope. */
  lowValue: number;
  highValue: number;
  expectedPoint: number;
  formalValue: number;
  /** `value / expectedPoint` — the share of the season the plan does not carry. */
  shareOfExpected: number;
  /** Band geometry: from the expected point down to the formal-plan line. */
  topPct: number;
  heightPct: number;
  /**
   * Caption placement inside the band. The envelope whisker hangs into the top
   * of the band, so the caption is centred in the CLEAR part below the
   * whisker's low cap rather than in the band's own middle.
   */
  labelFit: ShortfallLabelFit;
  labelTopPct: number;
  labelHeightPct: number;
}

/* ---------------------------------------------------------------------------
 * Row / chart model
 * ------------------------------------------------------------------------- */

export interface GapChartRowModel {
  period: string;
  /** Horizontal centre of this column, % from the left of the plot box. */
  centerPct: number;
  /** Bar height as a % of the plot box, measured from the baseline. */
  actualHeightPct?: number;
  actual?: number;
  /** Change vs. the previous season that carried an actual. */
  trend?: GapTrendDelta;
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
  /** Present on the same row as `range` — the drawn, mass-comparable column. */
  column?: GapExpectedColumn;
  /** Present when the formal plan sits below this row's expected point. */
  shortfall?: GapShortfall;
}

export interface GapChartLegend {
  historical: boolean;
  range: boolean;
  /** Only claim "P50 marked" when a P50 point is actually drawn. */
  base: boolean;
  formal: boolean;
  /** Only claim a covered segment when some of the expected column is covered. */
  covered: boolean;
  /** Only claim a shortfall when one is actually drawn. */
  shortfall: boolean;
  /** Only claim a trend path when >= 2 actuals are joined. */
  trend: boolean;
}

export interface GapChartModel {
  axis: AxisScale;
  rows: GapChartRowModel[];
  formal: {
    value: number;
    topPct: number;
    /** True when the line sits so high that its caption must move below it. */
    labelBelow: boolean;
    /** Which end of the line the caption is anchored to, after collision resolution. */
    labelSide: LabelSide;
  };
  /** The headline shortfall — the one the section exists to communicate. */
  shortfall: GapShortfall | null;
  trendPath: GapTrendPath;
  trendSummary: GapTrendSummary | null;
  legend: GapChartLegend;
}

/**
 * Six intervals rather than four: with the old target the axis for this data
 * landed on 0 / 2M / 4M / 6M, and every value in the chart sat between two
 * gridlines 2M apart. A planner reads values off gridlines.
 */
const DEFAULT_INTERVALS = 6;
/** Headroom so the tallest whisker and its caption clear the top tick. */
const HEADROOM = 1.12;

export function buildGapChartModel(
  data: GapChartRowInput[],
  formalValue: number,
  targetIntervals = DEFAULT_INTERVALS
): GapChartModel {
  const dataMax = Math.max(0, formalValue, ...data.map((d) => Math.max(d.actual ?? 0, d.high ?? 0, d.base ?? 0)));
  const axis = linearAxis(dataMax * HEADROOM, targetIntervals);
  const topPct = (v: number) => clampPct(100 - (v / axis.max) * 100);
  const heightPct = (v: number) => clampPct((v / axis.max) * 100);

  const n = Math.max(1, data.length);
  const formalIsUsable = Number.isFinite(formalValue) && formalValue > 0;

  let prevActual: { period: string; actual: number } | null = null;

  const rows: GapChartRowModel[] = data.map((d, i) => {
    const row: GapChartRowModel = { period: d.period, centerPct: ((i + 0.5) / n) * 100 };

    if (d.actual != null && Number.isFinite(d.actual)) {
      row.actual = d.actual;
      row.actualHeightPct = heightPct(d.actual);
      if (prevActual) {
        const delta = d.actual - prevActual.actual;
        row.trend = {
          prevPeriod: prevActual.period,
          prevActual: prevActual.actual,
          delta,
          pctChange: prevActual.actual > 0 ? delta / prevActual.actual : 0,
          direction: Math.abs(delta) < EPS ? "flat" : delta > 0 ? "up" : "down",
          labelTopPct: Math.max(0, topPct(d.actual) - TREND_LABEL_OFFSET_PCT),
        };
      }
      prevActual = { period: d.period, actual: d.actual };
    }

    if (d.low != null && d.high != null && Number.isFinite(d.low) && Number.isFinite(d.high)) {
      const bandTop = topPct(d.high);
      const bandBottom = topPct(d.low);
      const hasBase = d.base != null && Number.isFinite(d.base);
      row.range = {
        low: d.low,
        high: d.high,
        topPct: bandTop,
        heightPct: Math.max(1.5, bandBottom - bandTop),
        // Two-line caption: the value pair, then what the pair MEANS.
        labelTopPct: Math.max(0, bandTop - LABEL_OFFSET_PCT),
        ...(hasBase ? { base: d.base!, baseOffsetPct: clampPct(topPct(d.base!) - bandTop) } : {}),
      };

      const point = hasBase ? d.base! : d.high;
      const covered = formalIsUsable ? Math.min(formalValue, point) : 0;
      row.column = {
        point,
        pointIsBase: hasBase,
        heightPct: heightPct(point),
        pointTopPct: topPct(point),
        coveredValue: covered,
        coveredHeightPct: heightPct(covered),
      };

      if (formalIsUsable && point > formalValue + EPS) {
        row.shortfall = buildShortfall({ point, low: d.low, high: d.high, formalValue, topPct });
      }
    }

    return row;
  });

  const formalTopPct = topPct(formalValue);
  const expectedRow = rows.find((r) => r.range != null);

  // What a right-anchored formal-plan caption would land on: the captions
  // anchored over the right-most column AND that column's own marks. The bars
  // are obstacles too — a caption that covers a mark's top edge is exactly as
  // bad as one that covers another caption, and worse, because the mark is the
  // data.
  const lastRow = rows[rows.length - 1];
  const rightObstacles: LabelBand[] = [];
  if (expectedRow?.range) rightObstacles.push({ topPct: expectedRow.range.labelTopPct, heightPct: LABEL_OFFSET_PCT });
  if (expectedRow?.shortfall && expectedRow.shortfall.labelFit !== "none") {
    rightObstacles.push({ topPct: expectedRow.shortfall.labelTopPct, heightPct: expectedRow.shortfall.labelHeightPct });
  }
  if (lastRow?.column) rightObstacles.push(markTopGuard(lastRow.column.pointTopPct));
  if (lastRow?.actual != null) rightObstacles.push(markTopGuard(topPct(lastRow.actual)));

  // …and the same for the left-most column.
  const firstRow = rows[0];
  const leftObstacles: LabelBand[] = [];
  const firstTrend = firstRow?.trend;
  if (firstTrend) leftObstacles.push({ topPct: firstTrend.labelTopPct, heightPct: TREND_LABEL_OFFSET_PCT });
  if (firstRow?.column) leftObstacles.push(markTopGuard(firstRow.column.pointTopPct));
  if (firstRow?.actual != null) leftObstacles.push(markTopGuard(topPct(firstRow.actual)));

  const placement = formalIsUsable
    ? resolveFormalLabel(formalTopPct, rightObstacles, leftObstacles)
    : { labelBelow: formalTopPct < LABEL_OFFSET_PCT, labelSide: "right" as LabelSide };

  const actualPoints: ChartPoint[] = rows
    .filter((r) => r.actual != null)
    .map((r) => ({ xPct: r.centerPct, yPct: topPct(r.actual!) }));
  const lastActualPoint = actualPoints[actualPoints.length - 1] ?? null;
  const projection: readonly [ChartPoint, ChartPoint] | null =
    lastActualPoint && expectedRow?.column
      ? [lastActualPoint, { xPct: expectedRow.centerPct, yPct: topPct(expectedRow.column.point) }]
      : null;

  return {
    axis,
    rows,
    formal: { value: formalValue, topPct: formalTopPct, ...placement },
    shortfall: expectedRow?.shortfall ?? null,
    trendPath: { actual: actualPoints.length >= 2 ? actualPoints : [], projection },
    trendSummary: buildTrendSummary(rows, formalIsUsable ? formalValue : null),
    legend: {
      historical: rows.some((r) => r.actual != null),
      range: rows.some((r) => r.range != null),
      base: rows.some((r) => r.range?.base != null),
      formal: formalIsUsable,
      covered: rows.some((r) => (r.column?.coveredHeightPct ?? 0) > 0),
      shortfall: rows.some((r) => r.shortfall != null),
      trend: actualPoints.length >= 2,
    },
  };
}

function buildShortfall(input: {
  point: number;
  low: number;
  high: number;
  formalValue: number;
  topPct: (v: number) => number;
}): GapShortfall {
  const { point, low, high, formalValue, topPct } = input;
  const bandTop = topPct(point);
  const bandBottom = topPct(formalValue);
  const heightPct = Math.max(0, bandBottom - bandTop);

  // The envelope whisker hangs from `high` down to `low`. Whatever part of the
  // shortfall band sits below the whisker's low cap is clear space the caption
  // can occupy without being crossed by the whisker.
  const clearTop = low > formalValue ? Math.min(topPct(low), bandBottom) : bandTop;
  const clearHeightPct = Math.max(0, bandBottom - clearTop);
  const labelFit: ShortfallLabelFit =
    clearHeightPct >= SHORTFALL_LABEL_FULL_PCT ? "full" : clearHeightPct >= SHORTFALL_LABEL_COMPACT_PCT ? "compact" : "none";
  // The caption's footprint is the CAPTION's height, centred in the clear
  // zone — not the whole clear zone. Using the zone would make a tall
  // shortfall band look like a tall obstacle to every other caption.
  const captionHeightPct =
    labelFit === "full" ? SHORTFALL_LABEL_FULL_PCT : labelFit === "compact" ? SHORTFALL_LABEL_COMPACT_PCT : 0;
  const labelHeightPct = Math.min(clearHeightPct, captionHeightPct);

  return {
    value: point - formalValue,
    lowValue: low - formalValue,
    highValue: high - formalValue,
    expectedPoint: point,
    formalValue,
    shareOfExpected: point > 0 ? (point - formalValue) / point : 0,
    topPct: bandTop,
    heightPct,
    labelFit,
    labelTopPct: clampPct(clearTop + (clearHeightPct - labelHeightPct) / 2),
    labelHeightPct,
  };
}

function buildTrendSummary(rows: GapChartRowModel[], formalValue: number | null): GapTrendSummary | null {
  const actuals = rows.filter((r): r is GapChartRowModel & { actual: number } => r.actual != null);
  if (actuals.length < 2) return null;
  const first = actuals[0]!;
  const last = actuals[actuals.length - 1]!;
  const totalDelta = last.actual - first.actual;
  const periods = actuals.length - 1;
  const cagr = first.actual > 0 ? Math.pow(last.actual / first.actual, 1 / periods) - 1 : 0;
  return {
    seasons: actuals.length,
    firstPeriod: first.period,
    firstActual: first.actual,
    lastPeriod: last.period,
    lastActual: last.actual,
    totalDelta,
    cagr,
    direction: Math.abs(totalDelta) < EPS ? "flat" : totalDelta > 0 ? "up" : "down",
    seasonsAboveFormal: formalValue == null ? 0 : actuals.filter((r) => r.actual > formalValue).length,
  };
}
