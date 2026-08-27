import type { DecisionDeadline, DecisionDeadlineKind } from "@/types/planning";
import { clampPct, labelAnchor, type LabelAnchor } from "./axis";

/**
 * Pure view model for the Decision Runway (`components/planning/decision-runway-timeline.tsx`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * The runway used to compute its own scale inline: `min`/`max` over every
 * date in the data, then `left: (t - min) / span`. That produced a chart with
 * **no date scale at all** — ticks appeared only where a deadline happened to
 * fall, so a planner could not tell where June was, could not read a position
 * off the axis, and "Today" landed 2.9% from the left edge hard against the
 * production window's start. There was also no unit-testable place to assert
 * that a mark's percentage matches the date printed next to it.
 *
 * Everything geometric or calendrical now lives here and is unit tested:
 * the padded, month-snapped domain, the month gridline/label bands, every
 * mark's percentage, the anti-collision label decision, and the signed
 * weeks-from-today arithmetic (INCLUDING the overdue/negative case).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE PRODUCT RULE THIS MODEL PROTECTS
 * ─────────────────────────────────────────────────────────────────────────
 * Production timing and sales timing are separate windows on `BusinessEvent`
 * and must never be conflated (CLAUDE.md; PRD §11C). Halloween 2027 is BUILT
 * Mar–Jul 2027 and SOLD Sep–Oct 2027. The model therefore emits the two
 * windows as two independently-labelled lanes with their own date range,
 * duration, and status, plus an explicit `separation` derivation — how many
 * weeks sit between the last build day and the first selling day — because
 * that gap is the whole reason a build decision cannot wait for a sell-through
 * signal.
 *
 * All date maths is done in UTC on `YYYY-MM-DD` strings, which is how every
 * date in `data/synthetic/*` and `types/planning.ts` is stored. Using local
 * time here would shift a mark's percentage by a timezone offset while the
 * printed date stayed put.
 *
 * No React, no DOM, no data imports.
 */

/* ---------------------------------------------------------------------------
 * Calendar primitives (UTC)
 * ------------------------------------------------------------------------- */

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

/** `"2027-03-08"` -> UTC-midnight epoch ms. `NaN` for anything unparseable. */
export function parseDate(iso: string): number {
  if (typeof iso !== "string" || iso.length < 10) return Number.NaN;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return Number.NaN;
  return Date.UTC(y, m - 1, d);
}

/** UTC-midnight epoch ms -> `"YYYY-MM-DD"`. */
export function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** First instant of the UTC month containing `ms`. */
export function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** `n` calendar months from the start of `ms`'s month (n may be negative). */
export function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}

/** Whole days from `fromISO` to `toISO`. Negative when `toISO` is in the past. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = parseDate(fromISO);
  const to = parseDate(toISO);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.NaN;
  return Math.round((to - from) / DAY_MS);
}

/**
 * Signed weeks from `fromISO` to `toISO`, rounded to `digits` decimals.
 *
 * Signed on purpose: a deadline that has already passed is the single most
 * important thing this chart can say, and a `Math.abs` here would have hidden
 * it. The component decides how to word the sign; the model only reports it.
 */
export function weeksBetween(fromISO: string, toISO: string, digits = 1): number {
  const days = daysBetween(fromISO, toISO);
  if (!Number.isFinite(days)) return Number.NaN;
  const f = Math.pow(10, digits);
  return Math.round((days / 7) * f) / f;
}

/* ---------------------------------------------------------------------------
 * Domain — a real date scale, not "whatever range the data happened to span"
 * ------------------------------------------------------------------------- */

/**
 * Days of slack added before the earliest / after the latest date BEFORE the
 * domain is snapped out to whole months. Without it a mark that lands on the
 * 1st of a month (the production window start, here) would sit exactly on the
 * left edge with `Today` a few days later, unreadably close to it.
 */
export const DOMAIN_PAD_DAYS = 10;

export interface RunwayDomain {
  startMs: number;
  endMs: number;
  startISO: string;
  endISO: string;
  /** Total days spanned. Always > 0. */
  days: number;
}

/**
 * The plotted date range: every input date, padded by `padDays`, then snapped
 * OUT to whole calendar months so month gridlines bound the plot instead of
 * floating inside it. `endMs` is the first instant of the month AFTER the
 * padded maximum, so the final month band is drawn at full width.
 */
export function runwayDomain(dates: readonly string[], padDays = DOMAIN_PAD_DAYS): RunwayDomain {
  const times = dates.map(parseDate).filter((t) => Number.isFinite(t));
  const now = Date.UTC(2000, 0, 1);
  const min = times.length > 0 ? Math.min(...times) : now;
  const max = times.length > 0 ? Math.max(...times) : now + 30 * DAY_MS;
  const startMs = startOfMonth(min - padDays * DAY_MS);
  const endMs = addMonths(max + padDays * DAY_MS, 1);
  return {
    startMs,
    endMs,
    startISO: toISODate(startMs),
    endISO: toISODate(endMs),
    days: Math.round((endMs - startMs) / DAY_MS),
  };
}

/** A date's position across the domain, 0–100. Clamped; never NaN. */
export function datePct(iso: string, domain: RunwayDomain): number {
  const ms = parseDate(iso);
  const span = domain.endMs - domain.startMs;
  if (!Number.isFinite(ms) || span <= 0) return 0;
  return clampPct(((ms - domain.startMs) / span) * 100);
}

/* ---------------------------------------------------------------------------
 * Month scale
 * ------------------------------------------------------------------------- */

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const MONTH_LONG_FMT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export interface RunwayMonth {
  /** `"2027-02"` — stable React key. */
  key: string;
  label: string;
  /** `"February 2027"` — used by the month band's own tooltip. */
  longLabel: string;
  year: number;
  /** True for the first month drawn and for every January, where the year must print. */
  showYear: boolean;
  startISO: string;
  /** Last day of the month, i.e. the day BEFORE the next band starts. */
  endISO: string;
  days: number;
  startPct: number;
  endPct: number;
  widthPct: number;
  midPct: number;
}

/**
 * One band per calendar month across the domain — the gridlines and labels the
 * chart previously had no equivalent of. A month is drawn even when nothing
 * falls in it, because "nothing happens in August" is itself information a
 * planner reads off a runway.
 */
export function monthTicks(domain: RunwayDomain): RunwayMonth[] {
  const out: RunwayMonth[] = [];
  const span = domain.endMs - domain.startMs;
  if (!(span > 0)) return out;

  for (let ms = startOfMonth(domain.startMs), i = 0; ms < domain.endMs && i < 240; ms = addMonths(ms, 1), i += 1) {
    const next = addMonths(ms, 1);
    const d = new Date(ms);
    const year = d.getUTCFullYear();
    const startPct = clampPct(((ms - domain.startMs) / span) * 100);
    const endPct = clampPct(((next - domain.startMs) / span) * 100);
    const midPct = (startPct + endPct) / 2;
    out.push({
      key: `${year}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: MONTH_FMT.format(d),
      longLabel: MONTH_LONG_FMT.format(d),
      year,
      showYear: i === 0 || d.getUTCMonth() === 0,
      startISO: toISODate(ms),
      endISO: toISODate(next - DAY_MS),
      days: Math.round((next - ms) / DAY_MS),
      startPct,
      endPct,
      widthPct: Math.max(0, endPct - startPct),
      midPct,
    });
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * At-rest label anti-collision
 * ------------------------------------------------------------------------- */

/**
 * Minimum horizontal separation, in % of the plot width, between two deadline
 * captions. A caption is ~104px wide; on an ~800px plot that is 13%.
 */
export const DEADLINE_LABEL_MIN_GAP_PCT = 13;

export interface ClusterAssignment {
  showLabel: boolean;
  /** Index of the cluster this mark belongs to; the labelled mark leads it. */
  clusterIndex: number;
  /** How many marks (labelled + hidden) are in that cluster. */
  clusterSize: number;
  /** 0-based position within the cluster; the labelled mark is 0. */
  positionInCluster: number;
}

/**
 * Label only the leader of each cluster of near-coincident marks — the runway
 * carries eight per-material order-by dates inside a two-week band, and
 * labelling them all produced a pile of overlapping text.
 *
 * The hidden marks are NOT dropped: every one still renders as a tick and
 * still carries its own tooltip, and the cluster it belongs to is reported
 * here so the leader's caption can say how many others it stands for. That is
 * the difference between "readable" and "hiding data".
 *
 * `items` must be sorted ascending by `pct`. `force: true` always labels
 * (used for the binding constraint, which must be readable at rest).
 */
export function assignClusterLabels(
  items: readonly { pct: number; force?: boolean }[],
  minGapPct = DEADLINE_LABEL_MIN_GAP_PCT
): ClusterAssignment[] {
  let lastLabeledPct = Number.NEGATIVE_INFINITY;
  let clusterIndex = -1;
  let positionInCluster = 0;

  const seeded = items.map((it) => {
    const show = it.force === true || it.pct - lastLabeledPct >= minGapPct;
    if (show) {
      lastLabeledPct = it.pct;
      clusterIndex += 1;
      positionInCluster = 0;
    } else {
      positionInCluster += 1;
    }
    return { showLabel: show, clusterIndex: Math.max(0, clusterIndex), positionInCluster };
  });

  const sizes = new Map<number, number>();
  for (const s of seeded) sizes.set(s.clusterIndex, (sizes.get(s.clusterIndex) ?? 0) + 1);
  return seeded.map((s) => ({ ...s, clusterSize: sizes.get(s.clusterIndex) ?? 1 }));
}

/* ---------------------------------------------------------------------------
 * Deadline identity
 * ------------------------------------------------------------------------- */

export const DEADLINE_LABEL: Record<DecisionDeadlineKind, string> = {
  business_confirmation: "Business confirmation",
  sku_setup: "SKU / item setup",
  material_order_by: "Material order-by",
  supplier_capacity_decision: "Supplier capacity decision",
  production_start: "Production start",
  prebuild_window_open: "Prebuild window opens",
  sales_window_open: "Sales window opens",
  frozen_horizon: "Frozen horizon",
};

/** What kind of thing sets this date — the "how it came" half of a tooltip. */
export const DEADLINE_DRIVER_NOTE: Record<DecisionDeadline["drivenBy"], string> = {
  lead_time: "Set by lead time: this date is the production requirement date minus the lead time the plan is currently using for this component.",
  capacity: "Set by capacity: the constraint line has to start earlier than the demand date implies, so the decision is pulled forward.",
  material: "Set by material availability rather than by a purchasing lead time.",
  business_rule: "Set by a planning calendar rule (a freeze, a commit gate) rather than by a physical lead time.",
};

/**
 * The material a material-driven deadline belongs to.
 *
 * `lib/planning-engine/scenarios.ts` mints one deadline per readiness row as
 * `deadline_${readiness.id}`, and `lib/planning-engine/materials.ts` mints
 * that readiness id as `readiness_${gapId}_${materialId}`. So the material is
 * genuinely carried on the deadline — this reads it back rather than inventing
 * an association. Returns `null` when the id does not have that shape, so an
 * unrecognised deadline shows nothing instead of a fabricated owner.
 */
export function materialIdFromDeadlineId(deadlineId: string, gapId: string): string | null {
  const prefix = `deadline_readiness_${gapId}_`;
  if (!deadlineId.startsWith(prefix)) return null;
  const materialId = deadlineId.slice(prefix.length);
  return materialId.length > 0 ? materialId : null;
}

/* ---------------------------------------------------------------------------
 * Urgency — STATUS about a date, which is what the risk tokens are for
 * ------------------------------------------------------------------------- */

export const RUNWAY_CRITICAL_WEEKS = 2;
export const RUNWAY_WARNING_WEEKS = 6;

export type RunwayUrgency = "overdue" | "critical" | "warning" | "clear";

/** Risk (STATUS) token for an urgency. Never used to label a series. */
export type RunwayRiskToken = "--risk-critical" | "--risk-warning" | "--risk-positive";

export function urgencyOf(weeksFromToday: number): RunwayUrgency {
  if (!Number.isFinite(weeksFromToday)) return "clear";
  if (weeksFromToday < 0) return "overdue";
  if (weeksFromToday <= RUNWAY_CRITICAL_WEEKS) return "critical";
  if (weeksFromToday <= RUNWAY_WARNING_WEEKS) return "warning";
  return "clear";
}

export function urgencyToken(urgency: RunwayUrgency): RunwayRiskToken {
  if (urgency === "overdue" || urgency === "critical") return "--risk-critical";
  if (urgency === "warning") return "--risk-warning";
  return "--risk-positive";
}

export function urgencyNote(urgency: RunwayUrgency): string {
  switch (urgency) {
    case "overdue":
      return `This date is already behind. Anything it gates is now a recovery decision, not a planning decision.`;
    case "critical":
      return `Inside ${RUNWAY_CRITICAL_WEEKS} weeks: there is no longer room to re-plan around this date.`;
    case "warning":
      return `Inside ${RUNWAY_WARNING_WEEKS} weeks: still actionable, but the options narrow from here.`;
    default:
      return `More than ${RUNWAY_WARNING_WEEKS} weeks out: the decision is still fully open.`;
  }
}

/* ---------------------------------------------------------------------------
 * Windows
 * ------------------------------------------------------------------------- */

export type RunwayWindowKey = "production" | "sales";
export type WindowStatus = "past" | "open" | "upcoming";

export interface RunwayWindowModel {
  key: RunwayWindowKey;
  /** Series (provenance) token — never a risk token. */
  token: "--state-validated" | "--state-scenario";
  label: string;
  /** What this window MEANS in planning terms — the anti-conflation sentence. */
  meaning: string;
  startISO: string;
  endISO: string;
  startPct: number;
  endPct: number;
  widthPct: number;
  midPct: number;
  /**
   * The window's date caption is drawn BELOW its own bar, centred on `midPct`.
   * It is never drawn over the bar: an earlier pass had the caption absolutely
   * placed above the bar with too little clearance and the bar was drawn
   * straight through the neighbouring caption's text.
   */
  labelAnchor: LabelAnchor;
  /** Inclusive day count, so a Mar 1 – Mar 1 window is 1 day, not 0. */
  days: number;
  weeks: number;
  /** Signed weeks from today to the window's start / end. */
  weeksToStart: number;
  weeksToEnd: number;
  status: WindowStatus;
  /** How far through the window today is, 0–100; `null` unless status is "open". */
  progressPct: number | null;
  /** Which day of the window today is, 1-based; `null` unless status is "open". */
  dayOfWindow: number | null;
}

/** The relationship between the two windows — the point of the whole chart. */
export interface RunwaySeparation {
  productionEndISO: string;
  salesStartISO: string;
  /** Days from the last build day to the first selling day. Negative if they overlap. */
  gapDays: number;
  gapWeeks: number;
  overlaps: boolean;
  /** Weeks from the first build day to the first selling day. */
  leadWeeks: number;
  productionWeeks: number;
  salesWeeks: number;
}

function buildWindow(
  key: RunwayWindowKey,
  input: { start: string; end: string },
  todayISO: string,
  domain: RunwayDomain
): RunwayWindowModel {
  const startPct = datePct(input.start, domain);
  const endPct = datePct(input.end, domain);
  const widthPct = Math.max(0, endPct - startPct);
  const days = daysBetween(input.start, input.end) + 1;
  const weeksToStart = weeksBetween(todayISO, input.start);
  const weeksToEnd = weeksBetween(todayISO, input.end);
  const status: WindowStatus = weeksToEnd < 0 ? "past" : weeksToStart > 0 ? "upcoming" : "open";
  const elapsed = daysBetween(input.start, todayISO);
  const midPct = (startPct + endPct) / 2;

  return {
    key,
    token: key === "production" ? "--state-validated" : "--state-scenario",
    label: key === "production" ? "Production window" : "Sales / event window",
    meaning:
      key === "production"
        ? "When this season is BUILT. Every capacity hour, material order-by date and line commitment in this workspace lands inside this window."
        : "When this season is SOLD. Nothing here can be produced — by the time it opens the build is finished and shipped.",
    startISO: input.start,
    endISO: input.end,
    startPct,
    endPct,
    widthPct,
    midPct,
    labelAnchor: labelAnchor(midPct, 12),
    days,
    weeks: Math.round((days / 7) * 10) / 10,
    weeksToStart,
    weeksToEnd,
    status,
    progressPct: status === "open" && days > 0 ? clampPct(((elapsed + 1) / days) * 100) : null,
    dayOfWindow: status === "open" && days > 0 ? elapsed + 1 : null,
  };
}

/* ---------------------------------------------------------------------------
 * Deadlines
 * ------------------------------------------------------------------------- */

export interface RunwayDeadlineModel {
  id: string;
  kind: DecisionDeadlineKind;
  kindLabel: string;
  dateISO: string;
  pct: number;
  anchor: LabelAnchor;
  /**
   * Distance to this tick's nearest neighbour, in % of the plot. The component
   * caps each tick's hit box at `min(11px, hitWidthPct%)` so two order-by dates
   * two days apart cannot steal each other's hover — without it the wider box
   * of whichever tick renders last covered the centre of the one before it.
   */
  hitWidthPct: number;
  isBinding: boolean;
  showLabel: boolean;
  clusterIndex: number;
  clusterSize: number;
  positionInCluster: number;
  /** First and last date in this mark's cluster — what the leader's caption stands for. */
  clusterFirstISO: string;
  clusterLastISO: string;
  daysFromToday: number;
  weeksFromToday: number;
  isOverdue: boolean;
  urgency: RunwayUrgency;
  riskToken: RunwayRiskToken;
  drivenBy: DecisionDeadline["drivenBy"];
  driverNote: string;
  /** Material this deadline belongs to, read back off the engine's id. */
  materialId: string | null;
  movedFromDate?: string;
  moveReason?: string;
  /** Signed weeks this deadline moved, when a scenario shifted it. */
  movedWeeks?: number;
  /** Which window this date falls in — production, sales, or before either. */
  inWindow: RunwayWindowKey | "before_production" | "between_windows" | "after_sales";
}

/* ---------------------------------------------------------------------------
 * Model
 * ------------------------------------------------------------------------- */

export interface RunwaySpan {
  deadlineId: string;
  kindLabel: string;
  dateISO: string;
  /** Left/right ends of the bracket, already ordered. */
  fromPct: number;
  toPct: number;
  widthPct: number;
  /** Absolute magnitude — the component words the sign from `isOverdue`. */
  weeks: number;
  days: number;
  isOverdue: boolean;
  urgency: RunwayUrgency;
  riskToken: RunwayRiskToken;
  materialId: string | null;
}

export interface RunwayModelInput {
  today: string;
  deadlines: readonly DecisionDeadline[];
  productionWindow: { start: string; end: string };
  salesWindow: { start: string; end: string };
  /** Overridable so the label anti-collision rule can be asserted directly. */
  labelMinGapPct?: number;
}

export interface RunwayModel {
  domain: RunwayDomain;
  months: RunwayMonth[];
  today: { iso: string; pct: number; anchor: LabelAnchor };
  production: RunwayWindowModel;
  sales: RunwayWindowModel;
  separation: RunwaySeparation;
  deadlines: RunwayDeadlineModel[];
  /** Today -> the binding deadline. `null` when there are no deadlines. */
  runway: RunwaySpan | null;
  /** How many deadlines are hidden behind a cluster leader at rest. */
  hiddenLabelCount: number;
}

export function buildRunwayModel(input: RunwayModelInput): RunwayModel {
  const { today, productionWindow, salesWindow } = input;
  const sorted = [...input.deadlines].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));

  const domain = runwayDomain([
    today,
    productionWindow.start,
    productionWindow.end,
    salesWindow.start,
    salesWindow.end,
    ...sorted.map((d) => d.date),
  ]);

  const production = buildWindow("production", productionWindow, today, domain);
  const sales = buildWindow("sales", salesWindow, today, domain);

  const gapDays = daysBetween(production.endISO, sales.startISO);
  const separation: RunwaySeparation = {
    productionEndISO: production.endISO,
    salesStartISO: sales.startISO,
    gapDays,
    gapWeeks: weeksBetween(production.endISO, sales.startISO),
    overlaps: gapDays <= 0,
    leadWeeks: weeksBetween(production.startISO, sales.startISO),
    productionWeeks: production.weeks,
    salesWeeks: sales.weeks,
  };

  const bindingIndex = (() => {
    const flagged = sorted.findIndex((d) => d.isEarliestConstraint);
    return flagged >= 0 ? flagged : sorted.length > 0 ? 0 : -1;
  })();

  const clusters = assignClusterLabels(
    sorted.map((d, i) => ({ pct: datePct(d.date, domain), force: i === bindingIndex })),
    input.labelMinGapPct ?? DEADLINE_LABEL_MIN_GAP_PCT
  );

  const clusterDates = new Map<number, string[]>();
  clusters.forEach((c, i) => {
    const list = clusterDates.get(c.clusterIndex) ?? [];
    list.push(sorted[i]!.date);
    clusterDates.set(c.clusterIndex, list);
  });

  const pcts = sorted.map((d) => datePct(d.date, domain));

  const deadlines: RunwayDeadlineModel[] = sorted.map((d, i) => {
    const cluster = clusters[i]!;
    const dates = clusterDates.get(cluster.clusterIndex) ?? [d.date];
    const pct = pcts[i]!;
    const gaps = [i > 0 ? pct - pcts[i - 1]! : Infinity, i < pcts.length - 1 ? pcts[i + 1]! - pct : Infinity];
    const nearest = Math.min(...gaps);
    const daysFromToday = daysBetween(today, d.date);
    const weeksFromToday = weeksBetween(today, d.date);
    const urgency = urgencyOf(weeksFromToday);
    const movedWeeks = d.movedFromDate ? weeksBetween(d.movedFromDate, d.date) : undefined;

    return {
      id: d.id,
      kind: d.kind,
      kindLabel: DEADLINE_LABEL[d.kind],
      dateISO: d.date,
      pct,
      anchor: labelAnchor(pct, 8),
      hitWidthPct: Number.isFinite(nearest) ? Math.max(0, nearest) : 100,
      isBinding: i === bindingIndex,
      showLabel: cluster.showLabel,
      clusterIndex: cluster.clusterIndex,
      clusterSize: cluster.clusterSize,
      positionInCluster: cluster.positionInCluster,
      clusterFirstISO: dates[0]!,
      clusterLastISO: dates[dates.length - 1]!,
      daysFromToday,
      weeksFromToday,
      isOverdue: weeksFromToday < 0,
      urgency,
      riskToken: urgencyToken(urgency),
      drivenBy: d.drivenBy,
      driverNote: DEADLINE_DRIVER_NOTE[d.drivenBy],
      materialId: materialIdFromDeadlineId(d.id, d.gapId),
      ...(d.movedFromDate ? { movedFromDate: d.movedFromDate } : {}),
      ...(d.moveReason ? { moveReason: d.moveReason } : {}),
      ...(movedWeeks != null ? { movedWeeks } : {}),
      inWindow: classifyAgainstWindows(d.date, productionWindow, salesWindow),
    };
  });

  const binding = deadlines[bindingIndex] ?? null;
  const todayPct = datePct(today, domain);

  return {
    domain,
    months: monthTicks(domain),
    today: { iso: today, pct: todayPct, anchor: labelAnchor(todayPct, 6) },
    production,
    sales,
    separation,
    deadlines,
    runway: binding
      ? {
          deadlineId: binding.id,
          kindLabel: binding.kindLabel,
          dateISO: binding.dateISO,
          fromPct: Math.min(todayPct, binding.pct),
          toPct: Math.max(todayPct, binding.pct),
          widthPct: Math.abs(binding.pct - todayPct),
          weeks: Math.abs(binding.weeksFromToday),
          days: Math.abs(binding.daysFromToday),
          isOverdue: binding.isOverdue,
          urgency: binding.urgency,
          riskToken: binding.riskToken,
          materialId: binding.materialId,
        }
      : null,
    hiddenLabelCount: deadlines.filter((d) => !d.showLabel).length,
  };
}

function classifyAgainstWindows(
  iso: string,
  production: { start: string; end: string },
  sales: { start: string; end: string }
): RunwayDeadlineModel["inWindow"] {
  if (iso >= production.start && iso <= production.end) return "production";
  if (iso >= sales.start && iso <= sales.end) return "sales";
  if (iso < production.start) return "before_production";
  if (iso > sales.end) return "after_sales";
  return "between_windows";
}

/** How a deadline's position relates to the two windows, in words. */
export function windowRelationNote(relation: RunwayDeadlineModel["inWindow"]): string {
  switch (relation) {
    case "production":
      return "Falls inside the production window — the build has already started when this date arrives.";
    case "sales":
      return "Falls inside the sales window — by then the season is on shelf and nothing more can be built for it.";
    case "before_production":
      return "Falls before the production window opens — this is a decision that has to be made to let the build start on time.";
    case "between_windows":
      return "Falls between the last build day and the first selling day — the season is finished but not yet on shelf.";
    default:
      return "Falls after the sales window closes.";
  }
}
