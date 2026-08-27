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
import { PRODUCTION_LINES, lineById } from "@/data/synthetic/master-data";
import { CAPACITY_BUCKETS, HALLOWEEN_PEAK_PRODUCTION_PERIOD, capacityBucket } from "@/data/synthetic/capacity";
import { MATERIALS, materialById } from "@/data/synthetic/materials";
import { bomForProduct } from "@/data/synthetic/bom";
import { ANALOGUES, productById } from "@/data/synthetic/products";
import { OBSERVED_PERFORMANCE, OBSERVATION_WINDOW, leadTimeP80, purchaseOrdersForMaterial, LINE_MAPPING_RECORDS, lineMappingSummary } from "@/data/synthetic/execution-history";
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
 * Master-data corrections the planner has already ACCEPTED, and which are
 * therefore part of the baseline model rather than a what-if.
 *
 * Printed Seasonal Film's ERP norm (42 days / 6 weeks) was re-validated
 * against a full year of PO-to-goods-receipt execution and replaced with
 * the observed historical P80. This is the "norm setting" step: once a
 * planner accepts the corrected norm, every surface must compute against it
 * — the Halloween workspace can no longer explode its BOM at 42 days while
 * the lead-time workspace reports the accepted basis, because both now
 * resolve the same value.
 *
 * These are DEFAULTS: a scenario's own masterAssumptions always win, so a
 * planner can still simulate reverting to the system norm.
 */
export const ACCEPTED_MASTER_ASSUMPTIONS: NonNullable<ScenarioOverrides["masterAssumptions"]> = {
  "material:mat_printed_film:lead_time": { selectedBasis: "historical", leadTimeStatistic: "p80" },
};

const ACCEPTED_FILM_LEAD_TIME_DAYS = leadTimeP80ByMaterial.get("mat_printed_film") ?? materialById("mat_printed_film").historicalP80LeadTimeDays;

/**
 * Assembles the Halloween gap's calculateScenario() input from synthetic
 * data, parameterized by `overrides` so both baseline gap detection and a
 * live Scenario Lab session (with a planner's in-progress overrides) share
 * one definition instead of drifting apart.
 *
 * TIMING: `productionRequirementDate` is anchored to the event's PRODUCTION
 * window, never its sales window. Halloween 2027 is built Mar-Jul and sells
 * Sep-Oct; a material order-by date computed off the sell-through window
 * would be four months late. Likewise the capacity buckets below are the
 * peak PRODUCTION month (June), not a sell-through month.
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
    capacityBuckets: CAPACITY_BUCKETS.filter((b) => ["line_01", "line_03", "line_04"].includes(b.lineId) && b.period === HALLOWEEN_PEAK_PRODUCTION_PERIOD),
    observedRunRateByLine,
    bomRows: bomForProduct("prod_halloween_variety_classic"),
    materialsById,
    leadTimeP80ByMaterial,
    planningBasis: HALLOWEEN_BASIS,
    overrides: {
      ...overrides,
      masterAssumptions: { ...ACCEPTED_MASTER_ASSUMPTIONS, ...overrides.masterAssumptions },
    },
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
    title: "Reese's Halloween snack size appears underrepresented",
    type: "demand",
    status: "open",
    severity: scenarioResult.capacityImpact.some((c) => c.riskLevel === "critical") ? "critical" : "warning",
    eventId: event.id,
    productFamilyId: "fam_variety_bags",
    productId: "prod_halloween_variety_classic",
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
    createdAt: "2027-01-18T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: HALLOWEEN_BASIS, evidence: HALLOWEEN_EVIDENCE, scenarioResult };
}

const HALLOWEEN_BASIS: PlanningBasis = {
  id: "basis_halloween_demand",
  methodologyIds: ["seasonal_event_forecasting", "business_to_plan_reconciliation", "rccp"],
  primaryMethodologyId: "seasonal_event_forecasting",
  whySelected:
    "Three comparable, non-atypical Halloween seasons exist for this family with consistent growth, so the season can be forecast directly from its own history rather than from an analogue. 2023 is held out: that season was supply-capped by a peanut-paste interruption, so its sell-out understates demand. The forecast is reconciled against the formal Q3 shipment plan, and the resulting unresolved volume is pushed through RCCP on the June PRODUCTION peak — not on the Sep-Oct sell-through months.",
  historicalWindow: { seasonsOrYears: 3, excludedPeriodIds: ["hist_halloween_2023"], recentPeriodWeighting: "recent_weighted" },
  filters: { productFamilyIds: ["fam_variety_bags"] },
  plannerOverrides: [
    {
      id: "po_accepted_film_lead_time",
      field: "material:mat_printed_film:lead_time",
      previousValue: `${materialById("mat_printed_film").systemLeadTimeDays}d (ERP norm)`,
      newValue: `${ACCEPTED_FILM_LEAD_TIME_DAYS}d (historical P80)`,
      reason: "Accepted norm correction — the ERP's 6-week film norm has not held for a full year of receipts, so the seasonal BOM explosion uses the observed P80.",
      changedAt: "2027-02-19T14:00:00.000Z",
      changedBy: "planner",
    },
  ],
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
  rationale: p.isAtypical ? undefined : "Sell-through window; production for this season ran five to seven months earlier.",
}));

/** Printed Seasonal Film lead-time gap — Golden Scenario C (PRD §28.3). */
function detectPrintedFilmGap(): GapDetectionResult {
  const material = materialById("mat_printed_film");
  const p80 = leadTimeP80(material.id);
  const affectedRecords = purchaseOrdersForMaterial(material.id).filter((p) => !p.excluded);

  const gap: PlanningGap = {
    id: "printed-film-lead-time",
    title: "Printed Seasonal Film lead time may be optimistic",
    type: "master_data",
    status: "open",
    severity: "warning",
    materialId: material.id,
    period: { start: OBSERVATION_WINDOW.start, end: OBSERVATION_WINDOW.end },
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
    createdAt: "2027-01-25T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: PRINTED_FILM_BASIS, evidence: PRINTED_FILM_EVIDENCE };
}

const PRINTED_FILM_BASIS: PlanningBasis = {
  id: "basis_printed_film_lead_time",
  methodologyIds: ["historical_performance_analysis"],
  primaryMethodologyId: "historical_performance_analysis",
  whySelected:
    "Seasonal laminate is art- and plate-dependent: the print run cannot start until artwork is approved and cylinders are cut, so a graphics revision restarts the clock. The ERP norm has not been re-validated against PO-to-goods-receipt elapsed time in over a year, and a full 12-month sample is available. The P80 rather than the median is used because a season is one shot — there is no reorder window if the film lands late.",
  statistic: "p80",
  sampleCount: purchaseOrdersForMaterial("mat_printed_film").filter((p) => !p.excluded).length,
  plannerOverrides: [
    {
      id: "po_printed_film_basis_accepted",
      field: "lead_time_basis",
      previousValue: "system",
      newValue: "historical_p80",
      reason: "Accepted as the planning norm; the Halloween seasonal BOM explosion now uses the same basis.",
      changedAt: "2027-02-19T14:00:00.000Z",
      changedBy: "planner",
    },
  ],
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
    rationale: `${p.supplierName} — ${p.quantity.toLocaleString()} MSI received.`,
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
    // Sep-Dec 2027 build, not the Jan-Feb 2028 sell-through window.
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
    // The accepted film norm is a master-data fact, not a Halloween-only
    // assumption — it has to hold on every surface that explodes a BOM, or
    // two pages end up quoting two different order-by dates for the same
    // material. A scenario's own masterAssumptions still win.
    overrides: {
      ...overrides,
      masterAssumptions: { ...ACCEPTED_MASTER_ASSUMPTIONS, ...overrides.masterAssumptions },
    },
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
    title: "Reese's Valentine's Hearts tin can be partially planned",
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
    createdAt: "2027-01-11T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: VALENTINES_BASIS, evidence: VALENTINES_EVIDENCE, scenarioResult };
}

const VALENTINES_BASIS: PlanningBasis = {
  id: "basis_valentines_tin_bom",
  methodologyIds: ["analogous_forecasting", "pre_mrp_bom_explosion"],
  primaryMethodologyId: "analogous_forecasting",
  whySelected:
    "The heart shape is approved but no SKU, mold or film part number has been extended to the plant, so there is no BOM for MRP to explode. Reese's Mother's Day Tin 2027 shares the 18oz litho tin, the peanut-butter formulation and the producing plant, so its BOM and demand pattern are a strong starting analogue; the Kisses Holiday tin contributes only the tin construction. Formulation inputs inherit with high confidence, shape-dependent packaging does not — which is exactly the split the readiness classification exposes.",
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
    rationale: `${productById(a.candidateProductId).name}. Same: ${a.sameDimensions.join(", ")}. Different: ${a.differentDimensions.join(", ")}.`,
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

/**
 * Derived capacity consequence on Line 03 in the peak Halloween PRODUCTION
 * month — Gap Type E, sourced from the Halloween scenario.
 *
 * The gap id is a stable route slug and is deliberately left unchanged; the
 * period it actually describes is HALLOWEEN_PEAK_PRODUCTION_PERIOD (June
 * 2027), because September is a Halloween SELL-THROUGH month in which no
 * Halloween unit is produced.
 */
function detectLine03CapacityGap(halloween: GapDetectionResult): GapDetectionResult {
  const impact = halloween.scenarioResult!.capacityImpact.find((c) => c.lineId === "line_03" && c.period === HALLOWEEN_PEAK_PRODUCTION_PERIOD)!;
  const line = lineById("line_03");

  const gap: PlanningGap = {
    id: "line-03-september-capacity",
    type: "capacity",
    // Work-centre names come from master data. "Line 03" is a pre-rename
    // label that names nothing in this dataset any more; the gap id stays
    // `line-03-september-capacity` because it is a stable route slug.
    title: `${line.name} exceeds its utilization target in the June 2027 Halloween build once unresolved demand is included`,
    status: "open",
    severity: impact.riskLevel === "critical" ? "critical" : "warning",
    eventId: "evt_halloween_2027",
    lineId: "line_03",
    productFamilyId: "fam_variety_bags",
    period: { start: "2027-06-01", end: "2027-06-30" },
    formalValue: Math.round(impact.formalUtilization * 1000) / 10,
    expectedValueLow: Math.round(impact.p50Utilization * 1000) / 10,
    expectedValueHigh: Math.round(impact.p80Utilization * 1000) / 10,
    unresolvedValue: Math.round((impact.effectiveUtilization - impact.formalUtilization) * 1000) / 10,
    unit: "%",
    confidence: {
      overall: 0.78,
      dimensions: [
        { dimension: "line_resource", score: 0.82, note: `${line.plant} — committed hours and downtime are firm for this bucket` },
        { dimension: "demand_magnitude", score: 0.74, note: "Load added is the unresolved Halloween volume, which is itself a forecast" },
      ],
    },
    planningBasisId: LINE03_CAPACITY_BASIS.id,
    evidenceIds: LINE03_CAPACITY_EVIDENCE.map((e) => e.id),
    linkedScenarioIds: [],
    createdAt: "2027-01-18T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: LINE03_CAPACITY_BASIS, evidence: LINE03_CAPACITY_EVIDENCE };
}

const LINE03_CAPACITY_BASIS: PlanningBasis = {
  id: "basis_line03_peak_capacity",
  methodologyIds: ["rccp", "production_leveling"],
  primaryMethodologyId: "rccp",
  whySelected:
    "Rough-cut capacity, run against the PRODUCTION bucket rather than the sell-through month: Halloween units are built Mar-Jul and Stuarts Draft L03 carries 65% of the seasonal allocation, peaking in June. Committed hours, planned downtime and formal load come straight from the June bucket; the unresolved Halloween volume is converted to hours at the line's run rate and stacked on top, so the line's true position is visible before the build is committed. West Hershey L04 is the leveling candidate because it is the only eligible line with headroom in the same month.",
  filters: { lineIds: ["line_03"], productFamilyIds: ["fam_variety_bags"] },
  plannerOverrides: [],
};

/**
 * Evidence for the capacity consequence: the committed capacity facts the
 * ceiling is built from, the observed rate the hour conversion uses, and
 * the demand quantity being stacked on. Every row is a real record from the
 * synthetic source data — nothing here is a restatement of the conclusion.
 */
const LINE03_CAPACITY_EVIDENCE: EvidenceSignal[] = (() => {
  const bucket = capacityBucket("line_03", HALLOWEEN_PEAK_PRODUCTION_PERIOD);
  const line = lineById("line_03");
  const observedRate = OBSERVED_PERFORMANCE.find((o) => o.metric === "run_rate_units_per_hour" && o.scopeId === "line_03");
  const period = { start: "2027-06-01", end: "2027-06-30" };

  return [
    {
      id: "evidence_line03_available_hours",
      source: "SAP S/4HANA — Work Centre Capacity",
      sourceObjectType: "capacity_bucket",
      sourceObjectId: bucket.id,
      dateRange: period,
      value: bucket.availableHours - bucket.plannedDowntimeHours,
      unit: "hours",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: `${bucket.availableHours}h gross less ${bucket.plannedDowntimeHours}h planned downtime at ${line.plant}.`,
    },
    {
      id: "evidence_line03_formal_load",
      source: "SAP S/4HANA — Planned & Firm Orders",
      sourceObjectType: "capacity_bucket",
      sourceObjectId: bucket.id,
      dateRange: period,
      value: bucket.formalLoadHours,
      unit: "hours",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: "Committed load already in the formal plan for the June build.",
    },
    {
      id: "evidence_line03_validated_unresolved",
      source: "Planner Validation",
      sourceObjectType: "capacity_bucket",
      sourceObjectId: bucket.id,
      dateRange: period,
      value: bucket.validatedUnresolvedLoadHours,
      unit: "hours",
      quality: "medium",
      freshness: DEMO_NOW,
      suppliedBy: "planner",
      included: true,
      rationale: "Unresolved load a planner has already accepted onto this bucket — counted once, never re-inferred.",
    },
    {
      id: "evidence_line03_target_utilization",
      source: "Planning Policy",
      sourceObjectType: "capacity_bucket",
      sourceObjectId: bucket.id,
      dateRange: period,
      value: Math.round(bucket.targetUtilization * 100),
      unit: "%",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: "Target headroom policy for a seasonal build; above it, changeover and recovery time disappear.",
    },
    {
      id: "evidence_line03_standard_rate",
      source: "SAP S/4HANA — Routing",
      sourceObjectType: "production_line",
      sourceObjectId: line.id,
      value: line.standardRunRateUnitsPerHour,
      unit: "units/hr",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: "System standard rate — the hour conversion used by the baseline RCCP run.",
    },
    {
      id: "evidence_line03_observed_rate",
      source: "Production Confirmations",
      sourceObjectType: "observed_performance",
      sourceObjectId: observedRate?.id,
      dateRange: { start: OBSERVATION_WINDOW.start, end: OBSERVATION_WINDOW.end },
      value: observedRate?.value ?? line.historicalMedianRunRateUnitsPerHour,
      unit: "units/hr",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: `Median of ${observedRate?.sampleCount ?? 0} confirmations over the last 12 months — materially below the routing standard, which is why the scenario run rate is worth testing.`,
    },
  ];
})();

/**
 * Line-routing master-data anomaly (PRD §6.4): the routing record sends PDQ
 * counter displays to Reese L02, but most confirmations run on Reese L01.
 *
 * Quantity model — a routing gap has no "plan quantity" in finished units,
 * so the modelled quantity is the SHARE OF CONFIRMED EXECUTION that ran off
 * the routed work centre, measured two ways: by confirmed runs (the low
 * bound) and by confirmed volume (the high bound, higher because L01 runs
 * displays materially faster). Formal is 0% — the routing books none of it
 * on L01. The range is therefore two real measurements rather than a
 * degenerate point, and the hours, units and sampling interval behind it
 * are carried as evidence rows and confidence dimensions where they can be
 * read in their own units instead of being forced into one `unit` field.
 */
function detectLineMappingGap(): GapDetectionResult {
  const summary = lineMappingSummary();
  const pct = (x: number) => Math.round(x * 1000) / 10;
  const shareByRuns = summary.misroutedShare;
  const shareByUnits = summary.totalUnits > 0 ? summary.misroutedUnits / summary.totalUnits : 0;
  const shareByHours = summary.totalRuntimeHours > 0 ? summary.misroutedRuntimeHours / summary.totalRuntimeHours : 0;

  const gap: PlanningGap = {
    id: "counter-display-line-mapping",
    type: "master_data",
    title: "PDQ counter-display routing points at Reese L02 while the work runs on L01",
    status: "open",
    severity: "warning",
    productFamilyId: "fam_counter_displays",
    productId: "prod_counter_display_standard",
    lineId: "line_02",
    period: { start: OBSERVATION_WINDOW.start, end: OBSERVATION_WINDOW.end },
    formalValue: 0,
    expectedValueLow: pct(Math.min(shareByRuns, shareByUnits)),
    expectedValueHigh: pct(Math.max(shareByRuns, shareByUnits)),
    unresolvedValue: pct(shareByUnits),
    unit: "% of execution",
    confidence: {
      overall: 0.88,
      dimensions: [
        { dimension: "historical_data_quality", score: 0.92, note: `${summary.misroutedConfirmations} of ${summary.totalConfirmations} confirmations over 12 months; 80% interval on that share is ${pct(summary.misroutedShareLow)}-${pct(summary.misroutedShareHigh)}%` },
        { dimension: "line_resource", score: 0.84, note: `${summary.misroutedRuntimeHours}h of ${summary.totalRuntimeHours}h run time (${pct(shareByHours)}%) loaded a work centre the plan never books` },
      ],
    },
    planningBasisId: LINE_MAPPING_BASIS.id,
    evidenceIds: LINE_MAPPING_EVIDENCE.map((e) => e.id),
    linkedScenarioIds: [],
    createdAt: "2026-12-14T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: LINE_MAPPING_BASIS, evidence: LINE_MAPPING_EVIDENCE };
}

const LINE_MAPPING_BASIS: PlanningBasis = {
  id: "basis_counter_display_line_mapping",
  methodologyIds: ["historical_performance_analysis", "rccp"],
  primaryMethodologyId: "historical_performance_analysis",
  whySelected:
    "The routing master record for this family has never been reconciled against production confirmations. Both work centres sit in the same plant and both can physically run the display, so the work always got done and nothing ever failed loudly — but RCCP loads the wrong line at the wrong rate, and the two rates differ by roughly 25%. The magnitude is reported as a range because run count and confirmed volume give different answers: L01 runs displays faster, so it absorbs a larger share of the volume than of the runs. Sampling uncertainty on the run share is carried separately in the confidence dimensions rather than folded into the headline figure.",
  statistic: "custom",
  sampleCount: LINE_MAPPING_RECORDS.length,
  filters: { productFamilyIds: ["fam_counter_displays"], lineIds: ["line_01", "line_02"] },
  plannerOverrides: [],
};

/**
 * Evidence for the routing anomaly: the routing master record itself, the
 * aggregate that contradicts it, the rate difference that makes it matter,
 * and a readable sample of the individual confirmations behind it.
 */
const LINE_MAPPING_EVIDENCE: EvidenceSignal[] = (() => {
  const summary = lineMappingSummary();
  const routed = lineById("line_02");
  const actual = lineById("line_01");

  const onActual = LINE_MAPPING_RECORDS.filter((r) => r.actualLineId === "line_01");
  const onRouted = LINE_MAPPING_RECORDS.filter((r) => r.actualLineId === "line_02");
  const avg = (rows: typeof LINE_MAPPING_RECORDS) => (rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.computedUnitsPerHour, 0) / rows.length) : 0);

  const header: EvidenceSignal[] = [
    {
      id: "evidence_cd_routing_master",
      source: "SAP S/4HANA — Production Version / Routing",
      sourceObjectType: "routing_master_record",
      sourceObjectId: "prod_counter_display_standard",
      value: `Routed to ${routed.name} (${routed.plant})`,
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: "The record RCCP and MRP both plan against.",
    },
    {
      id: "evidence_cd_observed_share",
      source: "Production Confirmations",
      sourceObjectType: "observed_performance",
      sourceObjectId: "obs_line_usage_fam_counter_displays",
      dateRange: { start: OBSERVATION_WINDOW.start, end: OBSERVATION_WINDOW.end },
      value: Math.round(summary.misroutedShare * 1000) / 10,
      unit: "% of runs",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "ai",
      included: true,
      rationale: `${summary.misroutedConfirmations} of ${summary.totalConfirmations} confirmations executed on ${actual.name}, not the routed work centre.`,
    },
    {
      id: "evidence_cd_misrouted_hours",
      source: "Production Confirmations",
      sourceObjectType: "production_confirmation",
      dateRange: { start: OBSERVATION_WINDOW.start, end: OBSERVATION_WINDOW.end },
      value: summary.misroutedRuntimeHours,
      unit: "hours",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: `Of ${summary.totalRuntimeHours}h of confirmed display run time, this share loaded a work centre the plan never books.`,
    },
    {
      id: "evidence_cd_misrouted_units",
      source: "Production Confirmations",
      sourceObjectType: "production_confirmation",
      dateRange: { start: OBSERVATION_WINDOW.start, end: OBSERVATION_WINDOW.end },
      value: summary.misroutedUnits,
      unit: "units",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: `Display volume built on ${actual.name} against ${summary.totalUnits.toLocaleString()} units confirmed in total.`,
    },
    {
      id: "evidence_cd_rate_actual",
      source: "Production Confirmations",
      sourceObjectType: "production_line",
      sourceObjectId: actual.id,
      value: avg(onActual),
      unit: "units/hr",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: `Mean confirmed rate on ${actual.name} across ${onActual.length} display runs.`,
    },
    {
      id: "evidence_cd_rate_routed",
      source: "Production Confirmations",
      sourceObjectType: "production_line",
      sourceObjectId: routed.id,
      value: avg(onRouted),
      unit: "units/hr",
      quality: "medium",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: `Mean confirmed rate on ${routed.name} across ${onRouted.length} display runs — the rate RCCP applies to every unit.`,
    },
  ];

  const samples: EvidenceSignal[] = [...LINE_MAPPING_RECORDS]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8)
    .map((r) => ({
      id: `evidence_${r.id}`,
      source: "Production Confirmations",
      sourceObjectType: "production_confirmation",
      sourceObjectId: r.id,
      dateRange: { start: r.date, end: r.date },
      value: r.quantityUnits,
      unit: "units",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: `Routed ${routed.name} · actually ran ${r.actualLineId === "line_01" ? actual.name : routed.name} · ${r.runtimeHours}h at ${r.computedUnitsPerHour.toLocaleString()}/hr.`,
    }));

  return [...header, ...samples];
})();

/**
 * Holiday Gift Tins — Sam's Club exclusive: a pure representation gap (Gap
 * Type B). Unlike Halloween (a magnitude gap) or Valentine's (a BOM
 * readiness gap), the issue here is existence, not quantity or material
 * confidence — the club pack was committed verbally in the joint business
 * plan and has shipped for two seasons running, but there is no PO, so it
 * has no demand-planning representation and is invisible to MRP. No
 * RCCP/BOM pipeline applies until the item itself exists, so this is
 * assembled directly rather than through calculateScenario().
 */
function detectHolidayGiftTinsGap(): GapDetectionResult {
  const event = EVENTS.find((e) => e.id === "evt_holiday_2027")!;
  const periods = historicalPeriodsForEvent(event.id);
  const familyForecast = seasonalForecast({ historicalPeriods: periods, growthAssumption: event.businessGrowthAssumption });

  // Estimated share of family volume the club-exclusive format has
  // represented historically — a category-level estimate, since the
  // customer-exclusive SKU itself has no volume history of its own.
  const CLUB_EXCLUSIVE_SHARE = 0.09;
  const expectedBase = Math.round(familyForecast.base * CLUB_EXCLUSIVE_SHARE);
  const expectedLow = Math.round(familyForecast.low * CLUB_EXCLUSIVE_SHARE);
  const expectedHigh = Math.round(familyForecast.high * CLUB_EXCLUSIVE_SHARE);

  const gap: PlanningGap = {
    id: "holiday-gift-tins-representation",
    title: "Sam's Club's exclusive Holiday tin has no 2027 SKU yet",
    type: "representation",
    status: "open",
    severity: "warning",
    eventId: event.id,
    productFamilyId: "fam_gift_tins",
    productId: "prod_holiday_kroger_exclusive_tin",
    customerId: "cust_sams_club",
    period: { start: event.productionWindow.start, end: event.productionWindow.end },
    formalValue: 0,
    expectedValueLow: expectedLow,
    expectedValueHigh: expectedHigh,
    unresolvedValue: expectedBase,
    unit: "units",
    confidence: {
      overall: 0.58,
      dimensions: [
        { dimension: "business_intent", score: 0.8, note: "The club exclusive has shipped in each of the last two Holiday seasons and is in the joint business plan." },
        { dimension: "exact_sku", score: 0.15, note: "No 2027 item, artwork, tin part number or BOM exists yet — and no PO." },
        { dimension: "demand_magnitude", score: 0.6, note: "Estimated from the club share of Gift Tins volume, not from this item's own history." },
      ],
    },
    planningBasisId: HOLIDAY_REPRESENTATION_BASIS.id,
    evidenceIds: HOLIDAY_REPRESENTATION_EVIDENCE.map((e) => e.id),
    linkedScenarioIds: [],
    createdAt: "2027-01-05T09:00:00.000Z",
    updatedAt: DEMO_NOW,
    lastRecalculatedAt: DEMO_NOW,
  };

  return { gap, planningBasis: HOLIDAY_REPRESENTATION_BASIS, evidence: HOLIDAY_REPRESENTATION_EVIDENCE };
}

const HOLIDAY_REPRESENTATION_BASIS: PlanningBasis = {
  id: "basis_holiday_club_exclusive_representation",
  methodologyIds: ["business_to_plan_reconciliation", "analogous_forecasting"],
  primaryMethodologyId: "business_to_plan_reconciliation",
  whySelected:
    "A club-exclusive pack that has shipped for two consecutive Holiday seasons is absent from the 2027 item master. This is a coverage check against known commercial intent, not a forecasting problem: no PO exists, so demand planning has nothing to consume and MRP cannot see the item at all. Magnitude is estimated from the club share of Gift Tins volume, which is why demand confidence is deliberately held well below intent confidence. The offshore tin's 16-20 week lead time is what makes it urgent — the item has to exist before the tin can be committed.",
  filters: { customerIds: ["cust_sams_club"], productFamilyIds: ["fam_gift_tins"] },
  plannerOverrides: [],
};

const HOLIDAY_REPRESENTATION_EVIDENCE: EvidenceSignal[] = [
  {
    id: "evidence_holiday_club_intent",
    source: "Commercial / Joint Business Plan",
    sourceObjectType: "customer_commitment",
    sourceObjectId: "cust_sams_club",
    value: "Club-exclusive Holiday tin shipped 2025 and 2026; verbally committed for 2027",
    quality: "medium",
    freshness: DEMO_NOW,
    suppliedBy: "planner",
    included: true,
    rationale: "No 2027 purchase order on file yet, so nothing reaches demand planning — but the pattern has held for two consecutive seasons.",
  },
  {
    id: "evidence_holiday_club_item_master",
    source: "Item Master / PLM",
    sourceObjectType: "product",
    sourceObjectId: "prod_holiday_kroger_exclusive_tin",
    value: "No 2027 SKU, artwork, tin part number or BOM on file",
    quality: "high",
    freshness: DEMO_NOW,
    suppliedBy: "system",
    included: true,
  },
  {
    id: "evidence_holiday_club_tin_lead_time",
    source: "SAP S/4HANA — Purchasing Info Record",
    sourceObjectType: "material",
    sourceObjectId: "mat_tin_trim",
    value: materialById("mat_tin_trim").systemLeadTimeDays,
    unit: "days",
    quality: "high",
    freshness: DEMO_NOW,
    suppliedBy: "system",
    included: true,
    rationale: "Offshore litho tin. The item has to exist before this can be committed, and the Holiday build starts in July.",
  },
  ...HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_holiday_2027").map(
    (p): EvidenceSignal => ({
      id: `evidence_holiday_family_${p.id}`,
      source: "Historical Shipments",
      sourceObjectType: "historical_period",
      sourceObjectId: p.id,
      dateRange: { start: p.start, end: p.end },
      value: p.actualUnits,
      unit: "units",
      quality: "high",
      freshness: DEMO_NOW,
      suppliedBy: "system",
      included: true,
      rationale: "Gift Tins family sell-through; the club share is estimated against this base.",
    })
  ),
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
