import { describe, it, expect } from "vitest";
import { calculateScenario } from "./scenarios";
import { buildHalloweenScenarioInput } from "./gaps";
import { CAPACITY_BUCKETS } from "@/data/synthetic/capacity";

describe("calculateScenario — baseline immutability", () => {
  it("never mutates the underlying synthetic capacity data it reads", () => {
    const before = JSON.parse(JSON.stringify(CAPACITY_BUCKETS));
    calculateScenario(buildHalloweenScenarioInput("scn_test", {}));
    calculateScenario(
      buildHalloweenScenarioInput("scn_test_2", {
        capacity: { "line_03:2027-09": { prebuildQuantityUnits: 200_000, additionalShiftHours: 40 } },
      })
    );
    expect(CAPACITY_BUCKETS).toEqual(before);
  });

  it("is deterministic: the same input always produces the same output", () => {
    const a = calculateScenario(buildHalloweenScenarioInput("scn_a", {}));
    const b = calculateScenario(buildHalloweenScenarioInput("scn_a", {}));
    expect(a.unresolvedDemandUnits).toBe(b.unresolvedDemandUnits);
    expect(a.capacityImpact).toEqual(b.capacityImpact);
  });
});

describe("calculateScenario — scenario override behavior", () => {
  it("moving Printed Film's lead-time basis to the historical P80 pulls the earliest material deadline earlier", () => {
    const baseline = calculateScenario(buildHalloweenScenarioInput("scn_baseline", {}));
    const withP80 = calculateScenario(
      buildHalloweenScenarioInput("scn_p80", {
        masterAssumptions: { "material:mat_printed_film:lead_time": { selectedBasis: "historical", leadTimeStatistic: "p80" } },
      })
    );

    const baselineDeadline = baseline.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date;
    const p80Deadline = withP80.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date;
    expect(baselineDeadline).toBeDefined();
    expect(p80Deadline).toBeDefined();
    expect(p80Deadline! < baselineDeadline!).toBe(true);
  });

  it("a capacity override changes only the targeted line/period, leaving others untouched", () => {
    const baseline = calculateScenario(buildHalloweenScenarioInput("scn_baseline_2", {}));
    const withShift = calculateScenario(
      buildHalloweenScenarioInput("scn_shift", {
        capacity: { "line_03:2027-09": { additionalShiftHours: 40 } },
      })
    );

    const line03Before = baseline.capacityImpact.find((c) => c.lineId === "line_03")!;
    const line03After = withShift.capacityImpact.find((c) => c.lineId === "line_03")!;
    const line01Before = baseline.capacityImpact.find((c) => c.lineId === "line_01")!;
    const line01After = withShift.capacityImpact.find((c) => c.lineId === "line_01")!;

    expect(line03After.ceilingHours).toBe(line03Before.ceilingHours + 40);
    expect(line01After).toEqual(line01Before);
  });

  it("resetting overrides (empty object) reproduces the exact baseline result", () => {
    const baseline = calculateScenario(buildHalloweenScenarioInput("scn_x", {}));
    const afterReset = calculateScenario(buildHalloweenScenarioInput("scn_x", {}));
    expect(afterReset.unresolvedDemandUnits).toBe(baseline.unresolvedDemandUnits);
    expect(afterReset.capacityImpact).toEqual(baseline.capacityImpact);
  });
});
