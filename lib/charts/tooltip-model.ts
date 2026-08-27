/**
 * Pure model behind the shared chart tooltip (`components/charts/chart-tooltip.tsx`).
 *
 * Nothing here imports React. It exists so the three signature charts derive
 * tooltip content — row filtering, share/derivation strings, deltas, the
 * accessible flattened label — from ONE unit-tested place instead of building
 * ad-hoc template strings inline (which is how the current `title=""`
 * tooltips ended up inconsistent between the three charts).
 *
 * Token discipline is enforced at COMPILE time here: `SwatchToken` is a
 * closed union of the design tokens declared in `app/globals.css`. A hex or
 * `oklch()` literal will not type-check, and a `--risk-*` token cannot be
 * assigned where a `SeriesToken` is required.
 */

/**
 * Planning-STATE tokens — the categorical palette for DATA SERIES / provenance.
 * Never use one of these to convey status or severity.
 */
export type SeriesToken =
  | "--state-formal"
  | "--state-formal-soft"
  | "--state-validated"
  | "--state-validated-soft"
  | "--state-inferred"
  | "--state-inferred-soft"
  | "--state-scenario"
  | "--state-scenario-soft"
  | "--state-historical"
  | "--state-historical-soft"
  | "--state-unknown"
  | "--state-unknown-soft";

/**
 * RISK tokens — STATUS / severity only (a utilization band, an exception flag).
 * Never use one of these to label a data series.
 */
export type StatusToken =
  | "--risk-positive"
  | "--risk-positive-soft"
  | "--risk-warning"
  | "--risk-warning-soft"
  | "--risk-critical"
  | "--risk-critical-soft";

/**
 * Neutral chrome tokens, for reference marks that are neither a data series
 * nor a risk band (a capacity ceiling rule, a target line, a gridline).
 */
export type ChromeToken = "--text-primary" | "--text-secondary" | "--text-muted" | "--border" | "--border-strong" | "--accent";

export type SwatchToken = SeriesToken | StatusToken | ChromeToken;

/** Every token the tooltip/legend swatches accept. Exported for tests. */
export const SWATCH_TOKENS: readonly SwatchToken[] = [
  "--state-formal",
  "--state-formal-soft",
  "--state-validated",
  "--state-validated-soft",
  "--state-inferred",
  "--state-inferred-soft",
  "--state-scenario",
  "--state-scenario-soft",
  "--state-historical",
  "--state-historical-soft",
  "--state-unknown",
  "--state-unknown-soft",
  "--risk-positive",
  "--risk-positive-soft",
  "--risk-warning",
  "--risk-warning-soft",
  "--risk-critical",
  "--risk-critical-soft",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--border",
  "--border-strong",
  "--accent",
] as const;

/** `"--state-inferred"` -> `"var(--state-inferred)"`. The only way a colour reaches the DOM. */
export function swatchVar(token: SwatchToken): string {
  return `var(${token})`;
}

/** `"--state-inferred"` -> `"--state-inferred-soft"`; already-soft tokens are returned unchanged. */
export function softToken(token: SwatchToken): string {
  return token.endsWith("-soft") ? token : `${token}-soft`;
}

export type RowTone = "default" | "muted" | "emphasis";

export interface TooltipRowInput {
  /** Stable key; defaults to `label`. */
  key?: string;
  label: string;
  /**
   * Pre-formatted string preferred (you control precision and unit). A raw
   * number is formatted with at most 1 decimal as a fallback.
   * `null`/`undefined`/`NaN` drops the row entirely.
   */
  value: string | number | null | undefined;
  /** Series/status swatch shown left of the label. Omit for an unswatched row. */
  token?: SwatchToken;
  /** Drop this row when its numeric value is exactly 0 (an absent series). */
  omitWhenZero?: boolean;
  tone?: RowTone;
  /** Short trailing clarifier rendered under the row in muted type. */
  hint?: string;
}

export interface TooltipRow {
  key: string;
  label: string;
  value: string;
  token?: SwatchToken;
  tone: RowTone;
  hint?: string;
}

function formatFallback(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
}

/**
 * Drops rows with no value (and, when asked, rows that are exactly zero), so a
 * tooltip never advertises a series that is not present on the mark — the same
 * rule the legends follow.
 */
export function buildTooltipRows(inputs: readonly TooltipRowInput[]): TooltipRow[] {
  const out: TooltipRow[] = [];
  for (const r of inputs) {
    if (r.value === null || r.value === undefined) continue;
    if (typeof r.value === "number") {
      if (!Number.isFinite(r.value)) continue;
      if (r.omitWhenZero && r.value === 0) continue;
    }
    if (typeof r.value === "string" && r.value.trim() === "") continue;
    out.push({
      key: r.key ?? r.label,
      label: r.label,
      value: typeof r.value === "number" ? formatFallback(r.value) : r.value,
      token: r.token,
      tone: r.tone ?? "default",
      hint: r.hint,
    });
  }
  return out;
}

/** `part / whole` as a 0–1 share, or `null` when the denominator is unusable. */
export function shareOf(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return part / whole;
}

export interface DerivationInput {
  part: number;
  whole: number;
  /** Unit suffix appended directly to each number, e.g. `"h"`. */
  unit?: string;
  /** What the denominator IS, e.g. `"ceiling"`. */
  wholeLabel?: string;
  /** Decimals on part/whole. Default 1. */
  digits?: number;
  /** Decimals on the percentage. Default 1. */
  pctDigits?: number;
}

/**
 * The derivation footnote: `"266.4h ÷ 405.0h ceiling = 65.8%"`.
 * Returns `null` rather than a misleading string when the share is undefined.
 */
export function derivationText(input: DerivationInput): string | null {
  const { part, whole, unit = "", wholeLabel, digits = 1, pctDigits = 1 } = input;
  const share = shareOf(part, whole);
  if (share === null) return null;
  const fmt = (n: number) => n.toFixed(digits);
  const denom = wholeLabel ? `${fmt(whole)}${unit} ${wholeLabel}` : `${fmt(whole)}${unit}`;
  return `${fmt(part)}${unit} ÷ ${denom} = ${(share * 100).toFixed(pctDigits)}%`;
}

export type DeltaDirection = "up" | "down" | "flat";

export interface DeltaResult {
  delta: number;
  direction: DeltaDirection;
  text: string;
}

/**
 * A comparison line: `"+42.0h vs baseline 224.4h"`. This is the kind of thing a
 * tooltip must add — it is never on screen.
 */
export function deltaText(
  current: number,
  baseline: number,
  opts: { unit?: string; digits?: number; baselineLabel?: string } = {}
): DeltaResult | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return null;
  const { unit = "", digits = 1, baselineLabel = "baseline" } = opts;
  const delta = current - baseline;
  const direction: DeltaDirection = Math.abs(delta) < 1e-9 ? "flat" : delta > 0 ? "up" : "down";
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "±";
  const magnitude = Math.abs(delta).toFixed(digits);
  return {
    delta,
    direction,
    text: `${sign}${magnitude}${unit} vs ${baselineLabel} ${baseline.toFixed(digits)}${unit}`,
  };
}

export interface TooltipTextInput {
  title?: string;
  subtitle?: string;
  rows?: readonly TooltipRow[];
  footnote?: string;
}

/**
 * Flattens tooltip content to one sentence for `aria-label` on a mark that has
 * no text of its own (a bar, a segment, a heat cell). Chart marks are focusable
 * for keyboard tooltip access, so they must announce something.
 */
export function flattenTooltipText(input: TooltipTextInput): string {
  const parts: string[] = [];
  const head = [input.title, input.subtitle].filter((s): s is string => !!s && s.trim() !== "").join(" — ");
  if (head) parts.push(head);
  const rows = (input.rows ?? []).map((r) => `${r.label} ${r.value}`);
  if (rows.length > 0) parts.push(rows.join(", "));
  if (input.footnote && input.footnote.trim() !== "") parts.push(input.footnote);
  return parts.join(". ");
}
