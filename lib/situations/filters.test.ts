import { describe, it, expect } from "vitest";
import {
  activeFilterCount,
  applyFilters,
  filterOptions,
  filteredTotals,
  isUncovered,
} from "./filters";
import type { CandidateItem, ContributorDisposition } from "@/types/situation";

function candidate(partial: Partial<CandidateItem> & { id: string }): CandidateItem {
  const units = partial.plannedUnits ?? partial.actualUnits ?? 1000;
  return {
    itemId: `item_${partial.id}`,
    itemName: "Variety Bag 40ct",
    brand: "Ridgeline",
    productFamily: "Variety Bags",
    historicalPeriod: "2026-Halloween",
    actualUnits: units,
    actualValue: units * 10,
    plannedUnits: units,
    plannedValue: units * 10,
    plannedBasis: {
      kind: "prior_actual",
      seasonsUsed: ["2026-Halloween"],
      baselineUnits: units,
      growthPct: 0,
      inferredUnits: units,
      label: "1 season",
    },
    seasonHistory: [{ period: "2026-Halloween", units }],
    derivation: "own_bom" as const,
    analogues: [],
    derivationLabel: "",
    disposition: "carry_forward" as ContributorDisposition,
    proposedDisposition: "carry_forward" as ContributorDisposition,
    match: { score: 0, comparedDimensions: 0, outcomes: [] },
    ...partial,
  };
}

const rows: CandidateItem[] = [
  candidate({ id: "a", productFamily: "Variety Bags", brand: "Ridgeline", customer: "Mass" }),
  candidate({
    id: "b",
    productFamily: "Gift Tins",
    brand: "Ridgeline",
    customer: "Club",
    itemName: "Premium Tin 18oz",
    disposition: "under_review",
  }),
  candidate({
    id: "c",
    productFamily: "Gift Tins",
    brand: "Marlowe",
    customer: "Mass",
    itemName: "Counter Display 24ct",
    disposition: "already_represented",
    match: { score: 0.9, comparedDimensions: 4, outcomes: [], matchedItemId: "plan_1" },
  }),
];

describe("filterOptions", () => {
  it("offers each distinct value once, sorted", () => {
    const options = filterOptions(rows);
    expect(options.productFamilies).toEqual(["Gift Tins", "Variety Bags"]);
    expect(options.brands).toEqual(["Marlowe", "Ridgeline"]);
    expect(options.customers).toEqual(["Club", "Mass"]);
  });

  it("is empty for an empty list rather than throwing", () => {
    expect(filterOptions([])).toEqual({ productFamilies: [], brands: [], customers: [] });
  });
});

describe("applyFilters", () => {
  it("returns everything when nothing is set", () => {
    expect(applyFilters(rows, {})).toHaveLength(3);
  });

  it("narrows by each dimension", () => {
    expect(applyFilters(rows, { productFamily: "Gift Tins" })).toHaveLength(2);
    expect(applyFilters(rows, { brand: "Marlowe" })).toHaveLength(1);
    expect(applyFilters(rows, { customer: "Mass" })).toHaveLength(2);
    expect(applyFilters(rows, { disposition: "under_review" })).toHaveLength(1);
  });

  it("combines dimensions as AND, not OR", () => {
    expect(applyFilters(rows, { productFamily: "Gift Tins", brand: "Ridgeline" })).toHaveLength(1);
    expect(applyFilters(rows, { productFamily: "Variety Bags", brand: "Marlowe" })).toHaveLength(0);
  });

  it("finds items the formal plan has nothing standing for", () => {
    const uncovered = applyFilters(rows, { uncoveredOnly: true });
    expect(uncovered).toHaveLength(2);
    expect(uncovered.every((c) => isUncovered(c))).toBe(true);
  });

  it("searches name, id, brand and family, ignoring case and padding", () => {
    expect(applyFilters(rows, { search: "premium" })).toHaveLength(1);
    expect(applyFilters(rows, { search: "  MARLOWE " })).toHaveLength(1);
    // Matches row "a" on both its name and its family — one row, not two.
    expect(applyFilters(rows, { search: "variety" })).toHaveLength(1);
    expect(applyFilters(rows, { search: "nothing here" })).toHaveLength(0);
  });

  it("treats a blank search as no search", () => {
    expect(applyFilters(rows, { search: "   " })).toHaveLength(3);
  });
});

describe("activeFilterCount", () => {
  it("counts only what is actually set", () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ search: "  " })).toBe(0);
    expect(activeFilterCount({ brand: "Ridgeline", uncoveredOnly: true })).toBe(2);
  });
});

describe("filteredTotals", () => {
  it("counts only carry_forward toward the volume on screen", () => {
    const totals = filteredTotals(rows);
    // Only row "a" is carry_forward; "b" is under review and "c" is represented.
    expect(totals.count).toBe(3);
    expect(totals.carryForwardCount).toBe(1);
    expect(totals.plannedUnits).toBe(1000);
    expect(totals.plannedValue).toBe(10_000);
  });

  it("counts what is still undecided", () => {
    expect(filteredTotals(rows).undecidedCount).toBe(1);
    expect(filteredTotals([candidate({ id: "x", disposition: "unreviewed" })]).undecidedCount).toBe(1);
  });

  it("describes the filtered set, not the whole list", () => {
    const narrowed = applyFilters(rows, { productFamily: "Gift Tins" });
    const totals = filteredTotals(narrowed);
    // Neither Gift Tin is carrying forward, so the visible volume is zero —
    // the point being that the band must never quote the unfiltered figure.
    expect(totals.count).toBe(2);
    expect(totals.carryForwardCount).toBe(0);
    expect(totals.plannedUnits).toBe(0);
  });

  it("is all zeroes for an empty selection", () => {
    expect(filteredTotals([])).toEqual({
      count: 0,
      plannedUnits: 0,
      plannedValue: 0,
      carryForwardCount: 0,
      undecidedCount: 0,
    });
  });
});
