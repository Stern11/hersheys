import { describe, it, expect } from "vitest";
import { generateDemoDataset } from "@/lib/dataset/demo/generate";
import { buildSituations } from "./build";
import { summarizePortfolio } from "./portfolio";

const DATASET = generateDemoDataset({ planningNow: "2027-03-08T09:00:00.000Z" });

function situations() {
  return buildSituations(DATASET);
}

describe("summarizePortfolio — empty portfolio", () => {
  it("returns zeroed coverage and before/after rather than throwing", () => {
    const summary = summarizePortfolio([]);
    expect(summary.coverageByMonth).toEqual([]);
    expect(summary.beforeAfter).toEqual({
      demandValueBefore: 0,
      demandValueAfter: 0,
      hoursBefore: 0,
      hoursAfter: 0,
      materialPlanNowAfter: 0,
      currency: "USD",
    });
  });
});

describe("summarizePortfolio — coverageByMonth", () => {
  it("is chronological, capped at six months, and every ratio is 0-1", () => {
    const summary = summarizePortfolio(situations());
    expect(summary.coverageByMonth.length).toBeLessThanOrEqual(6);
    const periods = summary.coverageByMonth.map((m) => m.period);
    expect(periods).toEqual([...periods].sort());
    for (const month of summary.coverageByMonth) {
      if (month.coveragePct !== undefined) {
        expect(month.coveragePct).toBeGreaterThanOrEqual(0);
        expect(month.coveragePct).toBeLessThanOrEqual(1);
      }
    }
  });

  it("matches formal/effective hours summed directly from every situation's cells", () => {
    const summary = summarizePortfolio(situations());
    const first = summary.coverageByMonth[0];
    if (!first) return; // no capacity data in this dataset — nothing to check
    let formal = 0;
    let effective = 0;
    for (const s of situations()) {
      for (const cell of s.capacityExposure.cells) {
        if (cell.period !== first.period) continue;
        formal += cell.formalHours;
        effective += cell.effectiveHours;
      }
    }
    expect(first.coveragePct).toBeCloseTo(effective > 0 ? formal / effective : 0, 6);
  });
});

describe("summarizePortfolio — beforeAfter", () => {
  it("after never counts less than before — including absent SKUs only ever adds", () => {
    const summary = summarizePortfolio(situations());
    expect(summary.beforeAfter.demandValueAfter).toBeGreaterThanOrEqual(summary.beforeAfter.demandValueBefore);
    expect(summary.beforeAfter.hoursAfter).toBeGreaterThanOrEqual(summary.beforeAfter.hoursBefore);
  });

  it("reconciles to the same formal/validated/hours figures shown elsewhere on Overview", () => {
    const summary = summarizePortfolio(situations());
    expect(summary.beforeAfter.demandValueBefore).toBeCloseTo(summary.formalValue, 6);
    expect(summary.beforeAfter.demandValueAfter).toBeCloseTo(summary.formalValue + summary.validatedValue, 6);
    expect(summary.beforeAfter.hoursBefore).toBeCloseTo(summary.formalHours, 6);
    expect(summary.beforeAfter.hoursAfter).toBeCloseTo(summary.formalHours + summary.unresolvedHours, 6);
    expect(summary.beforeAfter.materialPlanNowAfter).toBe(summary.planNowCount);
    expect(summary.beforeAfter.currency).toBe(summary.currency);
  });
});
