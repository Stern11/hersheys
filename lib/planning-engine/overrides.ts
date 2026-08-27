import type { Material, ProductionLine } from "@/types/planning";
import type { ScenarioOverrideCategory, ScenarioOverrides } from "@/types/scenario";
import type { CalculateScenarioInput } from "./scenarios";
import { resolveRunRate } from "./capacity";
import { resolveLeadTimeDays } from "./lead-times";
import { availableSeasonCount } from "./seasonality";
import { resolveActiveAnalogues } from "./analogues";

/**
 * "N overrides vs. baseline" — computed ONCE, here.
 *
 * The badge used to read `Object.keys(scenario.overrides).length`: the number
 * of override CATEGORIES that had been touched. That number is wrong in every
 * direction at once. It said "2 overrides" while three override chips were on
 * screen (two master assumptions live in one category). It did not move when
 * the lookback changed (`historicalBasis` was already a present key). It DID
 * move when a planner set the run rate to the value it already had. And it
 * counted the seed scenario's `{ seasonsOrYears: 3 }` as a change even though
 * the baseline basis is also three seasons — "Baseline 3 seasons → Scenario 3
 * seasons" is not a scenario.
 *
 * The definition here is the only one that survives a planner's scrutiny:
 * **an override is a stored value that resolves to something different from
 * what the baseline resolves to.** Setting a field to its baseline value is
 * not an override; setting the same non-baseline value twice is still one
 * override; choosing a different BASIS that resolves to the same number is
 * not an override either (a P80 lead time already accepted into the baseline
 * is the baseline, whatever label the scenario puts on it).
 *
 * `diffOverrides` returns the individual differences, so a component renders
 * its chips from the SAME list it takes the count from and the two can never
 * disagree again.
 */

export interface OverrideDiff {
  /** Stable identity for the diff, e.g. `masterAssumptions:line:line_03:run_rate`. */
  key: string;
  category: ScenarioOverrideCategory;
  /** Short planner-facing label, e.g. "Line 03 run rate". */
  label: string;
  /** What the baseline resolves to, formatted for display. */
  baseline: string;
  /** What this scenario resolves to, formatted for display. */
  scenario: string;
}

export interface OverrideBaseline {
  gapId: string;
  growthRatePct: number;
  /** Baseline lookback = every comparable season the basis can read. */
  historicalLookbackSeasons: number;
  historicalWeighting: "equal" | "recent_weighted" | "custom";
  /** Baseline (unexcluded) period ids, used to detect exclusion/inclusion changes. */
  eligiblePeriodIds: string[];
  linesById: Record<string, ProductionLine>;
  observedRunRateByLine: Record<string, number>;
  materialsById: Record<string, Material>;
  leadTimeP80ByMaterial: Record<string, number>;
  /** Bucket key -> the bucket's own baseline values. */
  capacityByBucket: Record<string, { targetUtilization: number; availableHours: number; lineAllocationShare: number }>;
  /** Component id -> baseline consumption + scrap. */
  bomByComponentId: Record<string, { quantityPerUnit: number; scrapFactor: number }>;
  /** Normalized baseline analogue weights, keyed by candidate product id. */
  analogueWeightByProductId: Record<string, number>;
  /** The raw default weight for each analogue (its similarity score) — what a slider reads before anyone touches it. */
  analogueSimilarityByProductId: Record<string, number>;
  /**
   * Master assumptions ALREADY accepted into the baseline (gaps.ts::
   * ACCEPTED_MASTER_ASSUMPTIONS). A scenario restating one of these is not
   * overriding anything.
   */
  acceptedMasterAssumptions: NonNullable<ScenarioOverrides["masterAssumptions"]>;
}

/**
 * Derives the baseline every comparison is made against, straight from the
 * SAME `CalculateScenarioInput` the engine runs on — call it with the gap's
 * builder and EMPTY user overrides:
 *
 *   buildOverrideBaseline(buildHalloweenScenarioInput("baseline", {}))
 *
 * Deriving it from the input (rather than re-reading the synthetic data) is
 * what guarantees the baseline used for counting is the same baseline the
 * numbers were computed from.
 */
export function buildOverrideBaseline(baselineInput: CalculateScenarioInput): OverrideBaseline {
  const linesById: Record<string, ProductionLine> = {};
  baselineInput.lines.forEach((l) => (linesById[l.id] = l));

  const observedRunRateByLine: Record<string, number> = {};
  baselineInput.observedRunRateByLine.forEach((v, k) => (observedRunRateByLine[k] = v));

  const materialsById: Record<string, Material> = {};
  baselineInput.materialsById.forEach((v, k) => (materialsById[k] = v));

  const leadTimeP80ByMaterial: Record<string, number> = {};
  baselineInput.leadTimeP80ByMaterial.forEach((v, k) => (leadTimeP80ByMaterial[k] = v));

  const capacityByBucket: Record<string, { targetUtilization: number; availableHours: number; lineAllocationShare: number }> = {};
  baselineInput.capacityBuckets.forEach((b) => {
    capacityByBucket[`${b.lineId}:${b.period}`] = {
      targetUtilization: b.targetUtilization,
      availableHours: b.availableHours - b.plannedDowntimeHours,
      lineAllocationShare: baselineInput.lineAllocations.find((a) => a.lineId === b.lineId)?.defaultShare ?? 0,
    };
  });

  const bomByComponentId: Record<string, { quantityPerUnit: number; scrapFactor: number }> = {};
  baselineInput.bomRows.forEach((row) => {
    bomByComponentId[row.id] = {
      quantityPerUnit: row.quantityPerUnit,
      scrapFactor: baselineInput.materialsById.get(row.materialId)?.scrapFactorSystem ?? 0,
    };
  });

  const analogueWeightByProductId: Record<string, number> = {};
  const analogueSimilarityByProductId: Record<string, number> = {};
  resolveActiveAnalogues(baselineInput.analogueCandidates ?? [], undefined).forEach((w) => {
    analogueWeightByProductId[w.analogue.candidateProductId] = w.weight;
    analogueSimilarityByProductId[w.analogue.candidateProductId] = w.analogue.similarityScore;
  });

  return {
    gapId: baselineInput.gapId,
    growthRatePct: baselineInput.growthAssumption,
    historicalLookbackSeasons: availableSeasonCount(baselineInput.historicalPeriods),
    historicalWeighting: "recent_weighted",
    eligiblePeriodIds: baselineInput.historicalPeriods.filter((p) => !p.isAtypical).map((p) => p.id),
    linesById,
    observedRunRateByLine,
    materialsById,
    leadTimeP80ByMaterial,
    capacityByBucket,
    bomByComponentId,
    analogueWeightByProductId,
    analogueSimilarityByProductId,
    acceptedMasterAssumptions: baselineInput.overrides.masterAssumptions ?? {},
  };
}

const EPS = 1e-9;
const differs = (a: number, b: number) => Math.abs(a - b) > EPS;

/**
 * Every way this scenario's stored overrides resolve to something other than
 * the baseline. Order is stable (demand → basis → master assumptions →
 * capacity → materials → BOM → analogues) so chips don't reshuffle on edit.
 */
export function diffOverrides(overrides: ScenarioOverrides, baseline: OverrideBaseline): OverrideDiff[] {
  const diffs: OverrideDiff[] = [];

  /* --- demand -------------------------------------------------------- */
  const demand = overrides.demand;
  if (demand?.growthRatePct != null && differs(demand.growthRatePct, baseline.growthRatePct)) {
    diffs.push({
      key: "demand:growthRatePct",
      category: "demand",
      label: "Growth assumption",
      baseline: pct(baseline.growthRatePct),
      scenario: pct(demand.growthRatePct),
    });
  }
  if (demand?.seasonalUpliftPct != null && differs(demand.seasonalUpliftPct, 0)) {
    diffs.push({ key: "demand:seasonalUpliftPct", category: "demand", label: "Seasonal uplift", baseline: pct(0), scenario: pct(demand.seasonalUpliftPct) });
  }
  if (demand?.baselineDemandUnits != null) {
    diffs.push({ key: "demand:baselineDemandUnits", category: "demand", label: "Demand anchor", baseline: "Forecast base", scenario: `${Math.round(demand.baselineDemandUnits).toLocaleString()} units` });
  }
  if (demand?.percentileSelection != null && demand.percentileSelection !== "base" && demand.percentileSelection !== "p50") {
    diffs.push({ key: "demand:percentileSelection", category: "demand", label: "Demand percentile", baseline: "base (P50)", scenario: demand.percentileSelection });
  }

  /* --- historical basis ---------------------------------------------- */
  const hb = overrides.historicalBasis;
  if (hb?.seasonsOrYears != null && differs(hb.seasonsOrYears, baseline.historicalLookbackSeasons)) {
    diffs.push({
      key: "historicalBasis:seasonsOrYears",
      category: "historicalBasis",
      label: "Historical lookback",
      baseline: `${baseline.historicalLookbackSeasons} seasons`,
      scenario: `${hb.seasonsOrYears} season${hb.seasonsOrYears === 1 ? "" : "s"}`,
    });
  }
  if (hb?.weighting != null && hb.weighting !== baseline.historicalWeighting) {
    diffs.push({ key: "historicalBasis:weighting", category: "historicalBasis", label: "Season weighting", baseline: baseline.historicalWeighting, scenario: hb.weighting });
  }
  (hb?.excludedPeriodIds ?? []).forEach((id) => {
    // Excluding a period that was never in the basis (an atypical season) is
    // not a change — the baseline already left it out.
    if (!baseline.eligiblePeriodIds.includes(id)) return;
    diffs.push({ key: `historicalBasis:exclude:${id}`, category: "historicalBasis", label: "Season excluded", baseline: "in basis", scenario: `${id} excluded` });
  });
  (hb?.includedPeriodIds ?? []).forEach((id) => {
    if (baseline.eligiblePeriodIds.includes(id)) return; // already in the basis
    diffs.push({ key: `historicalBasis:include:${id}`, category: "historicalBasis", label: "Atypical season included", baseline: "excluded as atypical", scenario: `${id} included` });
  });

  /* --- master assumptions -------------------------------------------- */
  Object.entries(overrides.masterAssumptions ?? {}).forEach(([key, override]) => {
    const runRateLine = /^line:(.+):run_rate$/.exec(key);
    if (runRateLine) {
      const line = baseline.linesById[runRateLine[1]!];
      if (!line) return;
      const observed = baseline.observedRunRateByLine[line.id] ?? line.historicalMedianRunRateUnitsPerHour;
      const acceptedBasis = baseline.acceptedMasterAssumptions[key];
      const baseRate = resolveRunRate({ line, runRateOverride: acceptedBasis, observedMedianRunRate: observed }).unitsPerHour;
      const scenarioRate = resolveRunRate({ line, runRateOverride: override, observedMedianRunRate: observed }).unitsPerHour;
      if (differs(baseRate, scenarioRate)) {
        diffs.push({
          key: `masterAssumptions:${key}`,
          category: "masterAssumptions",
          label: `${line.name} run rate`,
          baseline: `${Math.round(baseRate).toLocaleString()}/hr`,
          scenario: `${Math.round(scenarioRate).toLocaleString()}/hr`,
        });
      }
      return;
    }

    const leadTimeMaterial = /^material:(.+):lead_time$/.exec(key);
    if (leadTimeMaterial) {
      const material = baseline.materialsById[leadTimeMaterial[1]!];
      if (!material) return;
      const p80 = baseline.leadTimeP80ByMaterial[material.id] ?? material.historicalP80LeadTimeDays;
      const acceptedBasis = baseline.acceptedMasterAssumptions[key];
      const baseDays = resolveLeadTimeDays(material, p80, acceptedBasis);
      const scenarioDays = resolveLeadTimeDays(material, p80, override);
      if (differs(baseDays, scenarioDays)) {
        diffs.push({
          key: `masterAssumptions:${key}`,
          category: "masterAssumptions",
          label: `${material.name} lead time`,
          baseline: `${baseDays}d`,
          scenario: `${scenarioDays}d`,
        });
      }
      return;
    }

    // Unknown master-assumption key: count it only if it actually carries a
    // scenario value, never merely because the key exists.
    if (override.selectedBasis === "scenario" && override.scenarioValue != null) {
      diffs.push({ key: `masterAssumptions:${key}`, category: "masterAssumptions", label: key, baseline: "system", scenario: String(override.scenarioValue) });
    }
  });

  /* --- capacity ------------------------------------------------------- */
  Object.entries(overrides.capacity ?? {}).forEach(([bucketKey, override]) => {
    const base = baseline.capacityByBucket[bucketKey];
    const lineId = bucketKey.split(":")[0] ?? bucketKey;
    const lineName = baseline.linesById[lineId]?.name ?? lineId;

    if (override.targetUtilization != null && (base == null || differs(override.targetUtilization, base.targetUtilization))) {
      diffs.push({
        key: `capacity:${bucketKey}:targetUtilization`,
        category: "capacity",
        label: `${lineName} utilization alert threshold`,
        baseline: base ? pct(base.targetUtilization) : "—",
        scenario: pct(override.targetUtilization),
      });
    }
    if (override.availableHours != null && (base == null || differs(override.availableHours, base.availableHours))) {
      diffs.push({ key: `capacity:${bucketKey}:availableHours`, category: "capacity", label: `${lineName} available hours`, baseline: base ? `${base.availableHours}h` : "—", scenario: `${override.availableHours}h` });
    }
    if (override.lineAllocationShare != null && (base == null || differs(override.lineAllocationShare, base.lineAllocationShare))) {
      diffs.push({ key: `capacity:${bucketKey}:lineAllocationShare`, category: "capacity", label: `${lineName} allocation share`, baseline: base ? pct(base.lineAllocationShare) : "—", scenario: pct(override.lineAllocationShare) });
    }
    if (override.additionalShiftHours != null && differs(override.additionalShiftHours, 0)) {
      diffs.push({ key: `capacity:${bucketKey}:additionalShiftHours`, category: "capacity", label: `${lineName} additional shift hours`, baseline: "0h", scenario: `+${override.additionalShiftHours}h` });
    }
    if (override.prebuildQuantityUnits != null && differs(override.prebuildQuantityUnits, 0)) {
      diffs.push({ key: `capacity:${bucketKey}:prebuildQuantityUnits`, category: "capacity", label: `${lineName} prebuild`, baseline: "0 units", scenario: `${override.prebuildQuantityUnits.toLocaleString()} units` });
    }
    if (override.productionWindowShiftWeeks != null && differs(override.productionWindowShiftWeeks, 0)) {
      diffs.push({ key: `capacity:${bucketKey}:productionWindowShiftWeeks`, category: "capacity", label: `${lineName} production window shift`, baseline: "0 wks", scenario: `${override.productionWindowShiftWeeks} wks` });
    }
    // NOTE: `runRateUnitsPerHour` is deliberately NOT diffed here. A scenario
    // run rate lives in masterAssumptions (see capacity.ts::resolveRunRate);
    // counting the legacy bucket field too would double-count one change.
  });

  /* --- materials ------------------------------------------------------ */
  Object.entries(overrides.materials ?? {}).forEach(([materialId, override]) => {
    const name = baseline.materialsById[materialId]?.name ?? materialId;
    const material = baseline.materialsById[materialId];
    if (override.leadTimeDaysOverride != null && material != null && differs(override.leadTimeDaysOverride, material.systemLeadTimeDays)) {
      diffs.push({ key: `materials:${materialId}:leadTimeDaysOverride`, category: "materials", label: `${name} lead time`, baseline: `${material.systemLeadTimeDays}d`, scenario: `${override.leadTimeDaysOverride}d` });
    }
    if (override.onHandInventoryUnits != null && differs(override.onHandInventoryUnits, 0)) {
      diffs.push({ key: `materials:${materialId}:onHandInventoryUnits`, category: "materials", label: `${name} on hand`, baseline: "0", scenario: override.onHandInventoryUnits.toLocaleString() });
    }
    if (override.openSupplyUnits != null && differs(override.openSupplyUnits, 0)) {
      diffs.push({ key: `materials:${materialId}:openSupplyUnits`, category: "materials", label: `${name} open supply`, baseline: "0", scenario: override.openSupplyUnits.toLocaleString() });
    }
    if (override.safetyStockUnits != null && differs(override.safetyStockUnits, 0)) {
      diffs.push({ key: `materials:${materialId}:safetyStockUnits`, category: "materials", label: `${name} safety stock`, baseline: "0", scenario: override.safetyStockUnits.toLocaleString() });
    }
    if (override.provisionalRequirementIncluded === false) {
      diffs.push({ key: `materials:${materialId}:provisionalRequirementIncluded`, category: "materials", label: `${name} provisional requirement`, baseline: "included", scenario: "excluded" });
    }
  });

  /* --- BOM ------------------------------------------------------------ */
  Object.entries(overrides.bom ?? {}).forEach(([componentId, override]) => {
    const base = baseline.bomByComponentId[componentId];
    if (override.included === false) {
      diffs.push({ key: `bom:${componentId}:included`, category: "bom", label: "Component excluded", baseline: "included", scenario: "excluded" });
    }
    if (override.quantityPerUnit != null && (base == null || differs(override.quantityPerUnit, base.quantityPerUnit))) {
      diffs.push({ key: `bom:${componentId}:quantityPerUnit`, category: "bom", label: "Consumption per unit", baseline: base ? String(base.quantityPerUnit) : "—", scenario: String(override.quantityPerUnit) });
    }
    if (override.scrapFactor != null && (base == null || differs(override.scrapFactor, base.scrapFactor))) {
      diffs.push({ key: `bom:${componentId}:scrapFactor`, category: "bom", label: "Scrap factor", baseline: base ? pct(base.scrapFactor) : "—", scenario: pct(override.scrapFactor) });
    }
    if (override.readinessOverride != null) {
      diffs.push({ key: `bom:${componentId}:readinessOverride`, category: "bom", label: "Readiness", baseline: "derived", scenario: override.readinessOverride });
    }
  });

  /* --- analogues ------------------------------------------------------ */
  const analogueOverride = overrides.analogues;
  if (analogueOverride != null && Object.keys(baseline.analogueWeightByProductId).length > 0) {
    (analogueOverride.removedAnalogueIds ?? []).forEach((id) => {
      diffs.push({ key: `analogues:removed:${id}`, category: "analogues", label: "Analogue removed", baseline: "active", scenario: `${id} removed` });
    });
    // Only EXPLICITLY set weights are diffed, and each is compared against
    // that analogue's own default (its similarity score). Two things this
    // avoids: (a) counting the renormalization the engine performs on the
    // OTHER analogues as separate planner decisions, and (b) reporting a
    // change when a planner sets a weight to the value it already had.
    Object.entries(analogueOverride.weights ?? {}).forEach(([productId, raw]) => {
      const base = baseline.analogueSimilarityByProductId[productId];
      if (base == null || !differs(raw, base)) return;
      diffs.push({ key: `analogues:weight:${productId}`, category: "analogues", label: "Analogue weight", baseline: pct(base), scenario: pct(raw) });
    });
  }

  return diffs;
}

/** The number every surface should render for "N overrides vs. baseline". */
export function countMeaningfulOverrides(overrides: ScenarioOverrides, baseline: OverrideBaseline): number {
  return diffOverrides(overrides, baseline).length;
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}
