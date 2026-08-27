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
  /**
   * How many comparable seasons SURVIVE the atypical/exclusion filters —
   * i.e. the largest lookback this basis can honor. A UI showing "Scenario 53
   * seasons" while this reads 3 is lying about the model.
   */
  seasonsAvailable: number;
  /** The lookback the scenario asked for; undefined means "everything available". */
  seasonsRequested?: number;
  /**
   * False when nothing survived the filters. The 0/0/0 figures returned in
   * that case are an ABSENCE of a forecast, not a forecast of zero, and every
   * surface must branch on this rather than rendering "0–0 units".
   */
  sufficient: boolean;
  /** Planner-readable reasons the basis is insufficient or degraded. */
  issues: string[];
}

/**
 * The comparable seasons a basis can actually read: atypical periods are out
 * unless explicitly re-included, and explicitly excluded periods are out
 * regardless. This runs BEFORE the lookback window, so it is also the ceiling
 * for a legal lookback (see validation.ts::historicalLookbackRange).
 */
export function eligibleHistoricalPeriods(periods: HistoricalPeriod[], basis?: HistoricalBasisOverride): HistoricalPeriod[] {
  const excluded = new Set(basis?.excludedPeriodIds ?? []);
  const included = new Set(basis?.includedPeriodIds ?? []);
  return periods.filter((p) => (!p.isAtypical || included.has(p.id)) && !excluded.has(p.id));
}

/** Count of comparable seasons the current basis can read. */
export function availableSeasonCount(periods: HistoricalPeriod[], basis?: HistoricalBasisOverride): number {
  return eligibleHistoricalPeriods(periods, basis).length;
}

/**
 * Seasonal / Event-Based Forecasting (PRD §7.2): a recent-weighted average
 * of comparable historical periods, adjusted by the current business growth
 * assumption, with a symmetric uncertainty band. Atypical periods are
 * excluded by default unless the planner explicitly includes them.
 *
 * A lookback longer than the eligible set is NOT an error here — it simply
 * cannot be honored, and the result says so via `seasonsAvailable` /
 * `seasonsRequested` / `issues`. The store clamps at the boundary so the
 * stored assumption matches the applied one; this is the second line of
 * defense for any caller that bypasses the store.
 */
export function seasonalForecast(input: SeasonalForecastInput): SeasonalForecastResult {
  const weighting = input.basis?.weighting ?? "recent_weighted";
  const seasonsRequested = input.basis?.seasonsOrYears;
  const issues: string[] = [];

  const eligible = eligibleHistoricalPeriods(input.historicalPeriods, input.basis);
  const seasonsAvailable = eligible.length;

  let periods = eligible;
  if (seasonsRequested != null) {
    const window = Math.max(1, Math.floor(seasonsRequested));
    if (window > seasonsAvailable) {
      issues.push(`Lookback of ${seasonsRequested} season${seasonsRequested === 1 ? "" : "s"} exceeds the ${seasonsAvailable} comparable season${seasonsAvailable === 1 ? "" : "s"} available — the forecast read ${seasonsAvailable}.`);
    }
    periods = periods.slice(0, window);
  }

  if (periods.length === 0) {
    issues.push(
      input.historicalPeriods.length === 0
        ? "No comparable historical seasons exist for this event."
        : "Every comparable season is excluded from the basis, so there is nothing to forecast from."
    );
    return { base: 0, low: 0, high: 0, seasonsUsed: [], weighting, seasonsAvailable, seasonsRequested, sufficient: false, issues };
  }

  if (periods.length === 1) {
    issues.push("Only one comparable season is in the basis — the uncertainty band understates the real spread.");
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
    seasonsAvailable,
    seasonsRequested,
    sufficient: true,
    issues,
  };
}
