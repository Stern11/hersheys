import type { IngestionSignal, SignalSourceSystem } from "@/data/synthetic/signals";

/**
 * Pure selection / ordering / freshness logic for the ingestion log.
 *
 * NO REACT IMPORTS. Nothing in this module reads a clock, draws a random
 * number, or touches the DOM — every function is a total function of its
 * arguments, so the server render and the client render agree and the whole
 * surface is unit-testable without a browser.
 *
 * NOTE ON LOCATION: by the rule in CLAUDE.md this belongs under `lib/`
 * alongside the other pure modules. This pass's file ownership is limited to
 * `components/live/*` and `data/synthetic/signals.ts`, so it lives here as a
 * plain non-React module and should be moved to `lib/live/signal-feed.ts`
 * (import path only) by whoever owns `lib/` next.
 *
 * Nothing here computes a planning number. These functions order, filter and
 * age records that already exist; all derived planning values still come
 * from `lib/planning-engine/*`.
 */

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Newest first. Ties broken by id ascending so the order is total and
 * reproducible — never dependent on Array.prototype.sort stability or on
 * the authoring order of the source array.
 */
export function sortSignalsByRecency(signals: readonly IngestionSignal[]): IngestionSignal[] {
  return [...signals].sort((a, b) => {
    const d = ms(b.receivedAt) - ms(a.receivedAt);
    if (d !== 0) return d;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The newest `limit` signals, newest first. */
export function recentSignals(signals: readonly IngestionSignal[], limit: number): IngestionSignal[] {
  if (limit <= 0) return [];
  return sortSignalsByRecency(signals).slice(0, limit);
}

/**
 * The timestamp the whole surface is "as of": the arrival time of the most
 * recent signal, not a wall clock. If nothing has arrived there is no
 * as-of, and callers must say so rather than substituting "now".
 */
export function latestSignalTimestamp(signals: readonly IngestionSignal[]): string | null {
  return sortSignalsByRecency(signals)[0]?.receivedAt ?? null;
}

export interface SourceFreshness {
  sourceSystem: SignalSourceSystem;
  /** Most recent arrival from this system, or null if it has never reported. */
  lastReceivedAt: string | null;
  /** Whole minutes between `lastReceivedAt` and the reference instant. */
  ageMinutes: number | null;
  signalCount: number;
}

/**
 * Per-source freshness against a caller-supplied reference instant, ordered
 * by `systems` (a stable roster) so a source that has gone quiet still gets
 * a row instead of silently vanishing from the strip.
 */
export function sourceFreshness(
  signals: readonly IngestionSignal[],
  systems: readonly SignalSourceSystem[],
  asOfIso: string
): SourceFreshness[] {
  const asOf = ms(asOfIso);
  return systems.map((sourceSystem) => {
    const mine = signals.filter((s) => s.sourceSystem === sourceSystem);
    const last = latestSignalTimestamp(mine);
    return {
      sourceSystem,
      lastReceivedAt: last,
      ageMinutes: last === null ? null : Math.max(0, Math.floor((asOf - ms(last)) / 60_000)),
      signalCount: mine.length,
    };
  });
}

/**
 * Compact elapsed-time label. Deterministic: it takes both endpoints, so it
 * never reads a clock. Rounds down, and never claims sub-minute precision.
 */
export function formatAge(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.floor((ms(toIso) - ms(fromIso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Signals bearing on one gap, newest first. */
export function signalsForGap(signals: readonly IngestionSignal[], gapId: string): IngestionSignal[] {
  return sortSignalsByRecency(signals.filter((s) => s.relatedGapId === gapId));
}

/**
 * Every `relatedGapId` in the log that is not a real detected gap id.
 *
 * A signal that links to a route slug which no longer exists renders a dead
 * link and is invisible in a static check, so this is asserted in the unit
 * tests against the actual output of `detectPlanningGaps()`.
 */
export function unknownGapLinks(signals: readonly IngestionSignal[], knownGapIds: readonly string[]): string[] {
  const known = new Set(knownGapIds);
  const bad = new Set<string>();
  for (const s of signals) {
    if (s.relatedGapId != null && !known.has(s.relatedGapId)) bad.add(s.relatedGapId);
  }
  return [...bad].sort();
}

/** Signals whose arrival time is after the reference instant — must be empty. */
export function signalsFromTheFuture(signals: readonly IngestionSignal[], asOfIso: string): IngestionSignal[] {
  const asOf = ms(asOfIso);
  return signals.filter((s) => ms(s.receivedAt) > asOf);
}
