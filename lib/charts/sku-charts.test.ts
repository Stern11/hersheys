import { describe, it, expect } from "vitest";
import { buildLineLoadChart, buildMaterialClock } from "./sku-charts";
import type { SkuLineLoad, SkuMaterialNeed } from "@/lib/situations/sku-impact";

function line(partial: Partial<SkuLineLoad> & { lineId: string }): SkuLineLoad {
  const peak = {
    period: "2027-06",
    thisItemHours: 100,
    effectiveHours: 400,
    availableHours: 500,
    targetHours: 450,
    effectiveUtilization: 0.8,
    ...partial.peak,
  };
  return {
    lineName: `Line ${partial.lineId}`,
    plant: "PLT-01",
    hours: peak.thisItemHours,
    shareOfUnresolved: 0.5,
    byPeriod: [{ period: peak.period, hours: peak.thisItemHours }],
    isExposed: false,
    peakEffectiveUtilization: peak.effectiveUtilization,
    ...partial,
    peak,
  };
}

describe("buildLineLoadChart", () => {
  it("is empty for no lines rather than throwing", () => {
    const chart = buildLineLoadChart([]);
    expect(chart.bars).toEqual([]);
    expect(chart.anyPushedOver).toBe(false);
  });

  it("scales every line against one axis, so bars are comparable between rows", () => {
    const chart = buildLineLoadChart([
      line({ lineId: "A", peak: { availableHours: 500, effectiveHours: 400, thisItemHours: 100, targetHours: 450, period: "2027-06", effectiveUtilization: 0.8 } }),
      line({ lineId: "B", peak: { availableHours: 200, effectiveHours: 100, thisItemHours: 20, targetHours: 180, period: "2027-06", effectiveUtilization: 0.5 } }),
    ]);
    // The axis covers the largest ceiling, so the small line reads as small
    // rather than filling its own row.
    expect(chart.axis.max).toBeGreaterThanOrEqual(500);
    const [a, b] = chart.bars;
    expect(a!.ceilingPct).toBeGreaterThan(b!.ceilingPct);
  });

  it("splits the bar into what was already there and what this item adds", () => {
    const chart = buildLineLoadChart([
      line({ lineId: "A", peak: { availableHours: 500, effectiveHours: 400, thisItemHours: 120, targetHours: 450, period: "2027-06", effectiveUtilization: 0.8 } }),
    ]);
    const bar = chart.bars[0]!;
    expect(bar.thisItemHours).toBe(120);
    expect(bar.otherHours).toBe(280);
    // The two segments together are the whole bar — no gap, no overlap.
    expect(bar.otherPct + bar.thisItemPct).toBeCloseTo((400 / chart.axis.max) * 100, 6);
  });

  it("names the case where this item alone takes the line past target", () => {
    const chart = buildLineLoadChart([
      // 430 already, under the 450 target; this item's 60 takes it to 490.
      line({ lineId: "A", peak: { availableHours: 500, effectiveHours: 490, thisItemHours: 60, targetHours: 450, period: "2027-06", effectiveUtilization: 0.98 } }),
    ]);
    const bar = chart.bars[0]!;
    expect(bar.overTarget).toBe(true);
    expect(bar.pushedOverByThisItem).toBe(true);
    expect(chart.anyPushedOver).toBe(true);
  });

  it("does not blame this item for a line that was already over", () => {
    const chart = buildLineLoadChart([
      // 460 already exceeds the 450 target before this item's 30 is counted.
      line({ lineId: "A", peak: { availableHours: 500, effectiveHours: 490, thisItemHours: 30, targetHours: 450, period: "2027-06", effectiveUtilization: 0.98 } }),
    ]);
    const bar = chart.bars[0]!;
    expect(bar.overTarget).toBe(true);
    expect(bar.pushedOverByThisItem).toBe(false);
  });

  it("never lets a bar overflow its track", () => {
    const chart = buildLineLoadChart([
      line({ lineId: "A", peak: { availableHours: 100, effectiveHours: 900, thisItemHours: 800, targetHours: 90, period: "2027-06", effectiveUtilization: 9 } }),
    ]);
    const bar = chart.bars[0]!;
    expect(bar.otherPct + bar.thisItemPct).toBeLessThanOrEqual(100.000001);
    expect(bar.ceilingPct).toBeLessThanOrEqual(100);
  });
});

function material(partial: Partial<SkuMaterialNeed> & { materialId: string }): SkuMaterialNeed {
  return {
    materialName: `Component ${partial.materialId}`,
    componentType: "RAW_MATERIAL",
    uom: "kg",
    requirement: 1000,
    shareOfTotal: 0.5,
    leadTimeDays: 40,
    leadTimeBasis: "system",
    decisionDate: "2027-05-01",
    weeksToDecision: 8,
    status: "PLAN_NOW",
    sourcing: "shared",
    standsWithoutThisItem: true,
    ...partial,
  };
}

describe("buildMaterialClock", () => {
  const today = "2027-03-08";

  it("is undefined with nothing to place", () => {
    expect(buildMaterialClock([], today, "2027-07-01")).toBeUndefined();
  });

  it("orders marks by date and names the one that binds", () => {
    const clock = buildMaterialClock(
      [
        material({ materialId: "late", decisionDate: "2027-06-01", weeksToDecision: 12 }),
        material({ materialId: "early", decisionDate: "2027-04-01", weeksToDecision: 3 }),
        material({ materialId: "mid", decisionDate: "2027-05-01", weeksToDecision: 8 }),
      ],
      today,
      "2027-07-01"
    )!;
    expect(clock.marks.map((m) => m.materialId)).toEqual(["early", "mid", "late"]);
    expect(clock.binding?.materialId).toBe("early");
    expect(clock.marks.filter((m) => m.isBinding)).toHaveLength(1);
  });

  it("keeps every mark inside the axis", () => {
    const clock = buildMaterialClock(
      [
        material({ materialId: "a", decisionDate: "2027-03-20" }),
        material({ materialId: "b", decisionDate: "2027-06-25" }),
      ],
      today,
      "2027-07-01"
    )!;
    for (const mark of clock.marks) {
      expect(mark.datePct).toBeGreaterThanOrEqual(0);
      expect(mark.datePct).toBeLessThanOrEqual(100);
    }
    expect(clock.todayPct).toBeGreaterThanOrEqual(0);
    expect(clock.todayPct).toBeLessThanOrEqual(100);
  });

  it("keeps an overdue date visible rather than clamping it to today", () => {
    const clock = buildMaterialClock(
      [
        material({ materialId: "overdue", decisionDate: "2027-01-15", weeksToDecision: -7 }),
        material({ materialId: "ok", decisionDate: "2027-05-01" }),
      ],
      today,
      "2027-07-01"
    )!;
    const overdue = clock.marks.find((m) => m.materialId === "overdue")!;
    expect(overdue.overdue).toBe(true);
    // It has to sit left of today, and still be on the chart.
    expect(overdue.datePct).toBeLessThan(clock.todayPct);
    expect(overdue.datePct).toBeGreaterThanOrEqual(0);
    expect(overdue.isBinding).toBe(true);
  });

  it("gives month gridlines across the window without running away", () => {
    const clock = buildMaterialClock(
      [material({ materialId: "a", decisionDate: "2027-05-01" })],
      today,
      "2027-07-01"
    )!;
    expect(clock.ticks.length).toBeGreaterThan(0);
    expect(clock.ticks.length).toBeLessThan(60);
    for (const tick of clock.ticks) {
      expect(tick.pct).toBeGreaterThanOrEqual(0);
      expect(tick.pct).toBeLessThanOrEqual(100);
    }
  });

  it("does not crash on an unparseable date", () => {
    expect(buildMaterialClock([material({ materialId: "a" })], "not-a-date", "2027-07-01")).toBeUndefined();
  });
});
