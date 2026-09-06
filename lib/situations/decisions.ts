/**
 * What a planner has to decide, and by when (V2 §49-50).
 *
 * The Decide step used to open on "Runway remaining: 10 weeks" with nothing
 * saying whose runway that was. A date with no subject is not a decision — it
 * is a number a planner has to go and reconstruct the meaning of.
 *
 * Every row here names three things: the thing being decided, the date it
 * stops being reversible, and the products that put it there. All of it is
 * read from the contributor lists the engine already recorded, so a decision
 * and the item pages behind it cannot disagree.
 *
 * Pure: no React.
 */

import type { PlanningSituation } from "@/types/situation";

export type DecisionKind = "material_order" | "line_capacity" | "production_start" | "representation";

export type DecisionUrgency = "overdue" | "urgent" | "soon" | "later";

export interface PendingDecision {
  id: string;
  kind: DecisionKind;
  /** What is being decided, in the planner's words. */
  title: string;
  /** The date it stops being reversible. Absent for undated work. */
  date?: string;
  weeksAway?: number;
  urgency: DecisionUrgency;
  /** One line saying what happens at that date. */
  consequence: string;
  /** The products that put this decision on the calendar. */
  drivenBy: string[];
  /** Where the planner goes to act on it. */
  href: string;
  cta: string;
}

/** Inside this many weeks a decision is effectively being made now. */
const URGENT_WEEKS = 4;
const SOON_WEEKS = 12;

export function urgencyOf(weeksAway: number | undefined): DecisionUrgency {
  if (weeksAway === undefined) return "later";
  if (weeksAway <= 0) return "overdue";
  if (weeksAway <= URGENT_WEEKS) return "urgent";
  if (weeksAway <= SOON_WEEKS) return "soon";
  return "later";
}

/**
 * Every dated commitment this situation implies, soonest first.
 *
 * Components a planner cannot act on yet are deliberately included, marked by
 * what is blocking them — an undecided item is itself a decision, and hiding
 * the dates it is holding up is how a deadline arrives unannounced.
 */
export function pendingDecisions(situation: PlanningSituation): PendingDecision[] {
  const out: PendingDecision[] = [];
  const { materialExposure, capacityExposure, runway, bridge, candidateItems } = situation;

  /* ---- materials: the usual first thing to become irreversible ---- */
  if (materialExposure.available) {
    for (const row of materialExposure.rows) {
      if (row.status === "WAIT") continue;
      const drivers = [...row.contributors]
        .sort((a, b) => b.requirement - a.requirement)
        .slice(0, 3)
        .map((c) => c.itemName);

      out.push({
        id: `material:${row.materialId}`,
        kind: "material_order",
        title: `Order ${row.materialName}`,
        date: row.decisionDate,
        weeksAway: row.weeksToDecision,
        urgency: urgencyOf(row.weeksToDecision),
        consequence:
          row.leadTimeDays > 0
            ? `${row.leadTimeDays}-day lead time`
            : "Needed before the build starts",
        drivenBy: drivers,
        href: `/workspace/${situation.id}/reconcile`,
        cta: "See the items",
      });
    }
  }

  /* ---- capacity: the month a line stops fitting ---- */
  if (capacityExposure.available) {
    const breaching = capacityExposure.cells
      .filter((c) => c.effectiveUtilization > c.targetUtilizationPct && c.unresolvedHours > 0)
      .sort((a, b) => a.period.localeCompare(b.period));

    const first = breaching[0];
    if (first) {
      const drivers = [...first.contributors]
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 3)
        .map((c) => c.itemName);
      const monthStart = `${first.period}-01`;
      const marker = runway.markers.find((m) => m.kind === "capacity_decision");

      out.push({
        id: `capacity:${first.lineId}:${first.period}`,
        kind: "line_capacity",
        title: `Resolve load on ${first.lineName}`,
        date: monthStart,
        weeksAway: marker?.weeksAway,
        urgency: urgencyOf(marker?.weeksAway),
        consequence: `Runs at ${Math.round(first.effectiveUtilization * 100)}% against a ${Math.round(
          first.targetUtilizationPct * 100
        )}% target. Move it, build it earlier, or accept the overtime.`,
        drivenBy: drivers,
        href: `/scenario-lab?situation=${situation.id}`,
        cta: "Test it in Scenario Lab",
      });
    }
  }

  /* ---- representation: undecided items hold everything else up ---- */
  const undecided = candidateItems.filter(
    (c) => c.disposition === "unreviewed" || c.disposition === "under_review"
  );
  if (undecided.length > 0) {
    const productionStart = situation.productionWindow?.start;
    const marker = runway.markers.find((m) => m.kind === "production_start");
    out.push({
      id: "representation:undecided",
      kind: "representation",
      title: `Decide on ${undecided.length} product${undecided.length === 1 ? "" : "s"}`,
      date: productionStart,
      weeksAway: marker?.weeksAway,
      urgency: urgencyOf(marker?.weeksAway),
      consequence:
        "Until these are decided they carry no load, so the hours and components they would need are missing from every figure above.",
      drivenBy: undecided.slice(0, 3).map((c) => c.itemName),
      href: `/workspace/${situation.id}/reconcile`,
      cta: "Decide them",
    });
  }

  /* ---- production: the build itself ---- */
  if (situation.productionWindow && bridge.validatedUnits > 0) {
    const marker = runway.markers.find((m) => m.kind === "production_start");
    out.push({
      id: "production:start",
      kind: "production_start",
      title: "Production starts",
      date: situation.productionWindow.start,
      weeksAway: marker?.weeksAway,
      urgency: urgencyOf(marker?.weeksAway),
      consequence: "Everything above has to be settled before the first build day.",
      drivenBy: [],
      href: `/workspace/${situation.id}/reconcile`,
      cta: "Review the plan",
    });
  }

  return out.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

/** Components that cannot be committed yet, and the item each is waiting on. */
export function blockedMaterials(
  situation: PlanningSituation
): { materialName: string; reason: string; blockedBy?: string }[] {
  if (!situation.materialExposure.available) return [];
  return situation.materialExposure.rows
    .filter((r) => r.status === "WAIT")
    .map((r) => ({
      materialName: r.materialName,
      reason: r.reason,
      blockedBy: r.blockedByItemName,
    }));
}
