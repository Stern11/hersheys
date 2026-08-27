/**
 * Colour banding for the multi-line capacity heatmap.
 *
 * The thresholds were hard-coded inside the component (`> 1`, `> 0.9`) with
 * no key rendered anywhere, so the colour encoding was undocumented on screen
 * AND the 0.9 boundary silently ignored a bucket's real `targetUtilization`.
 * Banding is a planning judgement, so it lives here and is unit-tested.
 *
 * Utilization risk is STATUS, so it maps to `--risk-*` tokens. It must never
 * borrow a `--state-*` data-series token.
 */

export type UtilizationBand = "positive" | "warning" | "critical";

export const DEFAULT_TARGET_UTILIZATION = 0.9;

/** Over ceiling -> critical; over the target headroom -> warning; else positive. */
export function utilizationBand(value: number, target = DEFAULT_TARGET_UTILIZATION): UtilizationBand {
  if (!Number.isFinite(value)) return "positive";
  if (value > 1) return "critical";
  if (value > target) return "warning";
  return "positive";
}

export function bandBg(band: UtilizationBand): string {
  return `var(--risk-${band}-soft)`;
}

export function bandFg(band: UtilizationBand): string {
  return `var(--risk-${band})`;
}

export interface HeatmapLegendEntry {
  band: UtilizationBand;
  label: string;
}

/** Legend copy states the ACTUAL thresholds in use, derived from `target`. */
export function heatmapLegend(target = DEFAULT_TARGET_UTILIZATION): HeatmapLegendEntry[] {
  const t = Math.round(target * 100);
  return [
    { band: "positive", label: `At or under target (≤ ${t}%)` },
    { band: "warning", label: `Over target, under ceiling (${t}–100%)` },
    { band: "critical", label: "Over ceiling (> 100%)" },
  ];
}
