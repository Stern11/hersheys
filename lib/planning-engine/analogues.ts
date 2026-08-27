import type { Analogue, BomComponent } from "@/types/planning";
import type { AnalogueOverride } from "@/types/scenario";

export interface WeightedAnalogue {
  analogue: Analogue;
  weight: number;
}

/**
 * Resolves the active analogue set + weights for a product, applying any
 * scenario override (accept/reject/add/remove/reweight — PRD §17.3).
 * Weights are renormalized to sum to 1 across whatever set survives.
 */
export function resolveActiveAnalogues(candidates: Analogue[], override?: AnalogueOverride): WeightedAnalogue[] {
  const removed = new Set(override?.removedAnalogueIds ?? []);
  const active = candidates.filter((a) => !removed.has(a.id));
  if (active.length === 0) return [];

  const explicitWeights = override?.weights;
  const rawWeights = active.map((a) => explicitWeights?.[a.candidateProductId] ?? a.similarityScore);
  const total = rawWeights.reduce((s, w) => s + w, 0) || 1;

  return active.map((analogue, i) => ({ analogue, weight: (rawWeights[i] ?? 0) / total }));
}

/**
 * Analogous Forecasting / Partial BOM Explosion input: blends the same
 * material's quantityPerUnit across every active analogue's BOM, weighted
 * by analogue weight, and blends confidence the same way. This is what
 * actually recalculates when a planner changes the analogue mix in
 * Scenario Lab — it does not just re-read whatever was hand-seeded.
 */
export function blendAnalogueBom(weighted: WeightedAnalogue[], bomByAnalogueProductId: Map<string, BomComponent[]>): Map<string, { quantityPerUnit: number; confidence: number; uom: string }> {
  const byMaterial = new Map<string, { qtySum: number; confSum: number; weightSum: number; uom: string }>();

  weighted.forEach(({ analogue, weight }) => {
    const rows = bomByAnalogueProductId.get(analogue.candidateProductId) ?? [];
    rows.forEach((row) => {
      const acc = byMaterial.get(row.materialId) ?? { qtySum: 0, confSum: 0, weightSum: 0, uom: row.uom };
      acc.qtySum += row.quantityPerUnit * weight;
      // A row inherited from a lower-similarity analogue should read as less
      // confident than one confirmed by the strongest analogue.
      acc.confSum += analogue.similarityScore * weight;
      acc.weightSum += weight;
      byMaterial.set(row.materialId, acc);
    });
  });

  const result = new Map<string, { quantityPerUnit: number; confidence: number; uom: string }>();
  byMaterial.forEach((acc, materialId) => {
    result.set(materialId, {
      quantityPerUnit: acc.weightSum > 0 ? acc.qtySum / acc.weightSum : 0,
      confidence: acc.weightSum > 0 ? acc.confSum / acc.weightSum : 0,
      uom: acc.uom,
    });
  });
  return result;
}
