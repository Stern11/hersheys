/**
 * Attribute matching between prior-season items and the current formal plan.
 *
 * This is deliberately not a prediction model. It compares business attributes
 * the planner already understands, and every result carries the list of
 * attributes that agreed and disagreed, so the screen can answer "why is this
 * matched?" rather than showing a bare 87% (V2 §43).
 *
 * Pure — no dataset imports, no dates, no randomness.
 */

import type {
  CandidateItem,
  ContributorDisposition,
  DimensionOutcome,
  MatchConfig,
  MatchDimension,
  MatchResult,
} from "@/types/situation";
import type { CurrentPlanRow, HistoricalItemRow } from "@/types/dataset";
import { eventLabel } from "@/lib/dataset/periods";

/**
 * The dimensions a prior item can be compared to a *current plan* item on.
 *
 * The pack, formulation and packaging attributes deliberately do not appear:
 * `Current_Plan` does not carry them, so comparing on them would always be
 * "not comparable" and would quietly dilute every score. They earn their keep
 * in analogue ranking instead, where both sides are historical items.
 */
export const REPRESENTATION_DIMENSIONS: readonly MatchDimension[] = [
  "brand",
  "product_family",
  "event",
  "customer",
  "channel",
];

/**
 * Weights reflect how strongly each attribute implies "this is the same piece
 * of business": brand and family are structural, customer and channel are
 * strong qualifiers, event is context.
 */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  dimensions: [
    { dimension: "brand", weight: 3, enabled: true },
    { dimension: "product_family", weight: 3, enabled: true },
    { dimension: "event", weight: 1, enabled: true },
    { dimension: "customer", weight: 2, enabled: true },
    { dimension: "channel", weight: 1, enabled: true },
  ],
  threshold: 0.8,
};

/** Statuses that mean the business deliberately stopped, not that it is missing. */
const EXIT_STATUSES = new Set([
  "discontinued",
  "delisted",
  "exited",
  "obsolete",
  "cancelled",
  "canceled",
  "dropped",
]);

function normalize(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Normalises one attribute for comparison.
 *
 * Event is the special case: a prior item is tagged "Halloween 2026" and its
 * successor "Halloween 2027", so comparing the raw strings marked the event as
 * *different* on literally every row — the one thing that is always true of a
 * prior season. Stripping the year compares the programme, which is what the
 * dimension is actually for.
 */
function comparable(value: string | undefined, dimension: MatchDimension): string | undefined {
  if (value === undefined) return undefined;
  if (dimension === "event") {
    const label = eventLabel(value);
    return label === "" ? undefined : label;
  }
  return normalize(value);
}

function historicalAttribute(row: HistoricalItemRow, dimension: MatchDimension): string | undefined {
  switch (dimension) {
    case "brand":
      return row.brand;
    case "product_family":
      return row.productFamily;
    case "event":
      return row.eventOrProgram;
    case "customer":
      return row.customer;
    case "channel":
      return row.channel;
    case "pack_format":
      return row.packFormat;
    case "pack_size":
      return row.packSize === undefined ? undefined : String(row.packSize);
    case "flavor_or_variant":
      return row.flavorOrVariant;
    case "formula_family":
      return row.formulaFamily;
    case "packaging_type":
      return row.packagingType;
    case "base_pack":
      return row.basePack;
  }
}

function currentAttribute(row: CurrentPlanRow, dimension: MatchDimension): string | undefined {
  switch (dimension) {
    case "brand":
      return row.brand;
    case "product_family":
      return row.productFamily;
    case "event":
      return row.eventOrProgram;
    case "customer":
      return row.customer;
    case "channel":
      return row.channel;
    default:
      // Not carried on Current_Plan — never comparable in this direction.
      return undefined;
  }
}

/**
 * Compares one prior item to one current-plan item.
 *
 * The score is the weighted share of *comparable* dimensions that agreed. A
 * dimension where either side is blank is excluded from both numerator and
 * denominator rather than counted as a mismatch, so a sparsely-filled optional
 * column cannot drag an otherwise clear match below the threshold.
 */
export function compareToCurrentItem(
  historical: HistoricalItemRow,
  current: CurrentPlanRow,
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): MatchResult {
  const outcomes: DimensionOutcome[] = [];
  let weightMatched = 0;
  let weightCompared = 0;

  for (const dim of config.dimensions) {
    if (!dim.enabled) continue;
    if (!REPRESENTATION_DIMENSIONS.includes(dim.dimension)) continue;

    const h = comparable(historicalAttribute(historical, dim.dimension), dim.dimension);
    const c = comparable(currentAttribute(current, dim.dimension), dim.dimension);

    if (h === undefined || c === undefined) {
      outcomes.push({
        dimension: dim.dimension,
        status: "not_comparable",
        historicalValue: historicalAttribute(historical, dim.dimension),
        currentValue: currentAttribute(current, dim.dimension),
      });
      continue;
    }

    weightCompared += dim.weight;
    const same = h === c;
    if (same) weightMatched += dim.weight;
    outcomes.push({
      dimension: dim.dimension,
      status: same ? "same" : "different",
      historicalValue: historicalAttribute(historical, dim.dimension),
      currentValue: currentAttribute(current, dim.dimension),
    });
  }

  // The same item id carried into the new plan is direct evidence, not
  // inference — it outranks any attribute comparison.
  const sameItemId = historical.itemId === current.itemId;
  const score = sameItemId ? 1 : weightCompared === 0 ? 0 : weightMatched / weightCompared;

  return {
    matchedItemId: current.itemId,
    matchedItemName: current.itemName,
    matchedUnits: current.plannedUnits,
    score,
    comparedDimensions: outcomes.filter((o) => o.status !== "not_comparable").length,
    outcomes,
  };
}

/**
 * Finds the current-plan item that best explains a prior item.
 *
 * Ties break toward the higher comparable-dimension count: a match backed by
 * four attributes is more trustworthy than the same score from one.
 */
export function matchToCurrentPlan(
  historical: HistoricalItemRow,
  currentItems: readonly CurrentPlanRow[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): MatchResult {
  let best: MatchResult | undefined;

  for (const current of currentItems) {
    const result = compareToCurrentItem(historical, current, config);
    if (
      best === undefined ||
      result.score > best.score ||
      (result.score === best.score && result.comparedDimensions > best.comparedDimensions)
    ) {
      best = result;
    }
  }

  if (best === undefined) {
    return { score: 0, comparedDimensions: 0, outcomes: [] };
  }

  // Below the threshold there is no claim of representation, so we keep the
  // explanation but drop the item pointer.
  if (best.score < config.threshold) {
    return { ...best, matchedItemId: undefined, matchedItemName: undefined, matchedUnits: undefined };
  }
  return best;
}

/**
 * The disposition the product proposes before the planner has looked.
 *
 * The signal is whether the item was *assigned* a successor in the plan, not
 * how high it scored: after a one-to-one assignment an unassigned item is
 * unrepresented however many attributes it happens to share with something
 * else. Unassigned business defaults to `carry_forward` — it ran last season
 * and nothing in the plan replaces it — which is both the planning-safe
 * reading and the one a planner is most likely to confirm.
 *
 * The exception is an item that scored high enough to have been a match and
 * only lost the assignment to a closer pair. That is genuinely ambiguous, so
 * it is put in front of the planner as `under_review` rather than being
 * counted as load.
 */
export function proposeDisposition(
  historical: HistoricalItemRow,
  match: MatchResult,
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): ContributorDisposition {
  const status = normalize(historical.status);
  if (status && EXIT_STATUSES.has(status)) return "intentional_exit";
  if (match.matchedItemId) return "already_represented";
  if (match.score >= config.threshold) return "under_review";
  return "carry_forward";
}

/**
 * A short planner-readable explanation of a match, e.g.
 * "Brand, product family, customer match; channel differs".
 */
export function explainMatch(match: MatchResult): string {
  const label = (d: MatchDimension) => DIMENSION_LABELS[d];
  const same = match.outcomes.filter((o) => o.status === "same").map((o) => label(o.dimension));
  const different = match.outcomes
    .filter((o) => o.status === "different")
    .map((o) => label(o.dimension));

  if (same.length === 0 && different.length === 0) return "No comparable attributes";

  const parts: string[] = [];
  if (same.length > 0) parts.push(`${same.join(", ")} match`);
  if (different.length > 0) parts.push(`${different.join(", ")} ${different.length === 1 ? "differs" : "differ"}`);
  return parts.join("; ");
}

export const DIMENSION_LABELS: Record<MatchDimension, string> = {
  brand: "Brand",
  product_family: "Product family",
  event: "Event",
  customer: "Customer",
  channel: "Channel",
  pack_format: "Pack format",
  pack_size: "Pack size",
  flavor_or_variant: "Flavour",
  formula_family: "Formulation",
  packaging_type: "Packaging",
  base_pack: "Base pack",
};

export const DISPOSITION_LABELS: Record<ContributorDisposition, string> = {
  unreviewed: "Unreviewed",
  carry_forward: "Carry forward",
  already_represented: "Already represented",
  intentional_exit: "Intentional exit",
  under_review: "Under review",
  new_or_changed: "New or changed",
};

/**
 * Assigns prior items to the current-plan items that represent them, one to
 * one.
 *
 * Scoring each prior item against the whole plan independently is not enough:
 * with a handful of brands and families, almost every prior item shares
 * attributes with *some* current item, so everything scores as represented and
 * nothing is left to explain the gap. A plan item can only stand for one prior
 * item, so the assignment is what the planner actually means by "this one came
 * back and that one did not".
 *
 * Greedy by descending score, which is sufficient here: pairs at score 1
 * (a shared item id) are exact successors and always win, and the remainder
 * are attribute ties where any consistent choice reads the same to a planner.
 */
export function assignRepresentation(
  historicalItems: readonly HistoricalItemRow[],
  currentItems: readonly CurrentPlanRow[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): Map<string, MatchResult> {
  interface Pair {
    historicalId: string;
    currentItemId: string;
    result: MatchResult;
  }

  const pairs: Pair[] = [];
  const best = new Map<string, MatchResult>();

  for (const historical of historicalItems) {
    let bestForRow: MatchResult | undefined;
    for (const current of currentItems) {
      const result = compareToCurrentItem(historical, current, config);
      if (
        bestForRow === undefined ||
        result.score > bestForRow.score ||
        (result.score === bestForRow.score && result.comparedDimensions > bestForRow.comparedDimensions)
      ) {
        bestForRow = result;
      }
      if (result.score >= config.threshold) {
        pairs.push({ historicalId: historical.id, currentItemId: current.itemId, result });
      }
    }
    // Kept so an unassigned row can still explain which attributes lined up.
    best.set(
      historical.id,
      bestForRow
        ? { ...bestForRow, matchedItemId: undefined, matchedItemName: undefined, matchedUnits: undefined }
        : { score: 0, comparedDimensions: 0, outcomes: [] }
    );
  }

  pairs.sort(
    (a, b) =>
      b.result.score - a.result.score ||
      b.result.comparedDimensions - a.result.comparedDimensions ||
      a.historicalId.localeCompare(b.historicalId)
  );

  const takenHistorical = new Set<string>();
  const takenCurrent = new Set<string>();
  const assigned = new Map<string, MatchResult>();

  for (const pair of pairs) {
    if (takenHistorical.has(pair.historicalId) || takenCurrent.has(pair.currentItemId)) continue;
    takenHistorical.add(pair.historicalId);
    takenCurrent.add(pair.currentItemId);
    assigned.set(pair.historicalId, pair.result);
  }

  for (const [id, result] of best) {
    if (!assigned.has(id)) assigned.set(id, result);
  }
  return assigned;
}

/**
 * Builds the candidate list for a situation: every prior item in scope, with
 * its match, its proposed disposition, and any planner override applied.
 */
export function buildCandidates(
  historicalItems: readonly HistoricalItemRow[],
  currentItems: readonly CurrentPlanRow[],
  dispositions: Readonly<Record<string, ContributorDisposition>>,
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
  pricePerUnit = 0
): CandidateItem[] {
  const assignments = assignRepresentation(historicalItems, currentItems, config);

  return historicalItems
    .map((row) => {
      const match = assignments.get(row.id) ?? { score: 0, comparedDimensions: 0, outcomes: [] };
      const proposed = proposeDisposition(row, match, config);
      const chosen = dispositions[row.id];
      return {
        id: row.id,
        itemId: row.itemId,
        itemName: row.itemName,
        brand: row.brand,
        productFamily: row.productFamily,
        historicalPeriod: row.historicalPeriod,
        actualUnits: row.actualUnits,
        actualValue: row.actualValue ?? row.actualUnits * pricePerUnit,
        // Matching does not resolve carry-forward volume — `collapseToSkus` in
        // ./volume does, and build.ts layers the result on top. The defaults
        // here keep a candidate self-consistent when it is built directly:
        // carry the prior actual forward unchanged.
        plannedUnits: row.actualUnits,
        plannedValue: row.actualValue ?? row.actualUnits * pricePerUnit,
        plannedBasis: {
          kind: "prior_actual",
          seasonsUsed: [row.historicalPeriod],
          baselineUnits: row.actualUnits,
          growthPct: 0,
          inferredUnits: row.actualUnits,
          label: "1 season · prior actual, no growth applied",
        },
        seasonHistory: [
          { period: row.historicalPeriod, units: row.actualUnits, value: row.actualValue },
        ],
        // Matching does not know which items have a bill of materials —
        // build.ts resolves that once it has the BOM index. `none` is the
        // honest default: it claims nothing until something is found.
        derivation: "none",
        analogues: [],
        derivationLabel: "",
        // Resolved in build.ts, which can see every season; matching sees one row.
        isNewThisSeason: false,
        disposition: chosen ?? proposed,
        proposedDisposition: proposed,
        match,
        customer: row.customer,
        channel: row.channel,
        packFormat: row.packFormat,
        basePack: row.basePack,
        formulaFamily: row.formulaFamily,
        primaryLineId: row.primaryLineId,
        status: row.status,
      } satisfies CandidateItem;
    })
    .sort((a, b) => b.actualValue - a.actualValue);
}
