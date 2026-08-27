import { describe, expect, it } from "vitest";
import {
  SWATCH_TOKENS,
  buildTooltipRows,
  deltaText,
  derivationText,
  flattenTooltipText,
  shareOf,
  softToken,
  swatchVar,
  type TooltipRow,
} from "@/lib/charts/tooltip-model";

describe("swatchVar / softToken", () => {
  it("wraps a token name in var() and nothing else", () => {
    expect(swatchVar("--state-inferred")).toBe("var(--state-inferred)");
    expect(swatchVar("--risk-critical")).toBe("var(--risk-critical)");
  });

  it("emits var() for every declared token, never a literal colour", () => {
    for (const t of SWATCH_TOKENS) {
      const v = swatchVar(t);
      expect(v).toBe(`var(${t})`);
      expect(v).not.toMatch(/#|oklch|rgb|hsl/);
    }
  });

  it("only declares state, risk and neutral-chrome tokens", () => {
    for (const t of SWATCH_TOKENS) {
      expect(t).toMatch(/^--(state|risk|text|border|accent)/);
    }
  });

  it("derives the soft fill variant, and is idempotent", () => {
    expect(softToken("--state-inferred")).toBe("--state-inferred-soft");
    expect(softToken("--state-inferred-soft")).toBe("--state-inferred-soft");
    expect(softToken("--risk-warning")).toBe("--risk-warning-soft");
  });
});

describe("buildTooltipRows", () => {
  it("keeps order and defaults key to label and tone to default", () => {
    const rows = buildTooltipRows([
      { label: "Formal", value: "266.4h", token: "--state-formal" },
      { label: "Inferred", value: "42.0h", token: "--state-inferred" },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["Formal", "Inferred"]);
    expect(rows.map((r) => r.label)).toEqual(["Formal", "Inferred"]);
    expect(rows[0]?.tone).toBe("default");
    expect(rows[0]?.token).toBe("--state-formal");
  });

  it("drops rows with no value, so a tooltip never advertises an absent series", () => {
    const rows = buildTooltipRows([
      { label: "Formal", value: "266.4h" },
      { label: "Validated", value: null },
      { label: "Inferred", value: undefined },
      { label: "Scenario", value: "" },
      { label: "Broken", value: Number.NaN },
      { label: "Infinite", value: Number.POSITIVE_INFINITY },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Formal"]);
  });

  it("drops zero rows only when omitWhenZero is set", () => {
    const rows = buildTooltipRows([
      { label: "Scenario", value: 0, omitWhenZero: true },
      { label: "Gap", value: 0 },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Gap"]);
    expect(rows[0]?.value).toBe("0");
  });

  it("formats a raw number to at most one decimal as a fallback", () => {
    const rows = buildTooltipRows([
      { label: "a", value: 266.44 },
      { label: "b", value: 1234567 },
      { label: "c", value: 5 },
    ]);
    expect(rows.map((r) => r.value)).toEqual(["266.4", "1,234,567", "5"]);
  });

  it("passes a preformatted string through untouched", () => {
    const rows = buildTooltipRows([{ label: "a", value: "266.4h of 405.0h" }]);
    expect(rows[0]?.value).toBe("266.4h of 405.0h");
  });

  it("carries explicit key, tone and hint", () => {
    const rows = buildTooltipRows([{ key: "k", label: "Ceiling", value: "405.0h", tone: "muted", hint: "Rated hours net of downtime" }]);
    expect(rows[0]).toEqual({ key: "k", label: "Ceiling", value: "405.0h", token: undefined, tone: "muted", hint: "Rated hours net of downtime" });
  });
});

describe("shareOf", () => {
  it("returns the fraction", () => {
    expect(shareOf(266.4, 405)).toBeCloseTo(0.65778, 5);
  });

  it("returns null rather than Infinity/NaN for an unusable denominator", () => {
    expect(shareOf(10, 0)).toBeNull();
    expect(shareOf(10, -5)).toBeNull();
    expect(shareOf(Number.NaN, 5)).toBeNull();
    expect(shareOf(10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("allows a share above 1 (over-ceiling load is real)", () => {
    expect(shareOf(500, 405)).toBeGreaterThan(1);
  });
});

describe("derivationText", () => {
  it("produces the canonical derivation footnote", () => {
    expect(derivationText({ part: 266.4, whole: 405, unit: "h", wholeLabel: "ceiling" })).toBe("266.4h ÷ 405.0h ceiling = 65.8%");
  });

  it("omits the denominator label when not given", () => {
    expect(derivationText({ part: 50, whole: 200, unit: "h" })).toBe("50.0h ÷ 200.0h = 25.0%");
  });

  it("honours digit overrides", () => {
    expect(derivationText({ part: 1, whole: 3, digits: 0, pctDigits: 0 })).toBe("1 ÷ 3 = 33%");
  });

  it("returns null instead of a misleading string when the share is undefined", () => {
    expect(derivationText({ part: 10, whole: 0 })).toBeNull();
  });
});

describe("deltaText", () => {
  it("labels an increase with a plus", () => {
    const d = deltaText(266.4, 224.4, { unit: "h" });
    expect(d).not.toBeNull();
    expect(d!.direction).toBe("up");
    expect(d!.delta).toBeCloseTo(42, 6);
    expect(d!.text).toBe("+42.0h vs baseline 224.4h");
  });

  it("labels a decrease with a true minus sign and a positive magnitude", () => {
    const d = deltaText(200, 250, { unit: "h", baselineLabel: "prior year" });
    expect(d!.direction).toBe("down");
    expect(d!.text).toBe("−50.0h vs prior year 250.0h");
  });

  it("treats an equal value as flat", () => {
    const d = deltaText(100, 100);
    expect(d!.direction).toBe("flat");
    expect(d!.text).toBe("±0.0 vs baseline 100.0");
  });

  it("returns null for non-finite inputs", () => {
    expect(deltaText(Number.NaN, 1)).toBeNull();
    expect(deltaText(1, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("flattenTooltipText", () => {
  const rows: TooltipRow[] = [
    { key: "f", label: "Formal", value: "266.4h", tone: "default" },
    { key: "i", label: "AI inferred", value: "42.0h", tone: "default" },
  ];

  it("joins title, subtitle, rows and footnote into one announceable sentence", () => {
    expect(
      flattenTooltipText({
        title: "Line 3 · Mar 2027",
        subtitle: "Effective load",
        rows,
        footnote: "266.4h ÷ 405.0h ceiling = 65.8%",
      })
    ).toBe("Line 3 · Mar 2027 — Effective load. Formal 266.4h, AI inferred 42.0h. 266.4h ÷ 405.0h ceiling = 65.8%");
  });

  it("skips missing and blank sections without leaving stray separators", () => {
    expect(flattenTooltipText({ title: "Mar 2027", rows: [] })).toBe("Mar 2027");
    expect(flattenTooltipText({ rows, footnote: "   " })).toBe("Formal 266.4h, AI inferred 42.0h");
    expect(flattenTooltipText({})).toBe("");
  });
});
