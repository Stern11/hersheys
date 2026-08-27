import { describe, it, expect } from "vitest";
import { buildOverrideBaseline, countMeaningfulOverrides, diffOverrides } from "./overrides";
import { buildHalloweenScenarioInput, buildValentinesScenarioInput } from "./gaps";
import type { ScenarioOverrides } from "@/types/scenario";
import { PRODUCTION_LINES } from "@/data/synthetic/master-data";
import { materialById } from "@/data/synthetic/materials";
import { leadTimeP80 } from "@/data/synthetic/execution-history";
import { HALLOWEEN_PEAK_PRODUCTION_PERIOD } from "@/data/synthetic/capacity";
import { SEED_SCENARIOS } from "@/data/synthetic/scenarios";

const halloweenBaseline = buildOverrideBaseline(buildHalloweenScenarioInput("baseline", {}));
const LINE_03 = PRODUCTION_LINES.find((l) => l.id === "line_03")!;
const BUCKET_KEY = `line_03:${HALLOWEEN_PEAK_PRODUCTION_PERIOD}`;
const count = (o: ScenarioOverrides) => countMeaningfulOverrides(o, halloweenBaseline);

describe("countMeaningfulOverrides — item 16", () => {
  it("counts nothing for an untouched scenario", () => {
    expect(count({})).toBe(0);
  });

  it("does NOT count a value set to what the baseline already is", () => {
    // "set Line 03 run rate to 8,200" when it is already 8,200 used to push
    // the badge from 2 to 3 while no number on the page moved.
    expect(count({ masterAssumptions: { "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: LINE_03.standardRunRateUnitsPerHour } } })).toBe(0);
    expect(count({ demand: { growthRatePct: halloweenBaseline.growthRatePct } })).toBe(0);
    expect(count({ historicalBasis: { seasonsOrYears: halloweenBaseline.historicalLookbackSeasons } })).toBe(0);
  });

  it("does NOT count 'Baseline 3 seasons -> Scenario 3 seasons', the flagged change that changed nothing", () => {
    expect(halloweenBaseline.historicalLookbackSeasons).toBe(3);
    const diffs = diffOverrides({ historicalBasis: { seasonsOrYears: 3, excludedPeriodIds: [], weighting: "recent_weighted" } }, halloweenBaseline);
    expect(diffs).toEqual([]);
  });

  it("DOES count a changed lookback — the override the old count never noticed", () => {
    expect(count({ historicalBasis: { seasonsOrYears: 1 } })).toBe(1);
    expect(diffOverrides({ historicalBasis: { seasonsOrYears: 1 } }, halloweenBaseline)[0]).toMatchObject({
      category: "historicalBasis",
      baseline: "3 seasons",
      scenario: "1 season",
    });
  });

  it("does not increment when the same non-baseline value is set again (idempotent writes)", () => {
    const once: ScenarioOverrides = { masterAssumptions: { "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 8200 } } };
    const twice: ScenarioOverrides = { masterAssumptions: { "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 8200 } } };
    expect(count(once)).toBe(1);
    expect(count(twice)).toBe(1);
  });

  it("counts two master assumptions in the same category as TWO, not as one 'masterAssumptions' key", () => {
    // The old count was Object.keys(overrides).length — categories, not
    // changes — so three chips could sit under a badge reading "2".
    const overrides: ScenarioOverrides = {
      masterAssumptions: {
        "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 8200 },
        "material:mat_printed_film:lead_time": { selectedBasis: "system" },
      },
    };
    expect(count(overrides)).toBe(2);
    expect(diffOverrides(overrides, halloweenBaseline)).toHaveLength(2);
  });

  it("the chip list and the count are the same list — they cannot disagree", () => {
    const overrides: ScenarioOverrides = {
      demand: { growthRatePct: 0.2 },
      historicalBasis: { seasonsOrYears: 2 },
      masterAssumptions: { "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 8200 } },
      capacity: { [BUCKET_KEY]: { targetUtilization: 0.75 } },
    };
    expect(count(overrides)).toBe(diffOverrides(overrides, halloweenBaseline).length);
    expect(count(overrides)).toBe(4);
  });

  it("treats a basis change that resolves to the SAME number as no change", () => {
    // Printed Seasonal Film's historical P80 is already accepted into the
    // baseline (gaps.ts::ACCEPTED_MASTER_ASSUMPTIONS). A scenario restating it
    // is not overriding anything, whatever label it puts on the basis.
    const film = materialById("mat_printed_film");
    expect(leadTimeP80(film.id)).not.toBe(film.systemLeadTimeDays);
    expect(count({ masterAssumptions: { "material:mat_printed_film:lead_time": { selectedBasis: "historical", leadTimeStatistic: "p80" } } })).toBe(0);
    // Reverting to the stale ERP norm IS a change.
    expect(count({ masterAssumptions: { "material:mat_printed_film:lead_time": { selectedBasis: "system" } } })).toBe(1);
  });

  it("does not count a capacity field set to its own bucket default", () => {
    const bucketTarget = halloweenBaseline.capacityByBucket[BUCKET_KEY]!.targetUtilization;
    expect(count({ capacity: { [BUCKET_KEY]: { targetUtilization: bucketTarget } } })).toBe(0);
    expect(count({ capacity: { [BUCKET_KEY]: { targetUtilization: bucketTarget - 0.2 } } })).toBe(1);
  });

  it("does not double-count one run-rate change across both storage fields", () => {
    // A run rate lives in masterAssumptions. If a legacy bucket-level rate is
    // also present it must not add a second chip for the same decision.
    const overrides: ScenarioOverrides = {
      masterAssumptions: { "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 8200 } },
      capacity: { [BUCKET_KEY]: { runRateUnitsPerHour: 8200 } },
    };
    expect(count(overrides)).toBe(1);
  });

  it("counts the seeded 'Line 03 relief' scenario honestly", () => {
    // It stores three things: a 3-season lookback (= baseline), the accepted
    // film P80 basis (= baseline), and a scenario run rate (a real change).
    const seed = SEED_SCENARIOS.find((s) => s.id === "scn_halloween_line03_relief")!;
    const diffs = diffOverrides(seed.overrides, halloweenBaseline);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ label: `${LINE_03.name} run rate`, scenario: "8,200/hr" });
  });
});

describe("countMeaningfulOverrides — analogue weights", () => {
  const valentinesBaseline = buildOverrideBaseline(buildValentinesScenarioInput("baseline", { analogues: {} }));

  it("does not count a weight set to the analogue's own default", () => {
    expect(countMeaningfulOverrides({ analogues: { weights: { prod_mothers_day_tin_2027: 0.86 } } }, valentinesBaseline)).toBe(0);
  });

  it("counts a changed weight once, not once per renormalized sibling", () => {
    const diffs = diffOverrides({ analogues: { weights: { prod_mothers_day_tin_2027: 0.4 } } }, valentinesBaseline);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ category: "analogues", baseline: "86%", scenario: "40%" });
  });

  it("counts a removed analogue", () => {
    expect(countMeaningfulOverrides({ analogues: { removedAnalogueIds: ["analogue_holiday_premium_tin"] } }, valentinesBaseline)).toBe(1);
  });
});
