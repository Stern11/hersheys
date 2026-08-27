import type { Confidence } from "./shared";
import type { DecisionDeadline, MaterialReadiness } from "./planning";
import type { PlanningMethodologyId } from "./methodology";

/* ---------------------------------------------------------------------- *
 * Overrides — the ONLY thing scenario state stores. Everything derived
 * (expectedDemand, capacityImpact, etc.) is recomputed by
 * lib/planning-engine/scenarios.ts::calculateScenario(), never persisted
 * to the store, so scenario state can never drift from its own baseline.
 * ---------------------------------------------------------------------- */

export interface DemandOverride {
  baselineDemandUnits?: number;
  seasonalUpliftPct?: number;
  growthRatePct?: number;
  eventProbabilityPct?: number;
  percentileSelection?: "low" | "base" | "high" | "p50" | "p80" | "p95";
  monthlyDistributionPct?: Record<string, number>; // period key -> share of total
}

export interface HistoricalBasisOverride {
  seasonsOrYears?: number;
  excludedPeriodIds?: string[];
  includedPeriodIds?: string[];
  channelIds?: string[];
  productFamilyIds?: string[];
  weighting?: "equal" | "recent_weighted" | "custom";
}

export interface AnalogueOverride {
  activeAnalogueIds?: string[];
  removedAnalogueIds?: string[];
  weights?: Record<string, number>; // analogueProductId -> weight
}

export interface BomComponentOverride {
  included?: boolean;
  quantityPerUnit?: number;
  scrapFactor?: number;
  substituteMaterialId?: string;
  readinessOverride?: "plan_now" | "review" | "monitor" | "wait";
  confidenceOverrideReason?: string;
}

export interface MasterAssumptionOverride {
  /** Which basis the scenario should use for this field. */
  selectedBasis: "system" | "historical" | "scenario";
  scenarioValue?: number;
  leadTimeStatistic?: "median" | "p80" | "custom";
  /** Sample size for a historical statistic (e.g. "last 50" vs "last 100" orders — PRD-phase-2 §18.4). */
  sampleSize?: number;
  dateWindowMonths?: number;
}

export interface CapacityOverride {
  lineAllocationShare?: number; // 0-1, share of a family's volume routed to this line
  availableHours?: number;
  targetUtilization?: number;
  headroomPct?: number;
  runRateUnitsPerHour?: number;
  productionWindowShiftWeeks?: number; // negative = pull forward
  prebuildQuantityUnits?: number;
  additionalShiftHours?: number;
}

export interface MaterialOverride {
  leadTimeDaysOverride?: number;
  safetyStockUnits?: number;
  onHandInventoryUnits?: number;
  openSupplyUnits?: number;
  provisionalRequirementIncluded?: boolean;
}

export interface ScenarioOverrides {
  demand?: DemandOverride;
  historicalBasis?: HistoricalBasisOverride;
  analogues?: AnalogueOverride;
  bom?: Record<string, BomComponentOverride>; // key: bomComponentId
  masterAssumptions?: Record<string, MasterAssumptionOverride>; // key: `${entityType}:${entityId}:${field}`
  capacity?: Record<string, CapacityOverride>; // key: `${lineId}:${period}`
  materials?: Record<string, MaterialOverride>; // key: materialId
}

export type ScenarioOverrideCategory = keyof ScenarioOverrides;

export type ScenarioStatus = "draft" | "saved" | "validated" | "preferred" | "published_simulated";

export interface Scenario {
  id: string;
  name: string;
  parentScenarioId?: string;
  baselineId: string;
  linkedGapIds: string[];
  overrides: ScenarioOverrides;
  status: ScenarioStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------------------------------------------- *
 * Derived output — the calculateScenario() contract.
 * ---------------------------------------------------------------------- */

export interface MethodologyTraceEntry {
  methodologyId: PlanningMethodologyId;
  step: string;
  inputSummary: string;
  outputSummary: string;
}

export interface CapacityImpactByLine {
  lineId: string;
  period: string;
  ceilingHours: number; // available - planned downtime
  targetUtilization: number;
  formalLoadHours: number;
  validatedUnresolvedLoadHours: number;
  aiInferredLoadHours: number; // computed by RCCP from this scenario's unresolved demand
  scenarioAdjustmentHours: number; // net effect of capacity overrides (shift/prebuild/allocation)
  formalUtilization: number;
  effectiveUtilization: number; // (formal + validated + inferred + scenario adjustment) / ceiling
  p50Utilization: number;
  p80Utilization: number;
  riskLevel: "positive" | "warning" | "critical";
  /**
   * The rate the volume->hours conversion actually divided by, and where that
   * rate came from — see capacity.ts::resolveRunRate. Always populated by
   * rccp(); optional only so hand-built fixtures elsewhere stay valid.
   */
  runRateUnitsPerHour?: number;
  runRateBasis?: "system" | "historical" | "scenario";
  runRateSource?: "scenario_value" | "observed_median" | "line_period_rate" | "line_standard";
}

export interface MaterialExposureByMaterial {
  materialId: string;
  grossRequirement: number;
  netRequirement: number; // after inventory/open supply
  unit: string;
  earliestDecisionDate: string;
  readiness: MaterialReadiness["readiness"];
}

export interface ScenarioRisk {
  id: string;
  kind: "capacity" | "material" | "demand" | "deadline";
  description: string;
  severity: "positive" | "warning" | "critical";
  relatedEntityId: string;
}

/**
 * Whether the scenario's forecast basis is strong enough to produce a number
 * at all. A planner who excludes every comparable season must see "no basis",
 * not a confident-looking "0–0 units" — an empty basis and a genuine zero
 * forecast are different facts and must not render identically.
 */
export interface ScenarioBasisStatus {
  /** Comparable seasons that survive the atypical/exclusion filters. */
  seasonsAvailable: number;
  /** Seasons the forecast actually read after the lookback window was applied. */
  seasonsUsed: number;
  /** The lookback the scenario asked for (undefined = "use everything available"). */
  seasonsRequested?: number;
  /** False when the derived demand figures carry no basis and must not be displayed as a forecast. */
  sufficient: boolean;
  /** Planner-readable reasons the basis is insufficient or degraded. Empty when healthy. */
  issues: string[];
}

/**
 * Readiness bucket counts. INVARIANT: planNow + review + wait + unknown ===
 * total. Surfaces that render only three buckets silently lose every
 * "unknown" row (a component no active analogue evidences), which is how
 * "6 of 7 components" happened.
 */
export interface ReadinessCounts {
  planNow: number;
  review: number;
  wait: number;
  unknown: number;
  total: number;
}

export interface ScenarioResult {
  scenarioId: string;
  expectedDemandUnits: { low: number; base: number; high: number };
  unresolvedDemandUnits: number;
  planningCompletenessPct: number; // represented / (represented + unresolved)
  capacityImpact: CapacityImpactByLine[];
  materialExposure: MaterialExposureByMaterial[];
  decisionDeadlines: DecisionDeadline[];
  confidence: Confidence;
  materialReadiness: MaterialReadiness[];
  /** Single source for readiness bucket counts — always sums to `total`. */
  readinessCounts: ReadinessCounts;
  /** Mean component confidence across the resolved BOM, 0-1. 0 when there is no BOM. */
  bomReadinessScore: number;
  /** Whether the forecast basis supports the demand figures above. */
  basis: ScenarioBasisStatus;
  risks: ScenarioRisk[];
  methodologyTrace: MethodologyTraceEntry[];
  calculatedAt: string;
}

/* ---------------------------------------------------------------------- *
 * Decisions
 * ---------------------------------------------------------------------- */

export type PlanningAssumptionStatus =
  | "inferred"
  | "partially_validated"
  | "operationally_validated"
  | "approved_provisional"
  | "formalized"
  | "reconciled"
  | "closed";

export interface PlanningAssumption {
  id: string;
  linkedGapIds: string[];
  eventId?: string;
  productFamilyId?: string;
  period: { start: string; end: string };
  expectedVolume: { p50: number; p80?: number; low?: number; high?: number };
  likelyLineId?: string;
  materialFamilyIds: string[];
  componentReadinessSummary: string;
  methodologyIds: PlanningMethodologyId[];
  basisSummary: string;
  confidence: Confidence;
  selectedScenarioId?: string;
  status: PlanningAssumptionStatus;
  createdAt: string;
  updatedAt: string;
  reconciliationTrigger?: string;
  expiryDate?: string;
}

export type PlanningDecisionAction =
  | "dismiss"
  | "mark_intentional"
  | "snooze"
  | "monitor"
  | "save_scenario"
  | "validate_inference"
  | "approve_provisional"
  | "simulate_downstream_handoff";

export interface PlanningDecision {
  id: string;
  gapId: string;
  action: PlanningDecisionAction;
  actor: "planner"; // single Super Admin persona for the demo
  reason?: string;
  scenarioId?: string;
  createdAt: string;
}
