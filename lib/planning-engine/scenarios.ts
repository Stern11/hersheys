import type { CapacityBucket, HistoricalPeriod, Material, ProductionLine } from "@/types/planning";
import type { BomComponent } from "@/types/planning";
import type { Analogue } from "@/types/planning";
import type { PlanningBasis } from "@/types/methodology";
import type { ScenarioOverrides, ScenarioResult, MethodologyTraceEntry, ScenarioRisk } from "@/types/scenario";
import { seasonalForecast } from "./seasonality";
import { applyDemandOverride, businessToPlanReconciliation, selectedDemandPoint } from "./demand";
import { rccp } from "./capacity";
import { resolveActiveAnalogues, blendAnalogueBom } from "./analogues";
import { partialBomExplosion } from "./materials";
import { resolveLeadTimeDays } from "./lead-times";
import { summarizeConfidence } from "./confidence";
import type { DecisionDeadline } from "@/types/planning";

/**
 * Default line allocation for a gap's unresolved demand. "Line allocation"
 * is explicitly an editable planning parameter (PRD §7.4/§13.10), not a
 * value silently derived from a generic heuristic — a scenario's
 * CapacityOverride.lineAllocationShare replaces these per line.
 */
export interface LineAllocation {
  lineId: string;
  defaultShare: number;
}

export interface CalculateScenarioInput {
  scenarioId: string;
  gapId: string;

  /** Demand basis */
  formalDemandUnits: number;
  historicalPeriods: HistoricalPeriod[]; // most-recent-first, for the relevant event/family
  growthAssumption: number;
  productionRequirementDate: string; // used as the anchor for lead-time deadlines

  /** Capacity basis */
  lineAllocations: LineAllocation[];
  lines: ProductionLine[];
  capacityBuckets: CapacityBucket[]; // one per line/period in scope
  observedRunRateByLine: Map<string, number>;

  /** Material basis: either a formal product's own BOM, or analogue-blended rows */
  bomRows: BomComponent[];
  analogueCandidates?: Analogue[];
  analogueBomByProductId?: Map<string, BomComponent[]>;
  materialsById: Map<string, Material>;
  leadTimeP80ByMaterial: Map<string, number>;

  planningBasis: PlanningBasis;
  overrides: ScenarioOverrides;
}

/**
 * The single entry point for every derived number in the product. Pure
 * function: (baseline + overrides + basis) -> ScenarioResult. Never called
 * from inside a component render — always memoized/derived in the store or
 * a server computation and read from there.
 */
export function calculateScenario(input: CalculateScenarioInput): ScenarioResult {
  const trace: MethodologyTraceEntry[] = [];

  // 1. Expected demand (Seasonal Forecast + Business-to-Plan Reconciliation)
  const forecast = seasonalForecast({
    historicalPeriods: input.historicalPeriods,
    growthAssumption: input.growthAssumption,
    basis: input.overrides.historicalBasis,
  });
  const expectedDemandUnits = applyDemandOverride(forecast, input.overrides.demand);
  const selectedPoint = selectedDemandPoint(expectedDemandUnits, input.overrides.demand?.percentileSelection);
  const b2p = businessToPlanReconciliation(input.formalDemandUnits, selectedPoint);
  trace.push({
    methodologyId: "seasonal_event_forecasting",
    step: "Forecast expected demand from comparable historical periods",
    inputSummary: `${forecast.seasonsUsed.length} comparable period(s), +${Math.round(input.growthAssumption * 100)}% growth`,
    outputSummary: `Expected ${expectedDemandUnits.low.toLocaleString()}-${expectedDemandUnits.high.toLocaleString()} units`,
  });
  trace.push({
    methodologyId: "business_to_plan_reconciliation",
    step: "Compare formal plan against expected demand",
    inputSummary: `Formal ${input.formalDemandUnits.toLocaleString()} vs expected ${selectedPoint.toLocaleString()}`,
    outputSummary: `${Math.round(b2p.completenessRatio * 100)}% complete, ${b2p.unresolvedAmount.toLocaleString()} unresolved`,
  });

  // 2. Capacity impact per line/period (RCCP)
  const capacityImpact = input.capacityBuckets.map((bucket) => {
    const line = input.lines.find((l) => l.id === bucket.lineId);
    if (!line) throw new Error(`No line configured for bucket ${bucket.id}`);
    const allocation = input.lineAllocations.find((a) => a.lineId === bucket.lineId)?.defaultShare ?? 0;
    const capacityOverride = input.overrides.capacity?.[`${bucket.lineId}:${bucket.period}`];
    const share = capacityOverride?.lineAllocationShare ?? allocation;
    const runRateOverride = input.overrides.masterAssumptions?.[`line:${bucket.lineId}:run_rate`];

    return rccp({
      bucket,
      line,
      aiInferredUnresolvedUnits: b2p.unresolvedAmount * share,
      capacityOverride,
      runRateOverride,
      observedMedianRunRate: input.observedRunRateByLine.get(bucket.lineId) ?? line.historicalMedianRunRateUnitsPerHour,
    });
  });
  trace.push({
    methodologyId: "rccp",
    step: "Translate unresolved demand into line load",
    inputSummary: `${input.capacityBuckets.length} line/period bucket(s)`,
    outputSummary: capacityImpact
      .filter((c) => c.riskLevel !== "positive")
      .map((c) => `${c.lineId} ${Math.round(c.effectiveUtilization * 100)}%`)
      .join(", ") || "All buckets within target headroom",
  });

  // 3. Material exposure (Analogous Forecasting + Partial BOM Explosion)
  let bomRows = input.bomRows;
  if (input.analogueCandidates && input.analogueBomByProductId) {
    const weighted = resolveActiveAnalogues(input.analogueCandidates, input.overrides.analogues);
    const blended = blendAnalogueBom(weighted, input.analogueBomByProductId);
    bomRows = Array.from(blended.entries()).map(([materialId, v], i) => ({
      id: `${input.gapId}_blended_${i}`,
      parentProductId: input.gapId,
      materialId,
      quantityPerUnit: v.quantityPerUnit,
      uom: v.uom,
      provenance: "inferred" as const,
      confidence: v.confidence,
      readiness: "unknown" as const,
    }));
    trace.push({
      methodologyId: "analogous_forecasting",
      step: "Blend BOM across active analogues",
      inputSummary: weighted.map((w) => `${w.analogue.candidateProductId} (${Math.round(w.weight * 100)}%)`).join(", "),
      outputSummary: `${bomRows.length} material row(s) derived`,
    });
  }

  const leadTimeDaysByMaterial = new Map<string, number>();
  bomRows.forEach((row) => {
    const material = input.materialsById.get(row.materialId);
    if (!material) return;
    const override = input.overrides.masterAssumptions?.[`material:${row.materialId}:lead_time`];
    leadTimeDaysByMaterial.set(row.materialId, resolveLeadTimeDays(material, input.leadTimeP80ByMaterial.get(row.materialId) ?? material.historicalP80LeadTimeDays, override));
  });

  const { exposure: materialExposure, readiness: materialReadiness } = partialBomExplosion({
    gapId: input.gapId,
    bomRows,
    expectedDemandUnits,
    materialsById: input.materialsById,
    bomOverrides: input.overrides.bom,
    materialOverrides: input.overrides.materials,
    leadTimeDaysByMaterial,
    productionRequirementDate: input.productionRequirementDate,
  });
  trace.push({
    methodologyId: "pre_mrp_bom_explosion",
    step: "Explode expected demand through the resolved BOM",
    inputSummary: `${bomRows.length} component row(s)`,
    outputSummary: `${materialReadiness.filter((m) => m.readiness === "plan_now").length} plan-now, ${materialReadiness.filter((m) => m.readiness === "review").length} review, ${materialReadiness.filter((m) => m.readiness === "wait").length} wait`,
  });

  // 4. Decision deadlines: earliest of (material order-by dates, capacity-driven pull-forward)
  const decisionDeadlines: DecisionDeadline[] = materialReadiness.map((m) => ({
    id: `deadline_${m.id}`,
    gapId: input.gapId,
    kind: "material_order_by",
    date: m.earliestDecisionDate,
    isEarliestConstraint: false,
    drivenBy: "lead_time",
  }));
  if (decisionDeadlines.length > 0) {
    const earliest = [...decisionDeadlines].sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (earliest) earliest.isEarliestConstraint = true;
  }
  trace.push({
    methodologyId: "rolling_horizon",
    step: "Derive decision deadlines from lead time and production requirement date",
    inputSummary: `Production requirement ${input.productionRequirementDate}`,
    outputSummary: decisionDeadlines[0] ? `Earliest deadline ${decisionDeadlines.sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date}` : "No material deadlines in scope",
  });

  // 5. Confidence + risks
  //
  // Always surface forecast-quality dimensions (never just BOM confidence —
  // a demand gap with an entirely formal, confidence=1 BOM would otherwise
  // report a meaningless wall of 100% bars and hide the actual uncertainty,
  // which lives in the forecast basis, not the material rows). Material
  // dimensions are added only for rows that are genuinely inferred
  // (confidence < 1) — formal rows carry no useful signal here.
  const forecastDimensions = [
    { dimension: "demand_magnitude" as const, score: b2p.completenessRatio },
    { dimension: "historical_data_quality" as const, score: forecast.seasonsUsed.length > 0 ? Math.min(1, forecast.seasonsUsed.length / 3) : 0.5 },
  ];
  const inferredMaterialDimensions = materialReadiness
    .filter((m) => m.confidence < 1)
    .map((m) => ({ dimension: "analogue_quality" as const, score: m.confidence, note: input.materialsById.get(m.materialId)?.name ?? m.materialId }));
  const confidence = summarizeConfidence([...forecastDimensions, ...inferredMaterialDimensions]);

  const risks: ScenarioRisk[] = [
    ...capacityImpact
      .filter((c) => c.riskLevel !== "positive")
      .map(
        (c): ScenarioRisk => ({
          id: `risk_capacity_${c.lineId}_${c.period}`,
          kind: "capacity",
          description: `${c.lineId} effective utilization ${Math.round(c.effectiveUtilization * 100)}% in ${c.period}`,
          severity: c.riskLevel,
          relatedEntityId: c.lineId,
        })
      ),
    ...materialReadiness
      .filter((m) => m.readiness === "wait")
      .map(
        (m): ScenarioRisk => ({
          id: `risk_material_${m.materialId}`,
          kind: "material",
          description: `${m.materialId} not yet actionable (${Math.round(m.confidence * 100)}% confidence)`,
          severity: "warning",
          relatedEntityId: m.materialId,
        })
      ),
  ];

  return {
    scenarioId: input.scenarioId,
    expectedDemandUnits,
    unresolvedDemandUnits: b2p.unresolvedAmount,
    planningCompletenessPct: Math.round(b2p.completenessRatio * 1000) / 10,
    capacityImpact,
    materialExposure,
    decisionDeadlines,
    confidence,
    materialReadiness,
    risks,
    methodologyTrace: trace,
    calculatedAt: new Date().toISOString(),
  };
}
