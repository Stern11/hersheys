import type { PlanningGap, PlanningGapType } from "@/types/gaps";

/**
 * ONE definition of "how many planning gaps are there", because there were
 * two and they disagreed on screen.
 *
 * `/gaps` counted only the gaps its four root categories cover and reported
 * "5 active situations". `/decisions` counted every detected gap and reported
 * "Open (6)". The extra row is the Line 03 September capacity gap, which is
 * real and has a workspace at `/gaps/line-03-september-capacity` — but no
 * category landing page, because capacity and material gaps are deliberately
 * modelled as CONSEQUENCE LENSES: they are what a demand or assumption gap
 * does to an operation, discoverable from the gap that caused them, not
 * independent situations a planner triages on their own terms. A planner
 * cannot see that distinction in "5" vs "6"; they see a contradiction.
 *
 * So the distinction is made explicit here and both surfaces read from it:
 *   - `situations` are what "N active situations" counts.
 *   - `consequenceLenses` are counted and labelled separately, never dropped
 *     silently and never folded into the same total.
 *
 * INVARIANT (asserted by the unit tests): situations + consequenceLenses
 * always equals the total number of detected gaps. Nothing may disappear
 * between the two buckets.
 */
export type GapSurface = "situation" | "consequence_lens";

/**
 * The canonical type → surface map. `components/gaps/gap-category.ts` maps the
 * same four situation types onto their category slugs; it should derive its
 * `categoryForGapType` null-case from this table rather than keeping a second
 * private copy of the rule.
 */
export const GAP_TYPE_SURFACE: Record<PlanningGapType, GapSurface> = {
  demand: "situation",
  representation: "situation",
  product_uncertainty: "situation",
  bom_uncertainty: "situation",
  master_data: "situation",
  capacity: "consequence_lens",
  material: "consequence_lens",
};

export function gapSurface(type: PlanningGapType): GapSurface {
  return GAP_TYPE_SURFACE[type];
}

export function isSituation(type: PlanningGapType): boolean {
  return gapSurface(type) === "situation";
}

export interface GapPartition<T> {
  situations: T[];
  consequenceLenses: T[];
  /** situations.length + consequenceLenses.length — always the input length. */
  total: number;
}

/** Splits any list carrying a `gap` into the two surfaces, losing nothing. */
export function partitionGapsBySurface<T extends { gap: Pick<PlanningGap, "type"> }>(results: T[]): GapPartition<T> {
  const situations: T[] = [];
  const consequenceLenses: T[] = [];
  results.forEach((r) => (isSituation(r.gap.type) ? situations : consequenceLenses).push(r));
  return { situations, consequenceLenses, total: results.length };
}

/**
 * The number `/gaps` prints as "N active situations" and the number
 * `/decisions` must print as "Open (N)" before any triage is applied.
 */
export function countActiveSituations<T extends { gap: Pick<PlanningGap, "type"> }>(results: T[]): number {
  return partitionGapsBySurface(results).situations.length;
}

/** The consequence lenses that exist alongside those situations. */
export function countConsequenceLenses<T extends { gap: Pick<PlanningGap, "type"> }>(results: T[]): number {
  return partitionGapsBySurface(results).consequenceLenses.length;
}

export type TriageBucket = "open" | "monitoring" | "validated" | "closed";

export interface TriageState {
  monitoredGapIds: string[];
  validatedGapIds: string[];
  dismissedGapIds: string[];
  intentionalGapIds: string[];
}

/**
 * Where a gap sits after the planner's triage. Precedence is deliberate:
 * a closed decision (dismissed / intentional) outranks validated, which
 * outranks monitoring — so a gap can never be counted in two buckets at once
 * and the four bucket counts always sum to the number of situations.
 */
export function triageBucketFor(gapId: string, triage: TriageState): TriageBucket {
  if (triage.dismissedGapIds.includes(gapId) || triage.intentionalGapIds.includes(gapId)) return "closed";
  if (triage.validatedGapIds.includes(gapId)) return "validated";
  if (triage.monitoredGapIds.includes(gapId)) return "monitoring";
  return "open";
}

export interface TriageCounts {
  open: number;
  monitoring: number;
  validated: number;
  closed: number;
  /** Always equals open + monitoring + validated + closed. */
  total: number;
}

/**
 * The Decisions page's own counts, derived from the SAME situation set
 * `/gaps` itemizes. Consequence lenses are excluded on purpose: they are
 * triaged through the situation that causes them, not on their own row.
 */
export function summarizeTriage<T extends { gap: Pick<PlanningGap, "id" | "type"> }>(results: T[], triage: TriageState): TriageCounts {
  const { situations } = partitionGapsBySurface(results);
  const counts: TriageCounts = { open: 0, monitoring: 0, validated: 0, closed: 0, total: situations.length };
  situations.forEach((r) => {
    counts[triageBucketFor(r.gap.id, triage)] += 1;
  });
  return counts;
}
