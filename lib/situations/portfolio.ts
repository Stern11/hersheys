/**
 * The portfolio roll-up behind Overview (V2 §39).
 *
 * Overview used to lead with one situation's four metrics and then repeat the
 * same four on every row beneath. That answered "tell me about this one thing"
 * on a page whose only job is "tell me about everything".
 *
 * The question it answers now is the one a planner actually opens with: how
 * many products are not represented, and what does that do to the plan — to
 * the money, to the factory, and to what I can still order in time.
 *
 * Pure: no React. Every figure is summed from the same situations the rest of
 * the app renders, so nothing here can disagree with a detail page.
 */

import type { MonthKey } from "@/types/dataset";
import type { PlanningSituation } from "@/types/situation";

/** One line carrying unresolved load, and the items putting it there. */
export interface ExposedLine {
  lineId: string;
  lineName: string;
  /** The month it is tightest. */
  period: string;
  effectiveUtilization: number;
  formalUtilization: number;
  targetUtilizationPct: number;
  /** Hours on it that no formal item accounts for. */
  unresolvedHours: number;
  availableHours: number;
  /** The items driving those hours, largest first. */
  drivers: { itemName: string; hours: number }[];
  situationTitle: string;
  situationId: string;
  /** How many months in the window this line goes past target. */
  monthsOverTarget: number;
}

/**
 * One month's portfolio-wide capacity coverage — how much of the *total*
 * load (formal + unresolved) is already formally accounted for. A planner
 * asking "is this getting better or worse" needs this as a trend, not a
 * snapshot; six of these in a row is the smallest visual that answers it
 * without reviving a full monthly matrix as its own page or section.
 */
export interface MonthCoverage {
  period: MonthKey;
  /** formalHours / effectiveHours, 0-1. Undefined when the month has no load. */
  coveragePct?: number;
}

/**
 * What the plan looks like before the absent SKUs are counted, and after —
 * a rollup of numbers already derived elsewhere on this page, not a new
 * MRP/PO object (V2 non-goals: no fabricated ERP/MRP data).
 */
export interface PortfolioBeforeAfter {
  demandValueBefore: number;
  demandValueAfter: number;
  hoursBefore: number;
  hoursAfter: number;
  /** Material components with nothing ordered today that could start moving. */
  materialPlanNowAfter: number;
  currency: string;
}

/** The first date anywhere in the portfolio that stops being reversible. */
export interface NearestDeadline {
  date: string;
  weeksAway: number;
  label: string;
  detail?: string;
  situationTitle: string;
  situationId: string;
}

export interface PortfolioSummary {
  situationCount: number;
  needsAttentionCount: number;

  /* --- what is missing --- */
  /** Prior products with nothing in the formal plan standing for them. */
  unrepresentedSkuCount: number;
  /** Of those, the ones the planner has accepted as carrying forward. */
  carryingForwardSkuCount: number;
  /** Prior products the planner has not decided about yet. */
  undecidedSkuCount: number;
  totalCandidateCount: number;

  /* --- what it is worth (sales) --- */
  currency: string;
  expectedValue: number;
  formalValue: number;
  unresolvedValue: number;
  /** formal / expected across the portfolio, 0-1. */
  representedPct: number;
  validatedUnits: number;
  validatedValue: number;

  /* --- what it does to the factory (manufacturing) --- */
  unresolvedHours: number;
  formalHours: number;
  exposedLines: ExposedLine[];
  /** Lines carrying unresolved load but still inside target. */
  linesCarryingLoadCount: number;

  /* --- what it puts on the clock (materials) --- */
  planNowCount: number;
  waitCount: number;
  nearestDeadline?: NearestDeadline;

  /** The next few months' formal-vs-total load coverage, earliest first. */
  coverageByMonth: MonthCoverage[];
  beforeAfter: PortfolioBeforeAfter;

  /* --- data completeness, never hidden --- */
  capacityUnavailable: boolean;
  materialsUnavailable: boolean;
}

export function summarizePortfolio(situations: readonly PlanningSituation[]): PortfolioSummary {
  const empty: PortfolioSummary = {
    situationCount: 0,
    needsAttentionCount: 0,
    unrepresentedSkuCount: 0,
    carryingForwardSkuCount: 0,
    undecidedSkuCount: 0,
    totalCandidateCount: 0,
    currency: "USD",
    expectedValue: 0,
    formalValue: 0,
    unresolvedValue: 0,
    representedPct: 0,
    validatedUnits: 0,
    validatedValue: 0,
    unresolvedHours: 0,
    formalHours: 0,
    exposedLines: [],
    linesCarryingLoadCount: 0,
    planNowCount: 0,
    waitCount: 0,
    coverageByMonth: [],
    beforeAfter: {
      demandValueBefore: 0,
      demandValueAfter: 0,
      hoursBefore: 0,
      hoursAfter: 0,
      materialPlanNowAfter: 0,
      currency: "USD",
    },
    capacityUnavailable: false,
    materialsUnavailable: false,
  };
  if (situations.length === 0) return empty;

  const out: PortfolioSummary = { ...empty, situationCount: situations.length };
  out.currency = situations[0]?.bridge.currency ?? "USD";

  // A line is shared across programmes, so its load has to be accumulated
  // across them rather than reported once per situation.
  const lineAccum = new Map<string, ExposedLine>();
  const deadlines: NearestDeadline[] = [];
  // Same idea, by month rather than by line — several programmes can share a
  // month even when they never share a line.
  const monthAccum = new Map<MonthKey, { formalHours: number; effectiveHours: number }>();

  for (const s of situations) {
    if (s.state === "ACTION_NEEDED" || s.state === "MONITOR") out.needsAttentionCount++;

    out.expectedValue += s.bridge.expectedValue;
    out.formalValue += s.bridge.formalValue;
    out.unresolvedValue += s.bridge.unresolvedValue;
    out.validatedUnits += s.bridge.validatedUnits;
    out.validatedValue += s.bridge.validatedValue;

    out.totalCandidateCount += s.candidateItems.length;
    for (const c of s.candidateItems) {
      if (c.match.matchedItemId === undefined) out.unrepresentedSkuCount++;
      if (c.disposition === "carry_forward") out.carryingForwardSkuCount++;
      if (c.disposition === "unreviewed" || c.disposition === "under_review") out.undecidedSkuCount++;
    }

    if (!s.capacityExposure.available) out.capacityUnavailable = true;
    for (const cell of s.capacityExposure.cells) {
      out.unresolvedHours += cell.unresolvedHours;
      out.formalHours += cell.formalHours;

      const month = monthAccum.get(cell.period) ?? { formalHours: 0, effectiveHours: 0 };
      month.formalHours += cell.formalHours;
      month.effectiveHours += cell.effectiveHours;
      monthAccum.set(cell.period, month);

      if (cell.unresolvedHours <= 0) continue;

      const key = `${cell.lineId}::${cell.period}`;
      const existing = lineAccum.get(key);
      const drivers = cell.contributors.map((c) => ({ itemName: c.itemName, hours: c.hours }));
      if (existing) {
        existing.unresolvedHours += cell.unresolvedHours;
        existing.drivers.push(...drivers);
      } else {
        lineAccum.set(key, {
          lineId: cell.lineId,
          lineName: cell.lineName,
          period: cell.period,
          effectiveUtilization: cell.effectiveUtilization,
          formalUtilization: cell.formalUtilization,
          targetUtilizationPct: cell.targetUtilizationPct,
          unresolvedHours: cell.unresolvedHours,
          availableHours: cell.availableHours,
          drivers,
          situationTitle: s.title,
          situationId: s.id,
          monthsOverTarget: 1,
        });
      }
    }

    if (!s.materialExposure.available) out.materialsUnavailable = true;
    out.planNowCount += s.materialExposure.planNowCount;
    out.waitCount += s.materialExposure.waitCount;

    const earliest = s.runway.earliest;
    if (earliest) {
      deadlines.push({
        date: earliest.date,
        weeksAway: earliest.weeksAway,
        label: earliest.label,
        detail: earliest.detail,
        situationTitle: s.title,
        situationId: s.id,
      });
    }
  }

  out.representedPct = out.expectedValue > 0 ? Math.min(1, out.formalValue / out.expectedValue) : 0;

  const carrying = [...lineAccum.values()];
  out.linesCarryingLoadCount = new Set(carrying.map((l) => l.lineId)).size;

  // Only lines the unresolved load actually pushes past target. A line running
  // hot on formal work alone is not something this product found.
  //
  // One row per line, at its worst month. The same line appearing three times
  // for three consecutive months is one problem listed three times — it fills
  // the section without adding anything, and buries the second line that also
  // needs attention.
  const worstByLine = new Map<string, ExposedLine>();
  const monthsOverByLine = new Map<string, number>();
  for (const line of carrying) {
    if (line.effectiveUtilization <= line.targetUtilizationPct) continue;
    monthsOverByLine.set(line.lineId, (monthsOverByLine.get(line.lineId) ?? 0) + 1);
    const worst = worstByLine.get(line.lineId);
    if (!worst || line.effectiveUtilization > worst.effectiveUtilization) {
      worstByLine.set(line.lineId, line);
    }
  }

  out.exposedLines = [...worstByLine.values()]
    .map((l) => ({
      ...l,
      drivers: topDrivers(l.drivers),
      monthsOverTarget: monthsOverByLine.get(l.lineId) ?? 1,
    }))
    .sort((a, b) => b.effectiveUtilization - a.effectiveUtilization);

  out.nearestDeadline = deadlines.sort((a, b) => a.date.localeCompare(b.date))[0];

  out.coverageByMonth = [...monthAccum.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([period, month]) => ({
      period,
      coveragePct: month.effectiveHours > 0 ? month.formalHours / month.effectiveHours : undefined,
    }));

  out.beforeAfter = {
    demandValueBefore: out.formalValue,
    demandValueAfter: out.formalValue + out.validatedValue,
    hoursBefore: out.formalHours,
    hoursAfter: out.formalHours + out.unresolvedHours,
    materialPlanNowAfter: out.planNowCount,
    currency: out.currency,
  };

  return out;
}

/** The few items that account for most of a line's unresolved hours. */
function topDrivers(
  drivers: { itemName: string; hours: number }[]
): { itemName: string; hours: number }[] {
  const byName = new Map<string, number>();
  for (const d of drivers) byName.set(d.itemName, (byName.get(d.itemName) ?? 0) + d.hours);
  return [...byName.entries()]
    .map(([itemName, hours]) => ({ itemName, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 3);
}
