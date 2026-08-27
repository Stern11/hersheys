import type { HistoricalPeriod } from "@/types/planning";
import type { HistoricalBasisOverride } from "@/types/scenario";

export interface SeasonalForecastInput {
  historicalPeriods: HistoricalPeriod[]; // most-recent-first
  growthAssumption: number; // e.g. 0.08
  basis?: HistoricalBasisOverride;
  uncertaintyBandPct?: number; // default 0.04
}

export interface SeasonalForecastResult {
  base: number;
  low: number;
  high: number;
  seasonsUsed: string[]; // HistoricalPeriod ids actually included
  weighting: "equal" | "recent_weighted" | "custom";
}

/**
 * Seasonal / Event-Based Forecasting (PRD §7.2): a recent-weighted average
 * of comparable historical periods, adjusted by the current business growth
 * assumption, with a symmetric uncertainty band. Atypical periods are
 * excluded by default unless the planner explicitly includes them.
 */
export function seasonalForecast(input: SeasonalForecastInput): SeasonalForecastResult {
  const weighting = input.basis?.weighting ?? "recent_weighted";
  const seasons = input.basis?.seasonsOrYears;
  const excluded = new Set(input.basis?.excludedPeriodIds ?? []);
  const included = new Set(input.basis?.includedPeriodIds ?? []);

  let periods = input.historicalPeriods.filter((p) => !p.isAtypical || included.has(p.id));
  periods = periods.filter((p) => !excluded.has(p.id));
  if (seasons != null) periods = periods.slice(0, seasons);

  if (periods.length === 0) {
    return { base: 0, low: 0, high: 0, seasonsUsed: [], weighting };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  if (weighting === "equal") {
    periods.forEach((p) => {
      weightedSum += p.actualUnits;
      totalWeight += 1;
    });
  } else {
    // Recent-weighted: most recent period (index 0, since periods are
    // most-recent-first) carries the most weight, decaying linearly.
    const n = periods.length;
    periods.forEach((p, i) => {
      const weight = n - i;
      weightedSum += p.actualUnits * weight;
      totalWeight += weight;
    });
  }

  const historicalAverage = weightedSum / totalWeight;
  const base = historicalAverage * (1 + input.growthAssumption);
  const band = input.uncertaintyBandPct ?? 0.04;

  return {
    base: Math.round(base),
    low: Math.round(base * (1 - band)),
    high: Math.round(base * (1 + band)),
    seasonsUsed: periods.map((p) => p.id),
    weighting,
  };
}
