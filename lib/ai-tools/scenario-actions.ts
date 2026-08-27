import { z } from "zod";
import { useScenarioStore } from "@/stores/scenario-store";
import type { AIToolDefinition } from "@/types/ai";

/**
 * Every tool here calls the EXACT SAME Zustand actions a click in the UI
 * would call (useScenarioStore.getState().<action>) — there is no separate
 * "AI path" through the planning engine. This is what makes "AI operates
 * the application" true rather than a chat layer that merely describes
 * changes (PRD §5.1).
 */
export function createScenarioTools(): AIToolDefinition<any, any>[] {
  const store = () => useScenarioStore.getState();

  return [
    {
      name: "setHistoricalLookback",
      description: "Set how many comparable historical seasons/years feed the forecast for a scenario. Returns the value that was ACTUALLY applied: a lookback longer than the number of comparable seasons available is clamped, and `clamped`/`reason` say so — never report success for a request the engine could not honor.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), seasonsOrYears: z.number() }),
      execute: ({ scenarioId, seasonsOrYears }: { scenarioId: string; seasonsOrYears: number }) => store().setHistoricalLookback(scenarioId, seasonsOrYears),
    },
    {
      name: "excludeHistoricalPeriod",
      description: "Exclude a specific historical period (e.g. a disrupted year) from the forecast basis.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), periodId: z.string() }),
      execute: ({ scenarioId, periodId }: { scenarioId: string; periodId: string }) => store().excludeHistoricalPeriod(scenarioId, periodId),
    },
    {
      name: "includeHistoricalPeriod",
      description: "Include a historical period that would otherwise be excluded (e.g. an atypical year) in the forecast basis.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), periodId: z.string() }),
      execute: ({ scenarioId, periodId }: { scenarioId: string; periodId: string }) => store().includeHistoricalPeriod(scenarioId, periodId),
    },
    {
      name: "setSeasonalUplift",
      description: "Apply a seasonal uplift on top of the forecast base (fraction; clamped to -0.5..0.5). Returns the applied value plus `clamped`/`noop`.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), pct: z.number() }),
      execute: ({ scenarioId, pct }: { scenarioId: string; pct: number }) => store().setSeasonalUplift(scenarioId, pct),
    },
    {
      name: "setGrowthAssumption",
      description: "Override the business growth assumption applied to the forecast (fraction, e.g. 0.08 = +8%; clamped to -0.5..0.5). Returns the applied value plus `clamped`/`noop`.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), pct: z.number() }),
      execute: ({ scenarioId, pct }: { scenarioId: string; pct: number }) => store().setGrowthAssumption(scenarioId, pct),
    },
    {
      name: "setAnalogues",
      description: "Set the weight for one or more analogue products used to derive demand/BOM for an unresolved product.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), weights: z.record(z.string(), z.number().min(0).max(1)) }),
      execute: ({ scenarioId, weights }: { scenarioId: string; weights: Record<string, number> }) => {
        Object.entries(weights).forEach(([productId, weight]) => store().setAnalogueWeight(scenarioId, productId, weight));
      },
    },
    {
      name: "setAnalogueWeight",
      description: "Set the weight of a single analogue product.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), analogueProductId: z.string(), weight: z.number() }),
      execute: ({ scenarioId, analogueProductId, weight }: { scenarioId: string; analogueProductId: string; weight: number }) => store().setAnalogueWeight(scenarioId, analogueProductId, weight),
    },
    {
      name: "includeBomComponent",
      description: "Include a BOM component in the provisional plan.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), bomComponentId: z.string() }),
      execute: ({ scenarioId, bomComponentId }: { scenarioId: string; bomComponentId: string }) => store().includeBomComponent(scenarioId, bomComponentId),
    },
    {
      name: "excludeBomComponent",
      description: "Exclude a BOM component from the provisional plan (e.g. packaging that isn't ready to plan yet).",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), bomComponentId: z.string() }),
      execute: ({ scenarioId, bomComponentId }: { scenarioId: string; bomComponentId: string }) => store().excludeBomComponent(scenarioId, bomComponentId),
    },
    {
      name: "setLeadTime",
      description: "Set a specific scenario lead-time value (days, 1-365) for a material, overriding both system and historical. Returns the applied value plus `clamped`/`noop`.",
      category: "scenario",
      // Out-of-range values are CLAMPED by the store and reported, not rejected
      // here with an opaque schema error - the planner gets told what was applied.
      parametersSchema: z.object({ scenarioId: z.string(), materialId: z.string(), days: z.number() }),
      execute: ({ scenarioId, materialId, days }: { scenarioId: string; materialId: string; days: number }) => store().setLeadTime(scenarioId, materialId, days),
    },
    {
      name: "setLeadTimeBasis",
      description: "Switch which basis (system assumption, historical median/P80, or scenario value) a material's lead time should use.",
      category: "scenario",
      parametersSchema: z.object({
        scenarioId: z.string(),
        materialId: z.string(),
        basis: z.enum(["system", "historical", "scenario"]),
        statistic: z.enum(["median", "p80", "custom"]).optional(),
      }),
      execute: ({ scenarioId, materialId, basis, statistic }: { scenarioId: string; materialId: string; basis: "system" | "historical" | "scenario"; statistic?: "median" | "p80" | "custom" }) =>
        store().setLeadTimeBasis(scenarioId, materialId, basis, statistic),
    },
    {
      name: "setRunRate",
      description: "Set a line's scenario run rate in units/hour (100-100,000). This is the ONE writer for a scenario run rate: it stores masterAssumptions['line:{lineId}:run_rate'].scenarioValue and switches that line to the scenario basis, which is the field the RCCP conversion reads. Returns the applied value plus `clamped`/`noop` - `noop: true` means the rate already held this value and NOTHING changed, so do not report a change.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), lineId: z.string(), period: z.string(), unitsPerHour: z.number() }),
      execute: ({ scenarioId, lineId, period, unitsPerHour }: { scenarioId: string; lineId: string; period: string; unitsPerHour: number }) => store().setRunRate(scenarioId, lineId, period, unitsPerHour),
    },
    {
      name: "setLineAllocation",
      description: "Set the share of a gap's unresolved demand allocated to a specific line/period.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), lineId: z.string(), period: z.string(), share: z.number() }),
      execute: ({ scenarioId, lineId, period, share }: { scenarioId: string; lineId: string; period: string; share: number }) => store().setLineAllocation(scenarioId, lineId, period, share),
    },
    {
      name: "setTargetUtilization",
      description: "Set the utilization ALERT THRESHOLD for a line/period, as a fraction 0-1. It changes risk classification and the chart ceiling marker only - by design it does NOT change modeled load or effective utilization, so never claim it lowered utilization. Returns the applied value plus `clamped`/`noop`.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), lineId: z.string(), period: z.string(), pct: z.number() }),
      execute: ({ scenarioId, lineId, period, pct }: { scenarioId: string; lineId: string; period: string; pct: number }) => store().setTargetUtilization(scenarioId, lineId, period, pct),
    },
    {
      name: "shiftProduction",
      description: "Pull production forward (negative weeks) or push it later (positive weeks) for a line/period.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), lineId: z.string(), period: z.string(), weeks: z.number() }),
      execute: ({ scenarioId, lineId, period, weeks }: { scenarioId: string; lineId: string; period: string; weeks: number }) => store().setProductionWindowShift(scenarioId, lineId, period, weeks),
    },
    {
      name: "setPrebuildQuantity",
      description: "Set how many units to prebuild ahead of peak demand for a line/period.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), lineId: z.string(), period: z.string(), units: z.number().nonnegative() }),
      execute: ({ scenarioId, lineId, period, units }: { scenarioId: string; lineId: string; period: string; units: number }) => store().setPrebuildQuantity(scenarioId, lineId, period, units),
    },
    {
      name: "createScenario",
      description: "Create a new draft scenario, optionally linked to a Planning Gap.",
      category: "scenario",
      parametersSchema: z.object({ name: z.string(), gapId: z.string().optional() }),
      execute: ({ name, gapId }: { name: string; gapId?: string }) => store().createScenario(name, gapId),
    },
    {
      name: "duplicateScenario",
      description: "Clone an existing scenario as a new draft.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string(), newName: z.string().optional() }),
      execute: ({ scenarioId, newName }: { scenarioId: string; newName?: string }) => store().duplicateScenario(scenarioId, newName),
    },
    {
      name: "compareScenarios",
      description: "Add a scenario to the active side-by-side comparison (up to 4).",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string() }),
      execute: ({ scenarioId }: { scenarioId: string }) => store().addComparisonScenario(scenarioId),
    },
    {
      name: "resetScenario",
      description: "Reset a scenario back to the baseline (clears every override).",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string() }),
      execute: ({ scenarioId }: { scenarioId: string }) => store().resetScenario(scenarioId),
    },
    {
      name: "saveScenario",
      description: "Save the scenario. A draft becomes 'saved'; an already validated/preferred scenario keeps its standing rather than being demoted. The change is durable across navigation. Returns the resulting status.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string() }),
      execute: ({ scenarioId }: { scenarioId: string }) => store().saveScenario(scenarioId),
    },
    {
      /**
       * A READ tool, deliberately. Without it the copilot could only report
       * what it INTENDED to do — which is how "what if I use 5 seasons" came
       * back as a success for a change that moved nothing (only three
       * comparable seasons exist, so the request was a no-op). Call this
       * before and after a change and report the difference, or the absence
       * of one.
       */
      name: "getScenarioState",
      description:
        "Read a scenario's current assumptions WITHOUT changing anything: its meaningful override count, the individual baseline->scenario differences, and how many comparable historical seasons its basis can actually read (the ceiling on any lookback). Use this to verify that a requested change actually changed something before reporting success.",
      category: "scenario",
      parametersSchema: z.object({ scenarioId: z.string() }),
      execute: ({ scenarioId }: { scenarioId: string }) => {
        const s = store();
        const scenario = s.scenarios[scenarioId];
        if (!scenario) return { found: false as const };
        return {
          found: true as const,
          name: scenario.name,
          status: scenario.status,
          overrideCount: s.overrideCount(scenarioId),
          overrides: s.overrideDiffs(scenarioId),
          availableSeasons: s.availableSeasons(scenarioId),
          requestedSeasons: scenario.overrides.historicalBasis?.seasonsOrYears ?? null,
        };
      },
    },
  ];
}
