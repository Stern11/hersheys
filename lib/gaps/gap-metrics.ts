import type { PlanningGap } from "@/types/gaps";
import type { MaterialReadiness } from "@/types/planning";
import type { CapacityImpactByLine, ReadinessCounts, ScenarioResult } from "@/types/scenario";
import { bomReadinessScore, summarizeReadinessCounts } from "@/lib/planning-engine/confidence";
import { lineById } from "@/data/synthetic/master-data";
import { LINE_MAPPING_RECORDS } from "@/data/synthetic/execution-history";
import { fmtNum, fmtPct } from "@/lib/utils/format";

/**
 * ONE derivation per displayed metric.
 *
 * Every number that was previously computed inline in a page or workspace
 * component — and therefore computed twice, differently, on two surfaces —
 * lives here as a pure function. Components render what these return; they
 * never re-derive.
 *
 * The rule this file exists to enforce: if a planner can see the inputs on
 * screen, the displayed result must be reproducible from those inputs by
 * hand. Anything not reproducible from what is shown either gets its
 * denominator put on screen, or is not shown at all.
 */

/** Structurally compatible with components/planning/metric-band.tsx's MetricBandItem. */
export interface GapMetric {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "critical" | "neutral";
  /** Optional derivation shown on hover — the arithmetic behind `value`. */
  hint?: string;
}

/** Percentage-shaped gap units, where a bare "%" must not be spaced off its number. */
const PERCENT_UNITS = new Set(["%", "% of execution", "% of runs", "% of volume", "percent"]);

export function isPercentUnit(unit: string): boolean {
  return PERCENT_UNITS.has(unit);
}

/**
 * Formats a gap quantity in its own unit. Percentage units glue to the
 * number ("70%"), never "70 %"; the qualifier ("of execution") is returned
 * separately so a caller can put it in the label where it belongs rather
 * than in the value.
 */
export function formatGapQuantity(value: number, unit: string): { value: string; qualifier?: string } {
  if (isPercentUnit(unit)) {
    const qualifier = unit === "%" || unit === "percent" ? undefined : unit.slice(1).trim();
    return { value: `${roundTo(value, 1)}%`, qualifier };
  }
  return { value: `${fmtNum(value)} ${unit}`.trim() };
}

export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/* ------------------------------------------------------------------ */
/* Capacity: effective utilization — item 10(a)                        */
/* ------------------------------------------------------------------ */

/**
 * The single source of truth for a capacity gap's EFFECTIVE utilization.
 *
 * A capacity PlanningGap models utilization as percentage points:
 *   formalValue        = formal load / ceiling
 *   unresolvedValue    = the points effective load adds on top of formal
 *   expectedValueLow   = P50 utilization
 *   expectedValueHigh  = P80 utilization
 *
 * Effective is therefore formal + unresolved — exactly the addition a
 * planner can do from the two numbers on the gap page. It is NOT
 * `expectedValueHigh`: that is the P80, a different statistic, and reading
 * it as "effective" is what made /decisions quote 98% while every other
 * surface quoted 92%.
 */
export function capacityEffectiveUtilizationPct(gap: PlanningGap): number {
  return roundTo(gap.formalValue + gap.unresolvedValue, 1);
}

export function capacityFormalUtilizationPct(gap: PlanningGap): number {
  return roundTo(gap.formalValue, 1);
}

/** The worst line/period bucket in a scenario result, by effective load. */
export function worstCapacityImpact(result?: ScenarioResult): CapacityImpactByLine | null {
  if (!result || result.capacityImpact.length === 0) return null;
  return result.capacityImpact.reduce((worst, c) => (c.effectiveUtilization > worst.effectiveUtilization ? c : worst));
}

/** Display name for a production line, read from master data — never a hard-coded "Line 03". */
export function lineDisplayName(lineId: string): string {
  try {
    return lineById(lineId).name;
  } catch {
    return lineId;
  }
}

/**
 * The work centre the PDQ counter-display confirmations actually ran on,
 * read out of the confirmation records rather than hard-coded as "Line 01".
 * Returns null if the anomaly is ever absent from the data.
 */
export function misroutedActualLineId(): string | null {
  const record = LINE_MAPPING_RECORDS.find((r) => r.actualLineId != null && r.actualLineId !== r.lineId);
  return record?.actualLineId ?? null;
}

/* ------------------------------------------------------------------ */
/* Demand: planning completeness — item 11                             */
/* ------------------------------------------------------------------ */

export interface CompletenessResult {
  /** Percent, one decimal. */
  pct: number;
  numerator: number;
  denominator: number;
  denominatorLabel: string;
  /** The arithmetic, spelled out, so the figure is verifiable on screen. */
  derivation: string;
}

/**
 * Planning completeness = formally represented demand / expected demand at
 * the P50 point. The engine divides by P50; the UI used to show P80 beside
 * the percentage, so 3,800,000 next to 4,942,080 read as 77% while the
 * label said 80%. This returns the denominator it actually used so the
 * caller is forced to put it on screen.
 */
export function planningCompleteness(formalUnits: number, expectedP50Units: number): CompletenessResult {
  const ratio = expectedP50Units > 0 ? Math.min(1, formalUnits / expectedP50Units) : 1;
  return {
    pct: roundTo(ratio * 100, 1),
    numerator: formalUnits,
    denominator: expectedP50Units,
    denominatorLabel: "P50",
    derivation: `${fmtNum(formalUnits)} formal ÷ ${fmtNum(expectedP50Units)} expected (P50)`,
  };
}

/* ------------------------------------------------------------------ */
/* BOM readiness — item 10(b)                                          */
/* ------------------------------------------------------------------ */

export interface BomReadinessSummary extends ReadinessCounts {
  /** planNow / total — reproducible from the two counts shown beside it. */
  planNowShare: number;
  /** Unweighted mean of component confidences. Named for exactly what it is. */
  meanComponentConfidence: number;
}

/**
 * Component readiness counts for a partial BOM, for the surfaces that render
 * them (the Valentine's workspace band, /gaps/product-readiness, /gaps and
 * /decisions). Counting itself is delegated to the engine's
 * summarizeReadinessCounts() so there is exactly one implementation of
 * "how many components are plan-now" in the app.
 *
 * There is deliberately NO "value-weighted BOM readiness" figure here.
 * Weighting by value needs a standard cost per material and materials.ts
 * carries none; weighting by requirement quantity would sum MT against cwt
 * against `ea`, which is not a quantity. The old "BOM readiness 69%" in the
 * Valentine's metric band was an unweighted mean of the seven component
 * confidences wearing a value-weighted label — which is why it disagreed
 * with the 65% gap confidence every other surface showed for the same
 * product. Both surfaces now render `planNow of total`, which is its own
 * denominator, and the 65% keeps its own honest label.
 */
export function summarizeBomReadiness(rows: MaterialReadiness[]): BomReadinessSummary {
  const counts = summarizeReadinessCounts(rows);
  return {
    ...counts,
    planNowShare: counts.total > 0 ? counts.planNow / counts.total : 0,
    meanComponentConfidence: bomReadinessScore(rows),
  };
}

/** "3 of 7" — the count form, which is its own denominator. */
export function formatReadinessCount(summary: BomReadinessSummary): string {
  return `${summary.planNow} of ${summary.total}`;
}

/* ------------------------------------------------------------------ */
/* Lead-time basis labelling — item 20                                 */
/* ------------------------------------------------------------------ */

const LEAD_TIME_BASIS_LABEL: Record<MaterialReadiness["leadTimeBasis"], string> = {
  system: "system",
  historical_median: "historical median",
  historical_p80: "historical P80",
  scenario: "scenario",
};

/**
 * `"historical_p80".replace("_", " ")` only replaces the FIRST underscore,
 * so the readiness table used to render "historical p80". More importantly
 * the basis itself was hard-coded to "system" in the explosion, so the
 * Halloween BOM showed the accepted 74-day P80 film lead time labelled as
 * the 42-day system norm.
 */
export function leadTimeBasisLabel(basis: MaterialReadiness["leadTimeBasis"]): string {
  return LEAD_TIME_BASIS_LABEL[basis] ?? basis;
}

/* ------------------------------------------------------------------ */
/* Generic gap workspace metric band — item 19                         */
/* ------------------------------------------------------------------ */

/**
 * Metrics for gaps that have no bespoke workspace. Previously every gap got
 * the same Formal / Expected / Unresolved triple regardless of what its
 * numbers meant, which produced "FORMAL 0 %" (stray space) and
 * "UNRESOLVED 84 %" on a routing anomaly where a percentage is a share of
 * observed execution, not a plan quantity.
 */
export function genericGapMetrics(gap: PlanningGap): GapMetric[] {
  const confidence: GapMetric = { label: "Confidence", value: fmtPct(gap.confidence.overall) };

  if (gap.type === "capacity" && isPercentUnit(gap.unit)) {
    const formal = capacityFormalUtilizationPct(gap);
    const effective = capacityEffectiveUtilizationPct(gap);
    return [
      { label: "Line", value: gap.lineId ? lineDisplayName(gap.lineId) : "—" },
      { label: "Formal utilization", value: `${formal}%`, hint: "Committed load in the formal plan ÷ ceiling hours" },
      {
        label: "Effective utilization",
        value: `${effective}%`,
        tone: gap.severity === "critical" ? "critical" : "warning",
        hint: `${formal}% formal + ${roundTo(gap.unresolvedValue, 1)}pp unresolved`,
      },
      { label: "Added by unresolved demand", value: `+${roundTo(gap.unresolvedValue, 1)}pp` },
      { label: "P80 utilization", value: `${roundTo(gap.expectedValueHigh, 1)}%`, hint: "Same load at the P80 demand point" },
      confidence,
    ];
  }

  if (isPercentUnit(gap.unit)) {
    // A share-of-execution gap (routing anomaly): the percentages describe
    // observed execution, not a plan quantity, so they are labelled that way
    // and the routed/actual work centres are named from master data.
    const low = roundTo(gap.expectedValueLow, 1);
    const high = roundTo(gap.expectedValueHigh, 1);
    const qualifier = formatGapQuantity(0, gap.unit).qualifier;
    return [
      { label: "Routed work centre", value: gap.lineId ? lineDisplayName(gap.lineId) : "—" },
      { label: "Booked by the routing", value: `${roundTo(gap.formalValue, 1)}%`, hint: `Share ${qualifier ?? "of execution"} the routing accounts for` },
      {
        label: "Observed off the routed line",
        value: low === high ? `${high}%` : `${low}–${high}%`,
        tone: "warning",
        hint: low === high ? undefined : `${low}% measured by confirmed runs, ${high}% by confirmed volume`,
      },
      confidence,
    ];
  }

  const low = formatGapQuantity(gap.expectedValueLow, gap.unit);
  const high = formatGapQuantity(gap.expectedValueHigh, gap.unit);
  return [
    { label: "Represented in the formal plan", value: formatGapQuantity(gap.formalValue, gap.unit).value },
    {
      label: "Expected range",
      value: low.value === high.value ? high.value : `${fmtNum(gap.expectedValueLow)}–${high.value}`,
      tone: gap.severity === "critical" ? "critical" : "warning",
    },
    { label: "Unresolved", value: formatGapQuantity(gap.unresolvedValue, gap.unit).value, tone: "warning" },
    confidence,
  ];
}

/**
 * A situation line derived from the gap's own numbers.
 *
 * The generic workspace used to pass `planningBasis.whySelected` as the
 * situation paragraph AND render it again under "Why this basis" in the
 * rail — the same text twice, and never a statement of what was actually
 * found. This states the finding; the rail keeps the basis.
 */
export function genericGapSituation(gap: PlanningGap): string {
  if (gap.type === "capacity") {
    const line = gap.lineId ? lineDisplayName(gap.lineId) : "This line";
    return `${line} is booked to ${capacityFormalUtilizationPct(gap)}% of its ceiling by the formal plan alone. Adding the unresolved seasonal volume takes effective load to ${capacityEffectiveUtilizationPct(gap)}% — ${roundTo(gap.unresolvedValue, 1)} percentage points higher — and the P80 demand point puts it at ${roundTo(gap.expectedValueHigh, 1)}%.`;
  }

  if (isPercentUnit(gap.unit)) {
    const routed = gap.lineId ? lineDisplayName(gap.lineId) : "the routed work centre";
    const low = roundTo(gap.expectedValueLow, 1);
    const high = roundTo(gap.expectedValueHigh, 1);
    const range = low === high ? `${high}%` : `${low}–${high}%`;
    return `The routing master record books this family on ${routed}, but ${range} of confirmed execution over the observation window ran somewhere else — ${low}% measured by run count, ${high}% by confirmed volume. Nothing failed loudly, so nothing corrected it; RCCP simply loads the wrong work centre at the wrong rate.`;
  }

  if (gap.type === "representation") {
    return `Nothing about this item is represented in the operational plan: the formal plan carries ${formatGapQuantity(gap.formalValue, gap.unit).value}, while the expected volume is ${fmtNum(gap.expectedValueLow)}–${fmtNum(gap.expectedValueHigh)} ${gap.unit}. MRP cannot see an item that does not exist, so the ${fmtNum(gap.unresolvedValue)} ${gap.unit} in between is invisible rather than merely under-planned.`;
  }

  return `The formal plan carries ${formatGapQuantity(gap.formalValue, gap.unit).value} against an expected ${fmtNum(gap.expectedValueLow)}–${fmtNum(gap.expectedValueHigh)} ${gap.unit}, leaving ${formatGapQuantity(gap.unresolvedValue, gap.unit).value} unresolved.`;
}

/* ------------------------------------------------------------------ */
/* Evidence rail summary — item 14                                     */
/* ------------------------------------------------------------------ */

export function summarizeEvidence(evidence: { included: boolean }[]): { total: number; included: number; excluded: number } {
  const included = evidence.filter((e) => e.included).length;
  return { total: evidence.length, included, excluded: evidence.length - included };
}

/** Percent with one decimal, e.g. 0.9214 -> "92.1%". Used wherever a utilization is shown. */
export function fmtUtilization(ratio: number): string {
  return fmtPct(ratio, 1);
}
