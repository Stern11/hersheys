import { describe, it, expect } from "vitest";
import { detectPlanningGaps, type GapDetectionResult } from "@/lib/planning-engine/gaps";
import { gapConsequence } from "@/components/gaps/gap-summary";
import {
  capacityEffectiveUtilizationPct,
  capacityFormalUtilizationPct,
  formatGapQuantity,
  formatReadinessCount,
  genericGapMetrics,
  genericGapSituation,
  isPercentUnit,
  leadTimeBasisLabel,
  lineDisplayName,
  planningCompleteness,
  summarizeBomReadiness,
  summarizeEvidence,
  worstCapacityImpact,
} from "./gap-metrics";
import { resolveLeadTimeBasis, resolveLeadTimeDays } from "@/lib/planning-engine/lead-times";
import { materialById } from "@/data/synthetic/materials";
import { lineById } from "@/data/synthetic/master-data";

const results = detectPlanningGaps();
const byId = (id: string): GapDetectionResult => {
  const r = results.find((x) => x.gap.id === id);
  if (!r) throw new Error(`No gap ${id}`);
  return r;
};

const halloween = byId("halloween-2027");
const line03 = byId("line-03-september-capacity");
const routing = byId("counter-display-line-mapping");
const valentines = byId("valentines-premium-tin");
const printedFilm = byId("printed-film-lead-time");

/* ================================================================== */
/* ITEM 10(a): ONE effective-utilization number across every surface    */
/* ================================================================== */

describe("item 10a — Line 03 effective utilization has exactly one value", () => {
  it("derives effective utilization as formal + unresolved, which is what the gap page shows", () => {
    // /gaps/line-03-september-capacity displays Formal and Unresolved. A
    // planner adding those two must land on the Effective figure.
    expect(capacityEffectiveUtilizationPct(line03.gap)).toBe(92.1);
    expect(capacityFormalUtilizationPct(line03.gap) + line03.gap.unresolvedValue).toBeCloseTo(capacityEffectiveUtilizationPct(line03.gap), 6);
  });

  it("agrees with the RCCP engine's own effectiveUtilization for the same bucket", () => {
    const impact = halloween.scenarioResult!.capacityImpact.find((c) => c.lineId === "line_03")!;
    expect(Math.abs(capacityEffectiveUtilizationPct(line03.gap) - impact.effectiveUtilization * 100)).toBeLessThanOrEqual(0.1);
  });

  it("is NOT the P80 — the regression that made /decisions say 98% while every other surface said 92%", () => {
    // The old code returned gap.expectedValueHigh (the P80 utilization) and
    // labelled it "effective". These are genuinely different statistics and
    // must never be swapped again.
    expect(capacityEffectiveUtilizationPct(line03.gap)).not.toBe(Math.round(line03.gap.expectedValueHigh));
    expect(line03.gap.expectedValueHigh).toBeGreaterThan(capacityEffectiveUtilizationPct(line03.gap));
  });

  it("the /decisions consequence line quotes that same number and never the P80", () => {
    const line = gapConsequence(line03);
    expect(line).toContain(`${capacityEffectiveUtilizationPct(line03.gap)}%`);
    expect(line).toContain(`${capacityFormalUtilizationPct(line03.gap)}% formal`);
    // The P80 must not appear at all in a line labelled "effective utilization".
    expect(line).not.toContain(`${Math.round(line03.gap.expectedValueHigh)}%`);
  });

  it("the generic gap workspace band and its situation line quote the same number", () => {
    const metrics = genericGapMetrics(line03.gap);
    const effective = metrics.find((m) => m.label === "Effective utilization");
    expect(effective?.value).toBe(`${capacityEffectiveUtilizationPct(line03.gap)}%`);
    expect(genericGapSituation(line03.gap)).toContain(`${capacityEffectiveUtilizationPct(line03.gap)}%`);
  });

  it("the demand gap's consequence line quotes the engine's effective utilization, not a second derivation", () => {
    const worst = worstCapacityImpact(halloween.scenarioResult)!;
    expect(worst.lineId).toBe("line_03");
    expect(gapConsequence(halloween)).toContain((worst.effectiveUtilization * 100).toFixed(1) + "%");
  });
});

/* ================================================================== */
/* ITEM 10(b): ONE BOM-readiness figure for the Valentine's tin         */
/* ================================================================== */

describe("item 10b — BOM readiness is one figure, and it is its own denominator", () => {
  const rows = valentines.scenarioResult!.materialReadiness;
  const summary = summarizeBomReadiness(rows);

  it("counts foot exactly to the number of component rows", () => {
    expect(summary.planNow + summary.review + summary.wait + summary.unknown).toBe(summary.total);
    expect(summary.total).toBe(rows.length);
  });

  it("planNowShare is reproducible from the two counts shown beside it", () => {
    expect(summary.planNowShare).toBeCloseTo(summary.planNow / summary.total, 10);
    expect(formatReadinessCount(summary)).toBe(`${summary.planNow} of ${summary.total}`);
  });

  it("does NOT expose an unweighted mean of confidences under a value-weighted name", () => {
    // The band used to render `mean(confidences)` as "BOM readiness" — 69% —
    // against the 65% gap confidence shown on /gaps, /gaps/product-readiness
    // and /decisions. The mean still exists, but only under a field named
    // for what it is, and no surface renders it as readiness.
    const mean = rows.reduce((s, r) => s + r.confidence, 0) / rows.length;
    expect(summary.meanComponentConfidence).toBeCloseTo(mean, 2);
    expect(summary.meanComponentConfidence).not.toBeCloseTo(valentines.gap.confidence.overall, 2);
    // The readiness figure the UI renders is the count, which cannot drift
    // from the gap confidence because it is not a confidence at all.
    expect(Number.isInteger(summary.planNow)).toBe(true);
  });

  it("the worklist consequence line and the readiness summary cannot disagree — same function", () => {
    const line = gapConsequence(valentines);
    expect(line).toContain(`${summary.planNow} of ${summary.total} components`);
    expect(line).toContain(`${summary.review} to review`);
    expect(line).toContain(`${summary.wait} to wait`);
  });
});

/* ================================================================== */
/* ITEM 11: completeness must be verifiable from what is on screen      */
/* ================================================================== */

describe("item 11 — planning completeness divides by a denominator that is on screen", () => {
  const s = halloween.scenarioResult!;
  const completeness = planningCompleteness(halloween.gap.formalValue, s.expectedDemandUnits.base);

  it("equals displayed numerator / displayed denominator", () => {
    expect(completeness.pct).toBeCloseTo((completeness.numerator / completeness.denominator) * 100, 1);
  });

  it("reports the P50 it actually used, not the P80 that used to sit beside it", () => {
    expect(completeness.denominator).toBe(s.expectedDemandUnits.base);
    expect(completeness.denominator).not.toBe(halloween.gap.expectedValueHigh);
    // The bug: dividing by the P80 that WAS on screen gave 76.9%, four points
    // off the printed 80%, and nothing explained the difference.
    const againstP80 = (completeness.numerator / halloween.gap.expectedValueHigh) * 100;
    expect(Math.abs(againstP80 - completeness.pct)).toBeGreaterThan(1);
  });

  it("matches the engine's own planningCompletenessPct, so the page cannot drift from calculateScenario()", () => {
    expect(completeness.pct).toBeCloseTo(s.planningCompletenessPct, 1);
  });

  it("spells the arithmetic out for the hover hint", () => {
    expect(completeness.derivation).toContain(completeness.numerator.toLocaleString());
    expect(completeness.derivation).toContain(completeness.denominator.toLocaleString());
    expect(completeness.derivation).toContain("P50");
  });

  it("clamps at 100% rather than reporting an over-plan as >100% complete", () => {
    expect(planningCompleteness(5_000, 4_000).pct).toBe(100);
    expect(planningCompleteness(1_000, 0).pct).toBe(100);
  });
});

/* ================================================================== */
/* ITEM 19: generic gap pages render their own units sensibly           */
/* ================================================================== */

describe("item 19 — generic gap workspaces render units, ranges and evidence honestly", () => {
  it("never emits a space between a number and a bare percent sign", () => {
    for (const r of results) {
      for (const m of genericGapMetrics(r.gap)) {
        expect(m.value).not.toMatch(/\d\s+%/);
      }
    }
    expect(formatGapQuantity(0, "%").value).toBe("0%");
    expect(formatGapQuantity(0, "% of execution").value).toBe("0%");
    expect(formatGapQuantity(84, "% of execution").qualifier).toBe("of execution");
    expect(isPercentUnit("% of execution")).toBe(true);
    expect(isPercentUnit("units")).toBe(false);
  });

  it("does not present the routing anomaly's share of execution as a plan quantity", () => {
    const labels = genericGapMetrics(routing.gap).map((m) => m.label);
    expect(labels).not.toContain("Formal");
    expect(labels).not.toContain("Unresolved");
    expect(labels).toContain("Routed work centre");
    expect(labels).toContain("Observed off the routed line");
  });

  it("does not double up the unit qualifier when building a hint", () => {
    // "% of execution" -> qualifier "of execution"; prefixing "Share of "
    // produced "Share of of execution the routing accounts for".
    for (const m of genericGapMetrics(routing.gap)) {
      expect(m.hint ?? "").not.toMatch(/\bof of\b/);
    }
  });

  it("renders the routing share as a real two-measurement range, not a degenerate 84–84", () => {
    expect(routing.gap.expectedValueLow).not.toBe(routing.gap.expectedValueHigh);
    const observed = genericGapMetrics(routing.gap).find((m) => m.label === "Observed off the routed line")!;
    expect(observed.value).toMatch(/^\d+(\.\d+)?–\d+(\.\d+)?%$/);
  });

  it("names work centres from master data, never a hard-coded 'Line 02'", () => {
    expect(lineDisplayName("line_02")).toBe(lineById("line_02").name);
    expect(lineDisplayName("line_03")).toBe(lineById("line_03").name);
    const routed = genericGapMetrics(routing.gap).find((m) => m.label === "Routed work centre")!;
    expect(routed.value).toBe(lineById("line_02").name);
    expect(routed.value).not.toMatch(/^Line \d+$/);
  });

  it("gives every generic gap a situation line that is NOT a copy of its planning basis", () => {
    for (const r of [line03, routing, byId("holiday-gift-tins-representation")]) {
      const situation = genericGapSituation(r.gap);
      expect(situation).not.toBe(r.planningBasis.whySelected);
      expect(situation.length).toBeGreaterThan(40);
    }
  });

  it("the capacity gap's situation line is about capacity, not copy-pasted Halloween demand text", () => {
    const situation = genericGapSituation(line03.gap);
    expect(situation).toContain(lineById("line_03").name);
    expect(situation).toContain("effective load");
    expect(situation).not.toBe(halloween.planningBasis.whySelected);
  });

  it("both generic gaps that reported EVIDENCE (0) now carry real evidence rows", () => {
    expect(line03.evidence.length).toBeGreaterThan(0);
    expect(routing.evidence.length).toBeGreaterThan(0);
    for (const r of results) {
      const s = summarizeEvidence(r.evidence);
      expect(s.included + s.excluded).toBe(s.total);
      expect(s.total).toBe(r.evidence.length);
    }
  });
});

/* ================================================================== */
/* ITEM 20: the Halloween BOM honours the ACCEPTED lead-time basis      */
/* ================================================================== */

describe("item 20 — one lead-time basis for Printed Seasonal Film across both workspaces", () => {
  const film = materialById("mat_printed_film");
  const filmRow = halloween.scenarioResult!.materialReadiness.find((m) => m.materialId === "mat_printed_film")!;

  it("uses the accepted historical P80, not the ERP norm", () => {
    expect(filmRow.leadTimeDaysUsed).toBe(printedFilm.gap.expectedValueHigh);
    expect(filmRow.leadTimeDaysUsed).not.toBe(film.systemLeadTimeDays);
  });

  it("LABELS it as the historical P80 — the number and the basis can no longer disagree", () => {
    // Previously hard-coded to "system" in partialBomExplosion, so the
    // Halloween workspace showed the accepted 74-day P80 under a label that
    // pointed at the 42-day ERP norm the lead-time workspace had rejected.
    expect(filmRow.leadTimeBasis).toBe("historical_p80");
    expect(leadTimeBasisLabel(filmRow.leadTimeBasis)).toBe("historical P80");
    // `.replace("_", " ")` only replaced the first underscore.
    expect(leadTimeBasisLabel("historical_p80")).not.toContain("_");
    expect(leadTimeBasisLabel("historical_median")).toBe("historical median");
  });

  it("produces the same order-by date as the lead-time workspace's active basis", () => {
    const productionEnd = "2027-07-31";
    const expected = new Date(productionEnd);
    expected.setUTCDate(expected.getUTCDate() - printedFilm.gap.expectedValueHigh);
    expect(filmRow.earliestDecisionDate).toBe(expected.toISOString().slice(0, 10));
  });

  it("resolveLeadTimeBasis reports the basis resolveLeadTimeDays actually used, for every basis", () => {
    const observedP80 = printedFilm.gap.expectedValueHigh;
    const cases = [
      { override: undefined, days: film.systemLeadTimeDays, basis: "system" },
      { override: { selectedBasis: "system" as const }, days: film.systemLeadTimeDays, basis: "system" },
      { override: { selectedBasis: "historical" as const, leadTimeStatistic: "p80" as const }, days: observedP80, basis: "historical_p80" },
      { override: { selectedBasis: "historical" as const, leadTimeStatistic: "median" as const }, days: film.historicalMedianLeadTimeDays, basis: "historical_median" },
      { override: { selectedBasis: "scenario" as const, scenarioValue: 55 }, days: 55, basis: "scenario" },
    ];
    for (const c of cases) {
      expect(resolveLeadTimeDays(film, observedP80, c.override)).toBe(c.days);
      expect(resolveLeadTimeBasis(c.override)).toBe(c.basis);
    }
  });

  it("materials with no accepted correction still report the system basis", () => {
    const cocoa = halloween.scenarioResult!.materialReadiness.find((m) => m.materialId === "mat_cocoa")!;
    expect(cocoa.leadTimeBasis).toBe("system");
    expect(cocoa.leadTimeDaysUsed).toBe(materialById("mat_cocoa").systemLeadTimeDays);
  });
});

/* ================================================================== */
/* Cross-surface coherence sweep                                        */
/* ================================================================== */

describe("no gap renders a metric it cannot derive", () => {
  it("every generic metric band has a value and no NaN/undefined leaking into the string", () => {
    for (const r of results) {
      for (const m of genericGapMetrics(r.gap)) {
        expect(m.label.length).toBeGreaterThan(0);
        expect(m.value).toBeTruthy();
        expect(m.value).not.toContain("NaN");
        expect(m.value).not.toContain("undefined");
      }
      expect(genericGapSituation(r.gap)).not.toContain("NaN");
    }
  });

  it("every gap's worklist consequence line is populated and free of hard-coded line names", () => {
    for (const r of results) {
      const line = gapConsequence(r);
      expect(line).not.toBe("—");
      expect(line).not.toContain("NaN");
      expect(line).not.toMatch(/\bLine 0\d\b/);
    }
  });
});
