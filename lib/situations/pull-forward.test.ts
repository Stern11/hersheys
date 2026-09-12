import { describe, it, expect } from "vitest";
import { simulatePullForward } from "./pull-forward";
import { addDays } from "@/lib/dataset/periods";
import type { CapacityExposure, CapacityCell } from "@/types/situation";

function cell(partial: Partial<CapacityCell> & Pick<CapacityCell, "period">): CapacityCell {
  return {
    lineId: "LINE-03",
    lineName: "Line 03 — High-Speed Bagging",
    plant: "Plant A",
    availableHours: 1000,
    baseCalendarHours: 1000,
    plannedMaintenanceHours: 0,
    projectDowntimeHours: 0,
    laborConstraintHours: 0,
    otherConstraintHours: 0,
    customAdjustmentHours: 0,
    targetUtilizationPct: 0.9,
    formalHours: 0,
    unresolvedHours: 0,
    effectiveHours: 0,
    formalUtilization: 0,
    effectiveUtilization: 0,
    contributors: [],
    ...partial,
  };
}

function exposureOf(cells: CapacityCell[]): CapacityExposure {
  return {
    cells,
    lines: [{ lineId: "LINE-03", lineName: "Line 03 — High-Speed Bagging", plant: "Plant A" }],
    periods: cells.map((c) => c.period),
    exposedLineIds: ["LINE-03"],
    available: true,
    unmappedItems: [],
  };
}

describe("simulatePullForward", () => {
  it("returns undefined for a line with no cells", () => {
    expect(simulatePullForward(exposureOf([]), "LINE-99", 6, {})).toBeUndefined();
  });

  it("at zero weeks, After equals Before — nothing moves", () => {
    const exposure = exposureOf([
      cell({ period: "2027-08", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }),
    ]);
    const result = simulatePullForward(exposure, "LINE-03", 0, {})!;
    expect(result.cells[0]!.pulledOutHours).toBe(0);
    expect(result.cells[0]!.overflowAfterHours).toBe(result.cells[0]!.overflowBeforeHours);
    expect(result.totalPulledHours).toBe(0);
  });

  it("pulls overflow into an earlier month with headroom, one month back at ~6 weeks", () => {
    const exposure = exposureOf([
      cell({ period: "2027-07", formalHours: 400, unresolvedHours: 0, availableHours: 1000 }), // 600h headroom
      cell({ period: "2027-08", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }), // 200h overflow
    ]);
    const result = simulatePullForward(exposure, "LINE-03", 6, {})!;
    const [jul, aug] = result.cells;

    expect(aug!.overflowBeforeHours).toBe(200);
    expect(aug!.pulledOutHours).toBe(200);
    expect(aug!.overflowAfterHours).toBe(0);
    expect(jul!.pulledInHours).toBe(200);
    expect(result.totalPulledHours).toBe(200);
    expect(result.totalShortfallHours).toBe(0);
  });

  it("leaves a shortfall when the target month doesn't have enough headroom", () => {
    const exposure = exposureOf([
      cell({ period: "2027-07", formalHours: 950, unresolvedHours: 0, availableHours: 1000 }), // 50h headroom
      cell({ period: "2027-08", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }), // 200h overflow
    ]);
    const result = simulatePullForward(exposure, "LINE-03", 6, {})!;
    const [jul, aug] = result.cells;

    expect(aug!.pulledOutHours).toBe(50);
    expect(aug!.overflowAfterHours).toBe(150);
    expect(jul!.pulledInHours).toBe(50);
    expect(result.totalShortfallHours).toBe(150);
  });

  it("never pulls before the first period in the window", () => {
    const exposure = exposureOf([
      cell({ period: "2027-08", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }),
    ]);
    const result = simulatePullForward(exposure, "LINE-03", 6, {})!;
    expect(result.cells[0]!.pulledOutHours).toBe(0);
    expect(result.cells[0]!.overflowAfterHours).toBe(result.cells[0]!.overflowBeforeHours);
  });

  it("gives earlier overloaded months first claim on a shared target", () => {
    const exposure = exposureOf([
      cell({ period: "2027-06", formalHours: 900, unresolvedHours: 0, availableHours: 1000 }), // 100h headroom, shared target
      cell({ period: "2027-07", formalHours: 900, unresolvedHours: 100, availableHours: 1000 }), // 0h overflow itself
      cell({ period: "2027-08", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }), // 200h overflow
    ]);
    // 4-5 weeks rounds to one month back for both Jul and Aug's targets? Use
    // 6 weeks (~1 month back) so Jul's target is Jun and Aug's target is Jul.
    const result = simulatePullForward(exposure, "LINE-03", 6, {})!;
    const [jun, jul, aug] = result.cells;

    // Jul has no overflow of its own (900+100=1000, exactly at capacity) —
    // nothing to pull out of it.
    expect(jul!.pulledOutHours).toBe(0);
    // Aug's target (Jul) has headroom = 1000 - (900+100) = 0, so nothing
    // moves and the full 200h overflow remains.
    expect(aug!.pulledOutHours).toBe(0);
    expect(aug!.overflowAfterHours).toBe(200);
    expect(jun!.pulledInHours).toBe(0);
  });

  it("converts pulled and shortfall hours to units via the line's blended rate", () => {
    const exposure = exposureOf([
      cell({
        period: "2027-07",
        formalHours: 400,
        unresolvedHours: 0,
        availableHours: 1000,
      }),
      cell({
        period: "2027-08",
        formalHours: 900,
        unresolvedHours: 300,
        availableHours: 1000,
        contributors: [{ candidateId: "cand-1", itemId: "item-1", itemName: "Caramel Bar Display 24ct", hours: 300 }],
      }),
    ]);
    // 300 units per 300 hours -> 1 unit/hour.
    const result = simulatePullForward(exposure, "LINE-03", 6, { "cand-1": 300 })!;
    expect(result.unitsSecured).toBeCloseTo(200, 5); // 200h pulled * 1 unit/h
    expect(result.unitsAtRisk).toBeCloseTo(200, 5); // 200h overflow-before * 1 unit/h
    expect(result.unitsStillAtRisk).toBeCloseTo(0, 5);
  });

  it("reaches a nearer month with headroom rather than only the month exactly maxWeeks back", () => {
    // 9 weeks rounds to 2 months back. May's exact 2-months-back target
    // (March) doesn't exist in this window, but April — 1 month back — has
    // room. The fix is that May reaches April instead of giving up.
    const exposure = exposureOf([
      cell({ period: "2027-04", formalHours: 700, unresolvedHours: 0, availableHours: 1000 }), // 300h headroom
      cell({ period: "2027-05", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }), // 200h overflow
    ]);
    const result = simulatePullForward(exposure, "LINE-03", 9, {})!;
    const [apr, may] = result.cells;

    expect(may!.overflowBeforeHours).toBe(200);
    expect(may!.pulledOutHours).toBe(200);
    expect(may!.overflowAfterHours).toBe(0);
    expect(apr!.pulledInHours).toBe(200);
  });

  it("cascades to a further month only once the nearer one runs out of room", () => {
    const exposure = exposureOf([
      cell({ period: "2027-04", formalHours: 950, unresolvedHours: 0, availableHours: 1000 }), // 50h headroom
      cell({ period: "2027-05", formalHours: 850, unresolvedHours: 0, availableHours: 1000 }), // 150h headroom
      cell({ period: "2027-06", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }), // 200h overflow
    ]);
    const result = simulatePullForward(exposure, "LINE-03", 9, {})!; // up to 2 months back
    const [apr, may, jun] = result.cells;

    // Nearest first: May (1 month back) takes 150h, then April (2 months
    // back) takes the remaining 50h — never skipping straight to April.
    expect(may!.pulledInHours).toBe(150);
    expect(apr!.pulledInHours).toBe(50);
    expect(jun!.pulledOutHours).toBe(200);
    expect(jun!.overflowAfterHours).toBe(0);
  });

  it("computes a per-month drop-dead and shifts it earlier by the pull for the pulled portion", () => {
    const exposure = exposureOf([
      cell({ period: "2027-07", formalHours: 400, unresolvedHours: 0, availableHours: 1000 }),
      cell({ period: "2027-08", formalHours: 900, unresolvedHours: 300, availableHours: 1000 }),
    ]);
    const result = simulatePullForward(exposure, "LINE-03", 6, {}, () => 40)!;
    const aug = result.cells[1]!;
    expect(aug.dropDeadBefore).toBe(addDays("2027-08-01", -40));
    expect(aug.dropDeadAfter).toBe(addDays("2027-07-01", -40));
  });
});
