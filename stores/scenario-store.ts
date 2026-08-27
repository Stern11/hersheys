import { create } from "zustand";
import type { Scenario, ScenarioOverrides, ScenarioOverrideCategory, ScenarioStatus } from "@/types/scenario";
import { SEED_SCENARIOS, BASELINE_ID } from "@/data/synthetic/scenarios";

interface ScenarioStoreState {
  scenarios: Record<string, Scenario>;
  activeScenarioId: string | null; // null = viewing the immutable baseline
  comparisonScenarioIds: string[];
  selectedGapId: string | null;
  selectedEventId: string | null;
  selectedLineId: string | null;
  selectedMaterialId: string | null;
  viewMode: "baseline" | "scenario";

  // --- scenario lifecycle ---
  createScenario: (name: string, gapId?: string) => string;
  duplicateScenario: (scenarioId: string, newName?: string) => string;
  renameScenario: (scenarioId: string, name: string) => void;
  resetScenario: (scenarioId: string) => void;
  resetCategory: (scenarioId: string, category: ScenarioOverrideCategory) => void;
  deleteScenario: (scenarioId: string) => void;
  setActiveScenario: (scenarioId: string | null) => void;
  setScenarioStatus: (scenarioId: string, status: ScenarioStatus) => void;
  addComparisonScenario: (scenarioId: string) => void;
  removeComparisonScenario: (scenarioId: string) => void;

  // --- demand controls ---
  setDemandAssumption: (scenarioId: string, baselineDemandUnits: number) => void;
  setSeasonalUplift: (scenarioId: string, pct: number) => void;
  setGrowthAssumption: (scenarioId: string, pct: number) => void;
  setDemandPercentile: (scenarioId: string, selection: NonNullable<ScenarioOverrides["demand"]>["percentileSelection"]) => void;

  // --- historical basis controls ---
  setHistoricalLookback: (scenarioId: string, seasonsOrYears: number) => void;
  includeHistoricalPeriod: (scenarioId: string, periodId: string) => void;
  excludeHistoricalPeriod: (scenarioId: string, periodId: string) => void;
  setHistoricalWeighting: (scenarioId: string, weighting: NonNullable<ScenarioOverrides["historicalBasis"]>["weighting"]) => void;

  // --- analogue controls ---
  setAnalogue: (scenarioId: string, analogueProductId: string, weight: number) => void;
  setAnalogueWeight: (scenarioId: string, analogueProductId: string, weight: number) => void;
  addAnalogue: (scenarioId: string, analogueId: string) => void;
  removeAnalogue: (scenarioId: string, analogueId: string) => void;

  // --- BOM controls ---
  includeBomComponent: (scenarioId: string, bomComponentId: string) => void;
  excludeBomComponent: (scenarioId: string, bomComponentId: string) => void;
  setBomConsumption: (scenarioId: string, bomComponentId: string, quantityPerUnit: number) => void;
  setScrapRate: (scenarioId: string, bomComponentId: string, scrapFactor: number) => void;

  // --- master assumption controls ---
  setLeadTime: (scenarioId: string, materialId: string, days: number) => void;
  setLeadTimeBasis: (scenarioId: string, materialId: string, basis: "system" | "historical" | "scenario", statistic?: "median" | "p80" | "custom") => void;
  setLeadTimeSampleSize: (scenarioId: string, materialId: string, sampleSize: number) => void;
  setRunRateBasis: (scenarioId: string, lineId: string, basis: "system" | "historical" | "scenario", scenarioValue?: number) => void;

  // --- capacity controls ---
  setRunRate: (scenarioId: string, lineId: string, period: string, unitsPerHour: number) => void;
  setLineAllocation: (scenarioId: string, lineId: string, period: string, share: number) => void;
  setAvailableCapacity: (scenarioId: string, lineId: string, period: string, hours: number) => void;
  setTargetUtilization: (scenarioId: string, lineId: string, period: string, pct: number) => void;
  setPrebuildQuantity: (scenarioId: string, lineId: string, period: string, units: number) => void;
  setAdditionalShiftHours: (scenarioId: string, lineId: string, period: string, hours: number) => void;
  setProductionWindowShift: (scenarioId: string, lineId: string, period: string, weeks: number) => void;

  // --- material controls ---
  setMaterialLeadTimeOverride: (scenarioId: string, materialId: string, days: number) => void;
  setSafetyStock: (scenarioId: string, materialId: string, units: number) => void;
  setOnHandInventory: (scenarioId: string, materialId: string, units: number) => void;
  setOpenSupply: (scenarioId: string, materialId: string, units: number) => void;
  setProvisionalRequirementIncluded: (scenarioId: string, materialId: string, included: boolean) => void;
}

let scenarioCounter = SEED_SCENARIOS.length;

function nowIso(): string {
  return new Date().toISOString();
}

function emptyOverrides(): ScenarioOverrides {
  return {};
}

export const useScenarioStore = create<ScenarioStoreState>((set, get) => {
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

  return {
    scenarios: Object.fromEntries(SEED_SCENARIOS.map((s) => [s.id, s])),
    activeScenarioId: SEED_SCENARIOS[0]?.id ?? null,
    comparisonScenarioIds: [],
    selectedGapId: null,
    selectedEventId: null,
    selectedLineId: null,
    selectedMaterialId: null,
    viewMode: "scenario",

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

    addComparisonScenario: (scenarioId) =>
      set((state) => ({ comparisonScenarioIds: state.comparisonScenarioIds.includes(scenarioId) ? state.comparisonScenarioIds : [...state.comparisonScenarioIds, scenarioId].slice(0, 4) })),

    removeComparisonScenario: (scenarioId) => set((state) => ({ comparisonScenarioIds: state.comparisonScenarioIds.filter((id) => id !== scenarioId) })),

    setDemandAssumption: (scenarioId, baselineDemandUnits) => patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, baselineDemandUnits } })),
    setSeasonalUplift: (scenarioId, pct) => patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, seasonalUpliftPct: pct } })),
    setGrowthAssumption: (scenarioId, pct) => patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, growthRatePct: pct } })),
    setDemandPercentile: (scenarioId, selection) => patch(scenarioId, (o) => ({ ...o, demand: { ...o.demand, percentileSelection: selection } })),

    setHistoricalLookback: (scenarioId, seasonsOrYears) => patch(scenarioId, (o) => ({ ...o, historicalBasis: { ...o.historicalBasis, seasonsOrYears } })),
    includeHistoricalPeriod: (scenarioId, periodId) =>
      patch(scenarioId, (o) => ({
        ...o,
        historicalBasis: {
          ...o.historicalBasis,
          includedPeriodIds: [...new Set([...(o.historicalBasis?.includedPeriodIds ?? []), periodId])],
          excludedPeriodIds: (o.historicalBasis?.excludedPeriodIds ?? []).filter((id) => id !== periodId),
        },
      })),
    excludeHistoricalPeriod: (scenarioId, periodId) =>
      patch(scenarioId, (o) => ({
        ...o,
        historicalBasis: {
          ...o.historicalBasis,
          excludedPeriodIds: [...new Set([...(o.historicalBasis?.excludedPeriodIds ?? []), periodId])],
          includedPeriodIds: (o.historicalBasis?.includedPeriodIds ?? []).filter((id) => id !== periodId),
        },
      })),
    setHistoricalWeighting: (scenarioId, weighting) => patch(scenarioId, (o) => ({ ...o, historicalBasis: { ...o.historicalBasis, weighting } })),

    setAnalogue: (scenarioId, analogueProductId, weight) =>
      patch(scenarioId, (o) => ({ ...o, analogues: { ...o.analogues, weights: { ...o.analogues?.weights, [analogueProductId]: weight } } })),
    setAnalogueWeight: (scenarioId, analogueProductId, weight) =>
      patch(scenarioId, (o) => ({ ...o, analogues: { ...o.analogues, weights: { ...o.analogues?.weights, [analogueProductId]: weight } } })),
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

    includeBomComponent: (scenarioId, bomComponentId) => patchKeyed(scenarioId, "bom", bomComponentId, { included: true }),
    excludeBomComponent: (scenarioId, bomComponentId) => patchKeyed(scenarioId, "bom", bomComponentId, { included: false }),
    setBomConsumption: (scenarioId, bomComponentId, quantityPerUnit) => patchKeyed(scenarioId, "bom", bomComponentId, { quantityPerUnit }),
    setScrapRate: (scenarioId, bomComponentId, scrapFactor) => patchKeyed(scenarioId, "bom", bomComponentId, { scrapFactor }),

    setLeadTime: (scenarioId, materialId, days) =>
      patchKeyed(scenarioId, "masterAssumptions", `material:${materialId}:lead_time`, { selectedBasis: "scenario", scenarioValue: days }),
    setLeadTimeBasis: (scenarioId, materialId, basis, statistic) =>
      patchKeyed(scenarioId, "masterAssumptions", `material:${materialId}:lead_time`, { selectedBasis: basis, leadTimeStatistic: statistic }),
    setLeadTimeSampleSize: (scenarioId, materialId, sampleSize) => patchKeyed(scenarioId, "masterAssumptions", `material:${materialId}:lead_time`, { sampleSize }),
    setRunRateBasis: (scenarioId, lineId, basis, scenarioValue) =>
      patchKeyed(scenarioId, "masterAssumptions", `line:${lineId}:run_rate`, { selectedBasis: basis, scenarioValue }),

    setRunRate: (scenarioId, lineId, period, unitsPerHour) => patchKeyed(scenarioId, "capacity", `${lineId}:${period}`, { runRateUnitsPerHour: unitsPerHour }),
    setLineAllocation: (scenarioId, lineId, period, share) => patchKeyed(scenarioId, "capacity", `${lineId}:${period}`, { lineAllocationShare: share }),
    setAvailableCapacity: (scenarioId, lineId, period, hours) => patchKeyed(scenarioId, "capacity", `${lineId}:${period}`, { availableHours: hours }),
    setTargetUtilization: (scenarioId, lineId, period, pct) => patchKeyed(scenarioId, "capacity", `${lineId}:${period}`, { targetUtilization: pct }),
    setPrebuildQuantity: (scenarioId, lineId, period, units) => patchKeyed(scenarioId, "capacity", `${lineId}:${period}`, { prebuildQuantityUnits: units }),
    setAdditionalShiftHours: (scenarioId, lineId, period, hours) => patchKeyed(scenarioId, "capacity", `${lineId}:${period}`, { additionalShiftHours: hours }),
    setProductionWindowShift: (scenarioId, lineId, period, weeks) => patchKeyed(scenarioId, "capacity", `${lineId}:${period}`, { productionWindowShiftWeeks: weeks }),

    setMaterialLeadTimeOverride: (scenarioId, materialId, days) => patchKeyed(scenarioId, "materials", materialId, { leadTimeDaysOverride: days }),
    setSafetyStock: (scenarioId, materialId, units) => patchKeyed(scenarioId, "materials", materialId, { safetyStockUnits: units }),
    setOnHandInventory: (scenarioId, materialId, units) => patchKeyed(scenarioId, "materials", materialId, { onHandInventoryUnits: units }),
    setOpenSupply: (scenarioId, materialId, units) => patchKeyed(scenarioId, "materials", materialId, { openSupplyUnits: units }),
    setProvisionalRequirementIncluded: (scenarioId, materialId, included) => patchKeyed(scenarioId, "materials", materialId, { provisionalRequirementIncluded: included }),
  };
});
