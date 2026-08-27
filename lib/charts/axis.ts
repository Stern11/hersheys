/**
 * Pure axis/scale geometry for the hand-built charts in `components/charts/*`
 * and the two planning charts that own their own SVG/CSS geometry.
 *
 * These functions exist because the charts are hand-positioned: without a
 * shared, unit-tested scale a bar's pixel length and the number printed next
 * to it can drift apart silently (no console error, no visual crash) — which
 * is exactly the defect class the browser audit found. Every geometric number
 * a chart renders should come from here so it can be asserted in a test.
 *
 * No React, no DOM, no data imports.
 */

/** Round away IEEE-754 noise (0.1*3 = 0.30000000000000004) without changing value. */
function round12(n: number): number {
  return Number(n.toPrecision(12));
}

/** Mantissas that produce a "nice" human-readable tick step. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;
/** Integer-only variant — used for count axes where 2.5 receipts is meaningless. */
const NICE_INTEGER_STEPS = [1, 2, 5, 10] as const;

/**
 * Smallest "nice" step >= `raw`. Always > 0 so callers can divide by it.
 */
export function niceStep(raw: number, integer = false): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const candidates = integer ? NICE_INTEGER_STEPS : NICE_STEPS;
  const exponent = Math.floor(Math.log10(raw));
  const magnitude = Math.pow(10, exponent);
  const normalized = raw / magnitude;
  const mantissa = candidates.find((c) => normalized <= c + 1e-9) ?? 10;
  const step = round12(mantissa * magnitude);
  return integer ? Math.max(1, Math.round(step)) : step;
}

export interface AxisScale {
  /** Upper bound of the axis. Always >= the dataMax it was built from. */
  max: number;
  step: number;
  /** Ascending, starts at 0, ends exactly at `max`. */
  ticks: number[];
}

/**
 * A 0-based linear axis whose top tick is a round number at or above `dataMax`.
 * Guarantees `max >= dataMax`, so nothing a caller draws can overflow the track.
 */
export function linearAxis(dataMax: number, targetIntervals = 5, integer = false): AxisScale {
  if (!Number.isFinite(dataMax) || dataMax <= 0) {
    return { max: 1, step: 1, ticks: [0, 1] };
  }
  const intervals = Math.max(1, Math.round(targetIntervals));
  const step = niceStep(dataMax / intervals, integer);
  const max = round12(Math.ceil(dataMax / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 1e-9; v = round12(v + step)) ticks.push(v);
  // Floating-point insurance: the last tick must be exactly `max`.
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return { max, step, ticks };
}

/**
 * Nice tick values inside an arbitrary [min, max] domain (used by the
 * lead-time histogram, whose x domain is days elapsed, not 0-based).
 * Always includes at least the two domain endpoints so the axis is bounded.
 */
export function niceTicksWithin(min: number, max: number, targetIntervals = 5, integer = true): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min, max].filter(Number.isFinite);
  const step = niceStep((max - min) / Math.max(1, targetIntervals), integer);
  const first = round12(Math.ceil(min / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 1e-9; v = round12(v + step)) ticks.push(v);
  if (ticks.length === 0) return [round12(min), round12(max)];
  return ticks;
}

/** Value -> percentage of a 0-based axis, clamped to [0, 100]. Never NaN. */
export function pctOfAxis(value: number, axisMax: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(axisMax) || axisMax <= 0) return 0;
  return clampPct((value / axisMax) * 100);
}

/** Value -> percentage across an arbitrary [min, max] domain, clamped. */
export function pctWithin(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return 0;
  return clampPct(((value - min) / span) * 100);
}

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export type LabelAnchor = "start" | "middle" | "end";

/**
 * Which way a tick/marker label must be aligned so it stays inside the plot
 * box. A label centred on a 0% or 100% tick hangs half its width outside the
 * container and gets clipped — that is why the old lead-time markers lost
 * their text at the domain edges.
 */
export function labelAnchor(pct: number, edgeTolerance = 6): LabelAnchor {
  if (pct <= edgeTolerance) return "start";
  if (pct >= 100 - edgeTolerance) return "end";
  return "middle";
}

/** CSS transform matching `labelAnchor` for an element positioned at `left: pct%`. */
export function anchorTransform(anchor: LabelAnchor): string {
  if (anchor === "start") return "translateX(0)";
  if (anchor === "end") return "translateX(-100%)";
  return "translateX(-50%)";
}
