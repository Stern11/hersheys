/**
 * Chart geometry for the per-SKU views (V2 §47, §63).
 *
 * Two questions, two shapes:
 *
 * - **Where it lands** — every line on one shared hour scale, so bar lengths
 *   are comparable between rows, with this SKU's own contribution separated
 *   from the load that was already there. A planner should see at a glance
 *   whether *this item* is what pushes a line past its ceiling.
 * - **What it puts on the clock** — components on a date axis running from
 *   today to production start, so the one that sets the deadline is the
 *   leftmost mark rather than a number to be compared by eye down a column.
 *
 * Pure geometry: no React, no DOM, no data imports beyond types. Every pixel a
 * chart draws comes from here so it can be asserted in a test — the failure
 * mode otherwise is a bar length and its printed number drifting apart
 * silently.
 */

import { linearAxis, type AxisScale } from "./axis";
import type { SkuLineLoad, SkuMaterialNeed } from "@/lib/situations/sku-impact";

/* ------------------------------------------------------------------ */
/* Where it lands                                                      */
/* ------------------------------------------------------------------ */

/** One line's bar at its tightest month, in percentages of the shared axis. */
export interface LineLoadBar {
  lineId: string;
  lineName: string;
  period: string;
  /** Hours already on the line that month, before this item. */
  otherHours: number;
  /** Hours this item adds that month. */
  thisItemHours: number;
  effectiveHours: number;
  availableHours: number;
  targetHours: number;
  /** Widths as percentages of the axis maximum. */
  otherPct: number;
  thisItemPct: number;
  /** Positions of the two reference marks, as percentages of the axis. */
  targetPct: number;
  ceilingPct: number;
  effectiveUtilization: number;
  /** True when the line goes past its target once this item is included. */
  overTarget: boolean;
  /** True when this item is what takes it past — the whole point of the chart. */
  pushedOverByThisItem: boolean;
}

export interface LineLoadChart {
  bars: LineLoadBar[];
  axis: AxisScale;
  /** True when at least one line is pushed over by this item. */
  anyPushedOver: boolean;
}

/**
 * Builds the shared-scale line chart.
 *
 * The axis covers the largest ceiling, not the largest bar, so a line running
 * comfortably under does not appear full simply because it is the widest thing
 * on screen — and bar lengths stay comparable between rows, which is the only
 * reason to share a scale at all.
 */
export function buildLineLoadChart(lines: readonly SkuLineLoad[]): LineLoadChart {
  if (lines.length === 0) return { bars: [], axis: linearAxis(1), anyPushedOver: false };

  const ceilingMax = Math.max(
    ...lines.map((l) => Math.max(l.peak.availableHours, l.peak.effectiveHours))
  );
  const axis = linearAxis(ceilingMax || 1, 5);

  const bars = lines.map((line) => {
    const { peak } = line;
    const other = Math.max(0, peak.effectiveHours - peak.thisItemHours);
    const overTarget = peak.targetHours > 0 && peak.effectiveHours > peak.targetHours;

    return {
      lineId: line.lineId,
      lineName: line.lineName,
      period: peak.period,
      otherHours: other,
      thisItemHours: peak.thisItemHours,
      effectiveHours: peak.effectiveHours,
      availableHours: peak.availableHours,
      targetHours: peak.targetHours,
      otherPct: pct(other, axis.max),
      thisItemPct: pct(peak.thisItemHours, axis.max),
      targetPct: pct(peak.targetHours, axis.max),
      ceilingPct: pct(peak.availableHours, axis.max),
      effectiveUtilization: peak.effectiveUtilization,
      overTarget,
      // Without this item the line would have been inside target; with it, not.
      pushedOverByThisItem: overTarget && peak.targetHours > 0 && other <= peak.targetHours,
    } satisfies LineLoadBar;
  });

  return { bars, axis, anyPushedOver: bars.some((b) => b.pushedOverByThisItem) };
}

/* ------------------------------------------------------------------ */
/* What it puts on the clock                                           */
/* ------------------------------------------------------------------ */

export interface MaterialClockMark {
  materialId: string;
  materialName: string;
  status: SkuMaterialNeed["status"];
  requirement: number;
  uom: string;
  leadTimeDays: number;
  decisionDate: string;
  weeksToDecision: number;
  /** Position of the order-by date along the axis, 0-100. */
  datePct: number;
  /** True when the date has already passed. */
  overdue: boolean;
  /** True when this is the first thing that becomes irreversible. */
  isBinding: boolean;
  sourcing: SkuMaterialNeed["sourcing"];
  standsWithoutThisItem: boolean;
}

export interface MaterialClock {
  marks: MaterialClockMark[];
  /** Month boundaries across the axis, for gridlines. */
  ticks: { label: string; pct: number }[];
  start: string;
  end: string;
  todayPct: number;
  /** The earliest order-by date, which is what sets the runway. */
  binding?: MaterialClockMark;
}

const DAY_MS = 86_400_000;

/**
 * Places every component's order-by date on one axis.
 *
 * The axis runs from today (or the earliest order-by, when one is already
 * overdue) to production start, because that is the window the planner is
 * actually spending. An overdue date must remain visible rather than being
 * clamped to the left edge and quietly losing its urgency.
 */
export function buildMaterialClock(
  materials: readonly SkuMaterialNeed[],
  today: string,
  productionStart: string | undefined
): MaterialClock | undefined {
  if (materials.length === 0) return undefined;

  const todayMs = Date.parse(today);
  if (!Number.isFinite(todayMs)) return undefined;

  const dates = materials.map((m) => Date.parse(m.decisionDate)).filter(Number.isFinite);
  if (dates.length === 0) return undefined;

  const earliest = Math.min(...dates, todayMs);
  const productionMs = productionStart ? Date.parse(productionStart) : Number.NaN;
  const latest = Math.max(
    ...dates,
    Number.isFinite(productionMs) ? productionMs : todayMs,
    todayMs + 30 * DAY_MS
  );

  // A little air at each end so a mark on the boundary is not half-clipped.
  const padding = Math.max(DAY_MS * 7, (latest - earliest) * 0.04);
  const start = earliest - padding;
  const end = latest + padding;
  const span = end - start || 1;
  const at = (ms: number) => ((ms - start) / span) * 100;

  const bindingDate = Math.min(...dates);

  const marks = materials
    .map((m) => {
      const ms = Date.parse(m.decisionDate);
      return {
        materialId: m.materialId,
        materialName: m.materialName,
        status: m.status,
        requirement: m.requirement,
        uom: m.uom,
        leadTimeDays: m.leadTimeDays,
        decisionDate: m.decisionDate,
        weeksToDecision: m.weeksToDecision,
        datePct: at(ms),
        overdue: ms < todayMs,
        isBinding: ms === bindingDate,
        sourcing: m.sourcing,
        standsWithoutThisItem: m.standsWithoutThisItem,
      } satisfies MaterialClockMark;
    })
    .sort((a, b) => a.datePct - b.datePct);

  return {
    marks,
    ticks: monthTicks(start, end, at),
    start: iso(start),
    end: iso(end),
    todayPct: at(todayMs),
    binding: marks.find((m) => m.isBinding),
  };
}

/** First-of-month gridlines inside the window. */
function monthTicks(
  start: number,
  end: number,
  at: (ms: number) => number
): { label: string; pct: number }[] {
  const ticks: { label: string; pct: number }[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);

  // Guard against a pathological range producing an unbounded loop.
  for (let i = 0; i < 60; i++) {
    const ms = cursor.getTime();
    if (ms > end) break;
    if (ms >= start) {
      ticks.push({
        label: cursor.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        pct: at(ms),
      });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function pct(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}
