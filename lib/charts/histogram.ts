import { type AxisScale, linearAxis, niceTicksWithin, pctWithin } from "./axis";

/**
 * Pure geometry for the lead-time distribution chart.
 *
 * The previous version had no axes at all: bars were flex children with no
 * count scale, and reference markers were positioned by a raw percentage with
 * a label whose CSS mixed `position: relative` with `left: 50%`, so a marker
 * at the extreme of the domain pushed its own text outside the plot box. None
 * of that throws — it just renders wrong — so the geometry lives here and is
 * asserted in `histogram.test.ts`.
 */

export interface HistogramBucket {
  from: number;
  to: number;
  count: number;
}

export interface HistogramMarkerInput {
  label: string;
  value: number;
  /** Planning-STATE token (`--state-*`). */
  token: string;
}

export interface HistogramMarkerModel extends HistogramMarkerInput {
  pct: number;
}

export interface HistogramModel {
  min: number;
  max: number;
  buckets: HistogramBucket[];
  /** Count axis (y). Integer ticks — fractional receipts do not exist. */
  countAxis: AxisScale;
  /** Value-axis (x) ticks, in domain units, inside [min, max]. */
  valueTicks: number[];
  markers: HistogramMarkerModel[];
  sampleCount: number;
}

/**
 * Domain spans the observed values AND every marker, so a reference line that
 * sits outside the sample (e.g. a system assumption well below every actual
 * receipt) is still drawn on-chart instead of clamped onto the edge.
 */
export function histogramDomain(values: number[], markers: { value: number }[]): { min: number; max: number } {
  const all = [...values, ...markers.map((m) => m.value)].filter(Number.isFinite);
  if (all.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...all);
  const max = Math.max(...all);
  return max > min ? { min, max } : { min, max: min + 1 };
}

/**
 * Equal-width buckets across [min, max]. The maximum value lands in the LAST
 * bucket rather than falling off the end (`Math.floor` on an exact boundary
 * would otherwise index one past the array).
 */
export function histogramBuckets(values: number[], bucketCount: number, min: number, max: number): HistogramBucket[] {
  const count = Math.max(1, Math.round(bucketCount));
  const size = (max - min) / count || 1;
  const buckets: HistogramBucket[] = Array.from({ length: count }, (_, i) => ({
    from: min + i * size,
    to: min + (i + 1) * size,
    count: 0,
  }));
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const raw = Math.floor((v - min) / size);
    const idx = Math.min(count - 1, Math.max(0, raw));
    const bucket = buckets[idx];
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

export function buildHistogramModel(
  values: number[],
  markers: HistogramMarkerInput[],
  bucketCount = 14
): HistogramModel {
  const { min, max } = histogramDomain(values, markers);
  const buckets = histogramBuckets(values, bucketCount, min, max);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  return {
    min,
    max,
    buckets,
    countAxis: linearAxis(maxCount, 3, true),
    valueTicks: niceTicksWithin(min, max, 5, true),
    markers: markers.map((m) => ({ ...m, pct: pctWithin(m.value, min, max) })),
    sampleCount: values.filter(Number.isFinite).length,
  };
}

/* ---------------------------------------------------------------------- *
 * Lead-time basis markers — punch item 13.
 * ---------------------------------------------------------------------- */

export interface LeadTimeMarkerSet {
  markers: HistogramMarkerInput[];
  /** The caption, listing ONLY the bases actually drawn. */
  caption: string;
}

/**
 * The reference lines overlaid on the lead-time distribution, plus the
 * caption that names them.
 *
 * The audit found the caption promising "System / Historical / Scenario
 * overlaid" on a chart that only ever drew System, Median and P80: there is
 * no scenario marker to draw until a planner actually enters a scenario lead
 * time, so the caption named a line that could not exist. Nothing errored —
 * the planner just looked for a third basis that was never there.
 *
 * So the caption is DERIVED from the marker list rather than written beside
 * it. A scenario marker appears only when `scenarioDays` is a real, finite,
 * positive override, and the caption gains "Scenario" at exactly the same
 * moment. The two cannot disagree because they are the same list.
 */
export function leadTimeBasisMarkers(args: { systemDays: number; medianDays: number; p80Days: number; scenarioDays?: number | null }): LeadTimeMarkerSet {
  const markers: HistogramMarkerInput[] = [
    { label: "System", value: args.systemDays, token: "--state-formal" },
    { label: "Median", value: args.medianDays, token: "--state-historical" },
    { label: "P80", value: args.p80Days, token: "--state-inferred" },
  ];
  const scenario = args.scenarioDays;
  if (scenario != null && Number.isFinite(scenario) && scenario > 0) {
    markers.push({ label: "Scenario", value: scenario, token: "--state-scenario" });
  }
  return {
    markers,
    caption: `Every non-outlier receipt in the sample, with ${markers.map((m) => m.label).join(" / ")} overlaid`,
  };
}
