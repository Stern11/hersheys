import type { Scenario } from "@/types/scenario";
import type { CopilotSnapshot } from "./types";
import { calculateScenario } from "@/lib/planning-engine/scenarios";
import { buildScenarioInput, buildScenarioBaselineInput, buildOverrideComparisonInput, availableSeasonsForScenario, scenarioControlLimits } from "@/lib/planning-engine/scenario-limits";
import { buildOverrideBaseline, diffOverrides } from "@/lib/planning-engine/overrides";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { DEMO_NOW } from "@/data/synthetic/master-data";

let gapCache: ReturnType<typeof detectPlanningGaps> | null = null;
function detectedGaps() {
  return (gapCache ??= detectPlanningGaps());
}

/**
 * Assembles everything the copilot is allowed to talk about, for one
 * scenario, from the planning engine.
 *
 * Nothing is invented here and nothing is cached across edits: every call
 * re-runs `calculateScenario()` for both the scenario and its baseline, so an
 * answer composed from a snapshot is an answer composed from the numbers the
 * workspace is showing at that instant. That is the whole reason the copilot
 * can say "nothing moved" truthfully — it has the before and the after.
 *
 * The override diff is taken from the SAME expression the scenario store's
 * `overrideDiffs`/`overrideCount` use (`diffOverrides` against
 * `buildOverrideBaseline(buildOverrideComparisonInput(...))`), so the copilot
 * and the badge can never disagree about what counts as a change.
 */
export function buildCopilotSnapshot(scenario: Scenario): CopilotSnapshot {
  const input = buildScenarioInput(scenario, scenario.id, scenario.overrides);
  const result = calculateScenario(input);
  const baseline = calculateScenario(buildScenarioBaselineInput(scenario));

  const overrideDiffs = diffOverrides(scenario.overrides, buildOverrideBaseline(buildOverrideComparisonInput(scenario)));

  const observedRunRateByLine: Record<string, number> = {};
  input.observedRunRateByLine.forEach((v, k) => (observedRunRateByLine[k] = v));

  const materialNames: Record<string, string> = {};
  input.materialsById.forEach((m, id) => (materialNames[id] = m.name));

  const linked = detectedGaps().filter((g) => scenario.linkedGapIds.includes(g.gap.id));
  const primary = linked.find((g) => g.gap.id === input.gapId) ?? linked[0];

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: scenario.status,
    gapId: input.gapId,
    gapTitle: primary?.gap.title ?? input.gapId,
    linkedGapIds: scenario.linkedGapIds,
    result,
    baseline,
    overrideDiffs,
    overrideCount: overrideDiffs.length,
    availableSeasons: availableSeasonsForScenario(scenario),
    requestedSeasons: scenario.overrides.historicalBasis?.seasonsOrYears ?? null,
    lines: input.lines,
    observedRunRateByLine,
    materialNames,
    historicalPeriods: input.historicalPeriods.map((p) => ({
      id: p.id,
      label: p.periodLabel,
      year: /(\d{4})/.exec(p.periodLabel)?.[1] ?? /(\d{4})/.exec(p.start)?.[1] ?? "",
      isAtypical: p.isAtypical,
      atypicalReason: p.atypicalReason,
    })),
    analogueProductIds: (input.analogueCandidates ?? []).map((a) => a.candidateProductId),
    period: input.capacityBuckets[0]?.period ?? "",
    productionRequirementDate: input.productionRequirementDate,
    asOf: DEMO_NOW,
    limits: scenarioControlLimits(scenario),
    evidence: linked.flatMap((g) => g.evidence),
    isAnalogueBased: input.analogueCandidates != null,
  };
}
