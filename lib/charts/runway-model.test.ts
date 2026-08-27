import { describe, expect, it } from "vitest";
import type { DecisionDeadline } from "@/types/planning";
import {
  DAY_MS,
  DEADLINE_LABEL_MIN_GAP_PCT,
  addMonths,
  assignClusterLabels,
  buildRunwayModel,
  datePct,
  daysBetween,
  materialIdFromDeadlineId,
  monthTicks,
  parseDate,
  runwayDomain,
  startOfMonth,
  toISODate,
  urgencyOf,
  urgencyToken,
  weeksBetween,
} from "./runway-model";

/* The real Halloween 2027 shape from data/synthetic — today 8 Mar 2027, built
 * Mar–Jul 2027, sold Sep–Oct 2027, with eight per-material order-by dates
 * clustered inside a six-week band. */
const TODAY = "2027-03-08";
const PRODUCTION = { start: "2027-03-01", end: "2027-07-31" };
const SALES = { start: "2027-09-01", end: "2027-10-31" };
const GAP_ID = "gap_halloween_2027";

function deadline(materialId: string, date: string, isEarliestConstraint = false): DecisionDeadline {
  return {
    id: `deadline_readiness_${GAP_ID}_${materialId}`,
    gapId: GAP_ID,
    kind: "material_order_by",
    date,
    isEarliestConstraint,
    drivenBy: "lead_time",
  };
}

const DEADLINES: DecisionDeadline[] = [
  deadline("mat_printed_film", "2027-05-18", true),
  deadline("mat_cocoa", "2027-05-29"),
  deadline("mat_cocoa_butter", "2027-06-01"),
  deadline("mat_foil", "2027-06-05"),
  deadline("mat_corrugate", "2027-06-12"),
  deadline("mat_sugar", "2027-06-18"),
  deadline("mat_milk_solids", "2027-06-24"),
  deadline("mat_lecithin", "2027-07-01"),
];

const INPUT = { today: TODAY, deadlines: DEADLINES, productionWindow: PRODUCTION, salesWindow: SALES };

/* ===========================================================================
 * Calendar primitives — every percentage in the chart is built on these
 * ========================================================================= */

describe("runway model — UTC date primitives", () => {
  it("parses an ISO day to UTC midnight, independent of the machine timezone", () => {
    expect(parseDate("2027-03-08")).toBe(Date.UTC(2027, 2, 8));
    expect(toISODate(parseDate("2027-03-08"))).toBe("2027-03-08");
  });

  it("returns NaN rather than a silent 1970 for an unusable date", () => {
    expect(Number.isNaN(parseDate(""))).toBe(true);
    expect(Number.isNaN(parseDate("not-a-date"))).toBe(true);
  });

  it("snaps to month starts and steps whole calendar months across a year boundary", () => {
    expect(toISODate(startOfMonth(parseDate("2027-03-08")))).toBe("2027-03-01");
    expect(toISODate(addMonths(parseDate("2027-11-30"), 2))).toBe("2028-01-01");
    expect(toISODate(addMonths(parseDate("2027-01-15"), -1))).toBe("2026-12-01");
  });

  it("counts days across a DST-shifting month without drifting", () => {
    // 8 Mar -> 18 May crosses the US DST change; UTC maths must still say 71.
    expect(daysBetween("2027-03-08", "2027-05-18")).toBe(71);
    expect(daysBetween("2027-03-01", "2027-07-31")).toBe(152);
  });
});

/* ===========================================================================
 * weeks-from-today, INCLUDING the overdue case the old chart could not show
 * ========================================================================= */

describe("runway model — signed weeks from today", () => {
  it("reports the headline runway the section is built around", () => {
    expect(weeksBetween(TODAY, "2027-05-18")).toBe(10.1);
  });

  it("keeps the sign for a deadline that has already passed", () => {
    expect(weeksBetween(TODAY, "2027-02-01")).toBe(-5);
    expect(weeksBetween(TODAY, "2027-03-01")).toBe(-1);
    expect(daysBetween(TODAY, "2027-03-01")).toBe(-7);
  });

  it("is exactly zero on the day itself, and never negative-zero", () => {
    expect(weeksBetween(TODAY, TODAY)).toBe(0);
    expect(Object.is(weeksBetween(TODAY, TODAY), -0)).toBe(false);
  });

  it("rounds to one decimal, so the tick and the callout can never disagree", () => {
    expect(weeksBetween("2027-03-08", "2027-03-11")).toBe(0.4);
    expect(weeksBetween("2027-03-08", "2027-03-15")).toBe(1);
  });

  it("classifies urgency off the signed value, so overdue is never read as 'clear'", () => {
    expect(urgencyOf(-0.5)).toBe("overdue");
    expect(urgencyOf(0)).toBe("critical");
    expect(urgencyOf(2)).toBe("critical");
    expect(urgencyOf(4)).toBe("warning");
    expect(urgencyOf(6)).toBe("warning");
    expect(urgencyOf(10.1)).toBe("clear");
    expect(urgencyToken(urgencyOf(-1))).toBe("--risk-critical");
    expect(urgencyToken(urgencyOf(4))).toBe("--risk-warning");
    expect(urgencyToken(urgencyOf(10.1))).toBe("--risk-positive");
  });

  it("surfaces an overdue binding deadline as an overdue runway span", () => {
    const model = buildRunwayModel({ ...INPUT, deadlines: [deadline("mat_printed_film", "2027-02-15", true)] });
    expect(model.deadlines[0]!.isOverdue).toBe(true);
    expect(model.deadlines[0]!.weeksFromToday).toBe(-3);
    expect(model.runway).toMatchObject({ isOverdue: true, weeks: 3, urgency: "overdue", riskToken: "--risk-critical" });
    // the bracket is still drawn left-to-right, with today on the RIGHT of it
    expect(model.runway!.fromPct).toBeLessThan(model.runway!.toPct);
    expect(model.runway!.toPct).toBeCloseTo(model.today.pct, 9);
  });
});

/* ===========================================================================
 * Domain + month scale — the biggest legibility win: a real date scale
 * ========================================================================= */

describe("runway model — a padded, month-snapped domain", () => {
  const domain = runwayDomain([TODAY, PRODUCTION.start, PRODUCTION.end, SALES.start, SALES.end, ...DEADLINES.map((d) => d.date)]);

  it("snaps out to whole months so gridlines bound the plot", () => {
    expect(domain.startISO).toBe("2027-02-01");
    expect(domain.endISO).toBe("2027-12-01");
    expect(domain.days).toBe(Math.round((parseDate("2027-12-01") - parseDate("2027-02-01")) / DAY_MS));
  });

  it("keeps Today off the left edge and clear of the production window start", () => {
    const todayPct = datePct(TODAY, domain);
    const prodPct = datePct(PRODUCTION.start, domain);
    expect(todayPct).toBeGreaterThan(6);
    expect(todayPct).toBeGreaterThan(prodPct);
    // the old un-padded domain put Today at 2.9% hard against the window start
    expect(todayPct - prodPct).toBeGreaterThan(1.5);
  });

  it("contains every mark strictly inside the plot box", () => {
    for (const iso of [TODAY, PRODUCTION.start, PRODUCTION.end, SALES.start, SALES.end, ...DEADLINES.map((d) => d.date)]) {
      const p = datePct(iso, domain);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(100);
    }
  });

  it("orders positions the same way the calendar does", () => {
    expect(datePct(PRODUCTION.start, domain)).toBeLessThan(datePct(TODAY, domain));
    expect(datePct(PRODUCTION.end, domain)).toBeLessThan(datePct(SALES.start, domain));
    expect(datePct(SALES.start, domain)).toBeLessThan(datePct(SALES.end, domain));
  });

  it("never returns NaN or an out-of-range percentage", () => {
    expect(datePct("garbage", domain)).toBe(0);
    expect(datePct("2020-01-01", domain)).toBe(0);
    expect(datePct("2099-01-01", domain)).toBe(100);
  });
});

describe("runway model — month tick generation across a multi-month span", () => {
  const domain = runwayDomain([TODAY, PRODUCTION.start, PRODUCTION.end, SALES.start, SALES.end, ...DEADLINES.map((d) => d.date)]);
  const months = monthTicks(domain);

  it("emits one band per calendar month, including months nothing falls in", () => {
    expect(months.map((m) => m.label)).toEqual(["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
    expect(months.map((m) => m.key)[0]).toBe("2027-02");
  });

  it("tiles the plot with no gap and no overflow", () => {
    expect(months[0]!.startPct).toBeCloseTo(0, 9);
    expect(months[months.length - 1]!.endPct).toBeCloseTo(100, 9);
    for (let i = 1; i < months.length; i += 1) {
      expect(months[i]!.startPct).toBeCloseTo(months[i - 1]!.endPct, 9);
    }
    expect(months.reduce((sum, m) => sum + m.widthPct, 0)).toBeCloseTo(100, 6);
  });

  it("gives each band the real length of its month, so widths are honest", () => {
    expect(months.find((m) => m.key === "2027-02")!.days).toBe(28);
    expect(months.find((m) => m.key === "2027-04")!.days).toBe(30);
    expect(months.find((m) => m.key === "2027-07")!.days).toBe(31);
    expect(months.find((m) => m.key === "2027-07")!.endISO).toBe("2027-07-31");
  });

  it("prints the year on the first band and on every January", () => {
    expect(months[0]!.showYear).toBe(true);
    expect(months.filter((m) => m.showYear)).toHaveLength(1);

    const crossYear = monthTicks(runwayDomain(["2027-11-20", "2028-02-10"]));
    expect(crossYear.map((m) => m.label)).toEqual(["Nov", "Dec", "Jan", "Feb"]);
    expect(crossYear.filter((m) => m.showYear).map((m) => m.key)).toEqual(["2027-11", "2028-01"]);
    expect(crossYear.find((m) => m.key === "2028-01")!.year).toBe(2028);
  });

  it("centres every label inside a band wider than the label, so none can be clipped", () => {
    for (const m of months) {
      expect(m.midPct).toBeGreaterThan(m.startPct);
      expect(m.midPct).toBeLessThan(m.endPct);
      expect(m.widthPct).toBeGreaterThan(6);
    }
  });

  it("handles a single-month span without emitting an empty scale", () => {
    const oneMonth = monthTicks(runwayDomain(["2027-06-10", "2027-06-12"], 0));
    expect(oneMonth).toHaveLength(1);
    expect(oneMonth[0]!.widthPct).toBeCloseTo(100, 9);
  });
});

/* ===========================================================================
 * Cluster labelling — readable at rest, nothing hidden from hover
 * ========================================================================= */

describe("runway model — at-rest label anti-collision", () => {
  it("labels the first mark and drops the ones that would collide with it", () => {
    const out = assignClusterLabels([{ pct: 10 }, { pct: 12 }, { pct: 30 }, { pct: 33 }], 13);
    expect(out.map((o) => o.showLabel)).toEqual([true, false, true, false]);
    expect(out.map((o) => o.clusterIndex)).toEqual([0, 0, 1, 1]);
    expect(out.map((o) => o.clusterSize)).toEqual([2, 2, 2, 2]);
    expect(out.map((o) => o.positionInCluster)).toEqual([0, 1, 0, 1]);
  });

  it("always labels a forced mark, even inside another mark's cluster", () => {
    const out = assignClusterLabels([{ pct: 10 }, { pct: 11, force: true }, { pct: 12 }], 13);
    expect(out.map((o) => o.showLabel)).toEqual([true, true, false]);
    expect(out[2]!.clusterIndex).toBe(1);
  });

  it("labels everything when the marks are far enough apart", () => {
    const out = assignClusterLabels([{ pct: 0 }, { pct: 20 }, { pct: 40 }], 13);
    expect(out.every((o) => o.showLabel)).toBe(true);
    expect(out.every((o) => o.clusterSize === 1)).toBe(true);
  });

  it("handles an empty list", () => {
    expect(assignClusterLabels([])).toEqual([]);
  });

  it("keeps every hidden deadline as a real mark and reports what the leader stands for", () => {
    const model = buildRunwayModel(INPUT);
    expect(model.deadlines).toHaveLength(DEADLINES.length);
    expect(model.hiddenLabelCount).toBeGreaterThan(0);
    expect(model.deadlines.filter((d) => d.showLabel).length).toBeLessThan(DEADLINES.length);

    // the binding constraint is labelled no matter how crowded it is
    const binding = model.deadlines.find((d) => d.isBinding)!;
    expect(binding.dateISO).toBe("2027-05-18");
    expect(binding.showLabel).toBe(true);

    // every hidden mark belongs to a cluster whose leader IS labelled
    for (const d of model.deadlines.filter((x) => !x.showLabel)) {
      const leader = model.deadlines.find((x) => x.clusterIndex === d.clusterIndex && x.showLabel);
      expect(leader).toBeDefined();
      expect(d.clusterSize).toBeGreaterThan(1);
      expect(d.clusterFirstISO <= d.dateISO).toBe(true);
      expect(d.clusterLastISO >= d.dateISO).toBe(true);
    }
  });

  it("caps each tick's hit box at the distance to its nearest neighbour", () => {
    const model = buildRunwayModel(INPUT);
    for (let i = 0; i < model.deadlines.length; i += 1) {
      const d = model.deadlines[i]!;
      const prev = model.deadlines[i - 1];
      const next = model.deadlines[i + 1];
      const nearest = Math.min(prev ? d.pct - prev.pct : Infinity, next ? next.pct - d.pct : Infinity);
      expect(d.hitWidthPct).toBeCloseTo(Number.isFinite(nearest) ? nearest : 100, 9);
      // centred boxes of this width can touch but never overlap
      if (next) expect(d.hitWidthPct / 2 + next.hitWidthPct / 2).toBeLessThanOrEqual(next.pct - d.pct + 1e-9);
    }
  });

  it("gives a lone deadline a full-width hit allowance rather than zero", () => {
    const model = buildRunwayModel({ ...INPUT, deadlines: [deadline("mat_printed_film", "2027-05-18", true)] });
    expect(model.deadlines[0]!.hitWidthPct).toBe(100);
  });

  it("never labels two marks closer together than the caption width", () => {
    const model = buildRunwayModel(INPUT);
    const labelled = model.deadlines.filter((d) => d.showLabel && !d.isBinding).map((d) => d.pct);
    for (let i = 1; i < labelled.length; i += 1) {
      expect(labelled[i]! - labelled[i - 1]!).toBeGreaterThanOrEqual(DEADLINE_LABEL_MIN_GAP_PCT - 1e-9);
    }
  });
});

/* ===========================================================================
 * Deadline identity — "which material does this tick belong to"
 * ========================================================================= */

describe("runway model — deadline identity", () => {
  it("reads the material back off the id the engine minted", () => {
    expect(materialIdFromDeadlineId("deadline_readiness_gap_halloween_2027_mat_printed_film", "gap_halloween_2027")).toBe(
      "mat_printed_film"
    );
  });

  it("returns null rather than inventing an owner for an unrecognised id", () => {
    expect(materialIdFromDeadlineId("deadline_capacity_pullforward", "gap_halloween_2027")).toBeNull();
    expect(materialIdFromDeadlineId("deadline_readiness_gap_other_mat_cocoa", "gap_halloween_2027")).toBeNull();
    expect(materialIdFromDeadlineId("deadline_readiness_gap_halloween_2027_", "gap_halloween_2027")).toBeNull();
  });

  it("carries the material and the driver on to every tick", () => {
    const model = buildRunwayModel(INPUT);
    expect(model.deadlines.map((d) => d.materialId)).toEqual([
      "mat_printed_film",
      "mat_cocoa",
      "mat_cocoa_butter",
      "mat_foil",
      "mat_corrugate",
      "mat_sugar",
      "mat_milk_solids",
      "mat_lecithin",
    ]);
    expect(model.deadlines.every((d) => d.driverNote.length > 0)).toBe(true);
    expect(model.deadlines.every((d) => d.kindLabel === "Material order-by")).toBe(true);
  });

  it("reports which window each deadline falls in", () => {
    const model = buildRunwayModel(INPUT);
    expect(model.deadlines.every((d) => d.inWindow === "production")).toBe(true);

    const early = buildRunwayModel({ ...INPUT, deadlines: [deadline("mat_printed_film", "2027-02-10", true)] });
    expect(early.deadlines[0]!.inWindow).toBe("before_production");
    const between = buildRunwayModel({ ...INPUT, deadlines: [deadline("mat_printed_film", "2027-08-15", true)] });
    expect(between.deadlines[0]!.inWindow).toBe("between_windows");
  });

  it("reports how far a scenario moved a deadline, signed", () => {
    const moved: DecisionDeadline = { ...deadline("mat_printed_film", "2027-04-20", true), movedFromDate: "2027-05-18", moveReason: "P80 lead time" };
    const model = buildRunwayModel({ ...INPUT, deadlines: [moved] });
    expect(model.deadlines[0]!.movedWeeks).toBe(-4);
    expect(model.deadlines[0]!.moveReason).toBe("P80 lead time");
  });

  it("falls back to the earliest deadline when nothing is flagged as the constraint", () => {
    const unflagged = DEADLINES.map((d) => ({ ...d, isEarliestConstraint: false }));
    const model = buildRunwayModel({ ...INPUT, deadlines: unflagged });
    expect(model.deadlines.find((d) => d.isBinding)!.dateISO).toBe("2027-05-18");
  });

  it("has no runway span at all when there are no deadlines", () => {
    const model = buildRunwayModel({ ...INPUT, deadlines: [] });
    expect(model.runway).toBeNull();
    expect(model.deadlines).toEqual([]);
    expect(model.months.length).toBeGreaterThan(0);
  });
});

/* ===========================================================================
 * Production vs sales — the distinction the chart exists to protect
 * ========================================================================= */

describe("runway model — production timing vs sales timing", () => {
  const model = buildRunwayModel(INPUT);

  it("keeps the two windows structurally separate, with different series tokens", () => {
    expect(model.production.token).toBe("--state-validated");
    expect(model.sales.token).toBe("--state-scenario");
    expect(model.production.token).not.toBe(model.sales.token);
    // neither window may be coloured with a risk token
    expect(model.production.token.startsWith("--state-")).toBe(true);
    expect(model.sales.token.startsWith("--state-")).toBe(true);
  });

  it("measures each window's real duration inclusively", () => {
    expect(model.production.days).toBe(153); // 1 Mar – 31 Jul inclusive
    expect(model.production.weeks).toBe(21.9);
    expect(model.sales.days).toBe(61); // 1 Sep – 31 Oct inclusive
    expect(model.sales.weeks).toBe(8.7);
  });

  it("derives the separation between building and selling", () => {
    expect(model.separation.gapDays).toBe(32);
    expect(model.separation.gapWeeks).toBe(4.6);
    expect(model.separation.overlaps).toBe(false);
    expect(model.separation.leadWeeks).toBe(26.3);
  });

  it("knows the build is under way today and the season is not yet selling", () => {
    expect(model.production.status).toBe("open");
    expect(model.production.progressPct).toBeGreaterThan(0);
    expect(model.production.progressPct).toBeLessThan(100);
    expect(model.sales.status).toBe("upcoming");
    expect(model.sales.progressPct).toBeNull();
    expect(model.sales.weeksToStart).toBeGreaterThan(0);
  });

  it("marks a window that has already closed as past", () => {
    const past = buildRunwayModel({ ...INPUT, productionWindow: { start: "2026-03-01", end: "2026-07-31" } });
    expect(past.production.status).toBe("past");
    expect(past.production.weeksToEnd).toBeLessThan(0);
  });

  it("centres each window's date caption under its own bar, clamped at the edges", () => {
    expect(model.production.midPct).toBeCloseTo((model.production.startPct + model.production.endPct) / 2, 9);
    expect(model.production.labelAnchor).toBe("middle");
    expect(model.sales.labelAnchor).toBe("middle");

    // a window hard against the right edge anchors its caption inward instead
    // of letting it hang outside the plot box
    const late = buildRunwayModel({ ...INPUT, salesWindow: { start: "2027-11-20", end: "2027-11-30" } });
    expect(late.sales.labelAnchor).toBe("end");
  });

  it("reports where today sits inside an open window", () => {
    expect(model.production.dayOfWindow).toBe(8); // 1 Mar + 7 days
    expect(model.sales.dayOfWindow).toBeNull();
  });

  it("does not overlap the two windows for this event", () => {
    expect(model.production.endPct).toBeLessThan(model.sales.startPct);
  });
});

/* ===========================================================================
 * The runway span itself — the callout attached to the mark it describes
 * ========================================================================= */

describe("runway model — the runway span", () => {
  const model = buildRunwayModel(INPUT);

  it("spans exactly from Today to the binding deadline", () => {
    expect(model.runway!.fromPct).toBeCloseTo(model.today.pct, 9);
    expect(model.runway!.toPct).toBeCloseTo(model.deadlines.find((d) => d.isBinding)!.pct, 9);
    expect(model.runway!.widthPct).toBeCloseTo(model.runway!.toPct - model.runway!.fromPct, 9);
  });

  it("carries the same 10.1 weeks the headline prints", () => {
    expect(model.runway!.weeks).toBe(10.1);
    expect(model.runway!.days).toBe(71);
    expect(model.runway!.isOverdue).toBe(false);
    expect(model.runway!.dateISO).toBe("2027-05-18");
    expect(model.runway!.materialId).toBe("mat_printed_film");
    expect(model.runway!.urgency).toBe("clear");
  });
});
