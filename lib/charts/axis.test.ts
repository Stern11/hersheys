import { describe, it, expect } from "vitest";
import { anchorTransform, clampPct, labelAnchor, linearAxis, niceStep, niceTicksWithin, pctOfAxis, pctWithin } from "./axis";

describe("niceStep", () => {
  it("snaps to a readable mantissa", () => {
    expect(niceStep(81)).toBe(100);
    expect(niceStep(1)).toBe(1);
    expect(niceStep(2.1)).toBe(2.5);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(0.3)).toBe(0.5);
    expect(niceStep(1200)).toBe(2000);
  });

  it("never returns 0 or a negative step (callers divide by it)", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });

  it("integer mode never produces a fractional step", () => {
    for (const raw of [0.2, 1, 2.1, 2.4, 7, 25, 260]) {
      const step = niceStep(raw, true);
      expect(Number.isInteger(step)).toBe(true);
      expect(step).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("linearAxis", () => {
  it("always covers the data (nothing a chart draws can overflow the track)", () => {
    for (const dataMax of [1, 7, 99, 405, 413.1, 4_942_080, 0.4]) {
      const axis = linearAxis(dataMax);
      expect(axis.max).toBeGreaterThanOrEqual(dataMax);
      expect(axis.ticks[0]).toBe(0);
      expect(axis.ticks[axis.ticks.length - 1]).toBe(axis.max);
    }
  });

  it("produces ascending, evenly spaced, round ticks", () => {
    const axis = linearAxis(413.1, 5);
    expect(axis.step).toBe(100);
    expect(axis.ticks).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("degrades safely on empty/zero data instead of producing NaN geometry", () => {
    expect(linearAxis(0)).toEqual({ max: 1, step: 1, ticks: [0, 1] });
    expect(linearAxis(Number.NaN).ticks.every(Number.isFinite)).toBe(true);
  });

  it("integer axes for counts have integer ticks", () => {
    for (const maxCount of [1, 2, 3, 7, 13, 31]) {
      const axis = linearAxis(maxCount, 3, true);
      expect(axis.ticks.every(Number.isInteger)).toBe(true);
      expect(axis.max).toBeGreaterThanOrEqual(maxCount);
    }
  });
});

describe("niceTicksWithin", () => {
  it("returns round values strictly inside a non-zero-based domain", () => {
    const ticks = niceTicksWithin(31, 96, 5);
    expect(ticks.length).toBeGreaterThan(1);
    expect(Math.min(...ticks)).toBeGreaterThanOrEqual(31);
    expect(Math.max(...ticks)).toBeLessThanOrEqual(96);
    expect(ticks.every(Number.isInteger)).toBe(true);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
  });

  it("does not blow up on a degenerate domain", () => {
    expect(niceTicksWithin(42, 42).every(Number.isFinite)).toBe(true);
    expect(niceTicksWithin(10, 5).every(Number.isFinite)).toBe(true);
  });
});

describe("pct helpers", () => {
  it("clamp into the plot box", () => {
    expect(pctOfAxis(250, 500)).toBe(50);
    expect(pctOfAxis(600, 500)).toBe(100);
    expect(pctOfAxis(-10, 500)).toBe(0);
    expect(pctOfAxis(10, 0)).toBe(0);
    expect(pctWithin(50, 30, 70)).toBe(50);
    expect(pctWithin(30, 30, 70)).toBe(0);
    expect(pctWithin(70, 30, 70)).toBe(100);
    expect(pctWithin(5, 30, 30)).toBe(0);
    expect(clampPct(Number.NaN)).toBe(0);
  });
});

describe("labelAnchor", () => {
  it("pulls edge labels inside the box so they cannot be clipped", () => {
    expect(labelAnchor(0)).toBe("start");
    expect(labelAnchor(3)).toBe("start");
    expect(labelAnchor(50)).toBe("middle");
    expect(labelAnchor(97)).toBe("end");
    expect(labelAnchor(100)).toBe("end");
  });

  it("maps to a transform that keeps the element on-canvas", () => {
    expect(anchorTransform(labelAnchor(0))).toBe("translateX(0)");
    expect(anchorTransform(labelAnchor(50))).toBe("translateX(-50%)");
    expect(anchorTransform(labelAnchor(100))).toBe("translateX(-100%)");
  });
});
