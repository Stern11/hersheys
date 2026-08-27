import type { Statistic } from "./shared";

export type PlanningMethodologyId =
  | "business_to_plan_reconciliation"
  | "seasonal_event_forecasting"
  | "analogous_forecasting"
  | "rccp"
  | "rolling_horizon"
  | "scenario_planning"
  | "pre_mrp_bom_explosion"
  | "historical_performance_analysis"
  | "production_leveling";

/** A registry entry describing one recognized planning methodology (static, not per-gap). */
export interface MethodologyDefinition {
  id: PlanningMethodologyId;
  name: string;
  shortName: string;
  description: string;
  whenUsed: string;
  requiredInputs: string[];
  outputs: string[];
  editableParameters: string[];
  limitations: string[];
}

/**
 * The applied configuration of one or more methodologies against a specific
 * gap/scenario — parameters, historical window, statistic, analogue set,
 * weights, filters, and any planner override. This is what a Planning Gap or
 * Scenario references; the definitions above are read-only reference data.
 */
export interface PlanningBasis {
  id: string;
  methodologyIds: PlanningMethodologyId[];
  primaryMethodologyId: PlanningMethodologyId;
  whySelected: string;
  historicalWindow?: {
    seasonsOrYears: number;
    excludedPeriodIds: string[];
    recentPeriodWeighting: "equal" | "recent_weighted" | "custom";
  };
  statistic?: Statistic;
  sampleCount?: number;
  analogueSetId?: string;
  filters?: {
    customerIds?: string[];
    channelIds?: string[];
    productFamilyIds?: string[];
    lineIds?: string[];
  };
  plannerOverrides: PlannerOverride[];
}

export interface PlannerOverride {
  id: string;
  field: string;
  previousValue: string | number;
  newValue: string | number;
  reason?: string;
  changedAt: string;
  changedBy: "planner" | "ai";
}
