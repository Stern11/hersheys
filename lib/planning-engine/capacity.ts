import type { CapacityBucket, ProductionLine } from "@/types/planning";
import type { CapacityOverride, MasterAssumptionOverride } from "@/types/scenario";
import type { CapacityImpactByLine } from "@/types/scenario";
import { TARGET_UTILIZATION_RANGE, clampToRange } from "./validation";

export interface RccpInput {
  bucket: CapacityBucket;
  line: ProductionLine;
  /** This scenario's unresolved-demand units attributable to this line/period (already allocated). */
  aiInferredUnresolvedUnits: number;
  capacityOverride?: CapacityOverride;
  runRateOverride?: MasterAssumptionOverride;
  observedMedianRunRate: number;
}

export type RunRateBasis = "system" | "historical" | "scenario";

export interface RunRateResolution {
  /** The rate the RCCP conversion actually divides by. Always > 0. */
  unitsPerHour: number;
  /** The basis the planner selected (or "system" when they selected nothing). */
  basis: RunRateBasis;
  /** Which stored field produced `unitsPerHour` — the answer to "why is this number here?". */
  source: "scenario_value" | "observed_median" | "line_period_rate" | "line_standard";
}

export interface ResolveRunRateInput {
  line: ProductionLine;
  /** `overrides.masterAssumptions["line:{lineId}:run_rate"]` — the ONE place a scenario run rate lives. */
  runRateOverride?: MasterAssumptionOverride;
  /** `overrides.capacity["{lineId}:{period}"]` — a bucket-specific rate carrying no basis selection. */
  capacityOverride?: CapacityOverride;
  observedMedianRunRate: number;
}

/**
 * THE single reader for "what run rate is this scenario using on this line?".
 *
 * There used to be two writable fields for one number:
 * `masterAssumptions["line:X:run_rate"].scenarioValue` (written by the basis
 * selector) and `capacity["X:period"].runRateUnitsPerHour` (written by the
 * custom-rate input). The custom-rate input is only VISIBLE when the basis is
 * "scenario", and the `runRateUnitsPerHour` branch below is only REACHABLE
 * when the basis is not "scenario" — so every keystroke in that input landed
 * in a field nothing read while it was on screen, and utilization never
 * moved. `stores/scenario-store.ts::setRunRate` now routes the custom rate
 * into `scenarioValue`; this function is the one reader, so the two fields
 * cannot drift apart again.
 *
 * Precedence:
 *   1. basis "scenario" with a finite positive `scenarioValue` → that value.
 *   2. basis "historical" → the observed median from execution history.
 *   3. a bucket-level `runRateUnitsPerHour` (period-specific rate, no basis).
 *   4. the line's system standard rate.
 *
 * Note case 1's guard: selecting "scenario" WITHOUT supplying a value must
 * not be read as zero (which would produce Infinity load hours) — it falls
 * through to the standard rate until a value is supplied.
 */
export function resolveRunRate(input: ResolveRunRateInput): RunRateResolution {
  const basis: RunRateBasis = input.runRateOverride?.selectedBasis ?? "system";
  const scenarioValue = input.runRateOverride?.scenarioValue;

  if (basis === "scenario" && scenarioValue != null && Number.isFinite(scenarioValue) && scenarioValue > 0) {
    return { unitsPerHour: scenarioValue, basis, source: "scenario_value" };
  }
  if (basis === "historical" && input.observedMedianRunRate > 0) {
    return { unitsPerHour: input.observedMedianRunRate, basis, source: "observed_median" };
  }
  const bucketRate = input.capacityOverride?.runRateUnitsPerHour;
  if (bucketRate != null && Number.isFinite(bucketRate) && bucketRate > 0) {
    return { unitsPerHour: bucketRate, basis, source: "line_period_rate" };
  }
  return { unitsPerHour: input.line.standardRunRateUnitsPerHour, basis, source: "line_standard" };
}

/**
 * Rough-Cut Capacity Planning (PRD §7.4): volume ÷ run rate = required
 * production hours, compared against available hours and target headroom.
 * "Effective" utilization is formal + already-validated unresolved + this
 * scenario's AI-inferred unresolved + any planner-chosen prebuild — never
 * silently folded into a single opaque number. `additionalShiftHours`
 * widens the ceiling (added capacity); `prebuildQuantityUnits` adds load
 * (a planner choosing to build inventory now).
 *
 * `targetUtilization` is an ALERT THRESHOLD, not a load lever: by design it
 * never appears in the effective-utilization arithmetic, only in `riskLevel`
 * (and the chart's ceiling marker). It is clamped to 0–100% here as well as
 * at the store boundary, because a threshold outside that band can never be
 * crossed meaningfully and makes `riskLevel` unreadable.
 */
export function rccp(input: RccpInput): CapacityImpactByLine {
  const { bucket, capacityOverride } = input;

  const runRate = resolveRunRate({
    line: input.line,
    runRateOverride: input.runRateOverride,
    capacityOverride,
    observedMedianRunRate: input.observedMedianRunRate,
  });

  const baseCeilingHours = capacityOverride?.availableHours ?? bucket.availableHours - bucket.plannedDowntimeHours;
  const ceilingHours = baseCeilingHours + (capacityOverride?.additionalShiftHours ?? 0);
  const targetUtilization = clampToRange(capacityOverride?.targetUtilization ?? bucket.targetUtilization, TARGET_UTILIZATION_RANGE).value;

  const aiInferredLoadHours = input.aiInferredUnresolvedUnits / runRate.unitsPerHour;
  const prebuildLoadHours = capacityOverride?.prebuildQuantityUnits != null ? capacityOverride.prebuildQuantityUnits / runRate.unitsPerHour : 0;

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
    runRateUnitsPerHour: runRate.unitsPerHour,
    runRateBasis: runRate.basis,
    runRateSource: runRate.source,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
