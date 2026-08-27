import { describe, it, expect } from "vitest";
import {
  bandsOverlap,
  buildGapChartModel,
  LABEL_OFFSET_PCT,
  MARK_TOP_GUARD_PCT,
  markTopGuard,
  resolveFormalLabel,
  SHORTFALL_LABEL_COMPACT_PCT,
  SHORTFALL_LABEL_FULL_PCT,
  type GapChartRowInput,
} from "./gap-chart-model";

const ROWS: GapChartRowInput[] = [
  { period: "Halloween 2024", actual: 3_950_000 },
  { period: "Halloween 2025", actual: 4_180_000 },
  { period: "Halloween 2026", actual: 4_400_000 },
  { period: "Halloween 2027", low: 4_561_920, base: 4_752_000, high: 4_942_080 },
];

describe("gap chart model — a readable y scale", () => {
  it("uses round gridline values a planner can read a number off", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    expect(model.axis.ticks.every((t) => t % model.axis.step === 0)).toBe(true);
    expect(model.axis.max).toBeGreaterThanOrEqual(4_942_080);
    expect(model.axis.ticks[0]).toBe(0);
  });

  it("keeps every drawn element inside the plot box", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    for (const r of model.rows) {
      if (r.actualHeightPct != null) {
        expect(r.actualHeightPct).toBeGreaterThan(0);
        expect(r.actualHeightPct).toBeLessThanOrEqual(100);
      }
      if (r.range) {
        expect(r.range.topPct).toBeGreaterThanOrEqual(0);
        expect(r.range.topPct + r.range.heightPct).toBeLessThanOrEqual(100.001);
        expect(r.range.labelTopPct).toBeGreaterThanOrEqual(0);
        expect(r.range.baseOffsetPct!).toBeGreaterThanOrEqual(0);
        expect(r.range.baseOffsetPct!).toBeLessThanOrEqual(r.range.heightPct + 0.001);
      }
    }
    expect(model.formal.topPct).toBeGreaterThanOrEqual(0);
    expect(model.formal.topPct).toBeLessThanOrEqual(100);
  });

  it("bar length encodes the value it is drawn for", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    const a = model.rows[0]!;
    const b = model.rows[2]!;
    expect(a.actualHeightPct!).toBeCloseTo((a.actual! / model.axis.max) * 100, 6);
    expect(b.actualHeightPct!).toBeGreaterThan(a.actualHeightPct!);
    const band = model.rows[3]!.range!;
    expect(band.heightPct).toBeCloseTo(((band.high - band.low) / model.axis.max) * 100, 6);
  });

  it("moves the formal-plan caption below its line when the line is at the top of the box", () => {
    // A line low in the box, with nothing anchored where its caption goes,
    // keeps the caption above itself. (ROWS/3.8M is NOT that case — there the
    // caption is displaced by the shortfall caption and the left-most bar's
    // top edge; see the anti-collision suite.)
    const low = buildGapChartModel(ROWS, 1_000_000);
    expect(low.formal.labelBelow).toBe(false);
    // a case where the nice axis lands tight against the data, pushing the
    // formal line into the top caption band
    const tight = buildGapChartModel([{ period: "p", actual: 5300 }], 5300);
    expect(tight.formal.topPct).toBeLessThan(12);
    expect(tight.formal.labelBelow).toBe(true);
  });
});

describe("gap chart model — legend honesty", () => {
  it("advertises only the series that are actually drawn", () => {
    // exhaustive shape (incl. the covered/shortfall/trend marks added later)
    // is asserted in "legend honesty for the new marks" below
    expect(buildGapChartModel(ROWS, 3_800_000).legend).toMatchObject({ historical: true, range: true, base: true, formal: true });
  });

  it("drops 'Historical actual' when no row carries one", () => {
    const legend = buildGapChartModel([{ period: "p", low: 10, high: 20, base: 15 }], 12).legend;
    expect(legend.historical).toBe(false);
    expect(legend.range).toBe(true);
  });

  it("does not claim 'P50 marked' when no P50 point exists", () => {
    const legend = buildGapChartModel([{ period: "p", low: 10, high: 20 }], 12).legend;
    expect(legend.range).toBe(true);
    expect(legend.base).toBe(false);
  });

  it("drops the range entry entirely when there is no envelope", () => {
    const legend = buildGapChartModel([{ period: "p", actual: 10 }], 12).legend;
    expect(legend.range).toBe(false);
    expect(legend.base).toBe(false);
  });
});

describe("gap chart model — degenerate input", () => {
  it("produces finite geometry for empty data", () => {
    const model = buildGapChartModel([], 0);
    expect(model.rows).toEqual([]);
    expect(Number.isFinite(model.axis.max)).toBe(true);
    expect(Number.isFinite(model.formal.topPct)).toBe(true);
    expect(model.legend.formal).toBe(false);
  });

  it("gives a degenerate low===high band a visible minimum height", () => {
    const model = buildGapChartModel([{ period: "p", low: 100, high: 100 }], 50);
    expect(model.rows[0]!.range!.heightPct).toBeGreaterThan(0);
  });
});

/* ===========================================================================
 * The shortfall — the whole reason the chart exists. It must be a drawn
 * quantity, not a subtraction the planner performs by eye.
 * ========================================================================= */

describe("gap chart model — the shortfall is geometry, not a caption", () => {
  const model = buildGapChartModel(ROWS, 3_800_000);

  it("quantifies the unrepresented volume against the expected point", () => {
    const sf = model.shortfall!;
    expect(sf).toBeTruthy();
    expect(sf.expectedPoint).toBe(4_752_000);
    expect(sf.formalValue).toBe(3_800_000);
    expect(sf.value).toBe(952_000);
    expect(sf.shareOfExpected).toBeCloseTo(952_000 / 4_752_000, 9);
  });

  it("carries the shortfall's own uncertainty rather than one number", () => {
    const sf = model.shortfall!;
    expect(sf.lowValue).toBe(4_561_920 - 3_800_000);
    expect(sf.highValue).toBe(4_942_080 - 3_800_000);
    // even the optimistic end of the envelope is short of nothing being wrong
    expect(sf.lowValue).toBeGreaterThan(0);
    expect(sf.lowValue).toBeLessThan(sf.value);
    expect(sf.highValue).toBeGreaterThan(sf.value);
  });

  it("draws the band exactly between the formal line and the expected point", () => {
    const sf = model.shortfall!;
    const col = model.rows[3]!.column!;
    expect(sf.topPct).toBeCloseTo(col.pointTopPct, 9);
    expect(sf.topPct + sf.heightPct).toBeCloseTo(model.formal.topPct, 9);
    // the band's height encodes the shortfall on the same scale as the bars
    expect(sf.heightPct).toBeCloseTo((sf.value / model.axis.max) * 100, 6);
  });

  it("splits the expected column at the formal plan so both parts are readable", () => {
    const col = model.rows[3]!.column!;
    expect(col.point).toBe(4_752_000);
    expect(col.pointIsBase).toBe(true);
    expect(col.coveredValue).toBe(3_800_000);
    expect(col.coveredHeightPct + model.shortfall!.heightPct).toBeCloseTo(col.heightPct, 6);
  });

  it("has no shortfall when the formal plan already covers the expected point", () => {
    const covered = buildGapChartModel([{ period: "p", low: 100, base: 150, high: 200 }], 400);
    expect(covered.shortfall).toBeNull();
    expect(covered.legend.shortfall).toBe(false);
    expect(covered.rows[0]!.column!.coveredValue).toBe(150);
    expect(covered.legend.covered).toBe(true);
  });

  it("falls back to the envelope high when no P50 point exists", () => {
    const noBase = buildGapChartModel([{ period: "p", low: 100, high: 200 }], 120);
    const col = noBase.rows[0]!.column!;
    expect(col.pointIsBase).toBe(false);
    expect(col.point).toBe(200);
    expect(noBase.shortfall!.value).toBe(80);
  });

  it("keeps the shortfall caption clear of the envelope whisker hanging into the band", () => {
    const sf = model.shortfall!;
    const lowTopPct = model.rows[3]!.range!.topPct + model.rows[3]!.range!.heightPct;
    // caption starts at or below the whisker's low cap...
    expect(sf.labelTopPct).toBeGreaterThanOrEqual(lowTopPct - 1e-9);
    // ...and ends at or above the formal line that closes the band
    expect(sf.labelTopPct + sf.labelHeightPct).toBeLessThanOrEqual(model.formal.topPct + 1e-9);
    expect(sf.labelFit).toBe("full");
  });

  it("degrades the caption to a value, then drops it, as the clear zone shrinks", () => {
    // clear zone = formal -> the envelope low; squeeze it by raising `low`
    const full = buildGapChartModel([{ period: "p", low: 3_000_000, base: 4_800_000, high: 5_000_000 }], 2_000_000);
    expect(full.shortfall!.labelFit).toBe("full");

    const compact = buildGapChartModel([{ period: "p", low: 4_400_000, base: 4_800_000, high: 5_000_000 }], 4_000_000);
    expect(compact.shortfall!.labelFit).toBe("compact");

    const none = buildGapChartModel([{ period: "p", low: 4_780_000, base: 4_800_000, high: 5_000_000 }], 4_760_000);
    expect(none.shortfall!.labelFit).toBe("none");
    expect(none.shortfall!.labelHeightPct).toBe(0);
  });

  it("never places the caption outside the plot box", () => {
    for (const formal of [10_000, 1_000_000, 3_800_000, 4_700_000]) {
      const m = buildGapChartModel(ROWS, formal);
      const sf = m.shortfall!;
      expect(sf.labelTopPct).toBeGreaterThanOrEqual(0);
      expect(sf.labelTopPct + sf.labelHeightPct).toBeLessThanOrEqual(100.001);
    }
  });
});

/* ===========================================================================
 * Caption anti-collision — the bug where "4.6M–4.9M" and "Formal plan: 3.8M
 * units" were drawn on top of each other in the top-right corner.
 * ========================================================================= */

describe("gap chart model — caption anti-collision", () => {
  it("detects overlapping caption footprints", () => {
    expect(bandsOverlap({ topPct: 10, heightPct: 12 }, { topPct: 20, heightPct: 12 })).toBe(true);
    expect(bandsOverlap({ topPct: 10, heightPct: 12 }, { topPct: 22, heightPct: 12 })).toBe(false);
    // touching edges are not an overlap
    expect(bandsOverlap({ topPct: 0, heightPct: 10 }, { topPct: 10, heightPct: 10 })).toBe(false);
  });

  it("keeps the formal caption on the right when nothing is anchored there", () => {
    expect(resolveFormalLabel(60, [], [])).toEqual({ labelBelow: false, labelSide: "right" });
  });

  it("moves the formal caption to the other end when a right-anchored caption is in the way", () => {
    const obstacle = { topPct: 50, heightPct: LABEL_OFFSET_PCT };
    expect(resolveFormalLabel(60, [obstacle], [])).toEqual({ labelBelow: false, labelSide: "left" });
  });

  it("flips to the other side of the line only when both ends are blocked", () => {
    const band = { topPct: 48, heightPct: LABEL_OFFSET_PCT };
    const placement = resolveFormalLabel(60, [band], [band]);
    expect(placement.labelBelow).toBe(true);
    expect(placement.labelSide).toBe("right");
  });

  it("still moves the caption below a line pinned to the top of the box", () => {
    expect(resolveFormalLabel(4, [], []).labelBelow).toBe(true);
  });

  it("resolves the real collision: the envelope + shortfall captions push the formal caption aside", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    const formalBand = { topPct: model.formal.topPct - LABEL_OFFSET_PCT, heightPct: LABEL_OFFSET_PCT };
    const rangeBand = { topPct: model.rows[3]!.range!.labelTopPct, heightPct: LABEL_OFFSET_PCT };
    const shortfallBand = { topPct: model.shortfall!.labelTopPct, heightPct: model.shortfall!.labelHeightPct };

    // the right-hand column genuinely has a caption where the formal caption wanted to go
    expect(bandsOverlap(formalBand, shortfallBand)).toBe(true);
    // …and the left end is no longer a free fallback: the Halloween 2024 bar's
    // top edge is there. So the caption flips BELOW its own line instead of
    // landing on a mark.
    expect(model.formal.labelBelow).toBe(true);
    expect(model.formal.labelSide).toBe("right");
    // and the envelope caption is nowhere near it, so it is not the thing that moved it
    expect(bandsOverlap(formalBand, rangeBand)).toBe(false);
  });

  it("leaves the formal caption on the right when the plan sits far below the column captions", () => {
    const model = buildGapChartModel(ROWS, 1_000_000);
    expect(model.formal.labelSide).toBe("right");
  });

  /* ---- the reported defect: the chip covered the Halloween 2024 bar ---- */

  it("treats a bar's top edge as an obstacle, not just other captions", () => {
    const barTop = markTopGuard(40);
    expect(barTop).toEqual({ topPct: 40, heightPct: MARK_TOP_GUARD_PCT });
    // a caption above a line at 50% would sit over the top edge of a bar whose
    // own top is at 40%, so that placement has to be rejected
    expect(bandsOverlap({ topPct: 50 - LABEL_OFFSET_PCT, heightPct: LABEL_OFFSET_PCT }, barTop)).toBe(true);
    // a bar at the LEFT end alone still leaves the conventional right anchor
    expect(resolveFormalLabel(50, [], [barTop])).toEqual({ labelBelow: false, labelSide: "right" });
    // a bar top at BOTH ends: the caption drops below its own line, where the
    // guard band has ended
    expect(resolveFormalLabel(56, [barTop], [barTop])).toEqual({ labelBelow: true, labelSide: "right" });
    // and when both ends are blocked above AND below, it does not pretend to
    // have found a clear spot — it falls back rather than looping
    expect(resolveFormalLabel(50, [barTop], [barTop])).toEqual({ labelBelow: false, labelSide: "left" });
  });

  it("never lands the formal caption on the top edge of the left-most bar", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    const chip = {
      topPct: model.formal.labelBelow ? model.formal.topPct : model.formal.topPct - LABEL_OFFSET_PCT,
      heightPct: LABEL_OFFSET_PCT,
    };
    const firstBarTopPct = 100 - (ROWS[0]!.actual! / model.axis.max) * 100;

    // The chip used to be anchored LEFT and drawn from 24.7% to 36.7% while
    // this bar's top edge sat at 34.2% — it covered the top-left of the
    // Halloween 2024 bar in both themes and at both widths.
    expect(firstBarTopPct).toBeCloseTo(34.17, 1);
    expect(bandsOverlap({ topPct: 24.67, heightPct: LABEL_OFFSET_PCT }, markTopGuard(firstBarTopPct))).toBe(true);

    // It is no longer anchored over that bar at all — and had it stayed on the
    // left, the chip's band would still have to clear that bar's top edge.
    expect(model.formal.labelSide).toBe("right");
    if (model.formal.labelSide === "left") {
      expect(bandsOverlap(chip, markTopGuard(firstBarTopPct))).toBe(false);
    }
  });

  it("also keeps the caption off the top edge of the right-most column", () => {
    const model = buildGapChartModel(ROWS, 3_800_000);
    const chip = {
      topPct: model.formal.labelBelow ? model.formal.topPct : model.formal.topPct - LABEL_OFFSET_PCT,
      heightPct: LABEL_OFFSET_PCT,
    };
    expect(model.formal.labelSide).toBe("right");
    expect(bandsOverlap(chip, markTopGuard(model.rows[3]!.column!.pointTopPct))).toBe(false);
  });
});

/* ===========================================================================
 * Trend — "demand has grown three years running while the formal plan sits
 * below all three" is the planner's insight; it has to be derived, not told.
 * ========================================================================= */

describe("gap chart model — season-over-season trend", () => {
  const model = buildGapChartModel(ROWS, 3_800_000);

  it("attaches each delta to the later season and never to the first", () => {
    expect(model.rows[0]!.trend).toBeUndefined();
    expect(model.rows[1]!.trend).toMatchObject({ prevPeriod: "Halloween 2024", prevActual: 3_950_000, delta: 230_000, direction: "up" });
    expect(model.rows[1]!.trend!.pctChange).toBeCloseTo(230_000 / 3_950_000, 9);
    expect(model.rows[2]!.trend).toMatchObject({ prevPeriod: "Halloween 2025", delta: 220_000, direction: "up" });
    // the expected column is not a closed season, so it carries no actual delta
    expect(model.rows[3]!.trend).toBeUndefined();
  });

  it("signs a falling season correctly and calls a flat one flat", () => {
    const falling = buildGapChartModel(
      [
        { period: "a", actual: 100 },
        { period: "b", actual: 80 },
        { period: "c", actual: 80 },
      ],
      50
    );
    expect(falling.rows[1]!.trend).toMatchObject({ delta: -20, direction: "down" });
    expect(falling.rows[1]!.trend!.pctChange).toBeCloseTo(-0.2, 9);
    expect(falling.rows[2]!.trend).toMatchObject({ delta: 0, direction: "flat" });
  });

  it("keeps a delta caption inside the plot box even for a bar at the ceiling", () => {
    const tall = buildGapChartModel(
      [
        { period: "a", actual: 100 },
        { period: "b", actual: 6_000_000 },
      ],
      100
    );
    expect(tall.rows[1]!.trend!.labelTopPct).toBeGreaterThanOrEqual(0);
  });

  it("summarises the series the way a planner would state it", () => {
    const s = model.trendSummary!;
    expect(s.seasons).toBe(3);
    expect(s.firstPeriod).toBe("Halloween 2024");
    expect(s.lastPeriod).toBe("Halloween 2026");
    expect(s.totalDelta).toBe(450_000);
    expect(s.direction).toBe("up");
    expect(s.cagr).toBeCloseTo(Math.pow(4_400_000 / 3_950_000, 1 / 2) - 1, 9);
    // the headline: every closed season already exceeded the plan booked for 2027
    expect(s.seasonsAboveFormal).toBe(3);
  });

  it("has no summary when fewer than two seasons are closed", () => {
    expect(buildGapChartModel([{ period: "a", actual: 100 }], 50).trendSummary).toBeNull();
    expect(buildGapChartModel([{ period: "a", actual: 100 }], 50).legend.trend).toBe(false);
  });

  it("places the trend path on the column centres so the line meets the bar tops", () => {
    expect(model.rows.map((r) => r.centerPct)).toEqual([12.5, 37.5, 62.5, 87.5]);
    const path = model.trendPath;
    expect(path.actual).toHaveLength(3);
    expect(path.actual[0]).toEqual({ xPct: 12.5, yPct: 100 - (3_950_000 / model.axis.max) * 100 });
    expect(path.actual[2]!.yPct).toBeLessThan(path.actual[0]!.yPct); // rising = higher on screen
  });

  it("connects the last closed season to the expected point, and only that", () => {
    const [from, to] = model.trendPath.projection!;
    expect(from).toEqual(model.trendPath.actual[2]);
    expect(to).toEqual({ xPct: 87.5, yPct: model.rows[3]!.column!.pointTopPct });
  });

  it("draws no projection when there is no expected column to connect to", () => {
    const noExpected = buildGapChartModel(
      [
        { period: "a", actual: 100 },
        { period: "b", actual: 120 },
      ],
      90
    );
    expect(noExpected.trendPath.projection).toBeNull();
    expect(noExpected.trendPath.actual).toHaveLength(2);
  });
});

describe("gap chart model — legend honesty for the new marks", () => {
  it("advertises exactly the marks that are drawn", () => {
    expect(buildGapChartModel(ROWS, 3_800_000).legend).toEqual({
      historical: true,
      range: true,
      base: true,
      formal: true,
      covered: true,
      shortfall: true,
      trend: true,
    });
  });

  it("drops the covered and shortfall entries when there is no formal plan", () => {
    const legend = buildGapChartModel([{ period: "p", low: 100, base: 150, high: 200 }], 0).legend;
    expect(legend.formal).toBe(false);
    expect(legend.covered).toBe(false);
    expect(legend.shortfall).toBe(false);
  });
});

describe("gap chart model — caption sizing constants stay ordered", () => {
  it("a two-line caption needs more room than a one-line caption", () => {
    expect(SHORTFALL_LABEL_FULL_PCT).toBeGreaterThan(SHORTFALL_LABEL_COMPACT_PCT);
    expect(LABEL_OFFSET_PCT).toBeGreaterThanOrEqual(SHORTFALL_LABEL_FULL_PCT);
  });
});
