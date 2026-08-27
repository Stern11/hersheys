import { describe, it, expect } from "vitest";
import { seasonalForecast, availableSeasonCount, eligibleHistoricalPeriods } from "./seasonality";
import { calculateScenario } from "./scenarios";
import { buildHalloweenScenarioInput } from "./gaps";
import { historicalPeriodsForEvent } from "@/data/synthetic/historical-demand";

const HALLOWEEN = historicalPeriodsForEvent("evt_halloween_2027");

describe("eligible seasons — the ceiling on a legal lookback", () => {
  it("leaves atypical seasons out of the basis unless the planner re-includes them", () => {
    const atypical = HALLOWEEN.filter((p) => p.isAtypical);
    expect(atypical.length).toBeGreaterThan(0);
    expect(availableSeasonCount(HALLOWEEN)).toBe(HALLOWEEN.length - atypical.length);
    expect(availableSeasonCount(HALLOWEEN, { includedPeriodIds: atypical.map((p) => p.id) })).toBe(HALLOWEEN.length);
  });

  it("shrinks as the planner excludes seasons", () => {
    const first = eligibleHistoricalPeriods(HALLOWEEN)[0]!;
    expect(availableSeasonCount(HALLOWEEN, { excludedPeriodIds: [first.id] })).toBe(availableSeasonCount(HALLOWEEN) - 1);
  });
});

describe("seasonalForecast — item 15: an empty basis is not a forecast of zero", () => {
  it("reports a healthy basis as sufficient", () => {
    const f = seasonalForecast({ historicalPeriods: HALLOWEEN, growthAssumption: 0.08 });
    expect(f.sufficient).toBe(true);
    expect(f.seasonsAvailable).toBe(3);
    expect(f.issues).toEqual([]);
    expect(f.base).toBeGreaterThan(0);
  });

  it("flags an all-excluded basis as INSUFFICIENT rather than returning a confident 0", () => {
    const f = seasonalForecast({
      historicalPeriods: HALLOWEEN,
      growthAssumption: 0.08,
      basis: { excludedPeriodIds: HALLOWEEN.map((p) => p.id) },
    });
    expect(f.sufficient).toBe(false);
    expect(f.seasonsUsed).toEqual([]);
    expect(f.base).toBe(0);
    expect(f.issues.join(" ")).toMatch(/excluded/i);
  });

  it("says so when the requested lookback exceeds what the basis can read", () => {
    const f = seasonalForecast({ historicalPeriods: HALLOWEEN, growthAssumption: 0.08, basis: { seasonsOrYears: 53 } });
    expect(f.seasonsRequested).toBe(53);
    expect(f.seasonsAvailable).toBe(3);
    expect(f.seasonsUsed).toHaveLength(3);
    expect(f.issues.join(" ")).toMatch(/exceeds/);
  });

  it("warns that a single-season basis understates the spread", () => {
    const f = seasonalForecast({ historicalPeriods: HALLOWEEN, growthAssumption: 0.08, basis: { seasonsOrYears: 1 } });
    expect(f.sufficient).toBe(true);
    expect(f.issues.join(" ")).toMatch(/one comparable season/i);
  });
});

describe("calculateScenario — the UI can branch on basis sufficiency", () => {
  it("carries a healthy basis through to the result", () => {
    const r = calculateScenario(buildHalloweenScenarioInput("scn_basis_ok", {}));
    expect(r.basis).toMatchObject({ sufficient: true, seasonsAvailable: 3, seasonsUsed: 3 });
  });

  it("marks the result insufficient when every season is excluded, instead of showing '0-0 units' as a forecast", () => {
    const r = calculateScenario(
      buildHalloweenScenarioInput("scn_basis_empty", {
        historicalBasis: { excludedPeriodIds: HALLOWEEN.map((p) => p.id) },
      })
    );
    expect(r.basis.sufficient).toBe(false);
    expect(r.basis.seasonsUsed).toBe(0);
    expect(r.basis.issues.length).toBeGreaterThan(0);
    expect(r.expectedDemandUnits).toEqual({ low: 0, base: 0, high: 0 });
    // And the confidence breakdown must not flatter an absent basis.
    expect(r.confidence.dimensions.find((d) => d.dimension === "historical_data_quality")!.score).toBe(0);
  });
});
