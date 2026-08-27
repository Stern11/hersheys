import type { ConfidenceDimension, DataProvenance, DateRange, Statistic } from "./shared";

export type PlanningHorizon =
  | "3_months"
  | "6_months"
  | "9_months"
  | "12_months"
  | "18_months";

export interface BusinessEvent {
  id: string;
  name: string; // e.g. "Halloween 2027"
  family: "halloween" | "holiday" | "valentines" | "retailer_reset" | "diwali";
  market: string; // e.g. "US"
  salesWindow: DateRange;
  productionWindow: DateRange;
  comparableEventIds: string[]; // prior years of the same event family, ordered recent-first
  businessGrowthAssumption: number; // e.g. 0.08 = +8% YoY
}

export interface ProductFamily {
  id: string;
  name: string; // e.g. "Variety Bags", "Gift Tins"
  description?: string;
}

export interface Customer {
  id: string;
  name: string; // e.g. "Walmart", "Target", "Kroger"
  channel: "mass" | "grocery" | "club" | "drug" | "ecommerce";
}

export interface Product {
  id: string;
  sku?: string; // undefined until formalized (Gap Type B)
  name: string;
  familyId: string;
  eventId?: string;
  customerIds: string[];
  packFormat: string; // e.g. "12ct variety bag"
  formulationFamily: string; // e.g. "chocolate_assortment"
  isFormal: boolean; // false while the item is a provisional/analogue-derived concept
  analoguePredecessorIds?: string[];
}

export interface ProductionLine {
  id: string;
  name: string; // "Line 01" ... "Line 04"
  plant: string;
  standardRunRateUnitsPerHour: number; // system assumption
  historicalMedianRunRateUnitsPerHour: number; // observed
  eligibleFamilyIds: string[];
}

/**
 * Static/committed capacity facts only. The AI-inferred unresolved-load
 * layer and any scenario adjustment are NOT stored here — they are always
 * computed fresh by the RCCP step in the planning engine (see
 * ScenarioResult.capacityImpact), so a screenshot of "effective capacity"
 * always reflects the current basis rather than a stale baked-in number.
 */
export interface CapacityBucket {
  id: string;
  lineId: string;
  period: string; // ISO week/month key, e.g. "2027-09"
  availableHours: number;
  plannedDowntimeHours: number;
  targetUtilization: number; // e.g. 0.9
  formalLoadHours: number;
  /** Unresolved load a planner has already validated (distinct from what AI still infers). */
  validatedUnresolvedLoadHours: number;
}

export type MaterialCategory = "raw_ingredient" | "packaging" | "conversion_component";

export interface Material {
  id: string;
  name: string; // "Cocoa", "Printed Film", ...
  category: MaterialCategory;
  unit: string; // "kg", "m2", "ea"
  systemLeadTimeDays: number;
  historicalMedianLeadTimeDays: number;
  historicalP80LeadTimeDays: number;
  scrapFactorSystem: number; // e.g. 0.02
  scrapFactorHistorical: number;
  supplier?: string;
}

export interface BomComponent {
  id: string;
  parentProductId: string;
  materialId: string;
  quantityPerUnit: number;
  uom: string;
  provenance: DataProvenance; // formal (real BOM row) vs inferred (from an analogue)
  confidence: number; // 0-1
  readiness: "plan_now" | "review" | "monitor" | "wait" | "unknown";
  sourceAnalogueId?: string;
  substituteForMaterialId?: string;
}

export interface HistoricalPeriod {
  id: string;
  eventId?: string;
  productFamilyId?: string;
  periodLabel: string; // "Halloween 2024"
  start: string;
  end: string;
  actualUnits: number;
  actualValue: number;
  isAtypical: boolean; // e.g. a disrupted year the planner may exclude
  atypicalReason?: string;
}

export interface AnalogueWeight {
  analogueProductId: string;
  weight: number; // 0-1, weights across a set should sum to 1
}

export interface Analogue {
  id: string;
  candidateProductId: string; // the historical product being proposed as a comparable
  similarityScore: number; // 0-1
  sameDimensions: string[]; // e.g. ["pack_format", "line_history"]
  differentDimensions: string[]; // e.g. ["formulation_family"]
  dataQuality: "high" | "medium" | "low";
  bomAvailable: boolean;
  lineHistoryAvailable: boolean;
}

/** A single dated snapshot of the formally represented plan for a scope. */
export interface FormalPlanValue {
  id: string;
  scopeType: "event" | "product_family" | "product" | "line" | "material";
  scopeId: string;
  period: string;
  asOfDate: string; // when this snapshot was taken
  value: number;
  unit: string;
}

/** Historical execution used to challenge a system/master assumption. */
export interface ObservedPerformance {
  id: string;
  metric: "lead_time_days" | "run_rate_units_per_hour" | "scrap_rate" | "line_usage_share";
  scopeType: "material" | "line" | "product_family";
  scopeId: string;
  sampleCount: number;
  dateRange: DateRange;
  statistic: Statistic;
  value: number;
  sourceRecordIds: string[]; // drilldown to raw PO/GR/production-confirmation rows
}

export type MaterialReadinessState = "plan_now" | "review" | "monitor" | "wait" | "unknown";

export interface MaterialReadiness {
  id: string;
  materialId: string;
  gapId: string;
  expectedRequirementLow: number;
  expectedRequirementHigh: number;
  unit: string;
  confidence: number;
  confidenceDimensions: ConfidenceDimension[];
  leadTimeDaysUsed: number;
  leadTimeBasis: "system" | "historical_median" | "historical_p80" | "scenario";
  earliestDecisionDate: string;
  readiness: MaterialReadinessState;
  reason: string;
}

export type DecisionDeadlineKind =
  | "business_confirmation"
  | "sku_setup"
  | "material_order_by"
  | "supplier_capacity_decision"
  | "production_start"
  | "prebuild_window_open"
  | "sales_window_open"
  | "frozen_horizon";

export interface DecisionDeadline {
  id: string;
  gapId: string;
  kind: DecisionDeadlineKind;
  date: string;
  isEarliestConstraint: boolean;
  drivenBy: "lead_time" | "capacity" | "material" | "business_rule";
  movedFromDate?: string; // set when a scenario change shifted this deadline
  moveReason?: string;
}

export interface ReconciliationRecord {
  id: string;
  gapId: string;
  assumptionId: string;
  formalObjectType: "sku" | "demand_line" | "bom";
  formalObjectId: string;
  matchConfidence: number;
  priorProvisionalAmount: number;
  formalizedAmount: number;
  matchedAmount: number;
  residualUnresolvedAmount: number;
  status: "proposed_match" | "confirmed" | "rejected";
  reconciledAt?: string;
}
