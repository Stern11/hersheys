import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createMemoryStorage } from "@/stores/memory-storage";

// Install Web Storage BEFORE the scenario store module runs any persistence.
const sessionStore = createMemoryStorage();
beforeAll(() => {
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionStore, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: createMemoryStorage(), configurable: true, writable: true });
});

const { useScenarioStore } = await import("@/stores/scenario-store");
const { buildToolRegistry, invokeTool } = await import("@/lib/ai-tools/registry");
const { buildCopilotSnapshot } = await import("./snapshot");
const { planTurn, composeMutationOutcome, outcomeToText } = await import("./engine");
const { SEED_SCENARIOS } = await import("@/data/synthetic/scenarios");
const { HALLOWEEN_PEAK_PRODUCTION_PERIOD } = await import("@/data/synthetic/capacity");
const { isVoiceInputSupported, speechRecognitionCtor, transcriptFromEvent } = await import("./voice");

type AppliedChange = import("@/stores/scenario-store").AppliedChange;

const HALLOWEEN = "scn_halloween_line03_relief";
const store = () => useScenarioStore.getState();
const snapshotOf = (id: string) => buildCopilotSnapshot(store().scenarios[id]!);

function resetStore() {
  sessionStore.clear();
  useScenarioStore.setState({
    scenarios: Object.fromEntries(SEED_SCENARIOS.map((s) => [s.id, structuredClone(s)])),
    activeScenarioId: SEED_SCENARIOS[0]?.id ?? null,
    comparisonScenarioIds: [],
  });
}
beforeEach(resetStore);

/**
 * The full turn, exactly as the component runs it:
 *   plan -> invoke through lib/ai-tools -> re-snapshot -> compose the outcome.
 *
 * Nothing here reimplements a mutation. If a tool name or a parameter shape
 * drifts, `invokeTool` returns status "error" and these tests fail — which is
 * the point: the copilot has no parallel mutation path to drift into.
 */
async function runTurn(text: string, scenarioId: string) {
  const before = snapshotOf(scenarioId);
  const plan = planTurn(text, before);
  if (plan.kind !== "mutation") return { plan, before, outcome: null, toolResult: null };
  const registry = buildToolRegistry({ navigate: () => undefined });
  const toolResult = await invokeTool(registry, plan.mutation.tool, plan.mutation.params);
  const after = snapshotOf(scenarioId);
  const applied = isAppliedChange(toolResult.result) ? toolResult.result : null;
  return { plan, before, after, toolResult, outcome: composeMutationOutcome({ command: plan.command, mutation: plan.mutation, applied, before, after }) };
}

function isAppliedChange(v: unknown): v is AppliedChange {
  return !!v && typeof v === "object" && "applied" in v && "noop" in v;
}

describe("mutations route through the existing typed tool registry", () => {
  it("every tool the copilot can name exists in lib/ai-tools", async () => {
    const registry = buildToolRegistry({ navigate: () => undefined });
    const snapshot = snapshotOf(HALLOWEEN);
    const commands = ["use 2 seasons", "exclude 2025", "include 2024", "use the P80 lead time", "set the lead time to 60 days", "set line 03 run rate to 9000", "set the alert threshold to 85%", "set growth to 12%", "reset the scenario", "save the scenario"];
    for (const text of commands) {
      const plan = planTurn(text, snapshot);
      expect(plan.kind, text).toBe("mutation");
      if (plan.kind !== "mutation") continue;
      expect(registry.has(plan.mutation.tool), `${text} -> ${plan.mutation.tool}`).toBe(true);
      const parsed = registry.get(plan.mutation.tool)!.parametersSchema.safeParse(plan.mutation.params);
      expect(parsed.success, `${text} params: ${JSON.stringify(plan.mutation.params)}`).toBe(true);
    }
  });

  it("targets the PRODUCTION bucket the engine evaluates, not a sell-through month", () => {
    const plan = planTurn("set line 03 run rate to 9000", snapshotOf(HALLOWEEN));
    if (plan.kind !== "mutation") throw new Error("expected mutation");
    expect(plan.mutation.params.period).toBe(HALLOWEEN_PEAK_PRODUCTION_PERIOD);
  });
});

describe("a real change is reported as a real change, with the numbers that moved", () => {
  it("'set line 03 run rate to 6000' moves utilization and says by how much", async () => {
    const { outcome, before, after } = await runTurn("set line 03 run rate to 6000", HALLOWEEN);
    expect(outcome).not.toBeNull();
    expect(outcome!.changed).toBe(true);
    expect(outcome!.headline).toContain("Stuarts Draft L03 run rate set to 6,000/hr");

    const beforeUtil = before.result.capacityImpact.find((c) => c.lineId === "line_03")!.effectiveUtilization;
    const afterUtil = after!.result.capacityImpact.find((c) => c.lineId === "line_03")!.effectiveUtilization;
    expect(afterUtil).toBeGreaterThan(beforeUtil);
    expect(outcomeToText(outcome!)).toContain("effective utilization");
    // The store is the single source: the workspace and the copilot read the same value.
    expect(store().scenarios[HALLOWEEN]!.overrides.masterAssumptions!["line:line_03:run_rate"]!.scenarioValue).toBe(6000);
  });

  it("a clamped request reports the value that was ACTUALLY applied", async () => {
    const { outcome } = await runTurn("set line 03 run rate to 20 an hour", HALLOWEEN);
    const text = outcomeToText(outcome!);
    expect(text).toContain("Requested");
    expect(text).toContain("applied 100/hr");
    expect(store().scenarios[HALLOWEEN]!.overrides.masterAssumptions!["line:line_03:run_rate"]!.scenarioValue).toBe(100);
  });

  it("a threshold change re-classifies risk without pretending it moved load", async () => {
    const beforeRow = snapshotOf(HALLOWEEN).result.capacityImpact.find((c) => c.lineId === "line_03")!;
    const { outcome, after } = await runTurn("set line 03's alert threshold to 100%", HALLOWEEN);
    const afterRow = after!.result.capacityImpact.find((c) => c.lineId === "line_03")!;
    expect(outcome!.changed).toBe(true);
    expect(afterRow.riskLevel).not.toBe(beforeRow.riskLevel);
    expect(afterRow.effectiveUtilization).toBe(beforeRow.effectiveUtilization);
    expect(outcomeToText(outcome!)).toContain("status warning → positive");
  });
});

/* ---------------------------------------------------------------------- *
 * NO-OP HONESTY — the audit's worst finding.
 * ---------------------------------------------------------------------- */

describe("no-op honesty: a command that cannot change anything is never reported as success", () => {
  it("'use 5 seasons' over a 3-season basis is reported as a NO-OP, not a success", async () => {
    const { outcome, before, after } = await runTurn("use 5 seasons", HALLOWEEN);
    expect(before.availableSeasons).toBe(3);
    expect(outcome!.changed).toBe(false);
    const text = outcomeToText(outcome!);
    expect(text).toMatch(/No change/i);
    expect(text).toContain("3 seasons");
    // And nothing downstream moved.
    expect(after!.result.basis.seasonsUsed).toBe(before.result.basis.seasonsUsed);
    expect(after!.result.expectedDemandUnits.base).toBe(before.result.expectedDemandUnits.base);
    expect(after!.overrideCount).toBe(before.overrideCount);
  });

  it("setting the run rate to the value it already holds is a NO-OP and does not add an override", async () => {
    const current = store().scenarios[HALLOWEEN]!.overrides.masterAssumptions!["line:line_03:run_rate"]!.scenarioValue!;
    const { outcome, before, after } = await runTurn(`set line 03 run rate to ${current}`, HALLOWEEN);
    expect(outcome!.changed).toBe(false);
    expect(outcomeToText(outcome!)).toMatch(/already 8,200\/hr/);
    expect(outcomeToText(outcome!)).toContain("no override was added");
    // The count comes from the engine's meaningful-override diff, so a
    // redundant set cannot inflate it (the old badge went 2 -> 3 here).
    expect(after!.overrideCount).toBe(before.overrideCount);
    expect(after!.overrideCount).toBe(1);
  });

  it("'use the P80 lead time' when P80 is ALREADY the accepted basis is reported as a no-op", async () => {
    const { outcome, before, after } = await runTurn("use the P80 lead time", HALLOWEEN);
    expect(outcome!.changed).toBe(false);
    expect(outcome!.headline).toContain("nothing moved");
    expect(outcomeToText(outcome!)).toContain("already what the baseline resolves to");
    expect(after!.overrideCount).toBe(before.overrideCount);
  });

  it("saving an already-preferred scenario says so instead of claiming a change", async () => {
    const { outcome } = await runTurn("save this scenario", HALLOWEEN);
    expect(outcome!.changed).toBe(false);
    expect(outcome!.headline).toContain("Already preferred");
    expect(store().scenarios[HALLOWEEN]!.status).toBe("preferred");
  });

  it("resetting a scenario with no overrides says there was nothing to reset", async () => {
    await runTurn("reset the scenario", HALLOWEEN);
    const second = await runTurn("reset the scenario", HALLOWEEN);
    expect(second.outcome!.changed).toBe(false);
    expect(second.outcome!.headline).toContain("Nothing to reset");
  });

  it("a real reset reports what it cleared (the confirmation the UI shows)", async () => {
    const { outcome, before } = await runTurn("reset the scenario", HALLOWEEN);
    expect(before.overrideCount).toBe(1);
    expect(outcome!.changed).toBe(true);
    expect(outcome!.headline).toContain("1 override cleared");
    expect(store().scenarios[HALLOWEEN]!.overrides).toEqual({});
  });
});

describe("commands the data cannot support are refused honestly", () => {
  it("excluding a season that is not in the basis lists the ones that are", () => {
    const plan = planTurn("exclude 2019", snapshotOf(HALLOWEEN));
    expect(plan.kind).toBe("answer");
    if (plan.kind !== "answer") return;
    expect(plan.answer.headline).toContain("no 2019 season");
    expect(plan.answer.lines.join(" ")).toContain("Halloween 2026");
  });

  it("an analogue weight command on a non-analogue gap says the lever does not exist here", () => {
    const plan = planTurn("set the analogue weight to 40%", snapshotOf(HALLOWEEN));
    expect(plan.kind).toBe("answer");
    if (plan.kind !== "answer") return;
    expect(plan.answer.headline).toContain("not analogue-based");
  });
});

/* ---------------------------------------------------------------------- *
 * Voice
 * ---------------------------------------------------------------------- */

describe("voice input is only offered where it exists", () => {
  it("reports unsupported when the browser has no Web Speech API", () => {
    expect(isVoiceInputSupported(undefined)).toBe(false);
    expect(isVoiceInputSupported({})).toBe(false);
    expect(speechRecognitionCtor({})).toBeNull();
  });

  it("finds both the standard and the webkit-prefixed constructor", () => {
    class Fake {}
    expect(speechRecognitionCtor({ SpeechRecognition: Fake })).toBe(Fake);
    expect(speechRecognitionCtor({ webkitSpeechRecognition: Fake })).toBe(Fake);
    expect(isVoiceInputSupported({ webkitSpeechRecognition: Fake })).toBe(true);
  });

  it("extracts a transcript without throwing on a malformed event", () => {
    expect(transcriptFromEvent({ results: [[{ transcript: "why is line 03 red" }]] })).toBe("why is line 03 red");
    expect(transcriptFromEvent({ results: [[{ transcript: "why is" }], [{ transcript: "line 03 red" }]] })).toBe("why is line 03 red");
    expect(transcriptFromEvent(null)).toBe("");
    expect(transcriptFromEvent({})).toBe("");
    expect(transcriptFromEvent({ results: [[{}]] })).toBe("");
  });

  it("a voice transcript drives the same parser as typed text", () => {
    const spoken = transcriptFromEvent({ results: [[{ transcript: "Why is Line 03 red" }]] });
    const plan = planTurn(spoken, snapshotOf(HALLOWEEN));
    expect(plan.kind).toBe("answer");
    if (plan.kind !== "answer") return;
    expect(plan.answer.intentKind).toBe("explain_line");
    expect(plan.answer.isFallback).toBe(false);
  });
});
