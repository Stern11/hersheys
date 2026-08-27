import { describe, it, expect } from "vitest";
import { parseIntent, parseNumber } from "./intents";
import type { CopilotIntentKind } from "./types";

/**
 * The parser is the surface the audit found 60% dead: the top-bar bar
 * recognized ~8 command phrasings and NO questions, so "why is Line 03 red"
 * — the query its own placeholder advertises — produced nothing on every
 * route. These tests pin the recognized surface, phrasing by phrasing.
 */

function kindOf(text: string): CopilotIntentKind {
  return parseIntent(text).kind;
}

describe("parseIntent — questions (the half that used to be entirely missing)", () => {
  const explainLine = [
    "why is line 03 red",
    "Why is Line 03 red?",
    "why is line 03 at risk",
    "why is line_03 red",
    "why is Stuarts Draft L03 red",
    "why is l03 amber",
    "explain line 03",
    "what's going on with line 03",
    "why is it red",
    "why is this line critical",
  ];
  it.each(explainLine)("%s -> explain_line", (q) => {
    expect(kindOf(q)).toBe("explain_line");
  });

  const deadline = ["what's driving the deadline", "what is driving the deadline?", "why is the deadline so early", "when do I need to decide", "show me the order-by date", "how long do I have"];
  it.each(deadline)("%s -> explain_deadline", (q) => {
    expect(kindOf(q)).toBe("explain_deadline");
  });

  const recommend = ["what should I do", "what should i do?", "what are my options", "what can I do about it", "recommend something", "how do I fix this", "what are my levers", "next steps"];
  it.each(recommend)("%s -> recommend", (q) => {
    expect(kindOf(q)).toBe("recommend");
  });

  const evidence = ["show me the evidence", "what evidence backs this", "show me the signals"];
  it.each(evidence)("%s -> explain_evidence", (q) => {
    expect(kindOf(q)).toBe("explain_evidence");
  });

  const changed = ["what changed", "what's changed", "what has changed since baseline", "what did I change", "list the overrides", "what's different"];
  it.each(changed)("%s -> what_changed", (q) => {
    expect(kindOf(q)).toBe("what_changed");
  });

  const basis = ["what's the basis", "why this basis", "what methodology is this", "how did you calculate that"];
  it.each(basis)("%s -> explain_basis", (q) => {
    expect(kindOf(q)).toBe("explain_basis");
  });
});

describe("parseIntent — mutations", () => {
  it("reads a season lookback in digits and in words", () => {
    expect(parseIntent("use 5 seasons")).toEqual({ kind: "mutate", command: { op: "setLookback", seasons: 5 } });
    expect(parseIntent("what if I use five seasons")).toEqual({ kind: "mutate", command: { op: "setLookback", seasons: 5 } });
    expect(parseIntent("look back over 2 seasons")).toEqual({ kind: "mutate", command: { op: "setLookback", seasons: 2 } });
  });

  it("reads a run rate WITHOUT mistaking the line number for the rate", () => {
    const intent = parseIntent("set line 03 run rate to 6000");
    expect(intent.kind).toBe("mutate");
    if (intent.kind !== "mutate" || intent.command.op !== "setRunRate") throw new Error("wrong intent");
    expect(intent.command.unitsPerHour).toBe(6000);
    expect(intent.command.lineQuery).toContain("line 03");
  });

  it("reads a comma-formatted run rate", () => {
    const intent = parseIntent("set Line 03's run rate to 8,200 an hour");
    if (intent.kind !== "mutate" || intent.command.op !== "setRunRate") throw new Error("wrong intent");
    expect(intent.command.unitsPerHour).toBe(8200);
  });

  it("reads lead-time basis switches", () => {
    expect(parseIntent("use the P80 lead time")).toMatchObject({ kind: "mutate", command: { op: "setLeadTimeBasis", basis: "historical", statistic: "p80" } });
    expect(parseIntent("use the median lead time for printed film")).toMatchObject({ kind: "mutate", command: { op: "setLeadTimeBasis", basis: "historical", statistic: "median" } });
    expect(parseIntent("reset the lead time to the system assumption")).toMatchObject({ kind: "mutate", command: { op: "setLeadTimeBasis", basis: "system" } });
  });

  it("reads a threshold as a fraction, including out-of-range asks", () => {
    expect(parseIntent("set the alert threshold to 50%")).toMatchObject({ kind: "mutate", command: { op: "setTargetUtilization", pct: 0.5 } });
    expect(parseIntent("set line 03's alert threshold to 200%")).toMatchObject({ kind: "mutate", command: { op: "setTargetUtilization", pct: 2 } });
    expect(parseIntent("flag line 03 below 90%")).toMatchObject({ kind: "mutate", command: { op: "setTargetUtilization", pct: 0.9 } });
  });

  it("reads season exclusion/inclusion and growth", () => {
    expect(parseIntent("exclude 2025")).toEqual({ kind: "mutate", command: { op: "excludeSeason", year: "2025" } });
    expect(parseIntent("include 2024 in the basis")).toEqual({ kind: "mutate", command: { op: "includeSeason", year: "2024" } });
    expect(parseIntent("set growth to 12%")).toMatchObject({ kind: "mutate", command: { op: "setGrowth", pct: 0.12 } });
  });

  it("reads lifecycle commands", () => {
    expect(parseIntent("reset the scenario")).toEqual({ kind: "mutate", command: { op: "reset" } });
    expect(parseIntent("save this scenario")).toEqual({ kind: "mutate", command: { op: "save" } });
  });
});

describe("parseIntent — navigation, and the boundary against questions", () => {
  it("navigates only on an explicit target", () => {
    expect(parseIntent("open decisions")).toEqual({ kind: "navigate", target: "decisions" });
    expect(parseIntent("go to the overview")).toEqual({ kind: "navigate", target: "overview" });
    expect(parseIntent("open scenario lab")).toEqual({ kind: "navigate", target: "scenario-lab" });
    expect(parseIntent("gaps")).toEqual({ kind: "navigate", target: "gaps" });
  });

  it("does NOT navigate for a question that merely contains a page word", () => {
    // The old bar matched /\bgaps?\b/ anywhere and hijacked real questions.
    expect(kindOf("what should I do")).toBe("recommend");
    expect(kindOf("show me the evidence")).toBe("explain_evidence");
    expect(kindOf("what's driving the deadline")).toBe("explain_deadline");
  });
});

describe("parseIntent — greetings and the honest fallback", () => {
  it.each(["hello", "hi there", "hey", "what can you do", "help"])("%s -> greeting", (q) => {
    expect(kindOf(q)).toBe("greeting");
  });

  it("returns unrecognized rather than guessing", () => {
    expect(kindOf("asdkjhasd")).toBe("unrecognized");
    expect(kindOf("write me a poem about cocoa futures")).toBe("unrecognized");
    expect(kindOf("")).toBe("unrecognized");
  });

  it("does not read three different unrecognized inputs as three different things", () => {
    // The audit found "hello" / "what should I do" / "show me the evidence"
    // returning three IDENTICAL canned fallbacks. The inverse must hold:
    // these are three DIFFERENT intents, and only true nonsense falls back.
    expect(new Set(["hello", "what should I do", "show me the evidence"].map(kindOf)).size).toBe(3);
  });
});

describe("parseNumber", () => {
  it("handles commas and trailing punctuation", () => {
    expect(parseNumber("8,200")).toBe(8200);
    expect(parseNumber("6000.")).toBe(6000);
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});
