import { describe, it, expect } from "vitest";
import { buildGapChartModel, type GapChartRowInput } from "./gap-chart-model";

const ROWS: GapChartRowInput[] = [
  { period: "Halloween 2024", actual: 3_950_000 },
  { period: "Halloween 2025", actual: 4_180_000 },
  { period: "Halloween 2026", actual: 4_400_000 },
  { period: "Halloween 2027", low: 4_561_920, base: 4_752_000, high: 4_942_080 },
];

describe("gap chart model — a readable y scale", () => {
  it("uses round gridline values a planner can read a number off", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    expect(model.axis.ticks.every((t) => t % model.axis.step === 0)).toBe(true);
    expect(model.axis.max).toBeGreaterThanOrEqual(4_942_080);
    expect(model.axis.ticks[0]).toBe(0);
  });

  it("keeps every drawn element inside the plot box", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    for (const r of model.rows) {
      if (r.actualHeightPct != null) {
        expect(r.actualHeightPct).toBeGreaterThan(0);
        expect(r.actualHeightPct).toBeLessThanOrEqual(100);
      }
      if (r.range) {
        expect(r.range.topPct).toBeGreaterThanOrEqual(0);
        expect(r.range.topPct + r.range.heightPct).toBeLessThanOrEqual(100.001);
        expect(r.range.labelTopPct).toBeGreaterThanOrEqual(0);
        expect(r.range.baseOffsetPct!).toBeGreaterThanOrEqual(0);
        expect(r.range.baseOffsetPct!).toBeLessThanOrEqual(r.range.heightPct + 0.001);
      }
    }
    expect(model.formal.topPct).toBeGreaterThanOrEqual(0);
    expect(model.formal.topPct).toBeLessThanOrEqual(100);
  });

  it("bar length encodes the value it is drawn for", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    const a = model.rows[0]!;
    const b = model.rows[2]!;
    expect(a.actualHeightPct!).toBeCloseTo((a.actual! / model.axis.max) * 100, 6);
    expect(b.actualHeightPct!).toBeGreaterThan(a.actualHeightPct!);
    const band = model.rows[3]!.range!;
    expect(band.heightPct).toBeCloseTo(((band.high - band.low) / model.axis.max) * 100, 6);
  });

  it("moves the formal-plan caption below its line when the line is at the top of the box", () => {
    const low = buildGapChartModel(ROWS, 3_800_000);
    expect(low.formal.labelBelow).toBe(false);
    // a case where the nice axis lands tight against the data, pushing the
    // formal line into the top caption band
    const tight = buildGapChartModel([{ period: "p", actual: 5300 }], 5300);
    expect(tight.formal.topPct).toBeLessThan(12);
    expect(tight.formal.labelBelow).toBe(true);
  });
});

describe("gap chart model — legend honesty", () => {
  it("advertises only the series that are actually drawn", () => {
    expect(buildGapChartModel(ROWS, 3_800_000).legend).toEqual({ historical: true, range: true, base: true, formal: true });
  });

  it("drops 'Historical actual' when no row carries one", () => {
    const legend = buildGapChartModel([{ period: "p", low: 10, high: 20, base: 15 }], 12).legend;
    expect(legend.historical).toBe(false);
    expect(legend.range).toBe(true);
  });

  it("does not claim 'P50 marked' when no P50 point exists", () => {
    const legend = buildGapChartModel([{ period: "p", low: 10, high: 20 }], 12).legend;
    expect(legend.range).toBe(true);
    expect(legend.base).toBe(false);
  });

  it("drops the range entry entirely when there is no envelope", () => {
    const legend = buildGapChartModel([{ period: "p", actual: 10 }], 12).legend;
    expect(legend.range).toBe(false);
    expect(legend.base).toBe(false);
  });
});

describe("gap chart model — degenerate input", () => {
  it("produces finite geometry for empty data", () => {
    const model = buildGapChartModel([], 0);
    expect(model.rows).toEqual([]);
    expect(Number.isFinite(model.axis.max)).toBe(true);
    expect(Number.isFinite(model.formal.topPct)).toBe(true);
    expect(model.legend.formal).toBe(false);
  });

  it("gives a degenerate low===high band a visible minimum height", () => {
    const model = buildGapChartModel([{ period: "p", low: 100, high: 100 }], 50);
    expect(model.rows[0]!.range!.heightPct).toBeGreaterThan(0);
  });
});
