import type { DemandOverride } from "@/types/scenario";
import type { SeasonalForecastResult } from "./seasonality";

export interface BusinessToPlanReconciliationResult {
  representedAmount: number;
  unresolvedAmount: number;
  unexplainedVarianceAmount: number;
  completenessRatio: number; // represented / (represented + unresolved), clamped to [0,1]
}

/**
 * Business-to-Plan Reconciliation (PRD §7.1): compares the formally
 * represented amount against the expected amount and reports what is still
 * unresolved. `unexplainedVarianceAmount` differs from `unresolvedAmount`
 * only when the formal plan actually exceeds the expected base (over-plan),
 * in which case the "unresolved" figure floors at zero rather than going
 * negative.
 */
export function businessToPlanReconciliation(formalValue: number, expectedBase: number): BusinessToPlanReconciliationResult {
  const unresolvedAmount = Math.max(0, expectedBase - formalValue);
  const unexplainedVarianceAmount = expectedBase - formalValue;
  const completenessRatio = expectedBase > 0 ? Math.min(1, formalValue / expectedBase) : 1;
  return { representedAmount: formalValue, unresolvedAmount, unexplainedVarianceAmount, completenessRatio };
}

export interface ExpectedDemandRange {
  low: number;
  base: number;
  high: number;
}

/**
 * Applies a scenario's demand controls on top of a seasonal-forecast result.
 * A planner-set baselineDemandUnits/seasonalUpliftPct/growthRatePct override
 * shifts the whole envelope; percentileSelection then picks which point of
 * that envelope downstream calculations should treat as "expected".
 */
export function applyDemandOverride(forecast: SeasonalForecastResult, override?: DemandOverride): ExpectedDemandRange {
  let { low, base, high } = forecast;

  if (override?.baselineDemandUnits != null) {
    const shift = override.baselineDemandUnits / base;
    low *= shift;
    base = override.baselineDemandUnits;
    high *= shift;
  }
  if (override?.seasonalUpliftPct != null) {
    const factor = 1 + override.seasonalUpliftPct;
    low *= factor;
    base *= factor;
    high *= factor;
  }
  if (override?.growthRatePct != null) {
    const factor = 1 + override.growthRatePct;
    low *= factor;
    base *= factor;
    high *= factor;
  }

  return { low: Math.round(low), base: Math.round(base), high: Math.round(high) };
}

export function selectedDemandPoint(range: ExpectedDemandRange, selection?: DemandOverride["percentileSelection"]): number {
  switch (selection) {
    case "low":
      return range.low;
    case "high":
      return range.high;
    case "p80":
      // Interpolate: base is treated as ~p50, high as ~p95 for display purposes.
      return Math.round(range.base + (range.high - range.base) * 0.65);
    case "p95":
      return range.high;
    case "p50":
    case "base":
    default:
      return range.base;
  }
}
