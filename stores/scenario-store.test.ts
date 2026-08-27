import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createMemoryStorage } from "./memory-storage";

// Install Web Storage BEFORE the store module runs any persistence.
const sessionStore = createMemoryStorage();
beforeAll(() => {
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionStore, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: createMemoryStorage(), configurable: true, writable: true });
});

const { useScenarioStore, nextStatusOnSave, SCENARIO_STORAGE_KEY } = await import("./scenario-store");
const { calculateScenario } = await import("@/lib/planning-engine/scenarios");
const { buildScenarioInput } = await import("@/lib/planning-engine/scenario-limits");
const { SEED_SCENARIOS } = await import("@/data/synthetic/scenarios");
const { PRODUCTION_LINES } = await import("@/data/synthetic/master-data");
const { HALLOWEEN_PEAK_PRODUCTION_PERIOD } = await import("@/data/synthetic/capacity");
const { RUN_RATE_RANGE, GROWTH_RATE_RANGE } = await import("@/lib/planning-engine/validation");

const HALLOWEEN_SCENARIO = "scn_halloween_line03_relief";
const VALENTINES_SCENARIO = "scn_valentines_tin_analogues";
const LINE_03 = PRODUCTION_LINES.find((l) => l.id === "line_03")!;
const PEAK = HALLOWEEN_PEAK_PRODUCTION_PERIOD;

const store = () => useScenarioStore.getState();

/** Runs the engine on whatever the store currently holds — the same path the UI takes. */
function resultFor(scenarioId: string) {
  const scenario = store().scenarios[scenarioId]!;
  return calculateScenario(buildScenarioInput(scenario, scenarioId, scenario.overrides));
}
function line03Utilization(scenarioId: string) {
  return resultFor(scenarioId).capacityImpact.find((c) => c.lineId === "line_03")!.effectiveUtilization;
}

function resetStore() {
  sessionStore.clear();
  useScenarioStore.setState({
    scenarios: Object.fromEntries(SEED_SCENARIOS.map((s) => [s.id, structuredClone(s)])),
    activeScenarioId: SEED_SCENARIOS[0]?.id ?? null,
    comparisonScenarioIds: [],
  });
}

beforeEach(resetStore);

/* ---------------------------------------------------------------------- *
 * Item 2 — the run-rate contract, store to engine.
 * ---------------------------------------------------------------------- */

describe("setRunRate — the custom run-rate input is wired to the field the engine reads", () => {
  it("writes the master assumption the RCCP conversion consults, and flips the basis to 'scenario'", () => {
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 6000);
    const ma = store().scenarios[HALLOWEEN_SCENARIO]!.overrides.masterAssumptions!["line:line_03:run_rate"];
    expect(ma).toMatchObject({ selectedBasis: "scenario", scenarioValue: 6000 });
  });

  it("does NOT write the bucket field that nothing read while the input was visible", () => {
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 6000);
    const capacity = store().scenarios[HALLOWEEN_SCENARIO]!.overrides.capacity;
    expect(capacity?.[`line_03:${PEAK}`]?.runRateUnitsPerHour).toBeUndefined();
  });

  it("MOVES effective utilization — the assertion the old wiring would fail", () => {
    const before = line03Utilization(HALLOWEEN_SCENARIO);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 6000);
    expect(line03Utilization(HALLOWEEN_SCENARIO)).not.toBe(before);
  });

  it("a LOWER run rate raises utilization: the same units need more hours", () => {
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 20000);
    const fast = line03Utilization(HALLOWEEN_SCENARIO);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 6000);
    const slow = line03Utilization(HALLOWEEN_SCENARIO);
    expect(slow).toBeGreaterThan(fast);
  });

  it("clamps an impossible rate and reports what was applied, instead of storing a number the engine ignores", () => {
    const applied = store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 0);
    expect(applied).toMatchObject({ applied: true, clamped: true, requested: 0, value: RUN_RATE_RANGE.min });
    expect(applied.reason).toBeTruthy();
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.masterAssumptions!["line:line_03:run_rate"]!.scenarioValue).toBe(RUN_RATE_RANGE.min);
    expect(Number.isFinite(line03Utilization(HALLOWEEN_SCENARIO))).toBe(true);
  });

  it("reports a redundant set as a no-op rather than as a change", () => {
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 8200);
    const again = store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 8200);
    expect(again.noop).toBe(true);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(1);
  });

  it("keeps the planner's custom rate when the basis is toggled away and back", () => {
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 7400);
    store().setRunRateBasis(HALLOWEEN_SCENARIO, "line_03", "system");
    store().setRunRateBasis(HALLOWEEN_SCENARIO, "line_03", "scenario");
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.masterAssumptions!["line:line_03:run_rate"]!.scenarioValue).toBe(7400);
  });
});

/* ---------------------------------------------------------------------- *
 * Item 3 — the utilization alert threshold.
 * ---------------------------------------------------------------------- */

describe("setTargetUtilization — clamps, and changes risk classification", () => {
  it("rejects -10% and 200%, storing the clamped value", () => {
    expect(store().setTargetUtilization(HALLOWEEN_SCENARIO, "line_03", PEAK, -0.1)).toMatchObject({ clamped: true, value: 0 });
    expect(store().setTargetUtilization(HALLOWEEN_SCENARIO, "line_03", PEAK, 2)).toMatchObject({ clamped: true, value: 1 });
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.capacity![`line_03:${PEAK}`]!.targetUtilization).toBe(1);
  });

  it("flips Line 03 between positive and warning as the threshold crosses its effective load", () => {
    const risk = () => resultFor(HALLOWEEN_SCENARIO).capacityImpact.find((c) => c.lineId === "line_03")!.riskLevel;
    store().setTargetUtilization(HALLOWEEN_SCENARIO, "line_03", PEAK, 0.5);
    expect(risk()).toBe("warning");
    store().setTargetUtilization(HALLOWEEN_SCENARIO, "line_03", PEAK, 1);
    expect(risk()).toBe("positive");
  });

  it("does not move effective utilization itself — a threshold is not a load lever", () => {
    const before = line03Utilization(HALLOWEEN_SCENARIO);
    store().setTargetUtilization(HALLOWEEN_SCENARIO, "line_03", PEAK, 0.5);
    expect(line03Utilization(HALLOWEEN_SCENARIO)).toBe(before);
  });
});

/* ---------------------------------------------------------------------- *
 * Item 15 — validation at the store boundary.
 * ---------------------------------------------------------------------- */

describe("input validation — what is stored is what was applied", () => {
  it("stores the CLAMPED lookback, never a 53 the engine reads as 3", () => {
    const applied = store().setHistoricalLookback(HALLOWEEN_SCENARIO, 53);
    expect(applied).toMatchObject({ clamped: true, requested: 53, value: 3 });
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.historicalBasis!.seasonsOrYears).toBe(3);
    expect(resultFor(HALLOWEEN_SCENARIO).basis.seasonsUsed).toBe(3);
  });

  it("exposes the available season count so the UI can show the legal range", () => {
    expect(store().availableSeasons(HALLOWEEN_SCENARIO)).toBe(3);
  });

  it("re-clamps a stored lookback when excluding a season narrows the basis", () => {
    store().setHistoricalLookback(HALLOWEEN_SCENARIO, 3);
    store().excludeHistoricalPeriod(HALLOWEEN_SCENARIO, "hist_halloween_2024");
    expect(store().availableSeasons(HALLOWEEN_SCENARIO)).toBe(2);
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.historicalBasis!.seasonsOrYears).toBe(2);
  });

  it("clamps a 128% growth assumption instead of rendering 223% utilization", () => {
    const applied = store().setGrowthAssumption(HALLOWEEN_SCENARIO, 1.28);
    expect(applied).toMatchObject({ clamped: true, value: GROWTH_RATE_RANGE.max });
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.demand!.growthRatePct).toBe(GROWTH_RATE_RANGE.max);
    expect(line03Utilization(HALLOWEEN_SCENARIO)).toBeLessThan(2);
  });

  it("marks the basis insufficient — not '0-0 units' — when every season is excluded", () => {
    ["hist_halloween_2024", "hist_halloween_2025", "hist_halloween_2026"].forEach((id) => store().excludeHistoricalPeriod(HALLOWEEN_SCENARIO, id));
    const result = resultFor(HALLOWEEN_SCENARIO);
    expect(result.basis.sufficient).toBe(false);
    expect(result.basis.issues.length).toBeGreaterThan(0);
    expect(result.expectedDemandUnits).toEqual({ low: 0, base: 0, high: 0 });
  });
});

/* ---------------------------------------------------------------------- *
 * Item 16 — the override count.
 * ---------------------------------------------------------------------- */

describe("overrideCount — one number, read from the same list as the chips", () => {
  it("counts the seeded scenario's single real deviation from baseline", () => {
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(1);
    expect(store().overrideDiffs(HALLOWEEN_SCENARIO)).toHaveLength(1);
  });

  it("returns 0 when a control is set to the baseline value", () => {
    store().resetScenario(HALLOWEEN_SCENARIO);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(0);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, LINE_03.standardRunRateUnitsPerHour);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(0);
  });

  it("increments when the lookback changes — the override the old count never saw", () => {
    store().resetScenario(HALLOWEEN_SCENARIO);
    store().setHistoricalLookback(HALLOWEEN_SCENARIO, 2);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(1);
  });

  it("does not increment on a redundant repeat set", () => {
    store().resetScenario(HALLOWEEN_SCENARIO);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 8200);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(1);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 8200);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 8200);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(1);
  });

  it("counts always equals the number of chips a component would render", () => {
    store().resetScenario(HALLOWEEN_SCENARIO);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 8200);
    store().setHistoricalLookback(HALLOWEEN_SCENARIO, 2);
    store().setTargetUtilization(HALLOWEEN_SCENARIO, "line_03", PEAK, 0.7);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(store().overrideDiffs(HALLOWEEN_SCENARIO).length);
    expect(store().overrideCount(HALLOWEEN_SCENARIO)).toBe(3);
  });
});

/* ---------------------------------------------------------------------- *
 * Item 4 — persistence and Save.
 * ---------------------------------------------------------------------- */

describe("persistence — a scenario change survives a rehydrate", () => {
  it("writes planner-authored overrides to session storage", () => {
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 6400);
    const raw = sessionStore.getItem(SCENARIO_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw!).toContain("6400");
  });

  it("restores overrides after the store is wiped and rehydrated (what a navigation does)", async () => {
    store().setHistoricalLookback(HALLOWEEN_SCENARIO, 1);
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 6400);
    const expected = line03Utilization(HALLOWEEN_SCENARIO);

    // Simulate a fresh page: the module-level store starts from seed data,
    // while the browser's session storage still holds what was saved. (The
    // snapshot is re-applied because resetting in-process state also triggers
    // a persist write, which a real page load would never do.)
    const persisted = sessionStore.getItem(SCENARIO_STORAGE_KEY)!;
    useScenarioStore.setState({ scenarios: Object.fromEntries(SEED_SCENARIOS.map((s) => [s.id, structuredClone(s)])) });
    sessionStore.setItem(SCENARIO_STORAGE_KEY, persisted);
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.historicalBasis!.seasonsOrYears).toBe(3);

    await useScenarioStore.persist.rehydrate();

    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.historicalBasis!.seasonsOrYears).toBe(1);
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.overrides.masterAssumptions!["line:line_03:run_rate"]!.scenarioValue).toBe(6400);
    expect(line03Utilization(HALLOWEEN_SCENARIO)).toBe(expected);
  });

  it("does not persist derived results — only the planner's stated assumptions", () => {
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 6400);
    const persisted = JSON.parse(sessionStore.getItem(SCENARIO_STORAGE_KEY)!) as { state: Record<string, unknown> };
    expect(Object.keys(persisted.state).sort()).toEqual(["activeScenarioId", "comparisonScenarioIds", "scenarios", "viewMode"]);
    expect(JSON.stringify(persisted.state)).not.toContain("effectiveUtilization");
  });
});

describe("saveScenario — Save is durable and never demotes", () => {
  it("moves a draft to saved", () => {
    expect(store().scenarios[VALENTINES_SCENARIO]!.status).toBe("draft");
    expect(store().saveScenario(VALENTINES_SCENARIO)).toBe("saved");
    expect(store().scenarios[VALENTINES_SCENARIO]!.status).toBe("saved");
  });

  it("leaves a preferred scenario preferred instead of downgrading it", () => {
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.status).toBe("preferred");
    expect(store().saveScenario(HALLOWEEN_SCENARIO)).toBe("preferred");
    expect(store().scenarios[HALLOWEEN_SCENARIO]!.status).toBe("preferred");
    expect(nextStatusOnSave("validated")).toBe("validated");
    expect(nextStatusOnSave("draft")).toBe("saved");
  });

  it("survives a rehydrate — the status change is not lost on navigation", async () => {
    store().saveScenario(VALENTINES_SCENARIO);
    const persisted = sessionStore.getItem(SCENARIO_STORAGE_KEY)!;
    useScenarioStore.setState({ scenarios: Object.fromEntries(SEED_SCENARIOS.map((s) => [s.id, structuredClone(s)])) });
    sessionStore.setItem(SCENARIO_STORAGE_KEY, persisted);
    expect(store().scenarios[VALENTINES_SCENARIO]!.status).toBe("draft");
    await useScenarioStore.persist.rehydrate();
    expect(store().scenarios[VALENTINES_SCENARIO]!.status).toBe("saved");
  });
});

describe("baseline immutability still holds through the store", () => {
  it("a scenario override never mutates the seeded scenario definitions", () => {
    const seedBefore = JSON.parse(JSON.stringify(SEED_SCENARIOS));
    store().setRunRate(HALLOWEEN_SCENARIO, "line_03", PEAK, 5000);
    store().setHistoricalLookback(HALLOWEEN_SCENARIO, 1);
    expect(SEED_SCENARIOS).toEqual(seedBefore);
  });
});
