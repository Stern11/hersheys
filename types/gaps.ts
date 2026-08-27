import type { Confidence } from "./shared";

export type PlanningGapType =
  | "demand" // Gap Type A — demand/event
  | "representation" // Gap Type B — future-item / representation
  | "product_uncertainty" // Gap Type B, product-concept-level
  | "bom_uncertainty" // Gap Type C — BOM/material readiness
  | "master_data" // Gap Type D — assumption/master-data mismatch
  | "capacity" // Gap Type E — derived operational consequence (capacity)
  | "material"; // Gap Type E — derived operational consequence (material)

export type PlanningGapStatus =
  | "open"
  | "monitoring"
  | "scenario_saved"
  | "validated"
  | "preferred"
  | "approved_provisional"
  | "simulated_published"
  | "reconciled"
  | "closed"
  | "dismissed"
  | "snoozed"
  | "marked_intentional";

export type PlanningGapSeverity = "critical" | "warning" | "informational";

/**
 * The primary product object. A meaningful mismatch between what should
 * reasonably be represented and what the formal planning model currently
 * represents or assumes (PRD §6).
 */
export interface PlanningGap {
  id: string;
  title: string;
  type: PlanningGapType;
  status: PlanningGapStatus;
  severity: PlanningGapSeverity;
  eventId?: string;
  productFamilyId?: string;
  productId?: string;
  customerId?: string;
  lineId?: string;
  materialId?: string;
  period: { start: string; end: string };

  formalValue: number;
  expectedValueLow: number;
  expectedValueHigh: number;
  unresolvedValue: number;
  unit: string;

  confidence: Confidence;
  earliestDeadlineId?: string;

  planningBasisId: string;
  evidenceIds: string[];
  linkedScenarioIds: string[];
  linkedAssumptionId?: string;

  changeSincePriorReview?: {
    field: string;
    previousValue: number;
    newValue: number;
  }[];

  createdAt: string;
  updatedAt: string;
  lastRecalculatedAt: string;
}
