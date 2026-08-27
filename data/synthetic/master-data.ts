import type { ProductFamily, ProductionLine } from "@/types/planning";

/**
 * The demo's "now". All relative deadlines/runways are computed from this
 * anchor so the whole dataset reconciles (PRD §27.6).
 *
 * Anchored inside the Halloween 2027 seasonal calendar at the point where
 * the season is still actionable. The real Hershey seasonal cadence is:
 * printed film / packaging commitment Jan-Mar, PRODUCTION Mar-Jul,
 * shipment Jul-Sep, shelf set around Labor Day, SELL-THROUGH Sep-Oct.
 * Standing on 8 March 2027 the planner is at the close of the film-commit
 * window with the June production peak ~13 weeks out — every seasonal
 * decision in the dataset is still open, and none of them sit in the past.
 */
export const DEMO_NOW = "2027-03-08T09:00:00.000Z";

export const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    id: "fam_variety_bags",
    name: "Seasonal Snack Size Bags",
    description: "Snack-size pieces in seasonal laydown (LDB) and stand-up (SUP) bags — the volume core of every US season.",
  },
  {
    id: "fam_gift_tins",
    name: "Seasonal Gift Tins",
    description: "Premium seasonal assortments in a litho-printed reusable tin, sourced offshore on a 16-20 week tin lead time.",
  },
  {
    id: "fam_counter_displays",
    name: "PDQ Counter Displays",
    description: "Pre-packed shelf-ready impulse displays shipped into convenience, drug and dollar through distribution.",
  },
  {
    id: "fam_molded_novelty",
    name: "Shell-Molded Novelty",
    description: "Shell-molded and foil-wrapped seasonal novelty shapes.",
  },
];

/**
 * Plant/line assignment follows what each Hershey plant actually makes:
 * Reese's peanut-butter items run at the Reese plant (Hershey PA) or at
 * Stuarts Draft VA — the peanut/PB plant and Hershey's second-largest US
 * facility — while Kisses and milk-chocolate items run at West Hershey.
 * Nothing Reese's is routed to Lancaster (Twizzlers) or Hazleton (Kit Kat).
 *
 * Line 03 (Stuarts Draft) is the consistently constrained line: highest
 * committed formal load, widest spread between its system-standard rate and
 * its actually-observed rate, and the primary line for Reese's seasonal
 * snack-size shapes. Line 04 (West Hershey) is the flexible alternate with
 * headroom. Line 03's rates are the exact System/Historical example used
 * throughout the PRD (§18.2).
 *
 * Line 01's `eligibleFamilyIds` deliberately omits PDQ counter displays even
 * though 84% of counter-display runs actually happen there — that omission
 * IS the routing master-data gap (gaps.ts::detectLineMappingGap), not an
 * oversight in this file.
 */
export const PRODUCTION_LINES: ProductionLine[] = [
  {
    id: "line_01",
    name: "Reese L01",
    plant: "Reese Plant — Hershey, PA",
    standardRunRateUnitsPerHour: 9000,
    historicalMedianRunRateUnitsPerHour: 8850,
    eligibleFamilyIds: ["fam_variety_bags", "fam_molded_novelty"],
  },
  {
    id: "line_02",
    name: "Reese L02",
    plant: "Reese Plant — Hershey, PA",
    standardRunRateUnitsPerHour: 7200,
    historicalMedianRunRateUnitsPerHour: 6980,
    eligibleFamilyIds: ["fam_counter_displays"],
  },
  {
    id: "line_03",
    name: "Stuarts Draft L03",
    plant: "Stuarts Draft, VA",
    standardRunRateUnitsPerHour: 10000,
    historicalMedianRunRateUnitsPerHour: 7950,
    eligibleFamilyIds: ["fam_variety_bags", "fam_gift_tins"],
  },
  {
    id: "line_04",
    name: "West Hershey L04",
    plant: "West Hershey, PA",
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
