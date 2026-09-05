import { describe, it, expect } from "vitest";
import {
  availablePeriods,
  candidateIdFor,
  clampGrowth,
  collapseToSkus,
  crossSeasonKey,
  defaultSelectedPeriods,
  describeSeasonBasis,
  observedGrowth,
} from "./volume";
import type { HistoricalItemRow } from "@/types/dataset";

function row(partial: Partial<HistoricalItemRow> & { id: string }): HistoricalItemRow {
  return {
    historicalPeriod: "2026-Halloween",
    itemId: `item_${partial.id}`,
    itemName: "Variety Bag 40ct",
    brand: "Ridgeline",
    productFamily: "Variety Bags",
    actualUnits: 1000,
    basePack: "BP-VB-40",
    customer: "Mass Retailer",
    channel: "mass",
    ...partial,
  };
}

describe("crossSeasonKey", () => {
  it("is the same for the same product in different seasons", () => {
    const a = row({ id: "a", historicalPeriod: "2025-Halloween", itemId: "SKU-HAL-P2-01" });
    const b = row({ id: "b", historicalPeriod: "2026-Halloween", itemId: "SKU-HAL-07" });
    expect(crossSeasonKey(a)).toBe(crossSeasonKey(b));
  });

  it("separates products that differ on a business attribute", () => {
    const a = row({ id: "a", customer: "Mass Retailer" });
    const b = row({ id: "b", customer: "Club" });
    expect(crossSeasonKey(a)).not.toBe(crossSeasonKey(b));
  });

  it("ignores case and surrounding whitespace", () => {
    const a = row({ id: "a", brand: "Ridgeline" });
    const b = row({ id: "b", brand: "  ridgeline " });
    expect(crossSeasonKey(a)).toBe(crossSeasonKey(b));
  });

  it("falls back to the item name when no pack attributes are carried", () => {
    const a = row({ id: "a", basePack: undefined, packFormat: undefined, itemName: "Only Name" });
    expect(crossSeasonKey(a)).toContain("only name");
  });

  it("produces a candidate id that does not depend on the row id", () => {
    const a = row({ id: "row_one" });
    const b = row({ id: "row_two" });
    expect(candidateIdFor(a)).toBe(candidateIdFor(b));
    expect(candidateIdFor(a).startsWith("sku::")).toBe(true);
  });
});

describe("period selection", () => {
  const rows = [
    row({ id: "a", historicalPeriod: "2026-Halloween" }),
    row({ id: "b", historicalPeriod: "2024-Halloween" }),
    row({ id: "c", historicalPeriod: "2025-Halloween" }),
  ];

  it("lists every period oldest first", () => {
    expect(availablePeriods(rows)).toEqual([
      "2024-Halloween",
      "2025-Halloween",
      "2026-Halloween",
    ]);
  });

  it("defaults to the most recent season only", () => {
    expect(defaultSelectedPeriods(rows)).toEqual(["2026-Halloween"]);
  });

  it("returns nothing when there is no history", () => {
    expect(defaultSelectedPeriods([])).toEqual([]);
    expect(availablePeriods([])).toEqual([]);
  });
});

describe("observedGrowth", () => {
  const rows = [
    row({ id: "a", historicalPeriod: "2024-Halloween", actualUnits: 1000 }),
    row({ id: "b", historicalPeriod: "2025-Halloween", actualUnits: 1100 }),
    row({ id: "c", historicalPeriod: "2026-Halloween", actualUnits: 1210 }),
  ];

  it("is undefined with fewer than two seasons — one point implies no trend", () => {
    expect(observedGrowth(rows, ["2026-Halloween"])).toBeUndefined();
    expect(observedGrowth(rows, [])).toBeUndefined();
  });

  it("compounds across the span rather than summing period-over-period", () => {
    // 1000 -> 1210 over three seasons is 10% compound, not 21%.
    expect(observedGrowth(rows, ["2024-Halloween", "2025-Halloween", "2026-Halloween"]))
      .toBeCloseTo(0.1, 6);
  });

  it("counts an excluded year in the span rather than inflating the rate", () => {
    // Dropping the middle season must not turn two years of growth into one.
    expect(observedGrowth(rows, ["2024-Halloween", "2026-Halloween"])).toBeCloseTo(0.1, 6);
  });

  it("reads growth from the programme total, not from one SKU", () => {
    const mixed = [
      row({ id: "a1", historicalPeriod: "2025-Halloween", actualUnits: 500, customer: "A" }),
      row({ id: "a2", historicalPeriod: "2025-Halloween", actualUnits: 500, customer: "B" }),
      // One SKU halves and the other triples; the total still doubles.
      row({ id: "b1", historicalPeriod: "2026-Halloween", actualUnits: 250, customer: "A" }),
      row({ id: "b2", historicalPeriod: "2026-Halloween", actualUnits: 1750, customer: "B" }),
    ];
    expect(observedGrowth(mixed, ["2025-Halloween", "2026-Halloween"])).toBeCloseTo(1, 6);
  });

  it("is undefined when a season carries no units, rather than dividing by zero", () => {
    const zero = [
      row({ id: "a", historicalPeriod: "2025-Halloween", actualUnits: 0 }),
      row({ id: "b", historicalPeriod: "2026-Halloween", actualUnits: 100 }),
    ];
    expect(observedGrowth(zero, ["2025-Halloween", "2026-Halloween"])).toBeUndefined();
  });

  it("clamps a runaway rate rather than projecting it", () => {
    const spike = [
      row({ id: "a", historicalPeriod: "2025-Halloween", actualUnits: 1 }),
      row({ id: "b", historicalPeriod: "2026-Halloween", actualUnits: 100_000 }),
    ];
    expect(observedGrowth(spike, ["2025-Halloween", "2026-Halloween"])).toBe(2);
  });
});

describe("clampGrowth", () => {
  it("holds the band and treats a non-finite rate as no growth", () => {
    expect(clampGrowth(0.05)).toBeCloseTo(0.05, 6);
    expect(clampGrowth(50)).toBe(2);
    expect(clampGrowth(-5)).toBe(-0.9);
    expect(clampGrowth(Number.NaN)).toBe(0);
    expect(clampGrowth(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("collapseToSkus", () => {
  const rows = [
    row({
      id: "old",
      historicalPeriod: "2025-Halloween",
      actualUnits: 1000,
      actualValue: 10_000,
    }),
    row({
      id: "new",
      historicalPeriod: "2026-Halloween",
      actualUnits: 1200,
      actualValue: 12_000,
    }),
    row({ id: "other", historicalPeriod: "2026-Halloween", customer: "Club", actualUnits: 400 }),
  ];

  it("yields one row per SKU, not one per season", () => {
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2025-Halloween", "2026-Halloween"],
    });
    // Two distinct SKUs across three rows.
    expect(out).toHaveLength(2);
  });

  it("keeps the historical actual separate from the planned carry-forward", () => {
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2025-Halloween", "2026-Halloween"],
    });
    const sku = out.find((s) => s.row.customer === "Mass Retailer")!;
    // The row still reports what actually happened in the latest season used.
    expect(sku.row.actualUnits).toBe(1200);
    // 1000 -> 1600 across the programme total is +26.5% compound.
    expect(sku.plannedUnits).toBeGreaterThan(1200);
    expect(sku.basis.baselineUnits).toBe(1200);
  });

  it("applies no growth from a single season, so the plan is the prior actual", () => {
    const out = collapseToSkus(rows, { selectedPeriods: ["2026-Halloween"] });
    const sku = out.find((s) => s.row.customer === "Mass Retailer")!;
    expect(sku.plannedUnits).toBe(1200);
    expect(sku.basis.kind).toBe("prior_actual");
    expect(sku.basis.growthPct).toBe(0);
  });

  it("falls back to the business plan's growth when the seasons cannot imply one", () => {
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2026-Halloween"],
      businessGrowthPct: 0.1,
    });
    const sku = out.find((s) => s.row.customer === "Mass Retailer")!;
    expect(sku.plannedUnits).toBe(1320);
    expect(sku.basis.kind).toBe("business_plan_growth");
    expect(sku.basis.label).toContain("business-plan growth");
  });

  it("prefers observed growth over the business plan's assumption", () => {
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2025-Halloween", "2026-Halloween"],
      businessGrowthPct: 0.5,
    });
    const sku = out.find((s) => s.row.customer === "Mass Retailer")!;
    expect(sku.basis.kind).toBe("seasons");
    // The programme total went 1000 -> 1600, so +60% is what the data says,
    // not the +50% the business plan assumed.
    expect(sku.basis.growthPct).toBeCloseTo(0.6, 6);
  });

  it("carries the SKU's own season history for display", () => {
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2025-Halloween", "2026-Halloween"],
    });
    const sku = out.find((s) => s.row.customer === "Mass Retailer")!;
    expect(sku.seasonHistory).toEqual([
      { period: "2025-Halloween", units: 1000, value: 10_000 },
      { period: "2026-Halloween", units: 1200, value: 12_000 },
    ]);
  });

  it("gives the collapsed row a stable id that survives a change of basis", () => {
    const wide = collapseToSkus(rows, {
      selectedPeriods: ["2025-Halloween", "2026-Halloween"],
    });
    const narrow = collapseToSkus(rows, { selectedPeriods: ["2026-Halloween"] });
    const wideIds = wide.map((s) => s.row.id).sort();
    const narrowIds = narrow.map((s) => s.row.id).sort();
    // Same SKUs, same ids — so a disposition set under one basis is not lost
    // when the planner changes the seasons.
    expect(wideIds).toEqual(narrowIds);
  });

  it("lets a planner override win over the derived number", () => {
    const id = candidateIdFor(rows[1]!);
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2025-Halloween", "2026-Halloween"],
      volumeOverrides: { [id]: 5000 },
    });
    const sku = out.find((s) => s.row.id === id)!;
    expect(sku.plannedUnits).toBe(5000);
    expect(sku.basis.kind).toBe("planner_override");
    // What the basis *would* have said is kept, so the override can show its own delta.
    expect(sku.basis.inferredUnits).toBeGreaterThan(1200);
  });

  it("moves value with units so the bridge keeps reconciling", () => {
    const id = candidateIdFor(rows[1]!);
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2026-Halloween"],
      volumeOverrides: { [id]: 2400 },
    });
    const sku = out.find((s) => s.row.id === id)!;
    // Unit value is $10; doubling the units doubles the money.
    expect(sku.plannedUnits).toBe(2400);
    expect(sku.plannedValue).toBeCloseTo(24_000, 6);
  });

  it("never returns a negative volume", () => {
    const id = candidateIdFor(rows[1]!);
    const out = collapseToSkus(rows, {
      selectedPeriods: ["2026-Halloween"],
      volumeOverrides: { [id]: -500 },
    });
    expect(out.find((s) => s.row.id === id)!.plannedUnits).toBe(0);
  });

  it("returns nothing when the selection matches no season", () => {
    expect(collapseToSkus(rows, { selectedPeriods: ["2019-Halloween"] })).toEqual([]);
    expect(collapseToSkus(rows, { selectedPeriods: [] })).toEqual([]);
  });
});

describe("describeSeasonBasis", () => {
  const rows = [
    row({ id: "a", historicalPeriod: "2025-Halloween", actualUnits: 1000 }),
    row({ id: "b", historicalPeriod: "2026-Halloween", actualUnits: 1100 }),
  ];

  it("names the observed growth when the seasons support one", () => {
    const text = describeSeasonBasis(rows, ["2025-Halloween", "2026-Halloween"]);
    expect(text).toContain("2 seasons");
    expect(text).toContain("+10.0% observed growth");
  });

  it("says which fallback applied rather than implying observation", () => {
    expect(describeSeasonBasis(rows, ["2026-Halloween"], 0.06)).toContain("from the business plan");
    expect(describeSeasonBasis(rows, ["2026-Halloween"])).toContain("no growth applied");
  });

  it("says plainly when nothing is selected", () => {
    expect(describeSeasonBasis(rows, [])).toContain("No seasons selected");
  });
});
