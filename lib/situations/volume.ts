/**
 * Season basis and carry-forward volume (V2 §16.3, §42).
 *
 * A prior item is a historical *fact*: it sold what it sold. What a planner
 * carries forward is a *decision* derived from that fact — which seasons to
 * believe, what growth they imply, and whether to override the result by hand.
 * Those three things are one number seen three ways, and this module is the
 * only place that resolves it.
 *
 * The engine deliberately collapses to one row per SKU before matching runs.
 * Three seasons of the same product are three observations of one thing to
 * plan, not three things to plan — and letting each season compete separately
 * for the same plan item would both double-count the volume and corrupt the
 * one-to-one representation rule.
 *
 * Pure: no React, no `Date.now()`, no `Math.random()`.
 */

import type { HistoricalItemRow, PeriodKey } from "@/types/dataset";
import type { PlannedVolumeBasis, SeasonOption, SeasonPoint } from "@/types/situation";

/**
 * Growth beyond this is more likely a data artefact than a plan. A season that
 * genuinely triples belongs in the planner's hands as an override, not in an
 * inferred default.
 */
const GROWTH_FLOOR = -0.9;
const GROWTH_CEILING = 2;

/**
 * Identity for the same product across seasons.
 *
 * Item ids are minted per season and cannot be compared — `SKU-…-P2-…` in one
 * year is the same product as `SKU-…-…` in the next. What survives a season
 * boundary is the business description of the product, so that is what we key
 * on. Falls back down the chain when a workbook does not carry every attribute.
 */
export function crossSeasonKey(row: HistoricalItemRow): string {
  const parts = [
    row.brand,
    row.productFamily,
    row.basePack ?? row.packFormat ?? row.itemName,
    row.customer ?? "",
    row.channel ?? "",
  ];
  return parts.map((p) => (p ?? "").trim().toLowerCase()).join("::");
}

/**
 * A stable candidate id.
 *
 * Deliberately derived from the cross-season key rather than from the
 * representative row's id: the representative changes when the planner changes
 * the season basis, and an id that moved with it would silently discard every
 * disposition and volume override they had already set.
 */
export function candidateIdFor(row: HistoricalItemRow): string {
  return `sku::${crossSeasonKey(row)}`;
}

/** Every period present in the rows, oldest first. */
export function availablePeriods(rows: readonly HistoricalItemRow[]): PeriodKey[] {
  return [...new Set(rows.map((r) => r.historicalPeriod))].sort();
}

/**
 * Each comparable season with its size.
 *
 * Sized from the whole history rather than from the current selection: a
 * planner deciding whether to *add* a season needs to know how big it is
 * before it is in the basis, and a figure that only appears once selected is
 * no help in making that choice.
 */
export function seasonOptions(rows: readonly HistoricalItemRow[]): SeasonOption[] {
  return availablePeriods(rows).map((period) => {
    const inSeason = rows.filter((r) => r.historicalPeriod === period);
    return {
      period,
      units: inSeason.reduce((sum, r) => sum + r.actualUnits, 0),
      value: inSeason.reduce((sum, r) => sum + (r.actualValue ?? 0), 0),
      itemCount: inSeason.length,
    };
  });
}

/**
 * The default basis: the most recent season only. Older seasons stay available
 * but unselected, so behaviour is unchanged until a planner opts into more.
 */
export function defaultSelectedPeriods(rows: readonly HistoricalItemRow[]): PeriodKey[] {
  const periods = availablePeriods(rows);
  const latest = periods[periods.length - 1];
  return latest === undefined ? [] : [latest];
}

/**
 * Observed growth across the selected seasons, at the level of the whole
 * situation rather than per SKU.
 *
 * A single product's season-over-season swing is mostly noise — an assortment
 * changed, one customer skipped a year. The programme total is the stable
 * signal, and it is what a planner would actually quote. Returned as a
 * compound rate across the span so three seasons do not weigh the same as two.
 */
export function observedGrowth(
  rows: readonly HistoricalItemRow[],
  selected: readonly PeriodKey[]
): number | undefined {
  if (selected.length < 2) return undefined;

  const ordered = [...selected].sort();
  const totals = ordered.map((period) => ({
    period,
    units: rows
      .filter((r) => r.historicalPeriod === period)
      .reduce((sum, r) => sum + r.actualUnits, 0),
  }));

  const first = totals[0];
  const last = totals[totals.length - 1];
  if (!first || !last) return undefined;
  if (first.units <= 0 || last.units <= 0) return undefined;

  // Spans are counted in calendar years, not in how many boxes are ticked.
  // A planner who keeps 2024 and 2026 but excludes an atypical 2025 has
  // observed two years of growth, and treating that as one would nearly double
  // the rate they are shown.
  const spans = yearSpan(first.period, last.period) ?? totals.length - 1;
  if (spans <= 0) return undefined;

  const compound = Math.pow(last.units / first.units, 1 / spans) - 1;
  return clampGrowth(compound);
}

/**
 * Whole years between two period keys, when both start with a four-digit year
 * (`2026-Halloween`). Undefined for any other shape, so an unfamiliar period
 * format degrades to counting selections rather than guessing.
 */
function yearSpan(from: PeriodKey, to: PeriodKey): number | undefined {
  const a = /^(\d{4})/.exec(from);
  const b = /^(\d{4})/.exec(to);
  if (!a?.[1] || !b?.[1]) return undefined;
  const span = Number(b[1]) - Number(a[1]);
  return span > 0 ? span : undefined;
}

export function clampGrowth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(GROWTH_CEILING, Math.max(GROWTH_FLOOR, value));
}

/** One SKU, collapsed from however many seasons the planner selected. */
export interface CollapsedSku {
  /** A synthetic row carrying the most recent selected season's attributes. */
  row: HistoricalItemRow;
  seasonHistory: SeasonPoint[];
  plannedUnits: number;
  plannedValue: number;
  basis: PlannedVolumeBasis;
  /** Absent from the earlier comparable seasons — new, not a repeat. */
  isNewThisSeason: boolean;
}

export interface CollapseOptions {
  selectedPeriods: readonly PeriodKey[];
  /** From the business plan, used only when the seasons cannot imply growth. */
  businessGrowthPct?: number;
  /** candidateId -> units the planner set by hand. Wins over everything. */
  volumeOverrides?: Readonly<Record<string, number>>;
}

/**
 * Collapses every prior row into one row per SKU, and resolves what each one
 * carries forward.
 *
 * `actualUnits` on the returned row stays the historical fact from the most
 * recent selected season. `plannedUnits` is the decision derived from it. The
 * two are kept separate on purpose so a screen can always show both.
 */
export function collapseToSkus(
  rows: readonly HistoricalItemRow[],
  options: CollapseOptions
): CollapsedSku[] {
  const selected = new Set(options.selectedPeriods);
  const inBasis = rows.filter((r) => selected.has(r.historicalPeriod));
  if (inBasis.length === 0) return [];

  const growth = observedGrowth(rows, options.selectedPeriods);
  const growthPct =
    growth ?? (options.businessGrowthPct !== undefined ? clampGrowth(options.businessGrowthPct) : 0);
  const growthSource: PlannedVolumeBasis["kind"] =
    growth !== undefined
      ? "seasons"
      : options.businessGrowthPct !== undefined
        ? "business_plan_growth"
        : "prior_actual";

  // Measured against the *whole* history, not the selected basis: a product is
  // not new because the planner narrowed the seasons, and calling it new on
  // that basis would flip the marker every time they changed the control.
  const earliestPeriod = availablePeriods(rows)[0];
  const seenEarly = new Set(
    rows.filter((r) => r.historicalPeriod === earliestPeriod).map((r) => crossSeasonKey(r))
  );

  const bySku = new Map<string, HistoricalItemRow[]>();
  for (const row of inBasis) {
    const key = crossSeasonKey(row);
    const list = bySku.get(key);
    if (list) list.push(row);
    else bySku.set(key, [row]);
  }

  const out: CollapsedSku[] = [];
  for (const [key, group] of bySku) {
    const ordered = [...group].sort((a, b) =>
      a.historicalPeriod < b.historicalPeriod ? -1 : a.historicalPeriod > b.historicalPeriod ? 1 : 0
    );
    const latest = ordered[ordered.length - 1];
    if (!latest) continue;

    const seasonHistory: SeasonPoint[] = ordered.map((r) => ({
      period: r.historicalPeriod,
      units: r.actualUnits,
      value: r.actualValue,
    }));

    const id = `sku::${key}`;
    // Units across every selected season for this SKU, so the row's own
    // history is visible even though growth comes from the programme total.
    const baselineUnits = latest.actualUnits;
    const override = options.volumeOverrides?.[id];
    const inferred = Math.max(0, Math.round(baselineUnits * (1 + growthPct)));
    const plannedUnits = override !== undefined ? Math.max(0, Math.round(override)) : inferred;

    // Value has to move with units or the bridge stops reconciling: a planner
    // who changes 100 units to 120 has changed the money too.
    const unitValue = latest.actualValue !== undefined && latest.actualUnits > 0
      ? latest.actualValue / latest.actualUnits
      : undefined;
    const plannedValue = unitValue !== undefined ? plannedUnits * unitValue : 0;

    out.push({
      row: { ...latest, id },
      seasonHistory,
      plannedUnits,
      plannedValue,
      // Only meaningful once there is more than one season to be absent from.
      isNewThisSeason: earliestPeriod !== undefined && seenEarly.size > 0 && !seenEarly.has(key),
      basis: {
        kind: override !== undefined ? "planner_override" : growthSource,
        seasonsUsed: ordered.map((r) => r.historicalPeriod),
        baselineUnits,
        growthPct: override !== undefined ? 0 : growthPct,
        inferredUnits: inferred,
        label: basisLabel({
          override: override !== undefined,
          seasonCount: ordered.length,
          source: growthSource,
          growthPct,
        }),
      },
    });
  }

  return out;
}

function basisLabel(args: {
  override: boolean;
  seasonCount: number;
  source: PlannedVolumeBasis["kind"];
  growthPct: number;
}): string {
  if (args.override) return "Volume set by planner";

  const seasons = `${args.seasonCount} season${args.seasonCount === 1 ? "" : "s"}`;
  const pct = `${args.growthPct >= 0 ? "+" : ""}${(args.growthPct * 100).toFixed(1)}%`;

  if (args.source === "seasons") return `${seasons} · ${pct} observed growth`;
  if (args.source === "business_plan_growth") return `${seasons} · ${pct} business-plan growth`;
  return `${seasons} · prior actual, no growth applied`;
}

/**
 * One line describing the basis for the whole situation, for the season
 * control's summary. Says which of the three growth sources actually applied
 * rather than implying a precision the data does not support.
 */
export function describeSeasonBasis(
  rows: readonly HistoricalItemRow[],
  selected: readonly PeriodKey[],
  businessGrowthPct?: number
): string {
  if (selected.length === 0) return "No seasons selected — nothing carries forward";

  const growth = observedGrowth(rows, selected);
  const seasons = `${selected.length} season${selected.length === 1 ? "" : "s"}`;

  if (growth !== undefined) {
    return `${seasons} · ${growth >= 0 ? "+" : ""}${(growth * 100).toFixed(1)}% observed growth`;
  }
  if (businessGrowthPct !== undefined) {
    const g = clampGrowth(businessGrowthPct);
    return `${seasons} · ${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)}% from the business plan`;
  }
  return `${seasons} · prior actual, no growth applied (select a second season to imply growth)`;
}
