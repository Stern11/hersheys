import type { PlanningGap } from "@/types/gaps";
import type { PlanningBasis } from "@/types/methodology";
import type { EvidenceSignal } from "@/types/shared";
import type { ScenarioOverrides, ScenarioResult } from "@/types/scenario";
import type { CalculateScenarioInput } from "./scenarios";
import { calculateScenario } from "./scenarios";
import { seasonalForecast } from "./seasonality";
import { businessToPlanReconciliation } from "./demand";

import { EVENTS } from "@/data/synthetic/events";
import { HISTORICAL_PERIODS, historicalPeriodsForEvent } from "@/data/synthetic/historical-demand";
import { PRODUCTION_LINES } from "@/data/synthetic/master-data";
import { CAPACITY_BUCKETS } from "@/data/synthetic/capacity";
import { MATERIALS, materialById } from "@/data/synthetic/materials";
import { bomForProduct } from "@/data/synthetic/bom";
import { ANALOGUES } from "@/data/synthetic/products";
import { OBSERVED_PERFORMANCE, leadTimeP80, purchaseOrdersForMaterial } from "@/data/synthetic/execution-history";
import { currentFormalPlanValue } from "@/data/synthetic/planning-snapshots";
import { DEMO_NOW } from "@/data/synthetic/master-data";

const materialsById = new Map(MATERIALS.map((m) => [m.id, m]));
const leadTimeP80ByMaterial = new Map(MATERIALS.map((m) => [m.id, leadTimeP80(m.id)]));
const observedRunRateByLine = new Map(
  PRODUCTION_LINES.map((l) => [l.id, OBSERVED_PERFORMANCE.find((o) => o.metric === "run_rate_units_per_hour" && o.scopeId === l.id)?.value ?? l.historicalMedianRunRateUnitsPerHour])
);

export interface GapDetectionResult {
  gap: PlanningGap;
  planningBasis: PlanningBasis;
  evidence: EvidenceSignal[];
  scenarioResult?: ScenarioResult;
}

/**
 * Assembles the Halloween gap's calculateScenario() input from synthetic
 * data, parameterized by `overrides` so both baseline gap detection and a
 * live Scenario Lab session (with a planner's in-progress overrides) share
 * one definition instead of drifting apart.
 */
export function buildHalloweenScenarioInput(scenarioId: string, overrides: ScenarioOverrides): CalculateScenarioInput {
  const event = EVENTS.find((e) => e.id === "evt_halloween_2027")!;
  const formal = currentFormalPlanValue("event", event.id);
  const periods = historicalPeriodsForEvent(event.id);

  return {
    scenarioId,
    gapId: "halloween-2027",
    formalDemandUnits: formal.value,
    historicalPeriods: periods,
    growthAssumption: event.businessGrowthAssumption,
    productionRequirementDate: event.productionWindow.end,
    lineAllocations: [
      { lineId: "line_03", defaultShare: 0.65 },
      { lineId: "line_01", defaultShare: 0.25 },
      { lineId: "line_04", defaultShare: 0.1 },
    ],
    lines: PRODUCTION_LINES,
    capacityBuckets: CAPACITY_BUCKETS.filter((b) => ["line_01", "line_03", "line_04"].includes(b.lineId) && b.period === "2027-09"),
    observedRunRateByLine,
    bomRows: bomForProduct("prod_halloween_variety_classic"),
    materialsById,
    leadTimeP80ByMaterial,
    planningBasis: HALLOWEEN_BASIS,
    overrides,
  };
}

/** Halloween demand/capacity gap — Golden Scenario A (PRD §28.1). */
function detectHalloweenGap(): GapDetectionResult {
  const event = EVENTS.find((e) => e.id === "evt_halloween_2027")!;
  const formal = currentFormalPlanValue("event", event.id);
  const periods = historicalPeriodsForEvent(event.id);

  const scenarioResult = calculateScenario(buildHalloweenScenarioInput("baseline_halloween", {}));

  const forecast = seasonalForecast({ historicalPeriods: periods, growthAssumption: event.businessGrowthAssumption });
  const b2p = businessToPlanReconciliation(formal.value, forecast.base);

  const earliestDeadline = [...scenarioResult.decisionDeadlines].sort((a, b) => (a.date < b.date ? -1 : 1))[0];

  const gap: PlanningGap = {
    id: "halloween-2027",
    title: "Halloween assortment appears underrepresented",
    type: "demand",
    status: "open",
    severity: scenarioResult.capacityImpact.some((c) => c.riskLevel === "critical") ? "critical" : "warning",
    eventId: event.id,
    productFamilyId: "fam_variety_bags",
    lineId: "line_03",
    period: { start: event.productionWindow.start, end: event.productionWindow.end },
    formalValue: formal.value,
    expectedValueLow: forecast.low,
    expectedValueHigh: forecast.high,
    unresolvedValue: b2p.unresolvedAmount,
    unit: "units",
    confidence: scenarioResult.confidence,
    earliestDeadlineId: earliestDeadline?.id,
    planningBasisId: HALLOWEEN_BASIS.id,
    evidenceIds: HALLOWEEN_EVIDENCE.map((e) => e.id),
    linkedScenarioIds: [],
    changeSincePriorReview: [{ field: "formalValue", previousValue: 3_500_000, newValue: formal.value }],
    createdAt: "2027-08-10T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: HALLOWEEN_BASIS, evidence: HALLOWEEN_EVIDENCE, scenarioResult };
}

const HALLOWEEN_BASIS: PlanningBasis = {
  id: "basis_halloween_demand",
  methodologyIds: ["seasonal_event_forecasting", "business_to_plan_reconciliation", "rccp"],
  primaryMethodologyId: "seasonal_event_forecasting",
  whySelected: "Three comparable, non-atypical Halloween seasons exist with consistent growth — enough history to forecast this event without needing an analogue.",
  historicalWindow: { seasonsOrYears: 3, excludedPeriodIds: ["hist_halloween_2023"], recentPeriodWeighting: "recent_weighted" },
  filters: { productFamilyIds: ["fam_variety_bags"] },
  plannerOverrides: [],
};

const HALLOWEEN_EVIDENCE: EvidenceSignal[] = HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_halloween_2027").map((p) => ({
  id: `evidence_${p.id}`,
  source: "Historical Shipments",
  sourceObjectType: "historical_period",
  sourceObjectId: p.id,
  dateRange: { start: p.start, end: p.end },
  value: p.actualUnits,
  unit: "units",
  quality: p.isAtypical ? "low" : "high",
  freshness: DEMO_NOW,
  suppliedBy: "system",
  included: !p.isAtypical,
  excludedReason: p.isAtypical ? p.atypicalReason : undefined,
}));

/** Printed Film lead-time gap — Golden Scenario C (PRD §28.3). */
function detectPrintedFilmGap(): GapDetectionResult {
  const material = materialById("mat_printed_film");
  const p80 = leadTimeP80(material.id);
  const affectedRecords = purchaseOrdersForMaterial(material.id).filter((p) => !p.excluded);

  const gap: PlanningGap = {
    id: "printed-film-lead-time",
    title: "Printed Film lead time may be optimistic",
    type: "master_data",
    status: "open",
    severity: "warning",
    materialId: material.id,
    period: { start: "2027-08-24", end: "2027-12-31" },
    formalValue: material.systemLeadTimeDays,
    expectedValueLow: material.historicalMedianLeadTimeDays,
    expectedValueHigh: p80,
    unresolvedValue: p80 - material.systemLeadTimeDays,
    unit: "days",
    confidence: {
      overall: 0.83,
      dimensions: [{ dimension: "historical_data_quality", score: 0.83, note: `${affectedRecords.length} non-outlier receipts in the last 12 months` }],
    },
    planningBasisId: PRINTED_FILM_BASIS.id,
    evidenceIds: PRINTED_FILM_EVIDENCE.map((e) => e.id),
    linkedScenarioIds: [],
    createdAt: "2027-08-15T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: PRINTED_FILM_BASIS, evidence: PRINTED_FILM_EVIDENCE };
}

const PRINTED_FILM_BASIS: PlanningBasis = {
  id: "basis_printed_film_lead_time",
  methodologyIds: ["historical_performance_analysis"],
  primaryMethodologyId: "historical_performance_analysis",
  whySelected: "System lead time has not been re-validated against actual PO-to-goods-receipt elapsed time in over a year; a full 12-month sample is available.",
  statistic: "p80",
  sampleCount: purchaseOrdersForMaterial("mat_printed_film").filter((p) => !p.excluded).length,
  plannerOverrides: [],
};

const PRINTED_FILM_EVIDENCE: EvidenceSignal[] = purchaseOrdersForMaterial("mat_printed_film")
  .slice(0, 12)
  .map((p) => ({
    id: `evidence_${p.id}`,
    source: "SAP S/4HANA",
    sourceObjectType: "purchase_order",
    sourceObjectId: p.id,
    dateRange: { start: p.poDate, end: p.goodsReceiptDate },
    value: p.elapsedDays,
    unit: "days",
    quality: p.excluded ? "low" : "high",
    freshness: DEMO_NOW,
    suppliedBy: "system",
    included: !p.excluded,
    excludedReason: p.excludedReason,
  }));

/**
 * Assembles the Valentine's gap's calculateScenario() input, mirroring
 * buildHalloweenScenarioInput. With no analogue override, it uses the
 * hand-resolved analogue-derived BOM rows already stored on
 * data/synthetic/bom.ts (provenance: "inferred", each row citing its source
 * analogue). Once a planner touches the analogue mix (accept/reject/
 * reweight) in Scenario Lab, this switches to the live blending path in
 * lib/planning-engine/analogues.ts — a genuine recomputation, not a lookup.
 */
export function buildValentinesScenarioInput(scenarioId: string, overrides: ScenarioOverrides): CalculateScenarioInput {
  const event = EVENTS.find((e) => e.id === "evt_valentines_2028")!;
  const periods = historicalPeriodsForEvent(event.id);
  const useLiveBlend = overrides.analogues != null;

  return {
    scenarioId,
    gapId: "valentines-premium-tin",
    formalDemandUnits: 0,
    historicalPeriods: periods,
    growthAssumption: event.businessGrowthAssumption,
    productionRequirementDate: event.productionWindow.end,
    lineAllocations: [{ lineId: "line_03", defaultShare: 1 }],
    lines: PRODUCTION_LINES,
    capacityBuckets: [],
    observedRunRateByLine,
    bomRows: bomForProduct("prod_valentines_premium_tin_2028"),
    analogueCandidates: useLiveBlend ? ANALOGUES : undefined,
    analogueBomByProductId: useLiveBlend
      ? new Map([
          ["prod_mothers_day_tin_2027", bomForProduct("prod_mothers_day_tin_2027")],
          ["prod_holiday_premium_tin", bomForProduct("prod_holiday_premium_tin")],
        ])
      : undefined,
    materialsById,
    leadTimeP80ByMaterial,
    planningBasis: VALENTINES_BASIS,
    overrides,
  };
}

/** Valentine's Premium Tin — Golden Scenario B (PRD §28.2). */
function detectValentinesTinGap(): GapDetectionResult {
  const event = EVENTS.find((e) => e.id === "evt_valentines_2028")!;
  const periods = historicalPeriodsForEvent(event.id);

  const scenarioResult = calculateScenario(buildValentinesScenarioInput("baseline_valentines", {}));

  const forecast = seasonalForecast({ historicalPeriods: periods, growthAssumption: event.businessGrowthAssumption });

  const gap: PlanningGap = {
    id: "valentines-premium-tin",
    title: "Valentine's Premium Tin can be partially planned",
    type: "bom_uncertainty",
    status: "open",
    severity: "informational",
    eventId: event.id,
    productFamilyId: "fam_gift_tins",
    productId: "prod_valentines_premium_tin_2028",
    period: { start: event.productionWindow.start, end: event.productionWindow.end },
    formalValue: 0,
    expectedValueLow: forecast.low,
    expectedValueHigh: forecast.high,
    unresolvedValue: forecast.base,
    unit: "units",
    confidence: scenarioResult.confidence,
    planningBasisId: VALENTINES_BASIS.id,
    evidenceIds: VALENTINES_EVIDENCE.map((e) => e.id),
    linkedScenarioIds: [],
    createdAt: "2027-08-05T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: VALENTINES_BASIS, evidence: VALENTINES_EVIDENCE, scenarioResult };
}

const VALENTINES_BASIS: PlanningBasis = {
  id: "basis_valentines_tin_bom",
  methodologyIds: ["analogous_forecasting", "pre_mrp_bom_explosion"],
  primaryMethodologyId: "analogous_forecasting",
  whySelected: "No exact SKU history exists yet; Mother's Day Tin 2027 shares pack format and formulation family, so its BOM and demand pattern are a strong starting analogue.",
  analogueSetId: "valentines_tin_analogues",
  plannerOverrides: [],
};

const VALENTINES_EVIDENCE: EvidenceSignal[] = [
  ...ANALOGUES.map((a) => ({
    id: `evidence_${a.id}`,
    source: "Item Master / PLM",
    sourceObjectType: "analogue_product",
    sourceObjectId: a.candidateProductId,
    value: a.similarityScore,
    unit: "similarity_score",
    quality: a.dataQuality,
    freshness: DEMO_NOW,
    suppliedBy: "ai" as const,
    included: true,
    rationale: `Same: ${a.sameDimensions.join(", ")}. Different: ${a.differentDimensions.join(", ")}.`,
  })),
  ...HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_valentines_2028").map((p) => ({
    id: `evidence_${p.id}`,
    source: "Historical Shipments",
    sourceObjectType: "historical_period",
    sourceObjectId: p.id,
    dateRange: { start: p.start, end: p.end },
    value: p.actualUnits,
    unit: "units",
    quality: "high" as const,
    freshness: DEMO_NOW,
    suppliedBy: "system" as const,
    included: true,
  })),
];

/** Derived capacity consequence at Line 03 in September — Gap Type E, sourced from the Halloween scenario. */
function detectLine03CapacityGap(halloween: GapDetectionResult): GapDetectionResult {
  const impact = halloween.scenarioResult!.capacityImpact.find((c) => c.lineId === "line_03" && c.period === "2027-09")!;

  const gap: PlanningGap = {
    id: "line-03-september-capacity",
    type: "capacity",
    title: "Line 03 effective capacity exceeds target once unresolved Halloween demand is included",
    status: "open",
    severity: impact.riskLevel === "critical" ? "critical" : "warning",
    eventId: "evt_halloween_2027",
    lineId: "line_03",
    period: { start: "2027-09-01", end: "2027-09-30" },
    formalValue: Math.round(impact.formalUtilization * 1000) / 10,
    expectedValueLow: Math.round(impact.p50Utilization * 1000) / 10,
    expectedValueHigh: Math.round(impact.p80Utilization * 1000) / 10,
    unresolvedValue: Math.round((impact.effectiveUtilization - impact.formalUtilization) * 1000) / 10,
    unit: "%",
    confidence: { overall: 0.78, dimensions: [{ dimension: "line_resource", score: 0.78 }] },
    planningBasisId: HALLOWEEN_BASIS.id,
    evidenceIds: [],
    linkedScenarioIds: [],
    createdAt: "2027-08-10T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: HALLOWEEN_BASIS, evidence: [] };
}

/** Line-mapping master-data anomaly (PRD §6.4) — Counter Displays routed to Line 02, 84% actually run on Line 01. */
function detectLineMappingGap(): GapDetectionResult {
  const observed = OBSERVED_PERFORMANCE.find((o) => o.id === "obs_line_usage_fam_counter_displays")!;
  const actualSharePct = Math.round(observed.value * 1000) / 10;

  const gap: PlanningGap = {
    id: "counter-display-line-mapping",
    type: "master_data",
    title: "Counter Display routing may not reflect actual execution",
    status: "open",
    severity: "warning",
    productFamilyId: "fam_counter_displays",
    lineId: "line_02",
    period: { start: "2026-08-24", end: "2027-08-24" },
    formalValue: 0,
    expectedValueLow: actualSharePct,
    expectedValueHigh: actualSharePct,
    unresolvedValue: actualSharePct,
    unit: "%",
    confidence: { overall: 0.88, dimensions: [{ dimension: "historical_data_quality", score: 0.88, note: `${observed.sampleCount} production confirmations` }] },
    planningBasisId: LINE_MAPPING_BASIS.id,
    evidenceIds: [],
    linkedScenarioIds: [],
    createdAt: "2027-07-28T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: LINE_MAPPING_BASIS, evidence: [] };
}

const LINE_MAPPING_BASIS: PlanningBasis = {
  id: "basis_counter_display_line_mapping",
  methodologyIds: ["historical_performance_analysis"],
  primaryMethodologyId: "historical_performance_analysis",
  whySelected: "System routing has not been reconciled against a full year of production confirmations for this family.",
  statistic: "custom",
  plannerOverrides: [],
};

/**
 * Holiday Gift Tins — Kroger Exclusive: a pure representation gap (Gap Type
 * B). Unlike Halloween (a magnitude gap) or Valentine's (a BOM-readiness
 * gap), the issue here is existence, not quantity or material confidence —
 * Kroger has ordered a customer-exclusive format the last two seasons, but
 * no 2027 SKU has been created in the item master yet. No RCCP/BOM
 * pipeline applies until the item itself exists, so this is assembled
 * directly rather than through calculateScenario().
 */
function detectHolidayGiftTinsGap(): GapDetectionResult {
  const event = EVENTS.find((e) => e.id === "evt_holiday_2027")!;
  const periods = historicalPeriodsForEvent(event.id);
  const familyForecast = seasonalForecast({ historicalPeriods: periods, growthAssumption: event.businessGrowthAssumption });

  // Estimated share of family volume Kroger's exclusive format has
  // represented historically — a category-level estimate, since the
  // customer-exclusive SKU itself has no volume history of its own.
  const KROGER_EXCLUSIVE_SHARE = 0.09;
  const expectedBase = Math.round(familyForecast.base * KROGER_EXCLUSIVE_SHARE);
  const expectedLow = Math.round(familyForecast.low * KROGER_EXCLUSIVE_SHARE);
  const expectedHigh = Math.round(familyForecast.high * KROGER_EXCLUSIVE_SHARE);

  const gap: PlanningGap = {
    id: "holiday-gift-tins-representation",
    title: "Kroger's exclusive Holiday tin has no 2027 SKU yet",
    type: "representation",
    status: "open",
    severity: "warning",
    eventId: event.id,
    productFamilyId: "fam_gift_tins",
    productId: "prod_holiday_kroger_exclusive_tin",
    customerId: "cust_kroger",
    period: { start: event.productionWindow.start, end: event.productionWindow.end },
    formalValue: 0,
    expectedValueLow: expectedLow,
    expectedValueHigh: expectedHigh,
    unresolvedValue: expectedBase,
    unit: "units",
    confidence: {
      overall: 0.58,
      dimensions: [
        { dimension: "business_intent", score: 0.8, note: "Kroger has ordered an exclusive Holiday format in each of the last two seasons." },
        { dimension: "exact_sku", score: 0.15, note: "No 2027 item, artwork, or BOM exists yet." },
        { dimension: "demand_magnitude", score: 0.6, note: "Estimated from Gift Tins' category-level Kroger share, not this item's own history." },
      ],
    },
    planningBasisId: HOLIDAY_REPRESENTATION_BASIS.id,
    evidenceIds: HOLIDAY_REPRESENTATION_EVIDENCE.map((e) => e.id),
    linkedScenarioIds: [],
    createdAt: "2027-08-01T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: HOLIDAY_REPRESENTATION_BASIS, evidence: HOLIDAY_REPRESENTATION_EVIDENCE };
}

const HOLIDAY_REPRESENTATION_BASIS: PlanningBasis = {
  id: "basis_holiday_kroger_exclusive_representation",
  methodologyIds: ["business_to_plan_reconciliation", "analogous_forecasting"],
  primaryMethodologyId: "business_to_plan_reconciliation",
  whySelected: "Kroger's exclusive format has appeared in each of the last two Holiday seasons but is absent from the 2027 item master — a coverage check against known customer commercial intent, not a demand-forecasting problem.",
  filters: { customerIds: ["cust_kroger"], productFamilyIds: ["fam_gift_tins"] },
  plannerOverrides: [],
};

const HOLIDAY_REPRESENTATION_EVIDENCE: EvidenceSignal[] = [
  {
    id: "evidence_holiday_kroger_2026_intent",
    source: "Commercial / Customer Plan",
    sourceObjectType: "customer_commitment",
    sourceObjectId: "cust_kroger",
    value: "Exclusive Holiday tin ordered 2025 and 2026",
    quality: "medium",
    freshness: DEMO_NOW,
    suppliedBy: "planner",
    included: true,
    rationale: "No formal 2027 commitment on file yet, but the pattern has held for two consecutive seasons.",
  },
  {
    id: "evidence_holiday_kroger_item_master",
    source: "Item Master / PLM",
    sourceObjectType: "product",
    sourceObjectId: "prod_holiday_kroger_exclusive_tin",
    value: "No 2027 SKU, artwork, or BOM on file",
    quality: "high",
    freshness: DEMO_NOW,
    suppliedBy: "system",
    included: true,
  },
];

export function detectPlanningGaps(): GapDetectionResult[] {
  const halloween = detectHalloweenGap();
  const printedFilm = detectPrintedFilmGap();
  const valentines = detectValentinesTinGap();
  const line03Capacity = detectLine03CapacityGap(halloween);
  const lineMapping = detectLineMappingGap();
  const holidayRepresentation = detectHolidayGiftTinsGap();
  return [halloween, printedFilm, valentines, line03Capacity, lineMapping, holidayRepresentation];
}
