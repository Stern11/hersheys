/**
 * Input validation for scenario controls.
 *
 * The rule this file exists to enforce (PRD §13, "a scenario is a set of
 * stated assumptions, not a set of typed characters"): **when a requested
 * value cannot be honored, the value that gets STORED must be the value that
 * was ACTUALLY APPLIED** — never a number the engine silently ignores. A
 * label reading "Scenario 53 seasons" while the forecast quietly uses 3 is a
 * lie about the model, and it is exactly the class of silent failure the
 * planner cannot detect from the screen.
 *
 * Every range is exported so the UI can render the legal bounds next to the
 * control instead of discovering them by rejection.
 */

export interface NumericRange {
  min: number;
  max: number;
  /** Suggested input step for the UI. */
  step: number;
  /** Human label for the unit, e.g. "units/hr". */
  unit: string;
  /** Short description of why the bound exists — surfaced as a hint/tooltip. */
  rationale: string;
}

export interface ClampResult {
  /** The value that was actually applied. Always finite and inside the range. */
  value: number;
  /** What the caller asked for (unchanged, may be NaN/Infinity). */
  requested: number;
  /** True when `value !== requested` — i.e. the request could not be honored as typed. */
  clamped: boolean;
  /** Present only when clamped; a planner-readable explanation. */
  reason?: string;
}

/**
 * Clamps `requested` into `range`. Non-finite input (NaN from an empty or
 * non-numeric field, ±Infinity) is treated as 0 and then clamped, so a
 * malformed keystroke can never propagate NaN through the planning engine
 * and silently blank out a derived number.
 */
export function clampToRange(requested: number, range: NumericRange, label = "value"): ClampResult {
  const finite = Number.isFinite(requested) ? requested : 0;
  const value = Math.min(range.max, Math.max(range.min, finite));
  if (value === requested) return { value, requested, clamped: false };

  const reason = !Number.isFinite(requested)
    ? `${label} was not a number — applied ${formatBound(value, range)}.`
    : `${label} must be between ${formatBound(range.min, range)} and ${formatBound(range.max, range)} — applied ${formatBound(value, range)}.`;
  return { value, requested, clamped: true, reason };
}

/** Same as clampToRange but also forces the result to a whole number. */
export function clampToIntegerRange(requested: number, range: NumericRange, label = "value"): ClampResult {
  const first = clampToRange(requested, range, label);
  const rounded = Math.round(first.value);
  if (rounded === requested) return { value: rounded, requested, clamped: false };
  return {
    value: rounded,
    requested,
    clamped: true,
    reason: first.reason ?? `${label} must be a whole number — applied ${rounded}.`,
  };
}

function formatBound(n: number, range: NumericRange): string {
  if (range.unit === "%") return `${Math.round(n * 100)}%`;
  return range.unit ? `${n} ${range.unit}` : String(n);
}

/* ---------------------------------------------------------------------- *
 * The ranges themselves.
 * ---------------------------------------------------------------------- */

/**
 * A line cannot run at zero or negative units/hour (division by it produces
 * Infinity load hours), and no confectionery packaging line in this model
 * runs above 100k/hr. The lower bound is deliberately well below any real
 * line so a planner can still model a severe degradation.
 */
export const RUN_RATE_RANGE: NumericRange = {
  min: 100,
  max: 100_000,
  step: 100,
  unit: "units/hr",
  rationale: "A run rate divides demand into hours, so it must be strictly positive; 100–100,000/hr brackets every line in the model.",
};

/**
 * A utilization ALERT THRESHOLD is a fraction of the line's own ceiling. It
 * is meaningless outside 0–100%: a negative threshold flags every line and a
 * >100% threshold can never be crossed before the ceiling breach that
 * already raises `critical`.
 */
export const TARGET_UTILIZATION_RANGE: NumericRange = {
  min: 0,
  max: 1,
  step: 0.01,
  unit: "%",
  rationale: "A threshold is a share of the line's own ceiling — outside 0–100% it can never be crossed meaningfully.",
};

/**
 * Business growth on a seasonal event. ±50% is already an extreme S&OP
 * assumption; beyond it the seasonal-forecast basis (a recent-weighted mean
 * of three comparable seasons) stops being the thing producing the number.
 */
export const GROWTH_RATE_RANGE: NumericRange = {
  min: -0.5,
  max: 0.5,
  step: 0.01,
  unit: "%",
  rationale: "Beyond ±50% the seasonal basis no longer explains the forecast — state a different basis instead of an extreme growth rate.",
};

/** Seasonal uplift stacks on top of growth, so it carries the same bound. */
export const SEASONAL_UPLIFT_RANGE: NumericRange = {
  min: -0.5,
  max: 0.5,
  step: 0.01,
  unit: "%",
  rationale: "Uplift multiplies the whole demand envelope; beyond ±50% it dominates the historical basis it is supposed to adjust.",
};

export const LEAD_TIME_DAYS_RANGE: NumericRange = {
  min: 1,
  max: 365,
  step: 1,
  unit: "days",
  rationale: "An order-by date is the requirement date minus this figure; 1–365 days keeps it inside a planning horizon.",
};

export const ANALOGUE_WEIGHT_RANGE: NumericRange = {
  min: 0,
  max: 1,
  step: 0.01,
  unit: "",
  rationale: "Analogue weights are renormalized to sum to 1, so only their relative size matters; negatives are meaningless.",
};

export const LINE_ALLOCATION_RANGE: NumericRange = {
  min: 0,
  max: 1,
  step: 0.01,
  unit: "",
  rationale: "A line's share of a family's volume is a fraction of that volume.",
};

export const ADDITIONAL_SHIFT_HOURS_RANGE: NumericRange = {
  min: 0,
  max: 744,
  step: 8,
  unit: "hrs",
  rationale: "Added shift hours widen the ceiling; they cannot be negative, and 744 is a full 31-day month of continuous running.",
};

export const PREBUILD_UNITS_RANGE: NumericRange = {
  min: 0,
  max: 50_000_000,
  step: 10_000,
  unit: "units",
  rationale: "A prebuild adds load; it cannot be negative.",
};

export const AVAILABLE_HOURS_RANGE: NumericRange = {
  min: 0,
  max: 744,
  step: 1,
  unit: "hrs",
  rationale: "Available hours in a monthly bucket cannot exceed the hours in the month.",
};

export const NON_NEGATIVE_UNITS_RANGE: NumericRange = {
  min: 0,
  max: 1_000_000_000,
  step: 1,
  unit: "units",
  rationale: "Inventory, open supply and safety stock are quantities on hand — never negative.",
};

/**
 * The lookback range is DATA-DEPENDENT: you cannot look back over more
 * comparable seasons than exist in the basis. `availableSeasons` is the count
 * of periods that survive the atypical/exclusion filter, so excluding a
 * season narrows the legal range immediately.
 */
export function historicalLookbackRange(availableSeasons: number): NumericRange {
  const max = Math.max(1, Math.floor(availableSeasons));
  return {
    min: 1,
    max,
    step: 1,
    unit: max === 1 ? "season" : "seasons",
    rationale: `Only ${max} comparable season${max === 1 ? "" : "s"} survive the current exclusions — a longer lookback has nothing to read.`,
  };
}

/* ---------------------------------------------------------------------- *
 * Convenience wrappers used by the store actions.
 * ---------------------------------------------------------------------- */

export const clampRunRate = (v: number) => clampToRange(v, RUN_RATE_RANGE, "Run rate");
export const clampTargetUtilization = (v: number) => clampToRange(v, TARGET_UTILIZATION_RANGE, "Utilization alert threshold");
export const clampGrowthRate = (v: number) => clampToRange(v, GROWTH_RATE_RANGE, "Growth assumption");
export const clampSeasonalUplift = (v: number) => clampToRange(v, SEASONAL_UPLIFT_RANGE, "Seasonal uplift");
export const clampLeadTimeDays = (v: number) => clampToIntegerRange(v, LEAD_TIME_DAYS_RANGE, "Lead time");
export const clampAnalogueWeight = (v: number) => clampToRange(v, ANALOGUE_WEIGHT_RANGE, "Analogue weight");
export const clampLineAllocation = (v: number) => clampToRange(v, LINE_ALLOCATION_RANGE, "Line allocation share");
export const clampAdditionalShiftHours = (v: number) => clampToRange(v, ADDITIONAL_SHIFT_HOURS_RANGE, "Additional shift hours");
export const clampPrebuildUnits = (v: number) => clampToRange(v, PREBUILD_UNITS_RANGE, "Prebuild quantity");
export const clampAvailableHours = (v: number) => clampToRange(v, AVAILABLE_HOURS_RANGE, "Available hours");
export const clampNonNegativeUnits = (v: number) => clampToRange(v, NON_NEGATIVE_UNITS_RANGE, "Quantity");
export const clampHistoricalLookback = (v: number, availableSeasons: number) =>
  clampToIntegerRange(v, historicalLookbackRange(availableSeasons), "Historical lookback");
