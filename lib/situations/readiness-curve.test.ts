import { describe, it, expect } from "vitest";
import { generateDemoDataset } from "@/lib/dataset/demo/generate";
import { buildSituations } from "./build";
import { buildReadinessCurve } from "./readiness-curve";

const DATASET = generateDemoDataset({ planningNow: "2027-03-08T09:00:00.000Z" });

function situations() {
  return buildSituations(DATASET);
}

describe("buildReadinessCurve", () => {
  it("reads today's percentage from real candidate matching, 0-1", () => {
    for (const s of situations()) {
      const curve = buildReadinessCurve(s, DATASET);
      if (curve.todayPct !== undefined) {
        expect(curve.todayPct).toBeGreaterThanOrEqual(0);
        expect(curve.todayPct).toBeLessThanOrEqual(1);
      }
    }
  });

  it("has readiness history available for the demo dataset, sorted earliest-first", () => {
    const s = situations()[0]!;
    const curve = buildReadinessCurve(s, DATASET);
    expect(curve.historyAvailable).toBe(true);
    expect(curve.currentSeasonHistory.length + curve.priorSeasonPace.length).toBeGreaterThan(0);

    for (const series of [curve.currentSeasonHistory, curve.priorSeasonPace]) {
      const weeks = series.map((p) => p.weeksBeforeProductionStart);
      expect(weeks).toEqual([...weeks].sort((a, b) => b - a));
      for (const point of series) {
        expect(point.representedPct).toBeGreaterThanOrEqual(0);
        expect(point.representedPct).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never invents a prior-season pace when there is no comparable prior period", () => {
    const s = situations()[0]!;
    // Fabricate a dataset that reports the capability off, as an upload
    // without the sheet would.
    const withoutHistory = {
      ...DATASET,
      readinessHistory: [],
      metadata: { ...DATASET.metadata, capabilities: { ...DATASET.metadata.capabilities, readinessHistory: false } },
    };
    const curve = buildReadinessCurve(s, withoutHistory);
    expect(curve.historyAvailable).toBe(false);
    expect(curve.currentSeasonHistory).toEqual([]);
    expect(curve.priorSeasonPace).toEqual([]);
    expect(curve.historyUnavailableReason).toBeTruthy();
  });

  it("reuses the situation's own runway rather than recomputing a deadline", () => {
    for (const s of situations()) {
      const curve = buildReadinessCurve(s, DATASET);
      expect(curve.dropDeadDate).toBe(s.runway.earliest?.date);
      expect(curve.runwayWeeks).toBe(s.runway.weeksOfRunway);
    }
  });

  it("names a constraining material only when the situation has unrepresented candidates and a BOM/analogue picture", () => {
    for (const s of situations()) {
      const curve = buildReadinessCurve(s, DATASET);
      const hasUnrepresented = s.candidateItems.some((c) => c.match.matchedItemId === undefined);
      if (!hasUnrepresented) {
        expect(curve.constrainingMaterial).toBeUndefined();
      }
      if (curve.constrainingMaterial) {
        expect(curve.constrainingMaterial.itemCount).toBeGreaterThan(0);
        expect(curve.constrainingMaterial.leadTimeDays).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
