/**
 * Cross-cutting primitives used by planning, gap, methodology, scenario, and
 * AI types. Nothing here is React- or storage-specific.
 */

/**
 * Field-level provenance for a single value. Distinct from PlanningStateVisual
 * (the chart/table display palette): a value's provenance is a data-quality
 * fact, while the visual palette also needs "scenario" and "historical" as
 * display layers that are not themselves a provenance state.
 */
export type DataProvenance = "formal" | "validated" | "inferred" | "unknown";

/** The six-way categorical palette used to color chart layers and table cells. */
export type PlanningStateVisual =
  | "formal"
  | "validated"
  | "inferred"
  | "scenario"
  | "historical"
  | "unknown";

/** Severity used ONLY for status/risk — never reused to label a data series. */
export type RiskLevel = "positive" | "warning" | "critical";

export type Statistic = "mean" | "median" | "p50" | "p80" | "p95" | "custom";

export interface DateRange {
  start: string; // ISO date
  end: string; // ISO date
}

/**
 * A value paired with the confidence-relevant dimension it was scored on.
 * The platform must never collapse confidence to one global number — every
 * confidence-bearing object carries a list of these instead.
 */
export interface ConfidenceDimension {
  dimension:
    | "business_intent"
    | "demand_magnitude"
    | "event_timing"
    | "product_family"
    | "exact_sku"
    | "line_resource"
    | "material_family"
    | "exact_material_spec"
    | "analogue_quality"
    | "historical_data_quality";
  score: number; // 0-1
  note?: string;
}

export interface Confidence {
  /** Overall score is a summary for sorting/badges only — always pair with dimensions. */
  overall: number; // 0-1
  dimensions: ConfidenceDimension[];
  p50?: number;
  p80?: number;
  p95?: number;
}

/** A single row of supporting evidence behind an inference. */
export interface EvidenceSignal {
  id: string;
  source: string; // e.g. "SAP S/4HANA", "Historical Shipments"
  sourceObjectType: string; // e.g. "purchase_order", "production_confirmation"
  sourceObjectId?: string;
  dateRange?: DateRange;
  value: number | string;
  unit?: string;
  quality: "high" | "medium" | "low";
  freshness: string; // ISO timestamp of last sync
  suppliedBy: "system" | "planner" | "ai";
  included: boolean;
  excludedReason?: string;
  rationale?: string;
}

/** A value that carries where it came from alongside the number itself. */
export interface ProvenancedValue<T = number> {
  value: T;
  provenance: DataProvenance;
  asOf: string; // ISO timestamp
  sourceEvidenceIds?: string[];
}
