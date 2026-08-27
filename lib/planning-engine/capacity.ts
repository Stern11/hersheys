import type { CapacityBucket, ProductionLine } from "@/types/planning";
import type { CapacityOverride, MasterAssumptionOverride } from "@/types/scenario";
import type { CapacityImpactByLine } from "@/types/scenario";

export interface RccpInput {
  bucket: CapacityBucket;
  line: ProductionLine;
  /** This scenario's unresolved-demand units attributable to this line/period (already allocated). */
  aiInferredUnresolvedUnits: number;
  capacityOverride?: CapacityOverride;
  runRateOverride?: MasterAssumptionOverride;
  observedMedianRunRate: number;
}

/**
 * Rough-Cut Capacity Planning (PRD §7.4): volume ÷ run rate = required
 * production hours, compared against available hours and target headroom.
 * "Effective" utilization is formal + already-validated unresolved + this
 * scenario's AI-inferred unresolved + any planner-chosen prebuild — never
 * silently folded into a single opaque number. `additionalShiftHours`
 * widens the ceiling (added capacity); `prebuildQuantityUnits` adds load
 * (a planner choosing to build inventory now).
 */
export function rccp(input: RccpInput): CapacityImpactByLine {
  const { bucket, capacityOverride, runRateOverride } = input;

  const runRate =
    runRateOverride?.selectedBasis === "scenario" && runRateOverride.scenarioValue != null
      ? runRateOverride.scenarioValue
      : runRateOverride?.selectedBasis === "historical"
        ? input.observedMedianRunRate
        : (capacityOverride?.runRateUnitsPerHour ?? input.line.standardRunRateUnitsPerHour);

  const baseCeilingHours = capacityOverride?.availableHours ?? bucket.availableHours - bucket.plannedDowntimeHours;
  const ceilingHours = baseCeilingHours + (capacityOverride?.additionalShiftHours ?? 0);
  const targetUtilization = capacityOverride?.targetUtilization ?? bucket.targetUtilization;

  const aiInferredLoadHours = runRate > 0 ? input.aiInferredUnresolvedUnits / runRate : 0;
  const prebuildLoadHours = capacityOverride?.prebuildQuantityUnits != null && runRate > 0 ? capacityOverride.prebuildQuantityUnits / runRate : 0;

  const formalLoadHours = bucket.formalLoadHours;
  const validatedUnresolvedLoadHours = bucket.validatedUnresolvedLoadHours;
  const totalLoadHours = formalLoadHours + validatedUnresolvedLoadHours + aiInferredLoadHours + prebuildLoadHours;

  const formalUtilization = baseCeilingHours > 0 ? formalLoadHours / baseCeilingHours : 0;
  const effectiveUtilization = ceilingHours > 0 ? totalLoadHours / ceilingHours : 0;

  const p50Utilization = effectiveUtilization;
  const p80Utilization = ceilingHours > 0 ? (totalLoadHours * 1.06) / ceilingHours : 0;

  const riskLevel: CapacityImpactByLine["riskLevel"] =
    effectiveUtilization > 1 ? "critical" : effectiveUtilization > targetUtilization ? "warning" : "positive";

  return {
    lineId: input.line.id,
    period: bucket.period,
    ceilingHours: round1(ceilingHours),
    targetUtilization,
    formalLoadHours,
    validatedUnresolvedLoadHours,
    aiInferredLoadHours: round1(aiInferredLoadHours),
    scenarioAdjustmentHours: round1(prebuildLoadHours),
    formalUtilization: round3(formalUtilization),
    effectiveUtilization: round3(effectiveUtilization),
    p50Utilization: round3(p50Utilization),
    p80Utilization: round3(p80Utilization),
    riskLevel,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
