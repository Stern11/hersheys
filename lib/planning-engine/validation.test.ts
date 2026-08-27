import { describe, it, expect } from "vitest";
import {
  GROWTH_RATE_RANGE,
  RUN_RATE_RANGE,
  TARGET_UTILIZATION_RANGE,
  clampGrowthRate,
  clampHistoricalLookback,
  clampRunRate,
  clampTargetUtilization,
  clampToRange,
  historicalLookbackRange,
} from "./validation";

describe("clampToRange — a stored value is always a value the engine will honor", () => {
  it("reports the request unchanged when it is already legal", () => {
    const r = clampToRange(0.9, TARGET_UTILIZATION_RANGE);
    expect(r).toEqual({ value: 0.9, requested: 0.9, clamped: false });
  });

  it("turns a non-numeric entry into a legal value rather than letting NaN through", () => {
    const r = clampToRange(Number("not a number"), RUN_RATE_RANGE);
    expect(Number.isNaN(r.value)).toBe(false);
    expect(r.value).toBe(RUN_RATE_RANGE.min);
    expect(r.clamped).toBe(true);
  });

  it("never lets Infinity through — non-finite input resolves to 0, then clamps", () => {
    // 0 is the neutral choice: for growth it means "no growth"; for a run
    // rate it lands on the range floor. What matters is that no ±Infinity or
    // NaN ever reaches a division inside the engine.
    expect(clampToRange(Infinity, GROWTH_RATE_RANGE)).toMatchObject({ value: 0, clamped: true });
    expect(clampToRange(-Infinity, GROWTH_RATE_RANGE)).toMatchObject({ value: 0, clamped: true });
    expect(clampToRange(Infinity, RUN_RATE_RANGE).value).toBe(RUN_RATE_RANGE.min);
  });
});

describe("utilization alert threshold — item 3: rejects -10% and 200%", () => {
  it("rejects a negative threshold and applies 0%", () => {
    const r = clampTargetUtilization(-0.1);
    expect(r.clamped).toBe(true);
    expect(r.value).toBe(0);
    expect(r.reason).toMatch(/between/);
  });

  it("rejects a threshold above 100% and applies 100%", () => {
    const r = clampTargetUtilization(2);
    expect(r.clamped).toBe(true);
    expect(r.value).toBe(1);
  });

  it("accepts 50% and 100% untouched", () => {
    expect(clampTargetUtilization(0.5)).toMatchObject({ value: 0.5, clamped: false });
    expect(clampTargetUtilization(1)).toMatchObject({ value: 1, clamped: false });
  });
});

describe("growth assumption — item 15: 128% growth cannot reach the engine", () => {
  it("clamps an absurd growth rate to the stated maximum", () => {
    const r = clampGrowthRate(1.28);
    expect(r.clamped).toBe(true);
    expect(r.value).toBe(GROWTH_RATE_RANGE.max);
  });

  it("still allows a strongly negative business assumption inside the band", () => {
    expect(clampGrowthRate(-0.4)).toMatchObject({ value: -0.4, clamped: false });
  });
});

describe("run rate — a rate of zero would divide demand by zero", () => {
  it("clamps zero and negative rates up to the floor", () => {
    expect(clampRunRate(0).value).toBe(RUN_RATE_RANGE.min);
    expect(clampRunRate(-500).value).toBe(RUN_RATE_RANGE.min);
  });

  it("leaves a realistic rate alone", () => {
    expect(clampRunRate(8200)).toMatchObject({ value: 8200, clamped: false });
  });
});

describe("historical lookback — item 15: the range is data-dependent", () => {
  it("exposes the available season count as the maximum, so the UI can show it", () => {
    expect(historicalLookbackRange(3)).toMatchObject({ min: 1, max: 3 });
    expect(historicalLookbackRange(3).rationale).toMatch(/3 comparable seasons/);
  });

  it("clamps a 53-season request down to what the basis can actually read", () => {
    const r = clampHistoricalLookback(53, 3);
    expect(r.value).toBe(3);
    expect(r.clamped).toBe(true);
  });

  it("clamps a zero/negative lookback up to one season", () => {
    expect(clampHistoricalLookback(0, 3).value).toBe(1);
    expect(clampHistoricalLookback(-4, 3).value).toBe(1);
  });

  it("never returns a maximum below 1, even when nothing is eligible", () => {
    expect(historicalLookbackRange(0).max).toBe(1);
  });
});
