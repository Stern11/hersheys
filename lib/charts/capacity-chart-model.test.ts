import { describe, it, expect } from "vitest";
import type { CapacityImpactByLine } from "@/types/scenario";
import { buildCapacityChartModel, riskToken, totalLoadHours, visibleCapacitySeries } from "./capacity-chart-model";
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
});
