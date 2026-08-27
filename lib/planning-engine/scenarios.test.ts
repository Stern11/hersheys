import { describe, it, expect } from "vitest";
import { calculateScenario } from "./scenarios";
import { buildHalloweenScenarioInput, ACCEPTED_MASTER_ASSUMPTIONS } from "./gaps";
import { CAPACITY_BUCKETS, HALLOWEEN_PEAK_PRODUCTION_PERIOD } from "@/data/synthetic/capacity";
import { EVENTS } from "@/data/synthetic/events";
import { materialById } from "@/data/synthetic/materials";
import { leadTimeP80 } from "@/data/synthetic/execution-history";

/** The bucket key the Halloween RCCP run actually targets: a PRODUCTION month. */
const LINE_03_PEAK_KEY = `line_03:${HALLOWEEN_PEAK_PRODUCTION_PERIOD}`;

describe("calculateScenario — baseline immutability", () => {
  it("never mutates the underlying synthetic capacity data it reads", () => {
    const before = JSON.parse(JSON.stringify(CAPACITY_BUCKETS));
    calculateScenario(buildHalloweenScenarioInput("scn_test", {}));
    calculateScenario(
      buildHalloweenScenarioInput("scn_test_2", {
        capacity: { [LINE_03_PEAK_KEY]: { prebuildQuantityUnits: 200_000, additionalShiftHours: 40 } },
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
  it("moving Printed Film's lead-time basis to the historical P80 pulls its material deadline earlier than the system norm", () => {
    // The Halloween baseline already carries the ACCEPTED historical-P80 norm
    // for Printed Seasonal Film (gaps.ts::ACCEPTED_MASTER_ASSUMPTIONS), so the
    // system norm is the thing that has to be asked for explicitly here. The
    // assertion is unchanged in substance: a longer lead time moves the
    // order-by date earlier.
    const withSystem = calculateScenario(
      buildHalloweenScenarioInput("scn_system", {
        masterAssumptions: { "material:mat_printed_film:lead_time": { selectedBasis: "system" } },
      })
    );
    const withP80 = calculateScenario(
      buildHalloweenScenarioInput("scn_p80", {
        masterAssumptions: { "material:mat_printed_film:lead_time": { selectedBasis: "historical", leadTimeStatistic: "p80" } },
      })
    );

    const filmDeadline = (r: ReturnType<typeof calculateScenario>) => r.materialReadiness.find((m) => m.materialId === "mat_printed_film")?.earliestDecisionDate;

    expect(filmDeadline(withSystem)).toBeDefined();
    expect(filmDeadline(withP80)).toBeDefined();
    expect(filmDeadline(withP80)! < filmDeadline(withSystem)!).toBe(true);
  });

  it("a capacity override changes only the targeted line/period, leaving others untouched", () => {
    const baseline = calculateScenario(buildHalloweenScenarioInput("scn_baseline_2", {}));
    const withShift = calculateScenario(
      buildHalloweenScenarioInput("scn_shift", {
        capacity: { [LINE_03_PEAK_KEY]: { additionalShiftHours: 40 } },
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

describe("production timing vs sales timing", () => {
  it("runs RCCP against a PRODUCTION month, never a sell-through month", () => {
    const halloween = EVENTS.find((e) => e.id === "evt_halloween_2027")!;
    const result = calculateScenario(buildHalloweenScenarioInput("scn_timing", {}));

    // Every bucket the capacity step touched must sit inside the production window.
    expect(result.capacityImpact.length).toBeGreaterThan(0);
    result.capacityImpact.forEach((c) => {
      expect(c.period >= halloween.productionWindow.start.slice(0, 7)).toBe(true);
      expect(c.period <= halloween.productionWindow.end.slice(0, 7)).toBe(true);
      // ...and must NOT sit inside the sell-through window.
      expect(c.period >= halloween.salesWindow.start.slice(0, 7) && c.period <= halloween.salesWindow.end.slice(0, 7)).toBe(false);
    });
  });

  it("puts every material order-by date before the production window opens, not before the sales window", () => {
    const halloween = EVENTS.find((e) => e.id === "evt_halloween_2027")!;
    const result = calculateScenario(buildHalloweenScenarioInput("scn_timing_2", {}));

    expect(result.materialReadiness.length).toBeGreaterThan(0);
    result.materialReadiness.forEach((m) => {
      expect(m.earliestDecisionDate < halloween.productionWindow.end).toBe(true);
      expect(m.earliestDecisionDate < halloween.salesWindow.start).toBe(true);
    });
  });
});

describe("accepted master-data corrections", () => {
  it("explodes the Halloween BOM at the accepted film lead time, not the stale ERP norm", () => {
    // Guards the cross-page contradiction: the Halloween workspace and the
    // lead-time workspace must resolve Printed Seasonal Film to the same
    // number of days, so they cannot show two different order-by dates.
    const film = materialById("mat_printed_film");
    const acceptedDays = leadTimeP80(film.id);
    expect(ACCEPTED_MASTER_ASSUMPTIONS["material:mat_printed_film:lead_time"]).toEqual({ selectedBasis: "historical", leadTimeStatistic: "p80" });

    const baseline = calculateScenario(buildHalloweenScenarioInput("scn_accepted", {}));
    const filmRow = baseline.materialReadiness.find((m) => m.materialId === "mat_printed_film")!;

    expect(filmRow.leadTimeDaysUsed).toBe(acceptedDays);
    expect(filmRow.leadTimeDaysUsed).not.toBe(film.systemLeadTimeDays);
  });
});
