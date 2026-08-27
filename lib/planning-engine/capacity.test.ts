import { describe, it, expect } from "vitest";
import { rccp, resolveRunRate } from "./capacity";
import type { CapacityBucket, ProductionLine } from "@/types/planning";

const line: ProductionLine = {
  id: "line_03",
  name: "Line 03",
  plant: "Hershey, PA",
  standardRunRateUnitsPerHour: 10_000,
  historicalMedianRunRateUnitsPerHour: 7_950,
  eligibleFamilyIds: ["fam_variety_bags"],
};

const bucket: CapacityBucket = {
  id: "cap_line03_2027-09",
  lineId: "line_03",
  period: "2027-09",
  availableHours: 400,
  plannedDowntimeHours: 20,
  targetUtilization: 0.9,
  formalLoadHours: 266,
  validatedUnresolvedLoadHours: 22,
};

describe("rccp — capacity-hour conversion (volume ÷ run rate = required hours)", () => {
  it("converts unresolved units to hours using the standard run rate by default", () => {
    const result = rccp({
      bucket,
      line,
      aiInferredUnresolvedUnits: 620_000, // matches ~65% of the golden ~0.95M unresolved figure
      observedMedianRunRate: 7_950,
    });
    // 620,000 / 10,000 = 62 hours
    expect(result.aiInferredLoadHours).toBeCloseTo(62, 1);
    expect(result.ceilingHours).toBe(380); // 400 - 20
    expect(result.formalUtilization).toBeCloseTo(266 / 380, 3);
  });

  it("uses the scenario run-rate override instead of the standard rate when selected", () => {
    const result = rccp({
      bucket,
      line,
      aiInferredUnresolvedUnits: 620_000,
      observedMedianRunRate: 7_950,
      runRateOverride: { selectedBasis: "scenario", scenarioValue: 8_200 },
    });
    expect(result.aiInferredLoadHours).toBeCloseTo(620_000 / 8_200, 1);
  });

  it("flags critical risk once effective utilization exceeds 100% of ceiling", () => {
    // At the standard 10,000/hr rate, 1,000,000 unresolved units adds 100
    // hours on top of the bucket's existing 288 formal+validated hours —
    // enough to push effective utilization past the 380-hour ceiling.
    const result = rccp({ bucket, line, aiInferredUnresolvedUnits: 1_000_000, observedMedianRunRate: 7_950 });
    expect(result.effectiveUtilization).toBeGreaterThan(1);
    expect(result.riskLevel).toBe("critical");
  });

  it("widens the ceiling (not the load) when additional shift hours are added", () => {
    const withoutShift = rccp({ bucket, line, aiInferredUnresolvedUnits: 100_000, observedMedianRunRate: 7_950 });
    const withShift = rccp({ bucket, line, aiInferredUnresolvedUnits: 100_000, observedMedianRunRate: 7_950, capacityOverride: { additionalShiftHours: 40 } });
    expect(withShift.ceilingHours).toBe(withoutShift.ceilingHours + 40);
    expect(withShift.formalLoadHours).toBe(withoutShift.formalLoadHours);
    expect(withShift.effectiveUtilization).toBeLessThan(withoutShift.effectiveUtilization);
  });
});

/* ---------------------------------------------------------------------- *
 * Punch item 2 — the custom run-rate input was dead.
 *
 * setRunRate() wrote capacity["line:period"].runRateUnitsPerHour, which rccp
 * only consulted when the basis was NOT "scenario" — while the input that
 * called it was only rendered when the basis WAS "scenario". These tests fail
 * if that split ever comes back: they assert that a scenario run rate moves
 * effectiveUtilization at all, and that it moves it in the right direction.
 * ---------------------------------------------------------------------- */

describe("resolveRunRate — one field, one reader", () => {
  it("uses the scenario value when the basis is 'scenario'", () => {
    expect(resolveRunRate({ line, runRateOverride: { selectedBasis: "scenario", scenarioValue: 6_000 }, observedMedianRunRate: 7_950 })).toEqual({
      unitsPerHour: 6_000,
      basis: "scenario",
      source: "scenario_value",
    });
  });

  it("uses the scenario value even when a stale bucket-level rate is also present", () => {
    // The exact collision that made the input dead: two stored numbers, one
    // reader. The basis selection must win.
    const r = resolveRunRate({
      line,
      runRateOverride: { selectedBasis: "scenario", scenarioValue: 6_000 },
      capacityOverride: { runRateUnitsPerHour: 20_000 },
      observedMedianRunRate: 7_950,
    });
    expect(r.unitsPerHour).toBe(6_000);
  });

  it("falls back to the standard rate — never to zero — when 'scenario' is selected with no value", () => {
    const r = resolveRunRate({ line, runRateOverride: { selectedBasis: "scenario" }, observedMedianRunRate: 7_950 });
    expect(r.unitsPerHour).toBe(line.standardRunRateUnitsPerHour);
    expect(r.source).toBe("line_standard");
  });

  it("uses the observed median on the historical basis, and the standard rate on the system basis", () => {
    expect(resolveRunRate({ line, runRateOverride: { selectedBasis: "historical" }, observedMedianRunRate: 7_950 }).unitsPerHour).toBe(7_950);
    expect(resolveRunRate({ line, observedMedianRunRate: 7_950 }).unitsPerHour).toBe(10_000);
  });
});

describe("rccp — a scenario run rate actually moves effective utilization", () => {
  const at = (unitsPerHour?: number) =>
    rccp({
      bucket,
      line,
      aiInferredUnresolvedUnits: 620_000,
      observedMedianRunRate: 7_950,
      runRateOverride: unitsPerHour == null ? undefined : { selectedBasis: "scenario", scenarioValue: unitsPerHour },
    });

  it("changes effective utilization when a scenario run rate is set", () => {
    expect(at(6_000).effectiveUtilization).not.toBe(at().effectiveUtilization);
  });

  it("raises utilization as the run rate FALLS — the same units need more hours", () => {
    const slow = at(6_000);
    const standard = at();
    const fast = at(20_000);
    expect(slow.effectiveUtilization).toBeGreaterThan(standard.effectiveUtilization);
    expect(fast.effectiveUtilization).toBeLessThan(standard.effectiveUtilization);
    // 620,000 units at 6,000/hr is 103.3 hours, vs 62 at the 10,000 standard.
    expect(slow.aiInferredLoadHours).toBeCloseTo(620_000 / 6_000, 1);
    expect(slow.runRateUnitsPerHour).toBe(6_000);
    expect(slow.runRateSource).toBe("scenario_value");
  });

  it("reports the rate it used, so a surface cannot label the wrong basis", () => {
    expect(at().runRateBasis).toBe("system");
    expect(at(8_200).runRateBasis).toBe("scenario");
  });
});

/* ---------------------------------------------------------------------- *
 * Punch item 3 — the utilization alert threshold.
 *
 * It is NOT a load lever (by design: a threshold cannot move the number it
 * judges), but it must clamp, and crossing it must demonstrably change the
 * risk classification.
 * ---------------------------------------------------------------------- */

describe("rccp — utilization alert threshold", () => {
  const withThreshold = (targetUtilization: number) =>
    rccp({ bucket, line, aiInferredUnresolvedUnits: 620_000, observedMedianRunRate: 7_950, capacityOverride: { targetUtilization } });

  it("clamps a negative threshold to 0% and a 200% threshold to 100%", () => {
    expect(withThreshold(-0.1).targetUtilization).toBe(0);
    expect(withThreshold(2).targetUtilization).toBe(1);
  });

  it("does not move effective utilization — a threshold judges load, it does not create it", () => {
    expect(withThreshold(0.5).effectiveUtilization).toBe(withThreshold(1).effectiveUtilization);
  });

  it("flips riskLevel when the threshold crosses the line's effective utilization", () => {
    const effective = withThreshold(0.9).effectiveUtilization;
    expect(effective).toBeGreaterThan(0.5);
    expect(effective).toBeLessThan(1);
    // Threshold BELOW effective load -> the line is flagged.
    expect(withThreshold(0.5).riskLevel).toBe("warning");
    // Threshold ABOVE effective load -> the line is within its own headroom.
    expect(withThreshold(1).riskLevel).toBe("positive");
  });

  it("keeps a ceiling breach 'critical' regardless of the threshold", () => {
    const breach = rccp({ bucket, line, aiInferredUnresolvedUnits: 1_500_000, observedMedianRunRate: 7_950, capacityOverride: { targetUtilization: 1 } });
    expect(breach.effectiveUtilization).toBeGreaterThan(1);
    expect(breach.riskLevel).toBe("critical");
  });
});
