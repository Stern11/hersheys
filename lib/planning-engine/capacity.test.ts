import { describe, it, expect } from "vitest";
import { rccp } from "./capacity";
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
