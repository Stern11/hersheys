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
