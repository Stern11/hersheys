import type { HistoricalPeriod } from "@/types/planning";
import type { Scenario, ScenarioOverrides } from "@/types/scenario";
import type { CalculateScenarioInput } from "./scenarios";
import { buildHalloweenScenarioInput, buildValentinesScenarioInput, detectPlanningGaps } from "./gaps";
import { historicalPeriodsForEvent } from "@/data/synthetic/historical-demand";
import { availableSeasonCount } from "./seasonality";
import {
  GROWTH_RATE_RANGE,
  RUN_RATE_RANGE,
  SEASONAL_UPLIFT_RANGE,
  TARGET_UTILIZATION_RANGE,
  historicalLookbackRange,
  type NumericRange,
} from "./validation";

/**
 * Which `calculateScenario` input a saved scenario runs on. This dispatch
 * used to live privately inside `scenario-lab-view.tsx`, which meant the
 * STORE could not tell how many comparable seasons a scenario's basis had —
 * and therefore could not clamp a lookback to something the engine would
 * actually honor. It belongs next to the engine.
 */
export function buildScenarioInput(scenario: Scenario, scenarioId: string, overrides: ScenarioOverrides): CalculateScenarioInput {
  return scenario.linkedGapIds.includes("valentines-premium-tin") ? buildValentinesScenarioInput(scenarioId, overrides) : buildHalloweenScenarioInput(scenarioId, overrides);
}

/** The unmodified baseline input for a scenario — what `calculateScenario` runs to produce the baseline result. */
export function buildScenarioBaselineInput(scenario: Scenario): CalculateScenarioInput {
  return buildScenarioInput(scenario, "baseline", {});
}

/**
 * The baseline that OVERRIDES are counted against.
 *
 * Identical to `buildScenarioBaselineInput` except for one thing: it passes an
 * empty `analogues` override so the gap builder attaches its analogue
 * candidates. With no analogue key at all, a gap builder legitimately omits
 * the candidate list (it uses the hand-resolved BOM instead) — and a baseline
 * with no candidates cannot tell whether a planner's analogue weight is a
 * change or the default. This is only ever used for COMPARISON, never to
 * compute a displayed baseline number, so it cannot move the baseline result.
 */
export function buildOverrideComparisonInput(scenario: Scenario): CalculateScenarioInput {
  return buildScenarioInput(scenario, "baseline", { analogues: {} });
}

let gapCache: ReturnType<typeof detectPlanningGaps> | null = null;
function detectedGaps() {
  return (gapCache ??= detectPlanningGaps());
}

/**
 * The comparable historical seasons behind a scenario, resolved through the
 * gap it is linked to rather than a second hard-coded gap→event table that
 * could drift away from gaps.ts.
 */
export function historicalPeriodsForScenario(scenario: Scenario): HistoricalPeriod[] {
  const match = detectedGaps().find((r) => scenario.linkedGapIds.includes(r.gap.id) && r.gap.eventId);
  return match?.gap.eventId ? historicalPeriodsForEvent(match.gap.eventId) : [];
}

/**
 * How many comparable seasons a scenario's basis can actually read, AFTER its
 * own exclusions/inclusions. This is the ceiling on a legal lookback: asking
 * for 53 when this returns 3 is not a scenario, it is a typo, and storing 53
 * would make the label disagree with the model.
 */
export function availableSeasonsForScenario(scenario: Scenario, overrides?: ScenarioOverrides): number {
  const basis = (overrides ?? scenario.overrides).historicalBasis;
  return availableSeasonCount(historicalPeriodsForScenario(scenario), basis);
}

export interface ScenarioControlLimits {
  historicalLookback: NumericRange;
  growthRatePct: NumericRange;
  seasonalUpliftPct: NumericRange;
  runRateUnitsPerHour: NumericRange;
  targetUtilization: NumericRange;
}

/**
 * The legal range for every numeric Scenario Lab control, so the UI can SHOW
 * the bounds next to the input instead of leaving the planner to discover
 * them by having a value silently ignored.
 */
export function scenarioControlLimits(scenario: Scenario, overrides?: ScenarioOverrides): ScenarioControlLimits {
  return {
    historicalLookback: historicalLookbackRange(availableSeasonsForScenario(scenario, overrides)),
    growthRatePct: GROWTH_RATE_RANGE,
    seasonalUpliftPct: SEASONAL_UPLIFT_RANGE,
    runRateUnitsPerHour: RUN_RATE_RANGE,
    targetUtilization: TARGET_UTILIZATION_RANGE,
  };
}
