import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createMemoryStorage } from "@/stores/memory-storage";

/* ---------------------------------------------------------------------- *
 * Scenario Lab wiring tests.
 *
 * These exist because the defects they guard were SILENT: the run-rate input
 * and the threshold input both typechecked, both linted, both rendered, and
 * both did nothing. A browser was the only thing that could see it. So these
 * tests drive the REAL store action the input's onChange calls, then re-run
 * the REAL engine the way the component does, and assert the derived number
 * actually moved. If either input is ever re-wired to a field the engine does
 * not read, or re-pointed at a period the scenario does not evaluate, these
 * fail.
 * ---------------------------------------------------------------------- */

const sessionStore = createMemoryStorage();
beforeAll(() => {
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionStore, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: createMemoryStorage(), configurable: true, writable: true });
});

const { useScenarioStore } = await import("@/stores/scenario-store");
const { calculateScenario } = await import("@/lib/planning-engine/scenarios");
const { buildScenarioInput, historicalPeriodsForScenario } = await import("@/lib/planning-engine/scenario-limits");
const { SEED_SCENARIOS } = await import("@/data/synthetic/scenarios");
const { PRODUCTION_LINES } = await import("@/data/synthetic/master-data");
const { basisBanner, controlNotice, demandDisplay, fmtRunRate, fmtThreshold, resetPlan, runRateControlModel, targetUtilizationControlModel } = await import("./controls");

const HALLOWEEN = "scn_halloween_line03_relief";
const LINE_03 = PRODUCTION_LINES.find((l) => l.id === "line_03")!;
const RUN_RATE_KEY = `line:${LINE_03.id}:run_rate`;

const store = () => useScenarioStore.getState();
const scenario = () => store().scenarios[HALLOWEEN]!;

/** Exactly what the component does: rebuild the engine input from the store, run it. */
function engineInput() {
  const s = scenario();
  return buildScenarioInput(s, HALLOWEEN, s.overrides);
}
function result() {
  return calculateScenario(engineInput());
}
/** The PRODUCTION bucket this scenario actually evaluates — never a hard-coded month. */
function evaluatedPeriod(): string {
  return engineInput().capacityBuckets[0]!.period;
}
function line03Row() {
  return result().capacityImpact.find((c) => c.lineId === LINE_03.id)!;
}
function runRateModel() {
  const s = scenario();
  const input = engineInput();
  return runRateControlModel({
    line: LINE_03,
    runRateOverride: s.overrides.masterAssumptions?.[RUN_RATE_KEY],
    capacityOverride: s.overrides.capacity?.[`${LINE_03.id}:${evaluatedPeriod()}`],
    observedMedianRunRate: input.observedRunRateByLine.get(LINE_03.id) ?? 0,
  });
}

beforeEach(() => {
  sessionStore.clear();
  useScenarioStore.setState({
    scenarios: Object.fromEntries(SEED_SCENARIOS.map((s) => [s.id, structuredClone(s)])),
    activeScenarioId: HALLOWEEN,
    comparisonScenarioIds: [],
  });
});

/* ====================================================================== *
 * Punch item 2 — the custom run-rate input was dead.
 * ====================================================================== */

describe("run-rate control wiring", () => {
  it("displays the STORED scenario value, not a hard-coded 8,200", () => {
    store().setRunRate(HALLOWEEN, LINE_03.id, evaluatedPeriod(), 6000);
    expect(runRateModel().inputValue).toBe(6000);
    expect(runRateModel().resolved.unitsPerHour).toBe(6000);
    expect(runRateModel().resolved.source).toBe("scenario_value");
  });

  it("falls back to the line's own standard rate when the scenario stores no run rate — never to a literal", () => {
    store().resetScenario(HALLOWEEN);
    const model = runRateModel();
    expect(model.inputValue).toBe(LINE_03.standardRunRateUnitsPerHour);
    expect(model.basis).toBe("system");
    expect(model.resolved.source).toBe("line_standard");
    // The old JSX read `runRateOverride?.scenarioValue ?? 8200`, so an
    // override-free scenario displayed 8,200/hr regardless of the data.
    expect(model.inputValue).not.toBe(8200);
  });

  it("moves effective utilization: a slower rate needs more hours, a faster rate fewer", () => {
    const period = evaluatedPeriod();
    store().setRunRate(HALLOWEEN, LINE_03.id, period, 6000);
    const slow = line03Row().effectiveUtilization;
    store().setRunRate(HALLOWEEN, LINE_03.id, period, 20000);
    const fast = line03Row().effectiveUtilization;

    expect(slow).toBeGreaterThan(fast);
    // The exact failure the audit saw: typing a rate and watching the number
    // snap back, unchanged.
    expect(runRateModel().inputValue).toBe(20000);
  });

  it("clamps out-of-range rates and reports what was applied", () => {
    const applied = store().setRunRate(HALLOWEEN, LINE_03.id, evaluatedPeriod(), 0);
    expect(applied.clamped).toBe(true);
    expect(applied.value).toBe(100);
    const notice = controlNotice(applied, fmtRunRate);
    expect(notice?.tone).toBe("clamped");
    expect(notice?.text).toMatch(/100/);
    // A zero rate would divide demand by zero — the store must never store it.
    expect(runRateModel().resolved.unitsPerHour).toBe(100);
  });

  it("reports a redundant set as a no-op rather than a change", () => {
    const period = evaluatedPeriod();
    store().setRunRate(HALLOWEEN, LINE_03.id, period, 8200);
    const again = store().setRunRate(HALLOWEEN, LINE_03.id, period, 8200);
    expect(again.noop).toBe(true);
    expect(controlNotice(again, fmtRunRate)?.tone).toBe("noop");
  });

  it("System → Custom preserves the planner's stored rate instead of resetting it", () => {
    store().setRunRate(HALLOWEEN, LINE_03.id, evaluatedPeriod(), 6000);
    store().setRunRateBasis(HALLOWEEN, LINE_03.id, "system");
    expect(runRateModel().resolved.unitsPerHour).toBe(LINE_03.standardRunRateUnitsPerHour);
    // No magic value passed on the way back — the component must not re-seed 8,200.
    store().setRunRateBasis(HALLOWEEN, LINE_03.id, "scenario");
    expect(runRateModel().inputValue).toBe(6000);
    expect(runRateModel().resolved.unitsPerHour).toBe(6000);
  });

  it("historical basis resolves to the observed median from execution history", () => {
    store().setRunRateBasis(HALLOWEEN, LINE_03.id, "historical");
    const model = runRateModel();
    expect(model.resolved.source).toBe("observed_median");
    expect(model.scenarioLabel).toMatch(/^Historical/);
  });
});

/* ====================================================================== *
 * Punch item 3 — the utilization-alert-threshold input was dead.
 * ====================================================================== */

describe("utilization alert threshold wiring", () => {
  it("reaches the engine when written against the period the scenario evaluates", () => {
    const period = evaluatedPeriod();
    const before = line03Row().targetUtilization;
    store().setTargetUtilization(HALLOWEEN, LINE_03.id, period, 0.5);
    expect(line03Row().targetUtilization).toBe(0.5);
    expect(line03Row().targetUtilization).not.toBe(before);
  });

  it("a threshold written against a period this scenario does not evaluate changes nothing", () => {
    // The component used to hard-code "2027-09" — the Holiday build month —
    // while the Halloween scenario evaluates the June production peak. The
    // override landed on a bucket key the engine never read.
    const period = evaluatedPeriod();
    const before = line03Row().targetUtilization;
    store().setTargetUtilization(HALLOWEEN, LINE_03.id, "2027-09", 0.5);
    expect(line03Row().targetUtilization).toBe(before);
    expect(period).not.toBe("2027-09");
  });

  it("re-classifies risk without moving the modeled load", () => {
    const period = evaluatedPeriod();
    const before = line03Row();
    store().setTargetUtilization(HALLOWEEN, LINE_03.id, period, 0.5);
    const after = line03Row();
    expect(after.effectiveUtilization).toBe(before.effectiveUtilization);
    expect(after.riskLevel).not.toBe("positive");

    store().setTargetUtilization(HALLOWEEN, LINE_03.id, period, 1);
    const relaxed = line03Row();
    expect(relaxed.effectiveUtilization).toBe(before.effectiveUtilization);
    expect(relaxed.riskLevel).toBe(relaxed.effectiveUtilization > 1 ? "critical" : "positive");
  });

  it("clamps a negative threshold to 0% and a 200% threshold to 100%", () => {
    const period = evaluatedPeriod();
    const low = store().setTargetUtilization(HALLOWEEN, LINE_03.id, period, -0.1);
    expect(low.clamped).toBe(true);
    expect(low.value).toBe(0);
    expect(controlNotice(low, fmtThreshold)?.tone).toBe("clamped");

    const high = store().setTargetUtilization(HALLOWEEN, LINE_03.id, period, 2);
    expect(high.clamped).toBe(true);
    expect(high.value).toBe(1);
    expect(line03Row().targetUtilization).toBe(1);
  });

  it("renders whole percents and the engine's own bounds", () => {
    const model = targetUtilizationControlModel({ baselineTargetUtilization: 0.9, override: undefined });
    expect(model.inputPct).toBe(90);
    expect(model.minPct).toBe(0);
    expect(model.maxPct).toBe(100);
    expect(model.changed).toBe(false);

    const overridden = targetUtilizationControlModel({ baselineTargetUtilization: 0.9, override: 0.85 });
    expect(overridden.inputPct).toBe(85);
    expect(overridden.changed).toBe(true);
  });

  it("an override equal to the baseline is not a change", () => {
    expect(targetUtilizationControlModel({ baselineTargetUtilization: 0.9, override: 0.9 }).changed).toBe(false);
  });
});

/* ====================================================================== *
 * Punch item 18 — Reset silently gutted a named scenario.
 * ====================================================================== */

describe("reset confirmation", () => {
  it("names every assumption that will be discarded", () => {
    const plan = resetPlan({ scenarioName: scenario().name, status: scenario().status, diffs: store().overrideDiffs(HALLOWEEN) });
    expect(plan.destructive).toBe(true);
    expect(plan.losses.length).toBe(store().overrideCount(HALLOWEEN));
    expect(plan.losses.length).toBeGreaterThan(0);
    expect(plan.title).toContain(scenario().name);
    // The seeded scenario is "preferred", not a scratch draft.
    expect(plan.standingWarning).toBeTruthy();
  });

  it("names the run rate specifically once one is set", () => {
    store().setRunRate(HALLOWEEN, LINE_03.id, evaluatedPeriod(), 6000);
    const plan = resetPlan({ scenarioName: scenario().name, status: scenario().status, diffs: store().overrideDiffs(HALLOWEEN) });
    expect(plan.losses.join(" ")).toMatch(/6,000/);
  });

  it("says there is nothing to lose when the scenario already resolves to the baseline", () => {
    store().resetScenario(HALLOWEEN);
    const plan = resetPlan({ scenarioName: scenario().name, status: scenario().status, diffs: store().overrideDiffs(HALLOWEEN) });
    expect(plan.destructive).toBe(false);
    expect(plan.losses).toEqual([]);
  });

  it("counts the same overrides the badge counts", () => {
    const diffs = store().overrideDiffs(HALLOWEEN);
    expect(diffs.length).toBe(store().overrideCount(HALLOWEEN));
    expect(resetPlan({ scenarioName: "x", status: "draft", diffs }).losses.length).toBe(store().overrideCount(HALLOWEEN));
  });
});

/* ====================================================================== *
 * Punch item 15 — "EXPECTED DEMAND 0–0" with no basis.
 * ====================================================================== */

describe("basis sufficiency", () => {
  it("shows a banner and refuses to render a demand range once every season is excluded", () => {
    historicalPeriodsForScenario(scenario()).forEach((p) => store().excludeHistoricalPeriod(HALLOWEEN, p.id));
    const r = result();
    expect(r.basis.sufficient).toBe(false);
    const banner = basisBanner(r.basis);
    expect(banner.show).toBe(true);
    expect(banner.detail.length).toBeGreaterThan(0);
    expect(demandDisplay({ basis: r.basis, low: r.expectedDemandUnits.low, high: r.expectedDemandUnits.high })).toBe("No basis");
  });

  it("shows the real range while the basis holds", () => {
    const r = result();
    expect(r.basis.sufficient).toBe(true);
    expect(basisBanner(r.basis).show).toBe(false);
    expect(demandDisplay({ basis: r.basis, low: r.expectedDemandUnits.low, high: r.expectedDemandUnits.high })).toMatch(/^[\d,]+–[\d,]+$/);
  });
});

describe("periodLabel", () => {
  it("labels the production bucket the scenario evaluates, not a sell-through month", async () => {
    const { periodLabel } = await import("./controls");
    expect(periodLabel(evaluatedPeriod())).toBe("June 2027");
    expect(periodLabel("2027-09")).toBe("September 2027");
    expect(periodLabel("not-a-period")).toBe("not-a-period");
  });
});

describe("controlNotice", () => {
  it("stays silent when a value was applied exactly as typed", () => {
    expect(controlNotice({ applied: true, value: 6000, requested: 6000, clamped: false, noop: false }, fmtRunRate)).toBeNull();
    expect(controlNotice(null, fmtRunRate)).toBeNull();
  });

  it("reports a rejected write", () => {
    const notice = controlNotice({ applied: false, value: NaN, requested: NaN, clamped: false, noop: true, reason: "Unknown scenario." }, fmtRunRate);
    expect(notice?.tone).toBe("rejected");
  });
});
