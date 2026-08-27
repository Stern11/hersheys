import type { ProductFamily, ProductionLine } from "@/types/planning";

/**
 * The demo's "now". All relative deadlines/runways are computed from this
 * anchor so the whole dataset reconciles (PRD §27.6). Hand-picked so the
 * Halloween golden scenario sits ~6-9 weeks before its earliest deadline.
 */
export const DEMO_NOW = "2027-08-24T09:00:00.000Z";

export const PRODUCT_FAMILIES: ProductFamily[] = [
  { id: "fam_variety_bags", name: "Variety Bags", description: "Assorted single-serve pieces sold in a multi-pack bag." },
  { id: "fam_gift_tins", name: "Gift Tins", description: "Premium seasonal assortments in a reusable metal tin." },
  { id: "fam_counter_displays", name: "Counter Displays", description: "Impulse checkout-counter merchandising units." },
  { id: "fam_molded_novelty", name: "Molded Novelty", description: "Shaped/molded seasonal novelty items." },
];

/**
 * Line 03 is the consistently constrained line (highest committed formal
 * load, lowest run-rate slack, primary Halloween/Variety Bags line). Line 04
 * is the flexible alternate with headroom. Line 03's rates are the exact
 * System/Historical example used throughout the PRD (§18.2).
 */
export const PRODUCTION_LINES: ProductionLine[] = [
  {
    id: "line_01",
    name: "Line 01",
    plant: "Hershey, PA",
    standardRunRateUnitsPerHour: 9000,
    historicalMedianRunRateUnitsPerHour: 8850,
    eligibleFamilyIds: ["fam_variety_bags", "fam_molded_novelty"],
  },
  {
    id: "line_02",
    name: "Line 02",
    plant: "Hershey, PA",
    standardRunRateUnitsPerHour: 7200,
    historicalMedianRunRateUnitsPerHour: 6980,
    eligibleFamilyIds: ["fam_counter_displays"],
  },
  {
    id: "line_03",
    name: "Line 03",
    plant: "Hershey, PA",
    standardRunRateUnitsPerHour: 10000,
    historicalMedianRunRateUnitsPerHour: 7950,
    eligibleFamilyIds: ["fam_variety_bags", "fam_gift_tins"],
  },
  {
    id: "line_04",
    name: "Line 04",
    plant: "Hershey, PA",
    standardRunRateUnitsPerHour: 6500,
    historicalMedianRunRateUnitsPerHour: 6400,
    eligibleFamilyIds: ["fam_variety_bags", "fam_gift_tins", "fam_molded_novelty"],
  },
];

export const lineById = (id: string): ProductionLine => {
  const l = PRODUCTION_LINES.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown line id: ${id}`);
  return l;
};

export const familyById = (id: string): ProductFamily => {
  const f = PRODUCT_FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown product family id: ${id}`);
  return f;
};
