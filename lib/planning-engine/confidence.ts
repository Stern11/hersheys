import type { Confidence, ConfidenceDimension } from "@/types/shared";
import type { MaterialReadinessState } from "@/types/planning";

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
  if (confidence >= READINESS_THRESHOLDS.planNow) return "plan_now";
  if (confidence >= READINESS_THRESHOLDS.review) return "review";
  if (confidence >= READINESS_THRESHOLDS.wait) return "wait";
  return "unknown";
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
