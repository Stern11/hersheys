import type { Analogue, Product } from "@/types/planning";

/**
 * Real US seasonal SKUs in real pack formats. Product ids are stable
 * identifiers referenced by bom.ts, gaps.ts and the workspaces — only the
 * display content (sku, name, packFormat, formulation, customers) carries
 * the Hershey detail.
 *
 * Plant implication of each item is enforced in master-data.ts: every
 * Reese's item below runs at Stuarts Draft or the Reese plant; the Kisses
 * items run at West Hershey.
 */
export const PRODUCTS: Product[] = [
  // --- Halloween snack size: mostly formal, one seasonal SKU not yet created ---
  {
    id: "prod_halloween_variety_classic",
    sku: "REE-HAL-9601",
    name: "Reese's Milk Chocolate Peanut Butter Pumpkins — Snack Size 9.6oz",
    familyId: "fam_variety_bags",
    eventId: "evt_halloween_2027",
    customerIds: ["cust_walmart", "cust_target", "cust_kroger", "cust_mclane"],
    packFormat: "9.6oz snack size laydown bag (LDB)",
    formulationFamily: "peanut_butter_milk_chocolate",
    isFormal: true,
  },
  {
    id: "prod_halloween_variety_fun_size",
    sku: "REE-HAL-9002",
    name: "Reese's Assorted Snack Size Peanut Butter Shapes — Pumpkins / Ghosts / Bats 9oz",
    familyId: "fam_variety_bags",
    eventId: "evt_halloween_2027",
    customerIds: ["cust_walmart", "cust_target", "cust_mclane"],
    packFormat: "9oz assorted snack size variety bag",
    formulationFamily: "peanut_butter_milk_chocolate",
    isFormal: true,
  },
  {
    id: "prod_halloween_variety_limited_glow",
    name: "Hershey's Cookies 'n' Creme Fangs — Snack Size 9oz",
    familyId: "fam_variety_bags",
    eventId: "evt_halloween_2027",
    customerIds: ["cust_walmart"],
    packFormat: "9oz snack size laydown bag (LDB)",
    formulationFamily: "cookies_n_creme",
    // Representation gap: expected Halloween novelty SKU, no item master record yet.
    isFormal: false,
    analoguePredecessorIds: ["prod_halloween_variety_classic"],
  },

  // --- Gift tins: formal Holiday line, plus the Valentine's NPI at the centre of Golden Scenario B ---
  {
    id: "prod_holiday_premium_tin",
    sku: "KIS-HOL-2401",
    name: "Hershey's Kisses Milk Chocolate Holiday Gift Tin 24oz",
    familyId: "fam_gift_tins",
    eventId: "evt_holiday_2027",
    customerIds: ["cust_walmart", "cust_target", "cust_kroger", "cust_costco"],
    packFormat: "24oz litho gift tin",
    formulationFamily: "milk_chocolate_assortment",
    isFormal: true,
  },
  {
    id: "prod_mothers_day_tin_2027",
    sku: "REE-MD-1801",
    name: "Reese's Peanut Butter Miniature Cups — Mother's Day Gift Tin 18oz",
    familyId: "fam_gift_tins",
    customerIds: ["cust_target", "cust_kroger", "cust_walgreens"],
    packFormat: "18oz litho gift tin",
    formulationFamily: "peanut_butter_milk_chocolate",
    isFormal: true,
  },
  {
    id: "prod_valentines_premium_tin_2028",
    name: "Reese's Peanut Butter Hearts — Valentine's Premium Gift Tin 18oz",
    familyId: "fam_gift_tins",
    eventId: "evt_valentines_2028",
    customerIds: ["cust_target", "cust_walgreens"],
    packFormat: "18oz litho gift tin",
    formulationFamily: "peanut_butter_milk_chocolate",
    // NPI: shape approved, but no final SKU, mold or film part numbers extended to the plant.
    isFormal: false,
    analoguePredecessorIds: ["prod_mothers_day_tin_2027", "prod_holiday_premium_tin"],
  },

  {
    id: "prod_holiday_kroger_exclusive_tin",
    name: "Hershey's Holiday Festive Favorites Gift Tin 44oz — Sam's Club Exclusive",
    familyId: "fam_gift_tins",
    eventId: "evt_holiday_2027",
    customerIds: ["cust_sams_club"],
    packFormat: "44oz club-exclusive litho gift tin",
    formulationFamily: "milk_chocolate_assortment",
    // Representation gap: a customer-exclusive club pack committed verbally in
    // the joint business plan, with no PO and therefore no DP representation —
    // invisible to MRP until someone creates the item.
    isFormal: false,
    analoguePredecessorIds: ["prod_holiday_premium_tin"],
  },

  // --- PDQ counter displays: carries the line-routing master-data anomaly ---
  {
    id: "prod_counter_display_standard",
    sku: "REE-PDQ-3001",
    name: "Reese's Peanut Butter Cups Standard Counter PDQ 24ct",
    familyId: "fam_counter_displays",
    customerIds: ["cust_mclane", "cust_walgreens", "cust_dollar_general"],
    packFormat: "24ct PDQ counter display",
    formulationFamily: "peanut_butter_milk_chocolate",
    isFormal: true,
  },
  {
    id: "prod_counter_display_fall_reset",
    sku: "REE-PDQ-3002",
    name: "Reese's Fall Reset Counter PDQ 24ct",
    familyId: "fam_counter_displays",
    eventId: "evt_walmart_fall_reset",
    customerIds: ["cust_walmart"],
    packFormat: "24ct PDQ counter display",
    formulationFamily: "peanut_butter_milk_chocolate",
    isFormal: true,
  },

  // --- Shell-molded novelty ---
  {
    id: "prod_diwali_molded_assortment",
    sku: "KIS-DIW-4001",
    name: "Hershey's Kisses Diwali Shell-Molded Assortment 16ct Gift Box",
    familyId: "fam_molded_novelty",
    eventId: "evt_diwali_2027",
    customerIds: ["cust_walmart", "cust_kroger", "cust_amazon"],
    packFormat: "16ct shell-molded gift box",
    formulationFamily: "milk_chocolate_assortment",
    isFormal: true,
  },
];

/**
 * AI-proposed analogue candidates for the Valentine's Premium Tin NPI
 * (Golden Scenario B). The Mother's Day tin is the stronger match — same
 * 18oz litho tin, same Reese's peanut-butter formulation, same plant — and
 * the Kisses Holiday tin is offered as the weaker alternative the planner
 * can swap in, matching the PRD's worked example of replacing one analogue
 * with another (§13.14).
 */
export const ANALOGUES: Analogue[] = [
  {
    id: "analogue_mothers_day_tin",
    candidateProductId: "prod_mothers_day_tin_2027",
    similarityScore: 0.86,
    sameDimensions: ["pack_format", "formulation_family", "tin_construction", "producing_plant"],
    differentDimensions: ["event_seasonality", "artwork_theme", "piece_shape"],
    dataQuality: "high",
    bomAvailable: true,
    lineHistoryAvailable: true,
  },
  {
    id: "analogue_holiday_premium_tin",
    candidateProductId: "prod_holiday_premium_tin",
    similarityScore: 0.64,
    sameDimensions: ["tin_construction", "customer_set"],
    differentDimensions: ["pack_format", "formulation_family", "event_seasonality", "producing_plant"],
    dataQuality: "medium",
    bomAvailable: true,
    lineHistoryAvailable: true,
  },
];

export const productById = (id: string): Product => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown product id: ${id}`);
  return p;
};

export const productsForEvent = (eventId: string): Product[] => PRODUCTS.filter((p) => p.eventId === eventId);
export const productsForFamily = (familyId: string): Product[] => PRODUCTS.filter((p) => p.familyId === familyId);
