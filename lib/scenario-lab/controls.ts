import type { ProductionLine } from "@/types/planning";
import type { CapacityOverride, MasterAssumptionOverride, ScenarioBasisStatus } from "@/types/scenario";
import type { OverrideDiff } from "@/lib/planning-engine/overrides";
import type { AppliedChange } from "@/stores/scenario-store";
import { resolveRunRate, type RunRateResolution } from "@/lib/planning-engine/capacity";
import { RUN_RATE_RANGE, TARGET_UTILIZATION_RANGE, type NumericRange } from "@/lib/planning-engine/validation";
import { fmtNum, fmtPct } from "@/lib/utils/format";

/* ---------------------------------------------------------------------- *
 * Scenario Lab control models.
 *
 * These are the numbers and sentences the left-hand assumption cards render.
 * They live here, as pure functions, for one reason: the three defects this
 * file exists to prevent were all INVISIBLE to the type checker and the
 * linter, and all three lived inside the component's JSX.
 *
 *   1. The custom run-rate input displayed a hard-coded `8200` fallback, so
 *      it looked correct while showing a number no part of the model held.
 *   2. The utilization-threshold input accepted -10 and 200 with no bound
 *      and no message, because the bounds were literals in the JSX rather
 *      than the engine's own range.
 *   3. Reset wiped a named scenario with no statement of what was lost.
 *
 * Nothing here reads the store or React. Everything here is asserted in
 * `controls.test.ts` against the real store and the real engine.
 * ---------------------------------------------------------------------- */

export interface RunRateControlModel {
  /** The basis the planner selected. "system" when they have selected nothing. */
  basis: RunRateResolution["basis"];
  /** What the RCCP conversion will actually divide by, per `resolveRunRate`. */
  resolved: RunRateResolution;
  /**
   * The number the "Custom" input must show.
   *
   * It is the STORED scenario value, falling back to the resolved rate — never
   * a literal. The old input rendered `runRateOverride?.scenarioValue ?? 8200`,
   * which meant a scenario carrying no run-rate override still displayed
   * 8,200/hr, and typing over it wrote to a field the engine did not read.
   */
  inputValue: number;
  baselineLabel: string;
  scenarioLabel: string;
  /** True when this line's run rate differs from the line's system standard. */
  changed: boolean;
  range: NumericRange;
  /** Why this particular number is on screen — shown under the control. */
  sourceNote: string;
}

const RUN_RATE_SOURCE_NOTE: Record<RunRateResolution["source"], string> = {
  scenario_value: "Scenario value entered on this scenario.",
  observed_median: "Observed median of executed runs on this line.",
  line_period_rate: "Period-specific rate stored on this capacity bucket.",
  line_standard: "The line's system standard rate — no scenario value is stored.",
};

export function runRateBasisLabel(basis: RunRateResolution["basis"], line: ProductionLine, observedMedianRunRate: number, scenarioValue: number): string {
  if (basis === "historical") return `Historical (${fmtNum(observedMedianRunRate || line.historicalMedianRunRateUnitsPerHour)}/hr)`;
  if (basis === "scenario") return `Custom (${fmtNum(scenarioValue)}/hr)`;
  return `System (${fmtNum(line.standardRunRateUnitsPerHour)}/hr)`;
}

export function runRateControlModel(args: {
  line: ProductionLine;
  /** `overrides.masterAssumptions["line:{id}:run_rate"]` — the ONE place a scenario run rate lives. */
  runRateOverride?: MasterAssumptionOverride;
  capacityOverride?: CapacityOverride;
  observedMedianRunRate: number;
}): RunRateControlModel {
  const { line, runRateOverride, capacityOverride, observedMedianRunRate } = args;
  const resolved = resolveRunRate({ line, runRateOverride, capacityOverride, observedMedianRunRate });
  const basis = runRateOverride?.selectedBasis ?? "system";
  const inputValue = runRateOverride?.scenarioValue ?? resolved.unitsPerHour;

  return {
    basis,
    resolved,
    inputValue,
    baselineLabel: `System (${fmtNum(line.standardRunRateUnitsPerHour)}/hr)`,
    scenarioLabel: runRateBasisLabel(basis, line, observedMedianRunRate, inputValue),
    changed: resolved.unitsPerHour !== line.standardRunRateUnitsPerHour,
    range: RUN_RATE_RANGE,
    sourceNote: RUN_RATE_SOURCE_NOTE[resolved.source],
  };
}

/* ---------------------------------------------------------------------- */

export interface TargetUtilizationControlModel {
  /** The fraction in force (0–1) after any scenario override. */
  fraction: number;
  /** What the percentage input displays — a whole percent, never a fraction. */
  inputPct: number;
  /** Whole-percent bounds for the input element, taken from the engine's range. */
  minPct: number;
  maxPct: number;
  stepPct: number;
  changed: boolean;
  /** The bound explanation, so the planner is not left to discover it by rejection. */
  rationale: string;
}

export function targetUtilizationControlModel(args: { baselineTargetUtilization: number; override?: number }): TargetUtilizationControlModel {
  const fraction = args.override ?? args.baselineTargetUtilization;
  return {
    fraction,
    inputPct: Math.round(fraction * 100),
    minPct: Math.round(TARGET_UTILIZATION_RANGE.min * 100),
    maxPct: Math.round(TARGET_UTILIZATION_RANGE.max * 100),
    stepPct: 1,
    changed: args.override != null && args.override !== args.baselineTargetUtilization,
    rationale: TARGET_UTILIZATION_RANGE.rationale,
  };
}

/* ---------------------------------------------------------------------- *
 * What actually happened to a control write.
 * ---------------------------------------------------------------------- */

export type ControlNoticeTone = "clamped" | "noop" | "rejected" | "held";

export interface ControlNotice {
  tone: ControlNoticeTone;
  text: string;
}

/**
 * The message shown under an input after a write, or null when the write was
 * honored exactly as typed.
 *
 * A store action clamps BEFORE writing, so the stored value is always the
 * applied value — which means a silently clamped input would show a number
 * the planner never asked for with no explanation. This turns that into a
 * sentence.
 */
export function controlNotice(applied: AppliedChange | null | undefined, format: (v: number) => string): ControlNotice | null {
  if (!applied) return null;
  if (!applied.applied) return { tone: "rejected", text: applied.reason ?? "That change could not be applied." };
  if (applied.clamped) return { tone: "clamped", text: applied.reason ?? `Applied ${format(applied.value)} instead of ${format(applied.requested)}.` };
  if (applied.noop) return { tone: "noop", text: `Already ${format(applied.value)} — nothing changed.` };
  return null;
}

/* ---------------------------------------------------------------------- *
 * Typing into a clamped numeric field.
 * ---------------------------------------------------------------------- */

export interface DraftEvaluation {
  /** The parsed number, or null for a blank/non-numeric draft. */
  value: number | null;
  /** True when the draft can be applied to the store as typed. */
  inRange: boolean;
  /** Shown while the draft is not yet applicable — never after a successful apply. */
  hint: string | null;
}

/**
 * Decides whether a partially-typed value should be pushed to the store yet.
 *
 * A clamped store plus a controlled input is a trap: typing "6000" into a
 * field whose minimum is 100 would apply "6" as 100 on the first keystroke and
 * fight the planner for the rest of the number. So an in-range draft applies
 * immediately (the workspace moves as you type, which is the point of a
 * scenario lab) and an out-of-range or half-typed draft is held with a visible
 * hint until the field is committed, where the store clamps it and says so.
 */
export function evaluateDraft(raw: string, bounds: { min: number; max: number; format: (n: number) => string }): DraftEvaluation {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null, inRange: false, hint: `Enter a value between ${bounds.format(bounds.min)} and ${bounds.format(bounds.max)}.` };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, inRange: false, hint: `That is not a number. Enter a value between ${bounds.format(bounds.min)} and ${bounds.format(bounds.max)}.` };
  if (value < bounds.min || value > bounds.max) {
    return { value, inRange: false, hint: `${bounds.format(value)} is outside ${bounds.format(bounds.min)}–${bounds.format(bounds.max)} — it will be clamped when you leave the field.` };
  }
  return { value, inRange: true, hint: null };
}

/* ---------------------------------------------------------------------- *
 * Reset — with a statement of what is lost.
 * ---------------------------------------------------------------------- */

export interface ResetPlan {
  /** False when the scenario already resolves to the baseline: Reset is a no-op and must say so. */
  destructive: boolean;
  title: string;
  /** One line per assumption that will be discarded, naming the value being lost. */
  losses: string[];
  confirmLabel: string;
  /** Extra warning when the scenario has standing (saved/validated/preferred) rather than being a scratch draft. */
  standingWarning: string | null;
}

/**
 * Reset used to clear every override on a NAMED scenario instantly, with no
 * confirmation and no undo — a scenario titled "Line 03 relief — P80 lead time
 * + scenario run rate" could be left holding neither, and nothing on screen
 * said what had gone. The confirmation is built from the same `overrideDiffs`
 * the badge counts, so it can only ever name real, resolved differences.
 */
export function resetPlan(args: { scenarioName: string; status: string; diffs: OverrideDiff[] }): ResetPlan {
  const { scenarioName, status, diffs } = args;
  if (diffs.length === 0) {
    return {
      destructive: false,
      title: `Nothing to reset — "${scenarioName}" already resolves to the baseline.`,
      losses: [],
      confirmLabel: "Reset anyway",
      standingWarning: null,
    };
  }
  const hasStanding = status !== "draft";
  return {
    destructive: true,
    title: `Reset "${scenarioName}"? This discards ${diffs.length} assumption${diffs.length === 1 ? "" : "s"} and cannot be undone.`,
    losses: diffs.map((d) => `${d.label}: ${d.scenario} reverts to ${d.baseline}.`),
    confirmLabel: `Discard ${diffs.length} override${diffs.length === 1 ? "" : "s"}`,
    standingWarning: hasStanding ? `This scenario is "${status.replace("_", " ")}" — resetting keeps the name and the standing but empties the assumptions behind them.` : null,
  };
}

/* ---------------------------------------------------------------------- *
 * Basis sufficiency — never render a forecast that has no basis.
 * ---------------------------------------------------------------------- */

export interface BasisBanner {
  show: boolean;
  headline: string;
  detail: string[];
}

/**
 * Excluding every comparable season left the workspace showing "EXPECTED
 * DEMAND 0–0" and a 76% utilization as though they were findings. They are
 * not findings — they are the absence of a basis, and CLAUDE.md forbids
 * showing a plausible-looking number in place of an honest gap.
 */
export function basisBanner(basis: ScenarioBasisStatus): BasisBanner {
  if (basis.sufficient) return { show: false, headline: "", detail: [] };
  return {
    show: true,
    headline: `No demand basis: ${basis.seasonsUsed} of ${basis.seasonsAvailable} comparable season(s) in scope.`,
    detail: basis.issues.length > 0 ? basis.issues : ["The forecast has no comparable season to read, so every demand-derived figure below is undefined rather than zero."],
  };
}

/** The demand figure to display — or an honest placeholder when there is no basis. */
export function demandDisplay(args: { basis: ScenarioBasisStatus; low: number; high: number }): string {
  if (!args.basis.sufficient) return "No basis";
  return `${fmtNum(args.low)}–${fmtNum(args.high)}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * "2027-06" -> "June 2027".
 *
 * The capacity heading was hard-coded to "September 2027" while the Halloween
 * scenario evaluates the JUNE production peak — production timing labelled
 * with a sell-through month. The label must be read from the bucket the
 * scenario actually evaluates.
 */
export function periodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : period;
}

/** Formats a run rate for a notice, e.g. "6,000/hr". */
export function fmtRunRate(v: number): string {
  return `${fmtNum(v)}/hr`;
}

/** Formats a threshold fraction for a notice, e.g. "85%". */
export function fmtThreshold(v: number): string {
  return fmtPct(v);
}
