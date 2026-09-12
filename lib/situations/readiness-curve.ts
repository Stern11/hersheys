/**
 * The per-programme readiness curve (V2 §39, feedback: "for every season,
 * show where we were last year for all the SKUs, and what one thing might
 * keep things from running").
 *
 * Three things, never fabricated:
 *
 * - "Today" is the real share of prior-year SKUs this situation already
 *   represents — the same match ratio every other page reads, not a second
 *   number invented for this chart.
 * - "Last year's pace" is read from `Readiness_History`, a real (if
 *   synthetic-in-demo) weekly-snapshot sheet — when it's absent, this simply
 *   isn't available, exactly like `capacityUnavailable`/`materialsUnavailable`
 *   elsewhere. It never becomes a plausible-looking curve nothing measured.
 * - The "one thing that could keep this from running" reuses the same BOM
 *   explosion and lead-time statistics `build.ts` already computes for
 *   settled items (`blendAnalogueBoms`, `leadTimeStats`), just applied to the
 *   candidates that are *not yet* represented — because that is exactly the
 *   set the callout is about.
 */

import { addDays, isComparablePeriod, weeksBetween } from "@/lib/dataset/periods";
import { blendAnalogueBoms } from "./analogues";
import { leadTimeStats } from "./build";
import type { BomRow, PlanningDataset } from "@/types/dataset";
import type { PlanningSituation } from "@/types/situation";

export interface ReadinessPoint {
  weeksBeforeProductionStart: number;
  representedPct: number;
}

export interface ConstrainingMaterial {
  materialId: string;
  materialName: string;
  leadTimeDays: number;
  decisionDate: string;
  weeksToDecision: number;
  /** How many of the situation's unrepresented items need this component. */
  itemCount: number;
}

export interface ReadinessCurve {
  situationId: string;
  situationTitle: string;

  /** planningNow — for the chart to position "today" without recomputing it. */
  today: string;
  productionStart?: string;

  /** From real candidate matching — never estimated for this chart. */
  todayPct?: number;
  todayWeeksBeforeProduction?: number;

  /** From Readiness_History, filtered to this situation's own period. */
  currentSeasonHistory: ReadinessPoint[];
  /** From Readiness_History, filtered to the most recent comparable prior period. */
  priorSeasonPace: ReadinessPoint[];
  historyAvailable: boolean;
  historyUnavailableReason?: string;

  dropDeadDate?: string;
  dropDeadLabel?: string;
  runwayWeeks?: number;

  /** The widest span worth drawing the axis over, in weeks before production. */
  horizonWeeks: number;

  constrainingMaterial?: ConstrainingMaterial;
}

function sortByWeeksDescending(points: ReadinessPoint[]): ReadinessPoint[] {
  return [...points].sort((a, b) => b.weeksBeforeProductionStart - a.weeksBeforeProductionStart);
}

/** The most recent comparable prior period among this situation's own candidates. */
function priorSeasonPeriod(situation: PlanningSituation): string | undefined {
  let best: string | undefined;
  for (const candidate of situation.candidateItems) {
    const period = candidate.historicalPeriod;
    if (!isComparablePeriod(period, situation.planningPeriod)) continue;
    if (!best || period > best) best = period;
  }
  return best;
}

/**
 * The single tightest material deadline among the situation's *unrepresented*
 * candidates — the thing that could stop one of them from being ready even if
 * the planner commits to it today. Deliberately not scoped to carry-forward
 * items only: those already have a material picture on Reconcile and
 * Materials. This is about what is still missing.
 */
function findConstrainingMaterial(
  situation: PlanningSituation,
  dataset: PlanningDataset
): ConstrainingMaterial | undefined {
  const unrepresented = situation.candidateItems.filter((c) => c.match.matchedItemId === undefined);
  if (unrepresented.length === 0) return undefined;

  const productionStart = situation.productionWindow?.start;
  if (!productionStart) return undefined;

  const bomByParent = new Map<string, BomRow[]>();
  for (const row of dataset.boms) {
    const list = bomByParent.get(row.parentItemId);
    if (list) list.push(row);
    else bomByParent.set(row.parentItemId, [row]);
  }

  const leadTimes = leadTimeStats(dataset);
  const itemCountByMaterial = new Map<string, { name: string; leadTimeDays: number; count: number }>();

  for (const candidate of unrepresented) {
    const own = bomByParent.get(candidate.itemId);
    const lines = own ?? blendAnalogueBoms(candidate.analogues, bomByParent);
    for (const line of lines) {
      const lead = leadTimes.get(line.componentId);
      if (!lead) continue;
      const existing = itemCountByMaterial.get(line.componentId);
      if (existing) existing.count += 1;
      else itemCountByMaterial.set(line.componentId, { name: line.componentName, leadTimeDays: lead.days, count: 1 });
    }
  }

  let worst: ConstrainingMaterial | undefined;
  for (const [materialId, entry] of itemCountByMaterial) {
    const decisionDate = addDays(productionStart, -entry.leadTimeDays);
    if (!worst || decisionDate < worst.decisionDate) {
      worst = {
        materialId,
        materialName: entry.name,
        leadTimeDays: entry.leadTimeDays,
        decisionDate,
        weeksToDecision: weeksBetween(dataset.metadata.planningNow, decisionDate),
        itemCount: entry.count,
      };
    }
  }
  return worst;
}

export function buildReadinessCurve(situation: PlanningSituation, dataset: PlanningDataset): ReadinessCurve {
  const now = dataset.metadata.planningNow;
  const productionStart = situation.productionWindow?.start;

  const totalCandidates = situation.candidateItems.length;
  const matchedCount = situation.candidateItems.filter((c) => c.match.matchedItemId !== undefined).length;
  const todayPct = totalCandidates > 0 ? matchedCount / totalCandidates : undefined;
  const todayWeeksBeforeProduction = productionStart ? weeksBetween(now, productionStart) : undefined;

  const historyAvailable = dataset.metadata.capabilities.readinessHistory;
  const currentSeasonHistory = historyAvailable
    ? sortByWeeksDescending(
        dataset.readinessHistory
          .filter((r) => r.seasonPeriod === situation.planningPeriod)
          .map((r) => ({ weeksBeforeProductionStart: r.weeksBeforeProductionStart, representedPct: r.representedPct }))
      )
    : [];

  const priorPeriod = priorSeasonPeriod(situation);
  const priorSeasonPace =
    historyAvailable && priorPeriod
      ? sortByWeeksDescending(
          dataset.readinessHistory
            .filter((r) => r.seasonPeriod === priorPeriod)
            .map((r) => ({ weeksBeforeProductionStart: r.weeksBeforeProductionStart, representedPct: r.representedPct }))
        )
      : [];

  const horizonWeeks = Math.max(
    1,
    todayWeeksBeforeProduction ?? 0,
    ...currentSeasonHistory.map((p) => p.weeksBeforeProductionStart),
    ...priorSeasonPace.map((p) => p.weeksBeforeProductionStart)
  );

  const earliest = situation.runway.earliest;

  return {
    situationId: situation.id,
    situationTitle: situation.title,
    today: now,
    productionStart,
    todayPct,
    todayWeeksBeforeProduction,
    currentSeasonHistory,
    priorSeasonPace,
    historyAvailable,
    historyUnavailableReason: historyAvailable
      ? undefined
      : "Add weekly readiness history to see this season's pace against last year's.",
    dropDeadDate: earliest?.date,
    dropDeadLabel: earliest?.label,
    runwayWeeks: situation.runway.weeksOfRunway,
    horizonWeeks,
    constrainingMaterial: findConstrainingMaterial(situation, dataset),
  };
}
