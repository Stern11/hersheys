import type { Confidence, ConfidenceDimension } from "@/types/shared";
import type { MaterialReadinessState } from "@/types/planning";
import type { ReadinessCounts } from "@/types/scenario";

/**
 * Confidence -> actionability thresholds (PRD §31.2 example: Cocoa 92% ->
 * Plan now, Foil 72% -> Review, Printed wrapper 29% -> Wait). Demo-configured
 * but explainable — never a single hidden magic number buried in a component.
 */
export const READINESS_THRESHOLDS = {
  planNow: 0.8,
  review: 0.55,
  wait: 0.3,
} as const;

export function classifyReadiness(confidence: number): MaterialReadinessState {
  if (!Number.isFinite(confidence)) return "unknown";
  if (confidence >= READINESS_THRESHOLDS.planNow) return "plan_now";
  if (confidence >= READINESS_THRESHOLDS.review) return "review";
  if (confidence >= READINESS_THRESHOLDS.wait) return "wait";
  return "unknown";
}

/**
 * The ONE place readiness rows get counted.
 *
 * `classifyReadiness` has four outcomes but the readiness views were counting
 * three, so every row below the "wait" floor — a component no active analogue
 * evidences, which is exactly the row a planner most needs to see — vanished
 * from the totals. The result read "plan 0 / review 6 / wait 0" against a
 * seven-component BOM and nothing on screen explained the missing row.
 *
 * INVARIANT (asserted by the unit tests): planNow + review + wait + unknown
 * === total === rows.length, for any input.
 */
export function summarizeReadinessCounts(rows: { readiness: MaterialReadinessState }[]): ReadinessCounts {
  const counts: ReadinessCounts = { planNow: 0, review: 0, wait: 0, unknown: 0, total: rows.length };
  rows.forEach((r) => {
    switch (r.readiness) {
      case "plan_now":
        counts.planNow += 1;
        break;
      case "review":
        counts.review += 1;
        break;
      case "wait":
        counts.wait += 1;
        break;
      default:
        // "monitor" and "unknown" both mean "not yet actionable, not yet
        // classified as a wait" — they belong in the same residual bucket
        // rather than being dropped on the floor.
        counts.unknown += 1;
    }
  });
  return counts;
}

/**
 * Mean component confidence across the resolved BOM, 0-1.
 *
 * The denominator is EVERY resolved row, including zero-support rows. That is
 * deliberate and is what makes the score monotone in analogue weight: if
 * unsupported rows were dropped instead, weakening the analogue basis would
 * shrink the denominator faster than the numerator and the score would go UP
 * as the evidence got worse.
 *
 * This is a mean of component confidences and nothing more — it is NOT a
 * value-weighted or volume-weighted readiness figure, and must not be
 * labelled as one. (Components here are measured in MT, cwt, lbs, kg, MSI and
 * each; there is no shared denominator to weight them by without a cost
 * master this phase does not have.)
 */
export function bomReadinessScore(rows: { confidence: number }[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((s, r) => s + (Number.isFinite(r.confidence) ? r.confidence : 0), 0);
  return Math.round((sum / rows.length) * 1000) / 1000;
}

/** Overall score is a sort/badge summary only — always keep the per-dimension breakdown alongside it. */
export function summarizeConfidence(dimensions: ConfidenceDimension[]): Confidence {
  if (dimensions.length === 0) {
    return { overall: 0, dimensions: [] };
  }
  const overall = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
  return { overall: Math.round(overall * 1000) / 1000, dimensions };
}

/** Widens a confidence band into P50/P80/P95 style bounds for display, without asserting false precision. */
export function confidenceBand(base: number, spreadPct = 0.06): { p50: number; p80: number; p95: number } {
  return {
    p50: base,
    p80: base * (1 + spreadPct),
    p95: base * (1 + spreadPct * 1.8),
  };
}
