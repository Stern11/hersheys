import type { MethodologyDefinition } from "@/types/methodology";

/**
 * Static reference data for every recognized planning methodology the
 * platform uses (PRD §7). UI components read this to render "View Method"
 * panels — it never changes at runtime.
 */
export const METHODOLOGY_DEFINITIONS: MethodologyDefinition[] = [
  {
    id: "business_to_plan_reconciliation",
    name: "Business-to-Plan Reconciliation",
    shortName: "B2P Reconciliation",
    description:
      "Compares an aggregate business expectation (growth target, seasonal outlook, commercial commitment) against what is currently operationally represented in the formal demand plan.",
    whenUsed:
      "When a business target or event expectation exists but the formal plan may not yet reflect its full magnitude.",
    requiredInputs: ["business target / growth assumption", "seasonal/event expectation", "current formal demand", "current item coverage"],
    outputs: ["represented amount", "unresolved amount", "unexplained variance", "completeness ratio"],
    editableParameters: ["growth assumption", "event expectation source", "item-coverage scope"],
    limitations: [
      "Depends on the business target itself being current and credible.",
      "Does not explain why the formal plan is incomplete, only that it is.",
    ],
  },
  {
    id: "seasonal_event_forecasting",
    name: "Seasonal / Event-Based Forecasting",
    shortName: "Seasonal Forecast",
    description:
      "Estimates expected event-level demand using comparable historical events, adjusted for current business drivers such as growth and promotion.",
    whenUsed: "For any event/season where prior comparable years exist (Halloween, Christmas, Valentine's, retailer resets).",
    requiredInputs: ["comparable historical event periods", "growth factor", "promotion factor"],
    outputs: ["expected demand range", "confidence band"],
    editableParameters: [
      "number of seasons",
      "included/excluded years",
      "event alignment",
      "customer/channel filters",
      "recent-period weighting",
      "growth factor",
      "promotion factor",
      "confidence range",
    ],
    limitations: [
      "A short or atypical history window will understate uncertainty.",
      "Assumes the comparable events are structurally similar to the current one.",
    ],
  },
  {
    id: "analogous_forecasting",
    name: "Analogous Forecasting",
    shortName: "Analogue Forecast",
    description:
      "Estimates future demand, production, or BOM behavior for a not-yet-created product using comparable prior items as analogues.",
    whenUsed: "When exact product history does not exist — new product introductions, unresolved assortment.",
    requiredInputs: ["candidate analogue products", "similarity dimensions"],
    outputs: ["demand envelope", "likely line", "BOM component families", "material consumption"],
    editableParameters: [
      "analogue selection",
      "similarity dimensions",
      "analogue weights",
      "event filter",
      "channel/customer filter",
      "production-line similarity",
      "pack-format similarity",
      "formulation similarity",
    ],
    limitations: [
      "Only as good as the chosen analogues' relevance.",
      "Exact SKU-level claims must remain distinguished from family-level estimates.",
    ],
  },
  {
    id: "rccp",
    name: "Rough-Cut Capacity Planning",
    shortName: "RCCP",
    description:
      "Translates formal plus unresolved demand into major line/resource load before detailed scheduling is possible.",
    whenUsed: "Whenever unresolved demand could plausibly load a production line before that demand is formally scheduled.",
    requiredInputs: ["product-to-line mapping", "run rate", "available hours", "planned downtime"],
    outputs: ["formal load", "effective load", "headroom", "risk band"],
    editableParameters: [
      "product-to-line mapping",
      "line allocation",
      "run rate",
      "available hours",
      "planned downtime",
      "target headroom",
      "utilization threshold",
      "production window",
      "scenario confidence percentile",
    ],
    limitations: [
      "Rough-cut only — does not sequence or finite-schedule individual orders.",
      "Line-mapping accuracy directly determines result accuracy.",
    ],
  },
  {
    id: "pre_mrp_bom_explosion",
    name: "Partial / Pre-MRP BOM Explosion",
    shortName: "Pre-MRP BOM",
    description:
      "Estimates which material requirements are actionable before the full finished-good BOM is formal, using provisional or analogue demand and BOM structure.",
    whenUsed: "When a product concept is real but its full BOM (especially packaging) is not yet finalized.",
    requiredInputs: ["provisional/analogue demand", "analogue or known BOM structure"],
    outputs: ["gross component demand", "component confidence/readiness", "provisional exposure"],
    editableParameters: ["component inclusion", "consumption rate", "scrap/yield", "lead-time basis", "inventory/open-supply offset"],
    limitations: [
      "Not a replacement for formal MRP.",
      "Must never present inferred components as a formal BOM.",
    ],
  },
  {
    id: "historical_performance_analysis",
    name: "Historical Performance Analysis",
    shortName: "Historical Performance",
    description:
      "Compares a planning master assumption (lead time, run rate, routing, scrap) with relevant execution history to test whether the assumption still holds.",
    whenUsed: "When a system/master value has not been recently re-validated against actual execution.",
    requiredInputs: ["execution history (POs, goods receipts, production confirmations)", "observation count", "date range"],
    outputs: ["historical median/mean/percentile", "deviation from system assumption"],
    editableParameters: ["observation count", "date range", "supplier/material/product filters", "contract period", "plant/line", "outlier handling", "statistic"],
    limitations: [
      "Does not itself explain WHY history differs from the system value.",
      "Sensitive to outliers and disruption periods unless explicitly excluded.",
    ],
  },
  {
    id: "scenario_planning",
    name: "Scenario Planning",
    shortName: "Scenario Planning",
    description: "Evaluates multiple plausible futures side by side rather than asserting one deterministic forecast.",
    whenUsed: "Any time a planner wants to compare the consequences of different assumption sets before deciding.",
    requiredInputs: ["baseline", "one or more assumption overrides"],
    outputs: ["scenario comparison across demand, capacity, material, and deadline metrics"],
    editableParameters: ["any demand, capacity, material, BOM, or master-assumption override"],
    limitations: ["A scenario is only as informative as the range of alternatives a planner actually explores."],
  },
  {
    id: "rolling_horizon",
    name: "Rolling-Horizon Reconciliation",
    shortName: "Rolling Horizon",
    description: "Continuously replaces provisional assumptions with formal information as uncertainty resolves over the planning horizon.",
    whenUsed: "Ongoing, for every open Planning Gap and Planning Assumption as the horizon rolls forward.",
    requiredInputs: ["provisional assumption", "incoming formal data"],
    outputs: ["match confidence", "net new (residual) amount"],
    editableParameters: ["match confirmation", "residual treatment"],
    limitations: ["Relies on the incoming formal object actually corresponding to the provisional assumption it is matched against."],
  },
  {
    id: "production_leveling",
    name: "Production Leveling / Pull-Forward",
    shortName: "Production Leveling",
    description: "Reduces peak line overload by moving feasible production earlier, within governed limits.",
    whenUsed: "When effective capacity exceeds target headroom in a peak period and earlier production is feasible.",
    requiredInputs: ["capacity impact by line/period", "eligible product families", "frozen horizon"],
    outputs: ["hours moved", "months moved to/from", "revised material deadline"],
    editableParameters: ["maximum pull-forward weeks", "frozen horizon", "minimum headroom", "maximum inventory build", "eligible product families", "storage limits"],
    limitations: ["Assumes prebuilt inventory is storable and sellable within its shelf/promotional window."],
  },
];

export function getMethodologyDefinition(id: MethodologyDefinition["id"]) {
  const def = METHODOLOGY_DEFINITIONS.find((m) => m.id === id);
  if (!def) throw new Error(`Unknown methodology id: ${id}`);
  return def;
}
