import type { GapDetectionResult } from "@/lib/planning-engine/gaps";
import { getMethodology } from "@/lib/methodology/registry";
import {
  capacityEffectiveUtilizationPct,
  capacityFormalUtilizationPct,
  fmtUtilization,
  formatGapQuantity,
  formatReadinessCount,
  isPercentUnit,
  lineDisplayName,
  roundTo,
  summarizeBomReadiness,
  worstCapacityImpact,
} from "@/lib/gaps/gap-metrics";
import { fmtNum } from "@/lib/utils/format";

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
 *
 * Every figure quoted here now comes from lib/gaps/gap-metrics.ts, which is
 * the same module the gap workspaces and category pages render from. That
 * is the point: this file used to compute the capacity consequence itself,
 * from `expectedValueHigh` (the P80), and label the answer "effective
 * utilization" — so /decisions announced 98% while /overview and the gap
 * workspace both said 92%, and the 98 had no derivation on any page.
 */
export function gapWhyFlagged(r: GapDetectionResult): string {
  return r.planningBasis.whySelected;
}

export function gapConsequence(r: GapDetectionResult): string {
  const g = r.gap;
  switch (g.type) {
    case "demand": {
      const worst = worstCapacityImpact(r.scenarioResult);
      return worst
        ? `${fmtNum(g.unresolvedValue)} ${g.unit} unresolved — ${lineDisplayName(worst.lineId)} reaches ${fmtUtilization(worst.effectiveUtilization)} effective load once included`
        : `${fmtNum(g.unresolvedValue)} ${g.unit} unresolved against the formal plan`;
    }

    case "master_data": {
      if (g.unit === "days") {
        return `Decision deadline moves ${g.unresolvedValue} days earlier than the system assumption implies`;
      }
      if (isPercentUnit(g.unit)) {
        const low = roundTo(g.expectedValueLow, 1);
        const high = roundTo(g.expectedValueHigh, 1);
        const routed = g.lineId ? lineDisplayName(g.lineId) : "the routed work centre";
        return `${low === high ? `${high}%` : `${low}–${high}%`} of confirmed execution ran off ${routed}, the work centre the routing books`;
      }
      return "Observed execution disagrees with the system master-data value";
    }

    case "bom_uncertainty":
    case "product_uncertainty": {
      // Component counts, not a percentage. materials.ts carries no cost per
      // material, so no genuinely value-weighted readiness figure exists —
      // the old "N% of BOM value ready to plan now" was the gap's overall
      // confidence score wearing a value-weighted label.
      const summary = summarizeBomReadiness(r.scenarioResult?.materialReadiness ?? []);
      return summary.total > 0
        ? `${formatReadinessCount(summary)} components stable enough to plan now · ${summary.review} to review · ${summary.wait} to wait`
        : "No component rows resolved from the current analogue mix";
    }

    case "capacity":
      return `Effective utilization ${capacityEffectiveUtilizationPct(g)}% vs. ${capacityFormalUtilizationPct(g)}% formal`;

    case "representation":
      return `${formatGapQuantity(g.unresolvedValue, g.unit).value} of expected volume has no formal SKU`;

    case "material":
      return `${formatGapQuantity(g.unresolvedValue, g.unit).value} of material exposure not yet represented`;

    default:
      return "—";
  }
}
