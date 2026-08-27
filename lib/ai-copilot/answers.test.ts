import { describe, it, expect } from "vitest";
import type { Scenario, ScenarioOverrides } from "@/types/scenario";
import { SEED_SCENARIOS } from "@/data/synthetic/scenarios";
import { PRODUCTION_LINES } from "@/data/synthetic/master-data";
import { HALLOWEEN_PEAK_PRODUCTION_PERIOD } from "@/data/synthetic/capacity";
import { fmtNum, fmtNum1, fmtPct } from "@/lib/utils/format";
import { buildCopilotSnapshot } from "./snapshot";
import { answerBasis, answerCapabilities, answerDeadline, answerEvidence, answerLineRisk, answerRecommend, answerToText, answerWhatChanged, bindingDeadline, describeDerivedDeltas, resolveLine } from "./answers";
import { planTurn } from "./engine";

/**
 * The previous copilot passed typecheck and lint while being ~60%
 * non-functional, because nothing asserted what it SAID. These tests assert
 * the content: that "why is line 03 red" produces the real load stack, that
 * every figure in it is the figure `calculateScenario()` produced, and that
 * the fallback is a real capability list rather than an apology.
 */

const HALLOWEEN = SEED_SCENARIOS.find((s) => s.id === "scn_halloween_line03_relief")!;
const VALENTINES = SEED_SCENARIOS.find((s) => s.id === "scn_valentines_tin_analogues")!;
const LINE_03 = PRODUCTION_LINES.find((l) => l.id === "line_03")!;

function withOverrides(base: Scenario, overrides: ScenarioOverrides): Scenario {
  return { ...structuredClone(base), overrides };
}

const snapshot = buildCopilotSnapshot(HALLOWEEN);
const line03 = snapshot.result.capacityImpact.find((c) => c.lineId === "line_03")!;

describe("buildCopilotSnapshot — reads the engine, not a stored summary", () => {
  it("evaluates the PRODUCTION bucket, never a sell-through month", () => {
    // Halloween 2027 sells Sep-Oct and is BUILT Mar-Jul. The old Scenario Lab
    // hard-coded "2027-09" for its capacity overrides — a sell month the
    // Halloween RCCP input never loads — so every write landed on a bucket
    // nothing read.
    expect(snapshot.period).toBe(HALLOWEEN_PEAK_PRODUCTION_PERIOD);
    expect(snapshot.period).not.toBe("2027-09");
    expect(snapshot.productionRequirementDate.startsWith("2027-07")).toBe(true);
  });

  it("takes the override count from the engine's meaningful-override diff, not a key count", () => {
    // The seeded scenario stores a 3-season lookback (== baseline) and a P80
    // film basis (== the accepted baseline). Only the 8,200/hr run rate is a
    // real deviation.
    expect(snapshot.overrideCount).toBe(1);
    expect(snapshot.overrideDiffs).toHaveLength(1);
    expect(snapshot.overrideDiffs[0]!.label).toContain("run rate");
  });

  it("carries real material and line names from the data layer", () => {
    expect(Object.values(snapshot.materialNames)).toContain("Printed Seasonal Film");
    expect(snapshot.lines.map((l) => l.name)).toContain("Stuarts Draft L03");
  });
});

describe("answerLineRisk — 'why is line 03 red'", () => {
  const answer = answerLineRisk(snapshot, "why is line 03 red");
  const text = answerToText(answer);

  it("is a substantive answer, not the fallback", () => {
    expect(answer.isFallback).toBe(false);
    expect(answer.intentKind).toBe("explain_line");
    expect(answer.lines.length).toBeGreaterThanOrEqual(6);
    expect(text.length).toBeGreaterThan(400);
  });

  it("names the real line from master data", () => {
    expect(text).toContain("Stuarts Draft L03");
  });

  it("reports the ENGINE's utilization, threshold and formal utilization", () => {
    expect(answer.headline).toContain(fmtPct(line03.effectiveUtilization));
    expect(answer.headline).toContain(fmtPct(line03.targetUtilization));
    expect(answer.headline).toContain(fmtPct(line03.formalUtilization));
  });

  it("breaks out every component of the load stack with the engine's own hours", () => {
    expect(text).toContain(fmtNum1(line03.ceilingHours));
    expect(text).toContain(fmtNum1(line03.formalLoadHours));
    expect(text).toContain(fmtNum1(line03.validatedUnresolvedLoadHours));
    expect(text).toContain(fmtNum1(line03.aiInferredLoadHours));
    // The threshold in hours, which is the number that actually sets the colour.
    expect(text).toContain(fmtNum1(line03.ceilingHours * line03.targetUtilization));
  });

  it("names the run rate the conversion actually divided by, and its basis", () => {
    expect(line03.runRateUnitsPerHour).toBeDefined();
    expect(text).toContain(fmtNum(line03.runRateUnitsPerHour!));
    expect(text).toContain("scenario run rate");
  });

  it("is recomputed per scenario — a different run rate produces different text", () => {
    const slower = buildCopilotSnapshot(withOverrides(HALLOWEEN, { masterAssumptions: { "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 5000 } } }));
    const slowerText = answerToText(answerLineRisk(slower, "why is line 03 red"));
    const slowerRow = slower.result.capacityImpact.find((c) => c.lineId === "line_03")!;
    expect(slowerText).not.toEqual(text);
    expect(slowerText).toContain(fmtPct(slowerRow.effectiveUtilization));
    expect(slowerRow.effectiveUtilization).toBeGreaterThan(line03.effectiveUtilization);
    // And it must not still be quoting the old rate anywhere.
    expect(slowerText).toContain("5,000");
  });

  it("says a line is out of scope rather than inventing a number for it", () => {
    // line_02 exists in master data but the Halloween basis does not load it.
    const answer02 = answerLineRisk(snapshot, "why is line 02 red");
    expect(answer02.headline).toContain("Reese L02");
    expect(answer02.headline).toContain("not loaded by this scenario");
    // It may list the lines that ARE in scope, but must never attribute a
    // utilization to the line it just said it has no number for.
    expect(answerToText(answer02)).not.toMatch(/Reese L02[^.]*\d+%/);
    expect(answer02.headline).not.toMatch(/\d+%/);
  });

  it("falls back to the line actually driving the risk when none is named", () => {
    const anon = answerLineRisk(snapshot, "why is it red");
    expect(anon.headline).toContain("Stuarts Draft L03");
  });
});

describe("resolveLine — resolves against the data layer, not a hard-coded table", () => {
  it.each([
    ["line 03", "line_03"],
    ["line_03", "line_03"],
    ["l03", "line_03"],
    ["stuarts draft l03", "line_03"],
    ["west hershey l04", "line_04"],
    ["reese l01", "line_01"],
  ])("%s -> %s", (query, id) => {
    expect(resolveLine(query, PRODUCTION_LINES)?.id).toBe(id);
  });

  it("returns null for a line that does not exist", () => {
    expect(resolveLine("line 99", PRODUCTION_LINES)).toBeNull();
    expect(resolveLine("the weather", PRODUCTION_LINES)).toBeNull();
  });
});

describe("answerDeadline — 'what's driving the deadline'", () => {
  const answer = answerDeadline(snapshot);
  const text = answerToText(answer);
  const binding = bindingDeadline(snapshot.result)!;

  it("names the engine's binding deadline date and the material driving it", () => {
    expect(answer.isFallback).toBe(false);
    expect(answer.headline).toContain(binding.deadline.date);
    expect(text).toContain(snapshot.materialNames[binding.driver!.materialId]!);
    expect(text).toContain(`${binding.driver!.leadTimeDaysUsed}d`);
  });

  it("anchors to the PRODUCTION requirement date and says so", () => {
    expect(text).toContain(snapshot.productionRequirementDate);
    expect(text).toContain("PRODUCTION window, never the sell-through window");
  });

  it("uses the resolved lead-time BASIS label, not a fixed one", () => {
    expect(binding.driver!.leadTimeBasis).toBe("historical_p80");
    expect(text).toContain("historical P80");
  });
});

describe("answerRecommend — 'what should I do'", () => {
  const answer = answerRecommend(snapshot);
  const text = answerToText(answer);

  it("lists real levers with their real current values and legal ranges", () => {
    expect(answer.isFallback).toBe(false);
    expect(text).toContain(fmtNum(line03.runRateUnitsPerHour!));
    expect(text).toContain(fmtNum(LINE_03.standardRunRateUnitsPerHour));
    expect(text).toContain(fmtNum(snapshot.observedRunRateByLine.line_03!));
    expect(text).toContain(`${fmtNum(snapshot.limits.runRateUnitsPerHour.min)}–${fmtNum(snapshot.limits.runRateUnitsPerHour.max)}/hr`);
  });

  it("names the line with real headroom, computed from that line's own threshold", () => {
    const l04 = snapshot.result.capacityImpact.find((c) => c.lineId === "line_04")!;
    const headroom = l04.ceilingHours * l04.targetUtilization - (l04.formalLoadHours + l04.validatedUnresolvedLoadHours + l04.aiInferredLoadHours + l04.scenarioAdjustmentHours);
    expect(text).toContain("West Hershey L04");
    expect(text).toContain(fmtNum1(headroom));
  });

  it("says out loud that the alert threshold does not move load", () => {
    expect(text).toMatch(/does NOT move the .* load/);
  });

  it("reports the lookback ceiling the store will actually clamp to", () => {
    expect(snapshot.limits.historicalLookback.max).toBe(snapshot.availableSeasons);
    expect(text).toContain(`capped at ${snapshot.limits.historicalLookback.max}`);
  });
});

describe("answerWhatChanged — 'what changed'", () => {
  it("lists the engine's override diffs plus the derived movement", () => {
    const answer = answerWhatChanged(snapshot);
    const text = answerToText(answer);
    expect(answer.headline).toContain(`${snapshot.overrideCount} override`);
    snapshot.overrideDiffs.forEach((d) => {
      expect(text).toContain(d.label);
      expect(text).toContain(d.baseline);
      expect(text).toContain(d.scenario);
    });
    expect(text).toContain("Downstream:");
  });

  it("says NOTHING changed for a scenario that only restates the baseline", () => {
    const answer = answerWhatChanged(buildCopilotSnapshot(VALENTINES));
    expect(answer.headline).toContain("Nothing.");
    expect(answer.headline).toContain("0 overrides");
  });
});

describe("answerEvidence and answerBasis read the real gap/methodology output", () => {
  it("counts and lists the gap's own evidence signals", () => {
    const answer = answerEvidence(snapshot);
    expect(answer.headline).toContain(`${snapshot.evidence.length} evidence signal`);
    expect(answer.headline).toContain(`${snapshot.evidence.filter((e) => e.included).length} included`);
    const excluded = snapshot.evidence.find((e) => !e.included);
    if (excluded?.excludedReason) expect(answerToText(answer)).toContain(excluded.excludedReason);
  });

  it("replays the engine's methodology trace verbatim", () => {
    const answer = answerBasis(snapshot);
    const text = answerToText(answer);
    snapshot.result.methodologyTrace.forEach((t) => {
      expect(text).toContain(t.step);
      expect(text).toContain(t.outputSummary);
    });
  });
});

describe("answerCapabilities — the honest fallback", () => {
  const answer = answerCapabilities(snapshot, { greeting: false, unrecognizedText: "write me a poem" });
  const text = answerToText(answer);

  it("is marked as a fallback and quotes what it could not place", () => {
    expect(answer.isFallback).toBe(true);
    expect(answer.headline).toContain("write me a poem");
  });

  it("lists CAPABILITIES with live values rather than apologising", () => {
    expect(text).not.toMatch(/sorry|apolog/i);
    expect(text).toContain("why is Stuarts Draft L03 red");
    expect(text).toContain("what's driving the deadline");
    expect(text).toContain("what should I do");
    expect(text).toContain("what changed");
    expect(text).toContain("show me the evidence");
    // Live values, not prose.
    expect(text).toContain(fmtNum(line03.runRateUnitsPerHour!));
    expect(text).toContain(`${snapshot.evidence.length} signals`);
    expect(text).toContain(`${snapshot.availableSeasons} comparable season`);
  });

  it("does not pretend to be a general-purpose model", () => {
    expect(text).toContain("I do not have a language model behind me");
  });

  it("greeting and fallback are NOT the same canned string", () => {
    const greeting = answerCapabilities(snapshot, { greeting: true });
    expect(greeting.isFallback).toBe(false);
    expect(greeting.headline).not.toEqual(answer.headline);
  });

  it("still lists something useful with no scenario loaded", () => {
    const none = answerCapabilities(null, { greeting: false, unrecognizedText: "xyz" });
    expect(none.isFallback).toBe(true);
    expect(answerToText(none)).toContain("why is <line> red");
  });
});

describe("describeDerivedDeltas — the mechanism behind no-op honesty", () => {
  it("is EMPTY when two runs of the engine agree", () => {
    const a = buildCopilotSnapshot(HALLOWEEN);
    const b = buildCopilotSnapshot(HALLOWEEN);
    expect(describeDerivedDeltas(a.result, b.result, a.lines)).toEqual([]);
  });

  it("names each moved metric with before -> after when something really changes", () => {
    const faster = buildCopilotSnapshot(withOverrides(HALLOWEEN, { masterAssumptions: { "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 20000 } } }));
    const deltas = describeDerivedDeltas(snapshot.result, faster.result, snapshot.lines);
    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.join(" ")).toContain("Stuarts Draft L03 effective utilization");
    expect(deltas.join(" ")).toContain("20,000/hr");
  });
});

describe("planTurn routes every supported query to a real answer", () => {
  it.each([
    ["why is line 03 red", "explain_line"],
    ["what's driving the deadline", "explain_deadline"],
    ["what should I do", "recommend"],
    ["show me the evidence", "explain_evidence"],
    ["what changed", "what_changed"],
    ["what's the basis", "explain_basis"],
  ])("%s produces a non-fallback answer", (query, intentKind) => {
    const plan = planTurn(query, snapshot);
    expect(plan.kind).toBe("answer");
    if (plan.kind !== "answer") return;
    expect(plan.answer.intentKind).toBe(intentKind);
    expect(plan.answer.isFallback).toBe(false);
    expect(plan.answer.derivedFrom.length).toBeGreaterThan(0);
    // Every answer must contain at least one number computed from the engine.
    expect(answerToText(plan.answer)).toMatch(/\d/);
  });

  it("routes navigation without touching scenario state", () => {
    const plan = planTurn("open decisions", snapshot);
    expect(plan).toMatchObject({ kind: "navigate", path: "/decisions" });
  });

  it("answers explanation queries with no scenario loaded by saying so, not by inventing one", () => {
    const plan = planTurn("why is line 03 red", null);
    expect(plan.kind).toBe("answer");
    if (plan.kind !== "answer") return;
    expect(plan.answer.headline).toContain("No scenario is loaded");
  });
});
