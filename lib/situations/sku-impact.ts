/**
 * What one SKU costs the plan (V2 §42, §47).
 *
 * The aggregate answers "how much of this programme is unrepresented"; this
 * answers "and what does *this* item do to my lines and my materials". Both
 * read the same contributor lists the engine already produced while summing,
 * so a SKU's figures are guaranteed to reconcile with the totals rather than
 * being a second, parallel calculation.
 *
 * Pure: no React.
 */

import type {
  CandidateItem,
  MaterialExposureRow,
  MaterialPlanningStatus,
  PlanningSituation,
} from "@/types/situation";
import type { MonthKey } from "@/types/dataset";

/** This SKU's hours on one line, across the production window. */
export interface SkuLineLoad {
  lineId: string;
  lineName: string;
  plant: string;
  /** Hours this SKU adds to the line across every month in the window. */
  hours: number;
  /** Share of the line's total unresolved hours that this SKU accounts for. */
  shareOfUnresolved: number;
  byPeriod: { period: MonthKey; hours: number }[];
  /** True when this line breaches its target in at least one month. */
  isExposed: boolean;
  /** The worst effective utilisation this line reaches, for context. */
  peakEffectiveUtilization: number;
}

/** One component this SKU requires. */
export interface SkuMaterialNeed {
  materialId: string;
  materialName: string;
  componentType: string;
  uom: string;
  /** This SKU's own share of the component requirement. */
  requirement: number;
  /** Share of the whole situation's requirement for this component. */
  shareOfTotal: number;
  leadTimeDays: number;
  leadTimeBasis: MaterialExposureRow["leadTimeBasis"];
  decisionDate: string;
  weeksToDecision: number;
  /** The component's readiness across the whole situation. */
  status: MaterialPlanningStatus;
  sourcing: MaterialExposureRow["sourcing"];
  /**
   * Whether this component can be committed regardless of what happens to this
   * SKU, because other carry-forward items need it too.
   */
  standsWithoutThisItem: boolean;
}

export interface SkuImpact {
  candidate: CandidateItem;
  /** True when this SKU's disposition means it adds no load at all. */
  bearsLoad: boolean;

  totalHours: number;
  lines: SkuLineLoad[];
  /** Set when the SKU carries load but no line mapping covers it. */
  unmappedReason?: string;

  materials: SkuMaterialNeed[];
  /** Components that other carry-forward items also need. */
  sharedCount: number;
  /** Components only this SKU needs. */
  itemSpecificCount: number;
  /** The earliest order-by date among components this SKU drives. */
  earliestDecisionDate?: string;
  /** Set when the SKU carries load but its item has no BOM. */
  noBomReason?: string;
}

/**
 * Everything one candidate contributes, read back out of the contributor lists
 * the capacity and material engines recorded.
 */
export function skuImpact(
  situation: PlanningSituation,
  candidateId: string
): SkuImpact | undefined {
  const candidate = situation.candidateItems.find((c) => c.id === candidateId);
  if (!candidate) return undefined;

  const bearsLoad = candidate.disposition === "carry_forward";

  /* ---------------- capacity ---------------- */

  const byLine = new Map<string, { hours: number; byPeriod: Map<MonthKey, number> }>();
  for (const cell of situation.capacityExposure.cells) {
    for (const contributor of cell.contributors) {
      if (contributor.candidateId !== candidateId) continue;
      const entry = byLine.get(cell.lineId) ?? { hours: 0, byPeriod: new Map() };
      entry.hours += contributor.hours;
      entry.byPeriod.set(cell.period, (entry.byPeriod.get(cell.period) ?? 0) + contributor.hours);
      byLine.set(cell.lineId, entry);
    }
  }

  const lines: SkuLineLoad[] = [...byLine.entries()]
    .map(([lineId, entry]) => {
      const cells = situation.capacityExposure.cells.filter((c) => c.lineId === lineId);
      const first = cells[0];
      const lineUnresolved = cells.reduce((sum, c) => sum + c.unresolvedHours, 0);
      const peak = cells.reduce((max, c) => Math.max(max, c.effectiveUtilization), 0);
      return {
        lineId,
        lineName: first?.lineName ?? lineId,
        plant: first?.plant ?? "",
        hours: entry.hours,
        shareOfUnresolved: lineUnresolved > 0 ? entry.hours / lineUnresolved : 0,
        byPeriod: [...entry.byPeriod.entries()]
          .map(([period, hours]) => ({ period, hours }))
          .sort((a, b) => (a.period < b.period ? -1 : 1)),
        isExposed: situation.capacityExposure.exposedLineIds.includes(lineId),
        peakEffectiveUtilization: peak,
      } satisfies SkuLineLoad;
    })
    .sort((a, b) => b.hours - a.hours);

  const unmapped = situation.capacityExposure.unmappedItems.some(
    (i) => i.candidateId === candidateId
  );

  /* ---------------- materials ---------------- */

  const materials: SkuMaterialNeed[] = [];
  for (const row of situation.materialExposure.rows) {
    const mine = row.contributors.find((c) => c.candidateId === candidateId);
    if (!mine) continue;
    materials.push({
      materialId: row.materialId,
      materialName: row.materialName,
      componentType: row.componentType,
      uom: row.uom,
      requirement: mine.requirement,
      shareOfTotal: row.requirementBase > 0 ? mine.requirement / row.requirementBase : 0,
      leadTimeDays: row.leadTimeDays,
      leadTimeBasis: row.leadTimeBasis,
      decisionDate: row.decisionDate,
      weeksToDecision: row.weeksToDecision,
      status: row.status,
      sourcing: row.sourcing,
      // The point of the split: a component other carry-forward items also
      // need is justified whatever this planner decides about this one item.
      standsWithoutThisItem: row.contributors.some(
        (c) => c.candidateId !== candidateId && c.settled
      ),
    });
  }
  materials.sort((a, b) => a.weeksToDecision - b.weeksToDecision || b.requirement - a.requirement);

  const noBom =
    situation.materialExposure.itemsWithoutBom.some((i) => i.candidateId === candidateId);

  return {
    candidate,
    bearsLoad,
    totalHours: lines.reduce((sum, l) => sum + l.hours, 0),
    lines,
    unmappedReason: unmapped
      ? "No line mapping covers this item, so its hours cannot be placed on a line."
      : undefined,
    materials,
    sharedCount: materials.filter((m) => m.sourcing === "shared").length,
    itemSpecificCount: materials.filter((m) => m.sourcing === "item_specific").length,
    earliestDecisionDate: materials[0]?.decisionDate,
    noBomReason: noBom
      ? "This item has no BOM, so its material requirement cannot be calculated."
      : undefined,
  };
}

/**
 * The attributes that agreed and differed against the plan item standing for
 * this one. Representation is explained by naming attributes, never by a bare
 * similarity percentage (V2 §43).
 */
export function matchExplanation(candidate: CandidateItem): {
  same: string[];
  different: string[];
  notComparable: string[];
} {
  const label = (d: string) => d.replace(/_/g, " ");
  return {
    same: candidate.match.outcomes.filter((o) => o.status === "same").map((o) => label(o.dimension)),
    different: candidate.match.outcomes
      .filter((o) => o.status === "different")
      .map((o) => label(o.dimension)),
    notComparable: candidate.match.outcomes
      .filter((o) => o.status === "not_comparable")
      .map((o) => label(o.dimension)),
  };
}
