import type { Analogue, BomComponent } from "@/types/planning";
import type { AnalogueOverride } from "@/types/scenario";
import { ANALOGUE_WEIGHT_RANGE, clampToRange } from "./validation";

export interface WeightedAnalogue {
  analogue: Analogue;
  /** Normalized share of the analogue basis, 0-1. Across the set these sum to 1 (or to 0 when the whole set is switched off). */
  weight: number;
  /** The raw weight before normalization — what the planner actually typed, or the similarity default. */
  rawWeight: number;
}

/**
 * Resolves the active analogue set + weights for a product, applying any
 * scenario override (accept/reject/add/remove/reweight — PRD §17.3).
 *
 * Weights are renormalized to sum to 1 across whatever set survives, so only
 * their RELATIVE size matters — a planner who halves every weight has changed
 * nothing. Negative weights are clamped to 0 (an analogue cannot count
 * against the blend). When every surviving weight is 0, normalization yields
 * an all-zero set rather than dividing by zero: the analogue basis is
 * switched off, and everything downstream must report that honestly instead
 * of quietly falling back to the last non-zero blend.
 */
export function resolveActiveAnalogues(candidates: Analogue[], override?: AnalogueOverride): WeightedAnalogue[] {
  const removed = new Set(override?.removedAnalogueIds ?? []);
  const active = candidates.filter((a) => !removed.has(a.id));
  if (active.length === 0) return [];

  const explicitWeights = override?.weights;
  const rawWeights = active.map((a) => clampToRange(explicitWeights?.[a.candidateProductId] ?? a.similarityScore, ANALOGUE_WEIGHT_RANGE).value);
  const total = rawWeights.reduce((s, w) => s + w, 0);

  return active.map((analogue, i) => ({
    analogue,
    rawWeight: rawWeights[i] ?? 0,
    weight: total > 0 ? (rawWeights[i] ?? 0) / total : 0,
  }));
}

/**
 * Overall strength of the analogue basis: the weight-weighted mean similarity
 * of the active set, 0-1. Zero when every analogue is removed or zero-weighted.
 *
 * This is what makes scenario confidence COLLAPSE when a planner switches the
 * analogue basis off, instead of freezing. Previously confidence was assembled
 * from forecast dimensions plus one dimension per surviving BOM row — so
 * removing every analogue removed every material dimension too, and the
 * headline confidence simply stopped moving at whatever the forecast
 * dimensions alone happened to average to.
 */
export function analogueSetStrength(weighted: WeightedAnalogue[]): number {
  return round4(weighted.reduce((sum, w) => sum + w.weight * w.analogue.similarityScore, 0));
}

export interface BlendedBomRow {
  materialId: string;
  /** Expected consumption per finished unit, averaged across the analogues that actually carry this component. */
  quantityPerUnit: number;
  /**
   * Confidence that this component belongs in the target BOM at this
   * quantity: `Σ weight × similarity` over the analogues that carry it.
   * Equivalently support-coverage × mean-similarity-of-supporters.
   */
  confidence: number;
  uom: string;
  /** Share of the analogue basis (0-1) that actually carries this component. */
  supportWeight: number;
  /** Which analogue products evidence this component at all (regardless of weight). */
  supportingProductIds: string[];
}

/**
 * Analogous Forecasting / Partial BOM Explosion input: blends the same
 * material's quantityPerUnit across every active analogue's BOM, weighted by
 * analogue weight.
 *
 * CONFIDENCE MATH — this is the part that was incoherent. It used to be
 * `Σ(w·similarity) / Σw` over only the analogues carrying the component,
 * which divides the coverage straight back out: a component evidenced by ONE
 * analogue holding 5% of the basis scored exactly as confidently as the same
 * component evidenced by that analogue holding 100% of it. Weight changes
 * therefore moved some rows and not others, and a weight of exactly zero made
 * a row drop discontinuously from 0.86 to 0 — which is how lowering an
 * analogue's weight could RAISE headline readiness while the plan-now count
 * fell.
 *
 * The blend now scores `Σ(w·similarity)` WITHOUT re-dividing by coverage, so
 * confidence is continuous and monotone in weight: raising a good analogue's
 * weight raises the confidence of every component it evidences and lowers the
 * confidence of components only its rivals evidence. Disagreement between
 * analogues about whether a component belongs is real uncertainty and now
 * reads as such.
 *
 * Rows with zero support are KEPT (quantity 0, confidence 0). Dropping them
 * would shrink the denominator of any aggregate readiness score and make that
 * score RISE as the basis got weaker — the same bug in a different place.
 * They classify as `unknown`; see confidence.ts::summarizeReadinessCounts.
 */
export function blendAnalogueBom(weighted: WeightedAnalogue[], bomByAnalogueProductId: Map<string, BomComponent[]>): Map<string, BlendedBomRow> {
  const acc = new Map<string, { qtySum: number; confSum: number; weightSum: number; uom: string; supporters: string[] }>();

  weighted.forEach(({ analogue, weight }) => {
    const rows = bomByAnalogueProductId.get(analogue.candidateProductId) ?? [];
    rows.forEach((row) => {
      const entry = acc.get(row.materialId) ?? { qtySum: 0, confSum: 0, weightSum: 0, uom: row.uom, supporters: [] };
      entry.qtySum += row.quantityPerUnit * weight;
      entry.confSum += analogue.similarityScore * weight;
      entry.weightSum += weight;
      if (!entry.supporters.includes(analogue.candidateProductId)) entry.supporters.push(analogue.candidateProductId);
      acc.set(row.materialId, entry);
    });
  });

  const result = new Map<string, BlendedBomRow>();
  acc.forEach((entry, materialId) => {
    result.set(materialId, {
      materialId,
      // Quantity stays coverage-normalized: it answers "how much per unit IF
      // this component is in the BOM", which is a different question from
      // "how sure are we that it is". Folding the two together would
      // understate consumption for every disputed component.
      quantityPerUnit: entry.weightSum > 0 ? entry.qtySum / entry.weightSum : 0,
      confidence: round4(entry.confSum),
      uom: entry.uom,
      supportWeight: round4(entry.weightSum),
      supportingProductIds: entry.supporters,
    });
  });
  return result;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
