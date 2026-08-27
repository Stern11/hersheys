import type { Material, MaterialReadiness } from "@/types/planning";
import type { MasterAssumptionOverride } from "@/types/scenario";

/**
 * Resolves which lead time to use for a material given System / Historical /
 * Scenario basis (PRD §18) plus the observed P80 computed from raw execution
 * records (data/synthetic/execution-history.ts).
 */
export function resolveLeadTimeDays(material: Material, observedP80: number, override?: MasterAssumptionOverride): number {
  if (override?.selectedBasis === "scenario" && override.scenarioValue != null) {
    return override.scenarioValue;
  }
  if (override?.selectedBasis === "historical") {
    if (override.leadTimeStatistic === "p80") return observedP80;
    return material.historicalMedianLeadTimeDays;
  }
  return material.systemLeadTimeDays;
}

/**
 * WHICH basis resolveLeadTimeDays() just used. Kept as a sibling of that
 * function, and exhaustively paired with it in the tests, because the two
 * drifting apart is exactly the cross-page contradiction this fixes: the
 * BOM explosion hard-coded the basis label to "system" while the resolved
 * number was the accepted historical P80, so the Halloween workspace
 * reported "74d (system)" for Printed Seasonal Film while the lead-time
 * workspace reported the accepted P80 basis for the same 74 days.
 */
export function resolveLeadTimeBasis(override?: MasterAssumptionOverride): MaterialReadiness["leadTimeBasis"] {
  if (override?.selectedBasis === "scenario" && override.scenarioValue != null) return "scenario";
  if (override?.selectedBasis === "historical") return override.leadTimeStatistic === "p80" ? "historical_p80" : "historical_median";
  return "system";
}

/** Production requirement date - lead time = decision/order-by date. */
export function decisionDeadlineFromLeadTime(productionRequirementDate: string, leadTimeDays: number): string {
  const d = new Date(productionRequirementDate);
  d.setUTCDate(d.getUTCDate() - leadTimeDays);
  return d.toISOString().slice(0, 10);
}

export function weeksBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.round(((to - from) / (7 * 86_400_000)) * 10) / 10;
}
