import { describe, it, expect } from "vitest";
import type { CapacityImpactByLine } from "@/types/scenario";
import {
  CAPACITY_SERIES,
  buildCapacityChartModel,
  capacityRunRate,
  formalContrastNote,
  riskLevelExplanation,
  riskToken,
  runRateSourceLabel,
  totalLoadHours,
  unitsAtRunRate,
  visibleCapacitySeries,
} from "./capacity-chart-model";
import { lineDisplayName } from "./line-label";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";

function row(partial: Partial<CapacityImpactByLine> & { lineId: string }): CapacityImpactByLine {
  const ceilingHours = partial.ceilingHours ?? 380;
  const formalLoadHours = partial.formalLoadHours ?? 266;
  const validatedUnresolvedLoadHours = partial.validatedUnresolvedLoadHours ?? 22;
  const aiInferredLoadHours = partial.aiInferredLoadHours ?? 61.9;
  const scenarioAdjustmentHours = partial.scenarioAdjustmentHours ?? 0;
  const load = formalLoadHours + validatedUnresolvedLoadHours + aiInferredLoadHours + scenarioAdjustmentHours;
  return {
    lineId: partial.lineId,
    period: partial.period ?? "2027-06",
    ceilingHours,
    targetUtilization: partial.targetUtilization ?? 0.9,
    formalLoadHours,
    validatedUnresolvedLoadHours,
    aiInferredLoadHours,
    scenarioAdjustmentHours,
    formalUtilization: formalLoadHours / ceilingHours,
    effectiveUtilization: load / ceilingHours,
    p50Utilization: load / ceilingHours,
    p80Utilization: (load * 1.06) / ceilingHours,
    riskLevel: partial.riskLevel ?? "warning",
    runRateUnitsPerHour: partial.runRateUnitsPerHour ?? 10_000,
    runRateBasis: partial.runRateBasis ?? "system",
    runRateSource: partial.runRateSource ?? "line_standard",
  };
}

const THREE_LINES = [
  row({ lineId: "line_01", ceilingHours: 405, formalLoadHours: 230, validatedUnresolvedLoadHours: 10, aiInferredLoadHours: 26.4, riskLevel: "positive" }),
  row({ lineId: "line_03" }),
  row({ lineId: "line_04", ceilingHours: 370, formalLoadHours: 150, validatedUnresolvedLoadHours: 0, aiInferredLoadHours: 14.6, riskLevel: "positive" }),
];

describe("capacity chart model — one shared hours axis", () => {
  it("exposes a single labelled axis that covers every row's ceiling and load", () => {
    const model = buildCapacityChartModel(THREE_LINES);
    expect(model.axis.ticks.length).toBeGreaterThanOrEqual(3);
    expect(model.axis.ticks[0]).toBe(0);
    for (const r of model.rows) {
      expect(model.axis.max).toBeGreaterThanOrEqual(r.ceilingHours);
      expect(model.axis.max).toBeGreaterThanOrEqual(r.loadHours);
      // strictly greater, so the tallest ceiling marker is not flush with the edge
      expect(r.ceilingPct).toBeLessThan(100);
    }
  });

  it("every bar geometry is a percentage of THAT axis, so rows are comparable", () => {
    const model = buildCapacityChartModel(THREE_LINES);
    for (const r of model.rows) {
      expect(r.loadPct).toBeCloseTo((r.loadHours / model.axis.max) * 100, 6);
      expect(r.ceilingPct).toBeCloseTo((r.ceilingHours / model.axis.max) * 100, 6);
      expect(r.targetPct).toBeCloseTo(r.ceilingPct * r.targetUtilization, 6);
      // segments tile the load without gaps or overlap
      const last = r.segments[r.segments.length - 1]!;
      expect(last.leftPct + last.widthPct).toBeCloseTo(r.loadPct, 6);
      let cursor = 0;
      for (const s of r.segments) {
        expect(s.leftPct).toBeCloseTo(cursor, 6);
        cursor += s.widthPct;
      }
    }
  });

  it("a row with more hours is drawn longer than a row with fewer — across rows", () => {
    const model = buildCapacityChartModel(THREE_LINES);
    const byLine = new Map(model.rows.map((r) => [r.lineId, r]));
    const l1 = byLine.get("line_01")!;
    const l3 = byLine.get("line_03")!;
    const l4 = byLine.get("line_04")!;
    expect(l3.loadHours).toBeGreaterThan(l1.loadHours);
    expect(l3.loadPct).toBeGreaterThan(l1.loadPct);
    expect(l1.loadHours).toBeGreaterThan(l4.loadHours);
    expect(l1.loadPct).toBeGreaterThan(l4.loadPct);
  });

  it("the printed percentage is reproducible from the row's own printed hours", () => {
    // This is the invariant that makes the bar cross-checkable: a planner can
    // divide the two numbers the row shows and land on the label.
    const model = buildCapacityChartModel(THREE_LINES);
    for (const r of model.rows) {
      expect(r.loadHours / r.ceilingHours).toBeCloseTo(r.effectiveUtilization, 3);
      expect(r.targetHours).toBeCloseTo(r.ceilingHours * r.targetUtilization, 1);
    }
  });
});

describe("capacity chart model — legend honesty", () => {
  it("drops a series that is zero on every row", () => {
    const visible = visibleCapacitySeries(THREE_LINES);
    expect(visible.map((s) => s.key)).toEqual(["formal", "validated", "inferred"]);
    expect(visible.some((s) => s.key === "scenario")).toBe(false);
  });

  it("shows the scenario series as soon as ONE row carries scenario hours", () => {
    const withPrebuild = [...THREE_LINES, row({ lineId: "line_03", period: "2027-07", scenarioAdjustmentHours: 20 })];
    expect(visibleCapacitySeries(withPrebuild).map((s) => s.key)).toContain("scenario");
    const model = buildCapacityChartModel(withPrebuild);
    const scenarioRow = model.rows.find((r) => r.period === "2027-07")!;
    expect(scenarioRow.segments.some((s) => s.key === "scenario")).toBe(true);
  });

  it("never emits a zero-width segment node", () => {
    const model = buildCapacityChartModel(THREE_LINES);
    for (const r of model.rows) {
      expect(r.segments.every((s) => s.hours > 0 && s.widthPct > 0)).toBe(true);
    }
    // line_04 has no validated-unresolved hours at all
    const l4 = model.rows.find((r) => r.lineId === "line_04")!;
    expect(l4.segments.some((s) => s.key === "validated")).toBe(false);
  });

  it("data series use --state-* tokens and status uses --risk-*, never crossed", () => {
    const model = buildCapacityChartModel(THREE_LINES);
    for (const r of model.rows) {
      for (const s of r.segments) expect(s.token.startsWith("--state-")).toBe(true);
      expect(riskToken(r.riskLevel).startsWith("--risk-")).toBe(true);
    }
  });
});

describe("capacity chart model — line identity comes from the data layer", () => {
  it("uses the real plant/line names, never a 'Line 0N' string transform", () => {
    const model = buildCapacityChartModel(THREE_LINES);
    const labels = model.rows.map((r) => r.lineLabel);
    expect(labels).toEqual(["Reese L01", "Stuarts Draft L03", "West Hershey L04"]);
    expect(labels.some((l) => /^Line \d/.test(l))).toBe(false);
    expect(model.rows[1]!.plant).toBe("Stuarts Draft, VA");
  });

  it("falls back to the raw id for an unknown line rather than inventing a name", () => {
    expect(lineDisplayName("line_99")).toBe("line_99");
  });
});

describe("capacity chart model — degenerate input", () => {
  it("handles an all-zero row without NaN geometry", () => {
    const zero = row({ lineId: "line_02", ceilingHours: 0, formalLoadHours: 0, validatedUnresolvedLoadHours: 0, aiInferredLoadHours: 0 });
    const model = buildCapacityChartModel([zero]);
    expect(totalLoadHours(zero)).toBe(0);
    expect(model.rows[0]!.segments).toEqual([]);
    expect(Number.isFinite(model.rows[0]!.loadPct)).toBe(true);
    expect(Number.isFinite(model.axis.max)).toBe(true);
  });
});

describe("capacity chart model — the formal-vs-effective contrast", () => {
  const model = buildCapacityChartModel(THREE_LINES);
  const byLine = new Map(model.rows.map((r) => [r.lineId, r]));

  it("splits load into the part the formal plan can see and the part it cannot", () => {
    for (const r of model.rows) {
      expect(r.formalHours + r.unresolvedHours).toBeCloseTo(r.loadHours, 6);
      const nonFormal = r.segments.filter((s) => s.key !== "formal").reduce((sum, s) => sum + s.hours, 0);
      expect(r.unresolvedHours).toBeCloseTo(nonFormal, 6);
    }
  });

  it("utilizationDelta is exactly the gap between the two printed percentages", () => {
    for (const r of model.rows) {
      expect(r.utilizationDelta).toBeCloseTo(r.effectiveUtilization - r.formalUtilization, 6);
      // and it is reproducible from the row's own hours
      expect(r.utilizationDelta).toBeCloseTo(r.unresolvedHours / r.ceilingHours, 2);
    }
  });

  it("flags the 'only looks safe' line: formal alone clears the target, effective does not", () => {
    const l3 = byLine.get("line_03")!;
    expect(l3.formalCrossesTarget).toBe(false);
    expect(l3.crossesTarget).toBe(true);
    expect(l3.crossesCeiling).toBe(false);
    expect(l3.overTargetHours).toBeCloseTo(l3.loadHours - l3.targetHours, 6);
    expect(formalContrastNote(l3)).toContain("only looks safe");
  });

  it("does not make the 'only looks safe' claim about a line that is under target", () => {
    const l1 = byLine.get("line_01")!;
    expect(l1.crossesTarget).toBe(false);
    expect(l1.overTargetHours).toBe(0);
    expect(l1.headroomHours).toBeCloseTo(l1.ceilingHours - l1.loadHours, 6);
    expect(formalContrastNote(l1)).not.toContain("only looks safe");
  });

  it("says so plainly when there is no unresolved load to contrast against", () => {
    const allFormal = buildCapacityChartModel([
      row({ lineId: "line_01", formalLoadHours: 200, validatedUnresolvedLoadHours: 0, aiInferredLoadHours: 0, riskLevel: "positive" }),
    ]).rows[0]!;
    expect(allFormal.unresolvedHours).toBe(0);
    expect(allFormal.utilizationDelta).toBeCloseTo(0, 6);
    expect(formalContrastNote(allFormal)).toContain("same number");
  });
});

describe("capacity chart model — row status treatment", () => {
  it("atRisk mirrors the engine's risk level and never touches a state token", () => {
    const model = buildCapacityChartModel(THREE_LINES);
    for (const r of model.rows) {
      expect(r.atRisk).toBe(r.riskLevel !== "positive");
      expect(r.risk.startsWith("--risk-")).toBe(true);
    }
    expect(model.anyAtRisk).toBe(true);
    expect(model.rows.find((r) => r.lineId === "line_03")!.atRisk).toBe(true);
    expect(model.rows.find((r) => r.lineId === "line_01")!.atRisk).toBe(false);
  });

  it("anyAtRisk is false when every line is within target, so the status legend entry drops", () => {
    const calm = buildCapacityChartModel([row({ lineId: "line_01", riskLevel: "positive" })]);
    expect(calm.anyAtRisk).toBe(false);
  });

  it("explains each risk level rather than leaving the tint undecodable", () => {
    expect(riskLevelExplanation("critical")).toContain("ceiling");
    expect(riskLevelExplanation("warning")).toContain("target");
    expect(riskLevelExplanation("positive")).toContain("target");
  });
});

describe("capacity chart model — what the hover adds", () => {
  const model = buildCapacityChartModel(THREE_LINES);

  it("gives every segment its share of the ceiling and the running total through it", () => {
    for (const r of model.rows) {
      let running = 0;
      for (const s of r.segments) {
        running += s.hours;
        expect(s.cumulativeHours).toBeCloseTo(running, 6);
        expect(s.shareOfCeiling).toBeCloseTo(s.hours / r.ceilingHours, 6);
        expect(s.cumulativeUtilization).toBeCloseTo(running / r.ceilingHours, 6);
      }
      const last = r.segments[r.segments.length - 1];
      if (last) expect(last.cumulativeUtilization).toBeCloseTo(r.effectiveUtilization, 3);
    }
  });

  it("converts hours back to units through the row's OWN run rate", () => {
    const l1 = model.rows.find((r) => r.lineId === "line_01")!;
    expect(l1.runRateUnitsPerHour).toBe(10_000);
    expect(l1.runRateSource).toBe("line standard rate");
    const formal = l1.segments.find((s) => s.key === "formal")!;
    expect(formal.units).toBe(230 * 10_000);
    expect(l1.unresolvedUnits).toBe(Math.round(l1.unresolvedHours * 10_000));
  });

  it("returns null instead of inventing units when the row carries no run rate", () => {
    const noRate = { ...row({ lineId: "line_01" }), runRateUnitsPerHour: undefined, runRateSource: undefined };
    expect(capacityRunRate(noRate)).toBeNull();
    expect(runRateSourceLabel(noRate)).toBeNull();
    expect(unitsAtRunRate(100, null)).toBeNull();
    const built = buildCapacityChartModel([noRate]).rows[0]!;
    expect(built.runRateUnitsPerHour).toBeNull();
    expect(built.unresolvedUnits).toBeNull();
    expect(built.segments.every((s) => s.units === null)).toBe(true);
  });

  it("rejects a zero or negative run rate rather than dividing by it", () => {
    expect(capacityRunRate({ ...row({ lineId: "line_01" }), runRateUnitsPerHour: 0 })).toBeNull();
    expect(capacityRunRate({ ...row({ lineId: "line_01" }), runRateUnitsPerHour: -5 })).toBeNull();
  });

  it("every series carries a planning-terms meaning, so no tooltip just restates its label", () => {
    for (const s of CAPACITY_SERIES) {
      expect(s.meaning.length).toBeGreaterThan(40);
      expect(s.meaning.toLowerCase()).not.toBe(s.label.toLowerCase());
    }
  });

  it("segment index drives the separator, so only the first segment draws none", () => {
    for (const r of model.rows) {
      expect(r.segments.map((s) => s.index)).toEqual(r.segments.map((_, i) => i));
    }
  });

  it("formalPct sits on the shared axis and never past the row's own load", () => {
    for (const r of model.rows) {
      expect(r.formalPct).toBeCloseTo((r.formalHours / model.axis.max) * 100, 6);
      expect(r.formalPct).toBeLessThanOrEqual(r.loadPct + 1e-9);
    }
  });
});

describe("capacity chart model — against real engine output", () => {
  const halloween = detectPlanningGaps().find((r) => r.gap.id === "halloween-2027")!;
  const impact = halloween.scenarioResult!.capacityImpact;

  it("scenarioAdjustmentHours is zero on every baseline row, so its legend entry is suppressed", () => {
    // Regression guard for the dead 'Scenario adjustment' swatch: the engine
    // only populates this from CapacityOverride.prebuildQuantityUnits.
    expect(impact.every((c) => c.scenarioAdjustmentHours === 0)).toBe(true);
    expect(visibleCapacitySeries(impact).some((s) => s.key === "scenario")).toBe(false);
  });

  it("renders the real Hershey line names for the engine's rows", () => {
    const model = buildCapacityChartModel(impact);
    expect(model.rows.map((r) => r.lineLabel)).toEqual(["Reese L01", "Stuarts Draft L03", "West Hershey L04"]);
  });

  it("each engine row's utilization matches the hours the chart prints beside it", () => {
    const model = buildCapacityChartModel(impact);
    for (const r of model.rows) {
      expect(r.loadHours / r.ceilingHours).toBeCloseTo(r.effectiveUtilization, 3);
    }
  });

  it("the constraint line really is the 'formal looks safe, effective does not' case the section claims", () => {
    // The section subtitle asserts this about Stuarts Draft L03. If the engine
    // ever stops producing that situation, the chip's sentence would be a lie —
    // so it is asserted rather than assumed.
    const model = buildCapacityChartModel(impact);
    const l3 = model.rows.find((r) => r.lineId === "line_03")!;
    expect(l3.formalCrossesTarget).toBe(false);
    expect(l3.crossesTarget).toBe(true);
    expect(l3.atRisk).toBe(true);
    expect(l3.utilizationDelta).toBeGreaterThan(0);
    expect(formalContrastNote(l3)).toContain("only looks safe");
  });

  it("the engine supplies a run rate, so the hour->unit tooltip rows are real", () => {
    const model = buildCapacityChartModel(impact);
    for (const r of model.rows) {
      expect(r.runRateUnitsPerHour).not.toBeNull();
      expect(r.segments.every((s) => s.units !== null)).toBe(true);
    }
  });
});
