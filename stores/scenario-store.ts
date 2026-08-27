import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Scenario, ScenarioOverrides, ScenarioOverrideCategory, ScenarioStatus } from "@/types/scenario";
import { SEED_SCENARIOS, BASELINE_ID } from "@/data/synthetic/scenarios";
import { webStorage } from "./persist-storage";
import {
  clampAdditionalShiftHours,
  clampAnalogueWeight,
  clampAvailableHours,
  clampGrowthRate,
  clampHistoricalLookback,
  clampLeadTimeDays,
  clampLineAllocation,
  clampNonNegativeUnits,
  clampPrebuildUnits,
  clampRunRate,
  clampSeasonalUplift,
  clampTargetUtilization,
  type ClampResult,
} from "@/lib/planning-engine/validation";
import { availableSeasonsForScenario, buildOverrideComparisonInput } from "@/lib/planning-engine/scenario-limits";
import { buildOverrideBaseline, countMeaningfulOverrides, diffOverrides, type OverrideDiff } from "@/lib/planning-engine/overrides";

export const SCENARIO_STORAGE_KEY = "heizen.scenarios";

/**
 * Result of a control write. Actions that clamp return this so the caller —
 * a component toast, or the AI copilot reporting back — can say what was
 * ACTUALLY applied instead of claiming success for a request the engine
 * quietly ignored.
 */
export interface AppliedChange {
  applied: boolean;
  /** The value now stored. Identical to what was requested unless `clamped`. */
  value: number;
  requested: number;
  clamped: boolean;
  /** Present when clamped: a planner-readable explanation. */
  reason?: string;
  /** True when the stored value did not change because it already held this value. */
  noop: boolean;
}

interface ScenarioStoreState {
  scenarios: Record<string, Scenario>;
  activeScenarioId: string | null; // null = viewing the immutable baseline
  comparisonScenarioIds: string[];
  selectedGapId: string | null;
  selectedEventId: string | null;
  selectedLineId: string | null;
  selectedMaterialId: string | null;
  viewMode: "baseline" | "scenario";
  /** True once persisted scenario state has been read back on the client. */
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // --- scenario lifecycle ---
  createScenario: (name: string, gapId?: string) => string;
  duplicateScenario: (scenarioId: string, newName?: string) => string;
  renameScenario: (scenarioId: string, name: string) => void;
  resetScenario: (scenarioId: string) => void;
  resetCategory: (scenarioId: string, category: ScenarioOverrideCategory) => void;
  deleteScenario: (scenarioId: string) => void;
  setActiveScenario: (scenarioId: string | null) => void;
  setScenarioStatus: (scenarioId: string, status: ScenarioStatus) => void;
  /** What the Save button calls. Durable, and never DOWNGRADES an already-validated/preferred scenario. */
  saveScenario: (scenarioId: string) => ScenarioStatus | null;
  addComparisonScenario: (scenarioId: string) => void;
  removeComparisonScenario: (scenarioId: string) => void;

  // --- derived read helpers (single source for every surface) ---
  overrideDiffs: (scenarioId: string) => OverrideDiff[];
  overrideCount: (scenarioId: string) => number;
  availableSeasons: (scenarioId: string) => number;

  // --- demand controls ---
  setDemandAssumption: (scenarioId: string, baselineDemandUnits: number) => AppliedChange;
  setSeasonalUplift: (scenarioId: string, pct: number) => AppliedChange;
  setGrowthAssumption: (scenarioId: string, pct: number) => AppliedChange;
  setDemandPercentile: (scenarioId: string, selection: NonNullable<ScenarioOverrides["demand"]>["percentileSelection"]) => void;

  // --- historical basis controls ---
  setHistoricalLookback: (scenarioId: string, seasonsOrYears: number) => AppliedChange;
  includeHistoricalPeriod: (scenarioId: string, periodId: string) => void;
  excludeHistoricalPeriod: (scenarioId: string, periodId: string) => void;
  setHistoricalWeighting: (scenarioId: string, weighting: NonNullable<ScenarioOverrides["historicalBasis"]>["weighting"]) => void;

  // --- analogue controls ---
  setAnalogue: (scenarioId: string, analogueProductId: string, weight: number) => AppliedChange;
  setAnalogueWeight: (scenarioId: string, analogueProductId: string, weight: number) => AppliedChange;
  addAnalogue: (scenarioId: string, analogueId: string) => void;
  removeAnalogue: (scenarioId: string, analogueId: string) => void;

  // --- BOM controls ---
  includeBomComponent: (scenarioId: string, bomComponentId: string) => void;
  excludeBomComponent: (scenarioId: string, bomComponentId: string) => void;
  setBomConsumption: (scenarioId: string, bomComponentId: string, quantityPerUnit: number) => void;
  setScrapRate: (scenarioId: string, bomComponentId: string, scrapFactor: number) => void;

  // --- master assumption controls ---
  setLeadTime: (scenarioId: string, materialId: string, days: number) => AppliedChange;
  setLeadTimeBasis: (scenarioId: string, materialId: string, basis: "system" | "historical" | "scenario", statistic?: "median" | "p80" | "custom") => void;
  setLeadTimeSampleSize: (scenarioId: string, materialId: string, sampleSize: number) => void;
  setRunRateBasis: (scenarioId: string, lineId: string, basis: "system" | "historical" | "scenario", scenarioValue?: number) => void;

  // --- capacity controls ---
  setRunRate: (scenarioId: string, lineId: string, period: string, unitsPerHour: number) => AppliedChange;
  setLineAllocation: (scenarioId: string, lineId: string, period: string, share: number) => AppliedChange;
  setAvailableCapacity: (scenarioId: string, lineId: string, period: string, hours: number) => AppliedChange;
  setTargetUtilization: (scenarioId: string, lineId: string, period: string, pct: number) => AppliedChange;
  setPrebuildQuantity: (scenarioId: string, lineId: string, period: string, units: number) => AppliedChange;
  setAdditionalShiftHours: (scenarioId: string, lineId: string, period: string, hours: number) => AppliedChange;
  setProductionWindowShift: (scenarioId: string, lineId: string, period: string, weeks: number) => void;

  // --- material controls ---
  setMaterialLeadTimeOverride: (scenarioId: string, materialId: string, days: number) => AppliedChange;
  setSafetyStock: (scenarioId: string, materialId: string, units: number) => AppliedChange;
  setOnHandInventory: (scenarioId: string, materialId: string, units: number) => AppliedChange;
  setOpenSupply: (scenarioId: string, materialId: string, units: number) => AppliedChange;
  setProvisionalRequirementIncluded: (scenarioId: string, materialId: string, included: boolean) => void;
}

let scenarioCounter = SEED_SCENARIOS.length;

function nowIso(): string {
  return new Date().toISOString();
}

function emptyOverrides(): ScenarioOverrides {
  return {};
}

const MISSING_SCENARIO: AppliedChange = { applied: false, value: NaN, requested: NaN, clamped: false, noop: true, reason: "Unknown scenario." };

function seedScenarios(): Record<string, Scenario> {
  return Object.fromEntries(SEED_SCENARIOS.map((s) => [s.id, structuredClone(s)]));
}

/**
 * Save must never LOSE standing. The Save button called
 * `setScenarioStatus(id, "saved")` unconditionally, so saving the seeded
 * "preferred" scenario silently demoted it to "saved" — and because nothing
 * persisted, navigating away threw the change out anyway.
 */
export function nextStatusOnSave(current: ScenarioStatus): ScenarioStatus {
  return current === "draft" ? "saved" : current;
}

export const useScenarioStore = create<ScenarioStoreState>()(
  persist(
    (set, get) => {
      function patch(scenarioId: string, updater: (o: ScenarioOverrides) => ScenarioOverrides) {
        set((state) => {
          const scenario = state.scenarios[scenarioId];
          if (!scenario) return state;
          return {
            scenarios: {
              ...state.scenarios,
              [scenarioId]: { ...scenario, overrides: updater(scenario.overrides), updatedAt: nowIso() },
            },
          };
        });
      }

      /**
       * Internal helper for the four keyed override categories (bom,
       * masterAssumptions, capacity, materials). Loosely typed on purpose —
       * every PUBLIC action below is fully typed against its real override
       * shape, so callers never see this looseness.
       */
      function patchKeyed(scenarioId: string, category: "bom" | "masterAssumptions" | "capacity" | "materials", key: string, value: Record<string, unknown>) {
        patch(scenarioId, (o) => {
          const bucket: Record<string, Record<string, unknown>> = { ...(o[category] as Record<string, Record<string, unknown>> | undefined) };
          bucket[key] = { ...bucket[key], ...value };
          return { ...o, [category]: bucket } as ScenarioOverrides;
        });
      }

      /**
       * Every numeric control goes through here.
       *
       * The rule: **what gets stored is what gets applied.** A request outside
       * the legal range is clamped BEFORE it is written, so a label can never
       * read back a number the engine ignored ("Scenario 53 seasons" over a
       * 3-season basis; utilization 223% from a 128% growth rate). The caller
       * gets the clamp reason so it can say so out loud.
       */
      function applyNumeric(scenarioId: string, clamp: ClampResult, currentValue: number | undefined, write: (value: number) => void): AppliedChange {
        if (!get().scenarios[scenarioId]) return MISSING_SCENARIO;
        const noop = currentValue != null && Math.abs(currentValue - clamp.value) < 1e-9;
        if (!noop) write(clamp.value);
        return { applied: true, value: clamp.value, requested: clamp.requested, clamped: clamp.clamped, reason: clamp.reason, noop };
      }

      function scenarioOf(scenarioId: string): Scenario | undefined {
        return get().scenarios[scenarioId];
      }

      function capacityKey(lineId: string, period: string) {
        return `${lineId}:${period}`;
      }

      return {
        scenarios: seedScenarios(),
        activeScenarioId: SEED_SCENARIOS[0]?.id ?? null,
        comparisonScenarioIds: [],
        selectedGapId: null,
        selectedEventId: null,
        selectedLineId: null,
        selectedMaterialId: null,
        viewMode: "scenario",
        hasHydrated: false,
        setHasHydrated: (v) => set({ hasHydrated: v }),

        createScenario: (name, gapId) => {
          scenarioCounter += 1;
          const id = `scn_${scenarioCounter}_${Date.now().toString(36)}`;
          const scenario: Scenario = {
            id,
            name,
            baselineId: BASELINE_ID,
            linkedGapIds: gapId ? [gapId] : [],
            overrides: emptyOverrides(),
            status: "draft",
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          set((state) => ({ scenarios: { ...state.scenarios, [id]: scenario }, activeScenarioId: id }));
          return id;
        },

        duplicateScenario: (scenarioId, newName) => {
          const source = get().scenarios[scenarioId];
          if (!source) throw new Error(`Unknown scenario: ${scenarioId}`);
          scenarioCounter += 1;
          const id = `scn_${scenarioCounter}_${Date.now().toString(36)}`;
          const clone: Scenario = {
            ...source,
            id,
            name: newName ?? `${source.name} (copy)`,
            parentScenarioId: source.id,
            status: "draft",
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          set((state) => ({ scenarios: { ...state.scenarios, [id]: clone }, activeScenarioId: id }));
          return id;
        },

        renameScenario: (scenarioId, name) => {
          set((state) => {
            const scenario = state.scenarios[scenarioId];
            if (!scenario) return state;
            return { scenarios: { ...state.scenarios, [scenarioId]: { ...scenario, name, updatedAt: nowIso() } } };
          });
        },

        resetScenario: (scenarioId) => patch(scenarioId, () => emptyOverrides()),

        resetCategory: (scenarioId, category) =>
          patch(scenarioId, (o) => {
            const next = { ...o };
            delete next[category];
            return next;
          }),

        deleteScenario: (scenarioId) => {
          set((state) => {
            const next = { ...state.scenarios };
            delete next[scenarioId];
            return {
              scenarios: next,
              activeScenarioId: state.activeScenarioId === scenarioId ? null : state.activeScenarioId,
              comparisonScenarioIds: state.comparisonScenarioIds.filter((id) => id !== scenarioId),
            };
          });
        },

        setActiveScenario: (scenarioId) => set({ activeScenarioId: scenarioId, viewMode: scenarioId ? "scenario" : "baseline" }),

        setScenarioStatus: (scenarioId, status) =>
          set((state) => {
            const scenario = state.scenarios[scenarioId];
            if (!scenario) return state;
            return { scenarios: { ...state.scenarios, [scenarioId]: { ...scenario, status, updatedAt: nowIso() } } };
          }),

        saveScenario: (scenarioId) => {
          const scenario = get().scenarios[scenarioId];
          if (!scenario) return null;
          const next = nextStatusOnSave(scenario.status);
          set((state) => ({ scenarios: { ...state.scenarios, [scenarioId]: { ...scenario, status: next, updatedAt: nowIso() } } }));
          return next;
        },

        addComparisonScenario: (scenarioId) =>
          set((state) => ({ comparisonScenarioIds: state.comparisonScenarioIds.includes(scenarioId) ? state.comparisonScenarioIds : [...state.comparisonScenarioIds, scenarioId].slice(0, 4) })),

        removeComparisonScenario: (scenarioId) => set((state) => ({ comparisonScenarioIds: state.comparisonScenarioIds.filter((id) => id !== scenarioId) })),

        /**
         * The one list of "what this scenario changes vs. baseline". Render
         * chips from this and take the count from `overrideCount` (its
         * length) so a badge can never disagree with the chips beside it.
         */
        overrideDiffs: (scenarioId) => {
          const scenario = scenarioOf(scenarioId);
          if (!scenario) return [];
          return diffOverrides(scenario.overrides, buildOverrideBaseline(buildOverrideComparisonInput(scenario)));
        },

        overrideCount: (scenarioId) => {
          const scenario = scenarioOf(scenarioId);
          if (!scenario) return 0;
          return countMeaningfulOverrides(scenario.overrides, buildOverrideBaseline(buildOverrideComparisonInput(scenario)));
        },

        availableSeasons: (scenarioId) => {
          const scenario = scenarioOf(scenarioId);
          return scenario ? availableSeasonsForScenario(scenario) : 0;
        },

        /* --- demand ---------------------------------------------------- */
        setDemandAssumption: (scenarioId, baselineDemandUnits) =>
          applyNumeric(scenarioId, clampNonNegativeUnits(baselineDemandUnits), scenarioOf(scenarioId)?.overrides.demand?.baselineDemandUnits, (v) =>
            patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, baselineDemandUnits: v } }))
          ),
        setSeasonalUplift: (scenarioId, pct) =>
          applyNumeric(scenarioId, clampSeasonalUplift(pct), scenarioOf(scenarioId)?.overrides.demand?.seasonalUpliftPct, (v) =>
            patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, seasonalUpliftPct: v } }))
          ),
        setGrowthAssumption: (scenarioId, pct) =>
          applyNumeric(scenarioId, clampGrowthRate(pct), scenarioOf(scenarioId)?.overrides.demand?.growthRatePct, (v) =>
            patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, growthRatePct: v } }))
          ),
        setDemandPercentile: (scenarioId, selection) => patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, percentileSelection: selection } })),

        /* --- historical basis ------------------------------------------ */
        /**
         * Clamped against the seasons this scenario's basis can actually
         * read. Asking for 53 over a 3-season basis stores 3 and reports why;
         * it never stores 53 while the forecast quietly reads 3.
         */
        setHistoricalLookback: (scenarioId, seasonsOrYears) => {
          const scenario = scenarioOf(scenarioId);
          if (!scenario) return MISSING_SCENARIO;
          const clamp = clampHistoricalLookback(seasonsOrYears, availableSeasonsForScenario(scenario));
          return applyNumeric(scenarioId, clamp, scenario.overrides.historicalBasis?.seasonsOrYears, (v) =>
            patch(scenarioId, (o) => ({ ...o, historicalBasis: { ...o.historicalBasis, seasonsOrYears: v } }))
          );
        },
        includeHistoricalPeriod: (scenarioId, periodId) => {
          patch(scenarioId, (o) => ({
            ...o,
            historicalBasis: {
              ...o.historicalBasis,
              includedPeriodIds: [...new Set([...(o.historicalBasis?.includedPeriodIds ?? []), periodId])],
              excludedPeriodIds: (o.historicalBasis?.excludedPeriodIds ?? []).filter((id) => id !== periodId),
            },
          }));
          reclampLookback(scenarioId);
        },
        excludeHistoricalPeriod: (scenarioId, periodId) => {
          patch(scenarioId, (o) => ({
            ...o,
            historicalBasis: {
              ...o.historicalBasis,
              excludedPeriodIds: [...new Set([...(o.historicalBasis?.excludedPeriodIds ?? []), periodId])],
              includedPeriodIds: (o.historicalBasis?.includedPeriodIds ?? []).filter((id) => id !== periodId),
            },
          }));
          reclampLookback(scenarioId);
        },
        setHistoricalWeighting: (scenarioId, weighting) => patch(scenarioId, (o) => ({ ...o, historicalBasis: { ...o.historicalBasis, weighting } })),

        /* --- analogues -------------------------------------------------- */
        setAnalogue: (scenarioId, analogueProductId, weight) => get().setAnalogueWeight(scenarioId, analogueProductId, weight),
        setAnalogueWeight: (scenarioId, analogueProductId, weight) =>
          applyNumeric(scenarioId, clampAnalogueWeight(weight), scenarioOf(scenarioId)?.overrides.analogues?.weights?.[analogueProductId], (v) =>
            patch(scenarioId, (o) => ({ ...o, analogues: { ...o.analogues, weights: { ...o.analogues?.weights, [analogueProductId]: v } } }))
          ),
        addAnalogue: (scenarioId, analogueId) =>
          patch(scenarioId, (o) => ({
            ...o,
            analogues: {
              ...o.analogues,
              activeAnalogueIds: [...new Set([...(o.analogues?.activeAnalogueIds ?? []), analogueId])],
              removedAnalogueIds: (o.analogues?.removedAnalogueIds ?? []).filter((id) => id !== analogueId),
            },
          })),
        removeAnalogue: (scenarioId, analogueId) =>
          patch(scenarioId, (o) => ({
            ...o,
            analogues: { ...o.analogues, removedAnalogueIds: [...new Set([...(o.analogues?.removedAnalogueIds ?? []), analogueId])] },
          })),

        /* --- BOM --------------------------------------------------------- */
        includeBomComponent: (scenarioId, bomComponentId) => patchKeyed(scenarioId, "bom", bomComponentId, { included: true }),
        excludeBomComponent: (scenarioId, bomComponentId) => patchKeyed(scenarioId, "bom", bomComponentId, { included: false }),
        setBomConsumption: (scenarioId, bomComponentId, quantityPerUnit) => patchKeyed(scenarioId, "bom", bomComponentId, { quantityPerUnit: Math.max(0, quantityPerUnit) }),
        setScrapRate: (scenarioId, bomComponentId, scrapFactor) => patchKeyed(scenarioId, "bom", bomComponentId, { scrapFactor: Math.min(1, Math.max(0, scrapFactor)) }),

        /* --- master assumptions ------------------------------------------ */
        setLeadTime: (scenarioId, materialId, days) => {
          const key = `material:${materialId}:lead_time`;
          const current = scenarioOf(scenarioId)?.overrides.masterAssumptions?.[key];
          return applyNumeric(scenarioId, clampLeadTimeDays(days), current?.selectedBasis === "scenario" ? current.scenarioValue : undefined, (v) =>
            patchKeyed(scenarioId, "masterAssumptions", key, { selectedBasis: "scenario", scenarioValue: v })
          );
        },
        setLeadTimeBasis: (scenarioId, materialId, basis, statistic) =>
          patchKeyed(scenarioId, "masterAssumptions", `material:${materialId}:lead_time`, { selectedBasis: basis, leadTimeStatistic: statistic }),
        setLeadTimeSampleSize: (scenarioId, materialId, sampleSize) =>
          patchKeyed(scenarioId, "masterAssumptions", `material:${materialId}:lead_time`, { sampleSize: Math.max(1, Math.round(sampleSize)) }),

        /**
         * Basis selector for a line's run rate.
         *
         * Selecting "scenario" WITHOUT a value keeps whatever custom rate is
         * already stored rather than wiping it — switching to System and back
         * must not silently discard the planner's number.
         */
        setRunRateBasis: (scenarioId, lineId, basis, scenarioValue) => {
          const key = `line:${lineId}:run_rate`;
          const existing = scenarioOf(scenarioId)?.overrides.masterAssumptions?.[key];
          const nextValue = scenarioValue != null ? clampRunRate(scenarioValue).value : existing?.scenarioValue;
          patchKeyed(scenarioId, "masterAssumptions", key, { selectedBasis: basis, scenarioValue: nextValue });
        },

        /* --- capacity ----------------------------------------------------- */
        /**
         * THE writer for a scenario run rate. See
         * `lib/planning-engine/capacity.ts::resolveRunRate` for the reader.
         *
         * This used to write `capacity["{line}:{period}"].runRateUnitsPerHour`,
         * a field the RCCP conversion only consults when the basis is NOT
         * "scenario" — while the input that called it is only rendered when
         * the basis IS "scenario". One field was written, a different field was
         * read, and typing a rate did nothing at all. It now writes the same
         * `masterAssumptions["line:{lineId}:run_rate"].scenarioValue` the basis
         * selector writes, and flips the basis to "scenario" so the value is
         * actually consulted.
         *
         * `period` is retained in the signature (callers and AI tools pass it)
         * but a run rate is a LINE property, not a bucket property: setting it
         * applies to every period the scenario evaluates for that line.
         */
        setRunRate: (scenarioId, lineId, period, unitsPerHour) => {
          void period;
          const key = `line:${lineId}:run_rate`;
          const existing = scenarioOf(scenarioId)?.overrides.masterAssumptions?.[key];
          const currentEffective = existing?.selectedBasis === "scenario" ? existing.scenarioValue : undefined;
          return applyNumeric(scenarioId, clampRunRate(unitsPerHour), currentEffective, (v) =>
            patchKeyed(scenarioId, "masterAssumptions", key, { selectedBasis: "scenario", scenarioValue: v })
          );
        },

        setLineAllocation: (scenarioId, lineId, period, share) =>
          applyNumeric(scenarioId, clampLineAllocation(share), scenarioOf(scenarioId)?.overrides.capacity?.[capacityKey(lineId, period)]?.lineAllocationShare, (v) =>
            patchKeyed(scenarioId, "capacity", capacityKey(lineId, period), { lineAllocationShare: v })
          ),
        setAvailableCapacity: (scenarioId, lineId, period, hours) =>
          applyNumeric(scenarioId, clampAvailableHours(hours), scenarioOf(scenarioId)?.overrides.capacity?.[capacityKey(lineId, period)]?.availableHours, (v) =>
            patchKeyed(scenarioId, "capacity", capacityKey(lineId, period), { availableHours: v })
          ),

        /**
         * Utilization ALERT THRESHOLD, as a fraction (0.9 = 90%), clamped to
         * 0–100%.
         *
         * By design this does NOT move effective utilization — a threshold is
         * not a load lever, and folding it into the load would make the number
         * it is supposed to judge depend on the judgement. What it does change,
         * demonstrably, is `riskLevel`: drop it below the line's effective
         * utilization and the line flips to `warning`; raise it above and the
         * line reads `positive`. It also positions the ceiling marker on the
         * capacity chart.
         */
        setTargetUtilization: (scenarioId, lineId, period, pct) =>
          applyNumeric(scenarioId, clampTargetUtilization(pct), scenarioOf(scenarioId)?.overrides.capacity?.[capacityKey(lineId, period)]?.targetUtilization, (v) =>
            patchKeyed(scenarioId, "capacity", capacityKey(lineId, period), { targetUtilization: v })
          ),

        setPrebuildQuantity: (scenarioId, lineId, period, units) =>
          applyNumeric(scenarioId, clampPrebuildUnits(units), scenarioOf(scenarioId)?.overrides.capacity?.[capacityKey(lineId, period)]?.prebuildQuantityUnits, (v) =>
            patchKeyed(scenarioId, "capacity", capacityKey(lineId, period), { prebuildQuantityUnits: v })
          ),
        setAdditionalShiftHours: (scenarioId, lineId, period, hours) =>
          applyNumeric(scenarioId, clampAdditionalShiftHours(hours), scenarioOf(scenarioId)?.overrides.capacity?.[capacityKey(lineId, period)]?.additionalShiftHours, (v) =>
            patchKeyed(scenarioId, "capacity", capacityKey(lineId, period), { additionalShiftHours: v })
          ),
        setProductionWindowShift: (scenarioId, lineId, period, weeks) =>
          patchKeyed(scenarioId, "capacity", capacityKey(lineId, period), { productionWindowShiftWeeks: Math.round(weeks) }),

        /* --- materials ---------------------------------------------------- */
        setMaterialLeadTimeOverride: (scenarioId, materialId, days) =>
          applyNumeric(scenarioId, clampLeadTimeDays(days), scenarioOf(scenarioId)?.overrides.materials?.[materialId]?.leadTimeDaysOverride, (v) =>
            patchKeyed(scenarioId, "materials", materialId, { leadTimeDaysOverride: v })
          ),
        setSafetyStock: (scenarioId, materialId, units) =>
          applyNumeric(scenarioId, clampNonNegativeUnits(units), scenarioOf(scenarioId)?.overrides.materials?.[materialId]?.safetyStockUnits, (v) =>
            patchKeyed(scenarioId, "materials", materialId, { safetyStockUnits: v })
          ),
        setOnHandInventory: (scenarioId, materialId, units) =>
          applyNumeric(scenarioId, clampNonNegativeUnits(units), scenarioOf(scenarioId)?.overrides.materials?.[materialId]?.onHandInventoryUnits, (v) =>
            patchKeyed(scenarioId, "materials", materialId, { onHandInventoryUnits: v })
          ),
        setOpenSupply: (scenarioId, materialId, units) =>
          applyNumeric(scenarioId, clampNonNegativeUnits(units), scenarioOf(scenarioId)?.overrides.materials?.[materialId]?.openSupplyUnits, (v) =>
            patchKeyed(scenarioId, "materials", materialId, { openSupplyUnits: v })
          ),
        setProvisionalRequirementIncluded: (scenarioId, materialId, included) => patchKeyed(scenarioId, "materials", materialId, { provisionalRequirementIncluded: included }),
      };

      /**
       * Excluding a season narrows the legal lookback. Without this, a
       * scenario left behind a stored "3 seasons" against a basis that can now
       * only read 2 — the exact drift between the stated assumption and the
       * applied one that this store exists to prevent.
       */
      function reclampLookback(scenarioId: string) {
        const scenario = get().scenarios[scenarioId];
        const requested = scenario?.overrides.historicalBasis?.seasonsOrYears;
        if (!scenario || requested == null) return;
        const clamped = clampHistoricalLookback(requested, availableSeasonsForScenario(scenario)).value;
        if (clamped !== requested) {
          patch(scenarioId, (o) => ({ ...o, historicalBasis: { ...o.historicalBasis, seasonsOrYears: clamped } }));
        }
      }
    },
    {
      name: SCENARIO_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => webStorage("session")),
      // See stores/persist-storage.ts: rehydration is deferred to a
      // post-hydration effect so the first client render matches the SSR HTML.
      skipHydration: true,
      // Only planner-authored state persists. Derived scenario results are
      // never stored (CLAUDE.md: recomputed by calculateScenario() every time),
      // and transient selections are not worth restoring.
      partialize: (state) => ({
        scenarios: state.scenarios,
        activeScenarioId: state.activeScenarioId,
        comparisonScenarioIds: state.comparisonScenarioIds,
        viewMode: state.viewMode,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    }
  )
);
