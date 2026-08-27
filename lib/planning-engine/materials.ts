import type { BomComponent, Material } from "@/types/planning";
import type { BomComponentOverride, MaterialOverride } from "@/types/scenario";
import type { MaterialExposureByMaterial } from "@/types/scenario";
import type { MaterialReadiness } from "@/types/planning";
import { classifyReadiness } from "./confidence";
import { decisionDeadlineFromLeadTime } from "./lead-times";

export interface MaterialExplosionInput {
  gapId: string;
  bomRows: BomComponent[]; // resolved rows for this product (formal, or already-blended analogue rows)
  expectedDemandUnits: { low: number; base: number; high: number };
  materialsById: Map<string, Material>;
  bomOverrides?: Record<string, BomComponentOverride>;
  materialOverrides?: Record<string, MaterialOverride>;
  leadTimeDaysByMaterial: Map<string, number>;
  /**
   * WHICH basis produced each entry of `leadTimeDaysByMaterial`. Supplied by
   * the caller alongside the days themselves so the reported basis can never
   * disagree with the reported number — see resolveLeadTimeBasis().
   */
  leadTimeBasisByMaterial?: Map<string, MaterialReadiness["leadTimeBasis"]>;
  productionRequirementDate: string;
}

export interface MaterialExplosionResult {
  exposure: MaterialExposureByMaterial[];
  readiness: MaterialReadiness[];
}

/**
 * Partial / Pre-MRP BOM Explosion (PRD §7.5): provisional demand × BOM
 * consumption = gross component demand, netted against inventory/open
 * supply, offset by lead time, classified into plan-now/review/wait. Never
 * a replacement for formal MRP — this only surfaces what is actionable
 * before the finished-good BOM is formal.
 */
export function partialBomExplosion(input: MaterialExplosionInput): MaterialExplosionResult {
  const exposure: MaterialExposureByMaterial[] = [];
  const readiness: MaterialReadiness[] = [];

  input.bomRows.forEach((row) => {
    const override = input.bomOverrides?.[row.id];
    if (override?.included === false) return;

    const material = input.materialsById.get(row.materialId);
    if (!material) return;

    const quantityPerUnit = override?.quantityPerUnit ?? row.quantityPerUnit;
    const scrapFactor = override?.scrapFactor ?? material.scrapFactorSystem;
    const confidence = row.confidence;

    const grossLow = input.expectedDemandUnits.low * quantityPerUnit * (1 + scrapFactor);
    const grossBase = input.expectedDemandUnits.base * quantityPerUnit * (1 + scrapFactor);
    const grossHigh = input.expectedDemandUnits.high * quantityPerUnit * (1 + scrapFactor);

    const matOverride = input.materialOverrides?.[row.materialId];
    const onHand = matOverride?.onHandInventoryUnits ?? 0;
    const openSupply = matOverride?.openSupplyUnits ?? 0;
    const netBase = Math.max(0, grossBase - onHand - openSupply);

    if (matOverride?.provisionalRequirementIncluded === false) return;

    const leadTimeDays = matOverride?.leadTimeDaysOverride ?? input.leadTimeDaysByMaterial.get(row.materialId) ?? material.systemLeadTimeDays;
    // The basis must describe the number actually used above, in the same
    // precedence order: a per-material scenario override wins, otherwise the
    // basis the caller resolved with the days, otherwise the ERP norm.
    const leadTimeBasis: MaterialReadiness["leadTimeBasis"] =
      matOverride?.leadTimeDaysOverride != null ? "scenario" : input.leadTimeBasisByMaterial?.get(row.materialId) ?? "system";
    const earliestDecisionDate = decisionDeadlineFromLeadTime(input.productionRequirementDate, leadTimeDays);
    const readinessState = override?.readinessOverride ?? classifyReadiness(confidence);

    exposure.push({
      materialId: row.materialId,
      grossRequirement: Math.round(grossBase),
      netRequirement: Math.round(netBase),
      unit: row.uom,
      earliestDecisionDate,
      readiness: readinessState,
    });

    readiness.push({
      id: `readiness_${input.gapId}_${row.materialId}`,
      materialId: row.materialId,
      gapId: input.gapId,
      expectedRequirementLow: Math.round(grossLow),
      expectedRequirementHigh: Math.round(grossHigh),
      unit: row.uom,
      confidence,
      confidenceDimensions: [{ dimension: "analogue_quality", score: confidence, note: override?.confidenceOverrideReason }],
      leadTimeDaysUsed: leadTimeDays,
      leadTimeBasis,
      earliestDecisionDate,
      readiness: readinessState,
      reason: readinessReason(readinessState, confidence),
    });
  });

  return { exposure, readiness };
}

function readinessReason(state: MaterialReadiness["readiness"], confidence: number): string {
  const pct = Math.round(confidence * 100);
  switch (state) {
    case "plan_now":
      return `${pct}% confidence — stable enough to plan against now.`;
    case "review":
      return `${pct}% confidence — directionally useful, worth a planner review before committing.`;
    case "wait":
      return `${pct}% confidence — too uncertain to commit; monitor until the underlying spec firms up.`;
    default:
      return "Insufficient basis to assess readiness yet.";
  }
}
