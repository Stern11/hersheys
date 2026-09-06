/**
 * Analogous derivation for products with no bill of materials (V2 §17, §43).
 *
 * A product can be real enough to plan before it is specified enough to
 * explode. A renovation, a new pack, an item whose spec was never set up — the
 * volume is known, the components are not. The honest move is neither to drop
 * it (which understates the plan) nor to invent a BOM for it (which fabricates
 * precision), but to say *this is what comparable products need, and here is
 * how comparable they actually are*.
 *
 * Two rules this module exists to hold:
 *
 * - Similarity is explained by naming attributes, never by a bare percentage.
 *   A planner can argue with "different pack format"; they cannot argue with
 *   64%.
 * - Confidence falls with disagreement. A component every analogue carries is
 *   better evidenced than one only the weakest of them does, and the two must
 *   never come out looking the same.
 *
 * Pure: no React, no `Date.now()`, no `Math.random()`.
 */

import type { BomRow, HistoricalItemRow } from "@/types/dataset";
import type { AnalogueMatch, InferredBomLine } from "@/types/situation";

/**
 * What makes two products comparable, and how much each attribute is worth.
 *
 * Weighted by how much each actually predicts a bill of materials: what a
 * product is made of dominates, what it is wrapped in follows, and who buys it
 * barely matters at all.
 */
const DIMENSIONS = [
  { key: "formulaFamily", label: "formulation", weight: 3 },
  { key: "productFamily", label: "product family", weight: 3 },
  { key: "packagingType", label: "packaging type", weight: 2 },
  { key: "packFormat", label: "pack format", weight: 2 },
  { key: "basePack", label: "base pack", weight: 2 },
  { key: "brand", label: "brand", weight: 1 },
  { key: "packSize", label: "pack size", weight: 1 },
  { key: "customer", label: "customer", weight: 0.5 },
] as const;

/** Below this the products are not comparable enough to derive anything from. */
const MIN_SIMILARITY = 0.35;
/** More than this and the tail adds noise rather than evidence. */
const MAX_ANALOGUES = 4;

function attr(row: HistoricalItemRow, key: (typeof DIMENSIONS)[number]["key"]): string | undefined {
  const value = row[key];
  if (value === undefined || value === null) return undefined;
  return String(value).trim().toLowerCase() || undefined;
}

/**
 * Ranks comparable products, explaining each one.
 *
 * Only products that actually have a BOM are offered: an analogue with nothing
 * to copy is not an analogue, and returning one would produce an item that
 * looks derived but explodes into nothing.
 */
export function findAnalogues(
  target: HistoricalItemRow,
  pool: readonly HistoricalItemRow[],
  bomByParent: ReadonlyMap<string, BomRow[]>,
  options: { excluded?: readonly string[]; limit?: number } = {}
): AnalogueMatch[] {
  const excluded = new Set(options.excluded ?? []);
  const scored: AnalogueMatch[] = [];

  for (const row of pool) {
    if (row.id === target.id) continue;
    if (!bomByParent.has(row.itemId)) continue;

    let matched = 0;
    let comparable = 0;
    const same: string[] = [];
    const different: string[] = [];

    for (const dim of DIMENSIONS) {
      const a = attr(target, dim.key);
      const b = attr(row, dim.key);
      // An attribute missing on either side is not evidence of similarity or
      // of difference, so it is left out of the denominator entirely.
      if (a === undefined || b === undefined) continue;
      comparable += dim.weight;
      if (a === b) {
        matched += dim.weight;
        same.push(dim.label);
      } else {
        different.push(dim.label);
      }
    }

    if (comparable === 0) continue;
    const similarity = matched / comparable;
    if (similarity < MIN_SIMILARITY) continue;

    scored.push({
      candidateId: row.id,
      itemId: row.itemId,
      itemName: row.itemName,
      period: row.historicalPeriod,
      similarity,
      same,
      different,
      componentCount: bomByParent.get(row.itemId)?.length ?? 0,
      excluded: excluded.has(row.id),
      // Default weight is the similarity itself: a closer product should
      // count for more until a planner says otherwise.
      weight: similarity,
    });
  }

  return scored
    .sort((a, b) => b.similarity - a.similarity || a.itemName.localeCompare(b.itemName))
    .slice(0, options.limit ?? MAX_ANALOGUES);
}

/**
 * Blends the analogues' bills of materials into one inferred BOM.
 *
 * Quantities are a weighted mean across the analogues that carry the
 * component, not across all of them — averaging in a zero for a product that
 * simply does not use foil would quietly halve the foil requirement.
 *
 * Confidence is the share of analogue weight that carries the component at
 * all. That is the number that separates "every comparable product needs
 * cocoa" from "one of them happened to use a tin".
 */
export function blendAnalogueBoms(
  analogues: readonly AnalogueMatch[],
  bomByParent: ReadonlyMap<string, BomRow[]>
): InferredBomLine[] {
  const included = analogues.filter((a) => !a.excluded && a.weight > 0);
  const totalWeight = included.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight <= 0) return [];

  const accum = new Map<
    string,
    {
      row: BomRow;
      weightedQty: number;
      weightedScrap: number;
      carryingWeight: number;
      sources: { itemName: string; quantityPerParent: number }[];
    }
  >();

  for (const analogue of included) {
    for (const line of bomByParent.get(analogue.itemId) ?? []) {
      const existing = accum.get(line.componentId);
      const entry = existing ?? {
        row: line,
        weightedQty: 0,
        weightedScrap: 0,
        carryingWeight: 0,
        sources: [],
      };
      entry.weightedQty += line.quantityPerParent * analogue.weight;
      entry.weightedScrap += (line.scrapPct ?? 0) * analogue.weight;
      entry.carryingWeight += analogue.weight;
      entry.sources.push({ itemName: analogue.itemName, quantityPerParent: line.quantityPerParent });
      if (!existing) accum.set(line.componentId, entry);
    }
  }

  return [...accum.values()]
    .map((entry) => ({
      componentId: entry.row.componentId,
      componentName: entry.row.componentName,
      componentType: entry.row.componentType,
      componentFamily: entry.row.componentFamily,
      uom: entry.row.uom,
      // Divided by the weight that actually carries it, not the total.
      quantityPerParent: entry.weightedQty / entry.carryingWeight,
      scrapPct: entry.weightedScrap / entry.carryingWeight,
      planningStatus: entry.row.planningStatus,
      confidence: entry.carryingWeight / totalWeight,
      sources: entry.sources.sort((a, b) => b.quantityPerParent - a.quantityPerParent),
    }))
    .sort((a, b) => b.confidence - a.confidence || a.componentName.localeCompare(b.componentName));
}

/**
 * One line describing the derivation, for a screen that has to say where a
 * number came from before a planner will act on it.
 */
export function describeAnalogueBasis(analogues: readonly AnalogueMatch[]): string {
  const included = analogues.filter((a) => !a.excluded && a.weight > 0);
  if (included.length === 0) return "No comparable product with a bill of materials was found.";

  const best = included[0];
  const rest = included.length - 1;
  const pct = best ? `${Math.round(best.similarity * 100)}%` : "";
  return rest > 0
    ? `Derived from ${included.length} comparable products, closest ${best?.itemName} (${pct} of compared attributes agree)`
    : `Derived from ${best?.itemName} (${pct} of compared attributes agree)`;
}
