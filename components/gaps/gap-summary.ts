import type { GapDetectionResult } from "@/lib/planning-engine/gaps";
import { getMethodology } from "@/lib/methodology/registry";
import { fmtNum, fmtPct } from "@/lib/utils/format";

export function methodologyLabelFor(id: Parameters<typeof getMethodology>[0]): string {
  return getMethodology(id).shortName;
}

/** The earliest decision deadline this gap's scenario result carries, if any. */
export function gapEarliestDate(r: GapDetectionResult): string | null {
  return r.scenarioResult?.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date ?? null;
}

export function weeksFromNow(nowIso: string, dateIso: string): number {
  return Math.round(((new Date(dateIso).getTime() - new Date(nowIso).getTime()) / (7 * 86_400_000)) * 10) / 10;
}

/**
 * Two presentation-layer summary lines per gap for the worklist ("why
 * flagged" / "operational consequence"). Deliberately NOT part of
 * PlanningGap itself — these are derived text for the grid, not domain
 * data, and every number in them traces back to a real gap field.
 */
export function gapWhyFlagged(r: GapDetectionResult): string {
  return r.planningBasis.whySelected;
}

export function gapConsequence(r: GapDetectionResult): string {
  const g = r.gap;
  switch (g.type) {
    case "demand":
      return `${fmtNum(g.unresolvedValue)} ${g.unit} unresolved — Line 03 exceeds target once included`;
    case "master_data":
      return g.unit === "days"
        ? `Decision deadline moves ${g.unresolvedValue} days earlier than the system assumption implies`
        : `${Math.round(g.expectedValueHigh)}% of observed execution disagrees with the system routing`;
    case "bom_uncertainty":
    case "product_uncertainty":
      return `${Math.round(g.confidence.overall * 100)}% of BOM value ready to plan now`;
    case "capacity":
      return `Effective utilization ${fmtPct(g.expectedValueHigh / 100)} vs. ${fmtPct(g.formalValue / 100)} formal`;
    case "representation":
      return `${fmtNum(g.unresolvedValue)} ${g.unit} of expected volume has no formal SKU`;
    case "material":
      return `${fmtNum(g.unresolvedValue)} ${g.unit} of material exposure not yet represented`;
    default:
      return "—";
  }
}
