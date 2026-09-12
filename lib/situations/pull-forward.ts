/**
 * Capacity pull-forward simulation (V2 §46, PRD §14.4, §7.9).
 *
 * The one capacity lever feedback asked for: "if a line is overloaded, let a
 * planner see what happens if some of that production is pulled into
 * earlier, emptier months instead." This is a *display-time* simulation over
 * an already-computed `CapacityExposure` — it never touches
 * `ScenarioAdjustments` or `applyScenarioToDataset`, is never persisted, and
 * can't disagree with any other page, exactly like the coherence rule
 * requires of anything derived (V2 §53).
 *
 * Algorithm: walk a line's months in chronological order. Each overloaded
 * month searches backward for headroom one month at a time — nearest month
 * first — up to `maxWeeks` away, claiming whatever room it finds and moving
 * on to the next-nearest month only if there's still overflow left. "Max
 * pull-forward" means *up to* that many weeks, not *exactly*: an earlier
 * version jumped straight to the single month exactly `maxWeeks` back, which
 * meant a 9-week setting could skip right past an emptier month one month
 * away to reach for a two-months-away month that didn't exist — the nearer,
 * genuinely available month was never even considered. Processing
 * chronologically still means an earlier overloaded month gets first claim
 * on a given month's headroom — which is why, in practice, the first couple
 * of overloaded months tend to resolve fully while later ones only partially
 * do: the room nearest to them was already spent.
 *
 * This intentionally does not touch `buildRunway`'s `capacity_decision`
 * marker — the per-month "drop-dead" shown here is a local, chart-scoped
 * calculation (month start minus lead time) so this stays a contained
 * addition rather than a change to situation-level runway logic.
 */

import type { CapacityExposure } from "@/types/situation";
import type { MonthKey } from "@/types/dataset";
import { addMonths, addDays } from "@/lib/dataset/periods";

const AVG_WEEKS_PER_MONTH = 4.345;

export interface PullForwardCell {
  period: MonthKey;
  committedHours: number;
  /** Unresolved hours this month started with, before any pull. */
  absentHoursBefore: number;
  /** Hours moved out of this month into an earlier one. */
  pulledOutHours: number;
  /** Hours this month absorbed from a later, overloaded month. */
  pulledInHours: number;
  /** absentHoursBefore - pulledOutHours + pulledInHours. */
  remainingAfterHours: number;
  /** What's still over capacity after pulling — "additional hours needed". */
  overflowAfterHours: number;
  /** What was over capacity before any pulling. */
  overflowBeforeHours: number;
  availableHours: number;
  dropDeadBefore?: string;
  dropDeadAfter?: string;
}

export interface PullForwardResult {
  lineId: string;
  lineName: string;
  maxWeeks: number;
  cells: PullForwardCell[];
  totalPulledHours: number;
  totalShortfallHours: number;
  totalOverflowBeforeHours: number;
  /** Units implied by `totalPulledHours`, via a line-blended units/hour rate. */
  unitsSecured: number;
  /** Units implied by `totalOverflowBeforeHours` — what's at risk untouched. */
  unitsAtRisk: number;
  /** Units implied by `totalShortfallHours` — what's still at risk after pulling. */
  unitsStillAtRisk: number;
}

/**
 * `maxWeeks` converted to whole months, since the exposure is monthly. Zero
 * stays zero — a slider at 0 should show no movement, not round up to one
 * month via floor/round quirks.
 */
function monthsFor(maxWeeks: number): number {
  if (maxWeeks <= 0) return 0;
  return Math.max(1, Math.round(maxWeeks / AVG_WEEKS_PER_MONTH));
}

export function simulatePullForward(
  exposure: CapacityExposure,
  lineId: string,
  maxWeeks: number,
  candidateUnitsById: Record<string, number>,
  leadTimeDaysFor?: (period: MonthKey) => number | undefined
): PullForwardResult | undefined {
  const cells = exposure.cells
    .filter((c) => c.lineId === lineId)
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period));
  if (cells.length === 0) return undefined;

  const lineName = cells[0]!.lineName;
  const firstPeriod = cells[0]!.period;
  const monthsBack = monthsFor(maxWeeks);

  const byPeriod = new Map<MonthKey, PullForwardCell>();
  for (const cell of cells) {
    const overflowBeforeHours = Math.max(0, cell.formalHours + cell.unresolvedHours - cell.availableHours);
    byPeriod.set(cell.period, {
      period: cell.period,
      committedHours: cell.formalHours,
      absentHoursBefore: cell.unresolvedHours,
      pulledOutHours: 0,
      pulledInHours: 0,
      remainingAfterHours: cell.unresolvedHours,
      overflowAfterHours: overflowBeforeHours,
      overflowBeforeHours,
      availableHours: cell.availableHours,
    });
  }

  // Nearest target actually used per source month, in months-back — the
  // pulled portion's real shift, not the slider's ceiling. A cell that never
  // pulls anything keeps this undefined.
  const nearestBackUsed = new Map<MonthKey, number>();

  if (monthsBack > 0) {
    for (const cell of cells) {
      const working = byPeriod.get(cell.period)!;
      let overflow = Math.max(0, working.committedHours + working.remainingAfterHours - working.availableHours);
      if (overflow <= 0) {
        working.overflowAfterHours = 0;
        continue;
      }

      for (let back = 1; back <= monthsBack && overflow > 0; back++) {
        const targetPeriod = addMonths(cell.period, -back);
        if (targetPeriod < firstPeriod) break; // nothing further back exists
        const target = byPeriod.get(targetPeriod);
        if (!target) continue; // a gap in the exposure — try the next month back

        const targetEffective = target.committedHours + target.remainingAfterHours;
        const headroom = Math.max(0, target.availableHours - targetEffective);
        const moved = Math.min(overflow, headroom);
        if (moved <= 0) continue;

        working.remainingAfterHours -= moved;
        working.pulledOutHours += moved;
        target.remainingAfterHours += moved;
        target.pulledInHours += moved;
        overflow -= moved;
        if (!nearestBackUsed.has(cell.period) || back < nearestBackUsed.get(cell.period)!) {
          nearestBackUsed.set(cell.period, back);
        }
      }

      working.overflowAfterHours = overflow;
    }
  }

  // Drop-dead per month: a local, chart-scoped read of month-start minus lead
  // time. The pulled-forward portion needs its materials that many weeks
  // earlier too, shifted by however far it actually moved — not by the
  // slider's ceiling, which may be further than any month it actually reached.
  for (const cell of byPeriod.values()) {
    const leadTimeDays = leadTimeDaysFor?.(cell.period);
    if (leadTimeDays === undefined) continue;
    const monthStart = `${cell.period}-01`;
    cell.dropDeadBefore = addDays(monthStart, -leadTimeDays);
    const back = nearestBackUsed.get(cell.period);
    cell.dropDeadAfter =
      back !== undefined ? addDays(`${addMonths(cell.period, -back)}-01`, -leadTimeDays) : cell.dropDeadBefore;
  }

  const orderedCells = cells.map((c) => byPeriod.get(c.period)!);
  const totalPulledHours = orderedCells.reduce((sum, c) => sum + c.pulledOutHours, 0);
  const totalShortfallHours = orderedCells.reduce((sum, c) => sum + c.overflowAfterHours, 0);
  const totalOverflowBeforeHours = orderedCells.reduce((sum, c) => sum + c.overflowBeforeHours, 0);

  const unitsPerHour = blendedUnitsPerHour(exposure, lineId, candidateUnitsById);

  return {
    lineId,
    lineName,
    maxWeeks,
    cells: orderedCells,
    totalPulledHours,
    totalShortfallHours,
    totalOverflowBeforeHours,
    unitsSecured: totalPulledHours * unitsPerHour,
    unitsAtRisk: totalOverflowBeforeHours * unitsPerHour,
    unitsStillAtRisk: totalShortfallHours * unitsPerHour,
  };
}

/**
 * A single blended units/hour rate for the line, from the same contributor
 * hours the capacity build already computed and each contributing
 * candidate's own planned units. Not a per-month rate — good enough to turn
 * "hours pulled" into a headline unit figure without a new input.
 */
function blendedUnitsPerHour(
  exposure: CapacityExposure,
  lineId: string,
  candidateUnitsById: Record<string, number>
): number {
  const hoursByCandidate = new Map<string, number>();
  for (const cell of exposure.cells) {
    if (cell.lineId !== lineId) continue;
    for (const contributor of cell.contributors) {
      hoursByCandidate.set(
        contributor.candidateId,
        (hoursByCandidate.get(contributor.candidateId) ?? 0) + contributor.hours
      );
    }
  }
  let totalHours = 0;
  let totalUnits = 0;
  for (const [candidateId, hours] of hoursByCandidate) {
    totalHours += hours;
    totalUnits += candidateUnitsById[candidateId] ?? 0;
  }
  return totalHours > 0 ? totalUnits / totalHours : 0;
}
