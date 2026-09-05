/**
 * Contributor-list filtering (V2 §42).
 *
 * Twenty prior items is a list; two hundred is a haystack. A planner narrows
 * by the dimensions they already think in — family, brand, customer — and by
 * the one question the page is actually about: what is not covered by the
 * plan.
 *
 * Pure: no React.
 */

import type { CandidateItem, ContributorDisposition } from "@/types/situation";

export interface CandidateFilters {
  productFamily?: string;
  brand?: string;
  customer?: string;
  disposition?: ContributorDisposition;
  /** Only items no plan item stands for. */
  uncoveredOnly?: boolean;
  /** Free text over item name and id. */
  search?: string;
}

export const EMPTY_FILTERS: CandidateFilters = {};

/** The distinct values available for each filter, for building the controls. */
export interface FilterOptions {
  productFamilies: string[];
  brands: string[];
  customers: string[];
}

export function filterOptions(candidates: readonly CandidateItem[]): FilterOptions {
  const families = new Set<string>();
  const brands = new Set<string>();
  const customers = new Set<string>();
  for (const c of candidates) {
    if (c.productFamily) families.add(c.productFamily);
    if (c.brand) brands.add(c.brand);
    if (c.customer) customers.add(c.customer);
  }
  return {
    productFamilies: [...families].sort(),
    brands: [...brands].sort(),
    customers: [...customers].sort(),
  };
}

/** True when the item has no plan item standing for it. */
export function isUncovered(candidate: CandidateItem): boolean {
  return candidate.match.matchedItemId === undefined;
}

export function applyFilters(
  candidates: readonly CandidateItem[],
  filters: CandidateFilters
): CandidateItem[] {
  const search = filters.search?.trim().toLowerCase();

  return candidates.filter((c) => {
    if (filters.productFamily && c.productFamily !== filters.productFamily) return false;
    if (filters.brand && c.brand !== filters.brand) return false;
    if (filters.customer && c.customer !== filters.customer) return false;
    if (filters.disposition && c.disposition !== filters.disposition) return false;
    if (filters.uncoveredOnly && !isUncovered(c)) return false;
    if (search) {
      const haystack = `${c.itemName} ${c.itemId} ${c.brand} ${c.productFamily}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function activeFilterCount(filters: CandidateFilters): number {
  let n = 0;
  if (filters.productFamily) n++;
  if (filters.brand) n++;
  if (filters.customer) n++;
  if (filters.disposition) n++;
  if (filters.uncoveredOnly) n++;
  if (filters.search?.trim()) n++;
  return n;
}

/**
 * What the filtered selection is worth.
 *
 * Shown next to the filters so narrowing the list never hides how much
 * business the planner is now looking at — a filtered view that still quotes
 * the unfiltered total would be worse than no total at all.
 */
export function filteredTotals(candidates: readonly CandidateItem[]): {
  count: number;
  plannedUnits: number;
  plannedValue: number;
  carryForwardCount: number;
  undecidedCount: number;
} {
  let plannedUnits = 0;
  let plannedValue = 0;
  let carryForwardCount = 0;
  let undecidedCount = 0;

  for (const c of candidates) {
    if (c.disposition === "carry_forward") {
      plannedUnits += c.plannedUnits;
      plannedValue += c.plannedValue;
      carryForwardCount++;
    }
    if (c.disposition === "unreviewed" || c.disposition === "under_review") undecidedCount++;
  }

  return {
    count: candidates.length,
    plannedUnits,
    plannedValue,
    carryForwardCount,
    undecidedCount,
  };
}
