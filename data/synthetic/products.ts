import type { Analogue, Product } from "@/types/planning";

export const PRODUCTS: Product[] = [
  // --- Halloween Variety Bags: mostly formal, one seasonal SKU not yet created ---
  {
    id: "prod_halloween_variety_classic",
    sku: "VB-HAL-1001",
    name: "Halloween Variety Bag — Classic Assortment",
    familyId: "fam_variety_bags",
    eventId: "evt_halloween_2027",
    customerIds: ["cust_walmart", "cust_target", "cust_kroger"],
    packFormat: "12ct variety bag",
    formulationFamily: "chocolate_assortment",
    isFormal: true,
  },
  {
    id: "prod_halloween_variety_fun_size",
    sku: "VB-HAL-1002",
    name: "Halloween Variety Bag — Fun Size",
    familyId: "fam_variety_bags",
    eventId: "evt_halloween_2027",
    customerIds: ["cust_walmart", "cust_target"],
    packFormat: "20ct variety bag",
    formulationFamily: "chocolate_assortment",
    isFormal: true,
  },
  {
    id: "prod_halloween_variety_limited_glow",
    name: "Halloween Variety Bag — Glow Trick-or-Treat Edition",
    familyId: "fam_variety_bags",
    eventId: "evt_halloween_2027",
    customerIds: ["cust_walmart"],
    packFormat: "12ct variety bag",
    formulationFamily: "chocolate_assortment",
    isFormal: false, // Representation gap: expected seasonal SKU, not yet created in the item master
    analoguePredecessorIds: ["prod_halloween_variety_classic"],
  },

  // --- Gift Tins: formal Holiday line, plus the Valentine's NPI at the center of Golden Scenario B ---
  {
    id: "prod_holiday_premium_tin",
    sku: "GT-HOL-2001",
    name: "Holiday Premium Tin",
    familyId: "fam_gift_tins",
    eventId: "evt_holiday_2027",
    customerIds: ["cust_walmart", "cust_target", "cust_kroger"],
    packFormat: "24oz tin",
    formulationFamily: "assorted_confection",
    isFormal: true,
  },
  {
    id: "prod_mothers_day_tin_2027",
    sku: "GT-MD-1900",
    name: "Mother's Day Tin 2027",
    familyId: "fam_gift_tins",
    customerIds: ["cust_target", "cust_kroger"],
    packFormat: "18oz tin",
    formulationFamily: "assorted_confection",
    isFormal: true,
  },
  {
    id: "prod_valentines_premium_tin_2028",
    name: "Valentine's Premium Tin 2028",
    familyId: "fam_gift_tins",
    eventId: "evt_valentines_2028",
    customerIds: ["cust_target"],
    packFormat: "18oz tin",
    formulationFamily: "assorted_confection",
    isFormal: false, // NPI: concept-level only, no final SKU/BOM (Golden Scenario B)
    analoguePredecessorIds: ["prod_mothers_day_tin_2027", "prod_holiday_premium_tin"],
  },

  {
    id: "prod_holiday_kroger_exclusive_tin",
    name: "Holiday Gift Tin — Kroger Exclusive 12oz",
    familyId: "fam_gift_tins",
    eventId: "evt_holiday_2027",
    customerIds: ["cust_kroger"],
    packFormat: "12oz tin",
    formulationFamily: "assorted_confection",
    isFormal: false, // Representation gap: Kroger has ordered an exclusive format the last two years; no 2027 SKU exists yet
    analoguePredecessorIds: ["prod_holiday_premium_tin"],
  },

  // --- Counter Displays: carries the line-mapping master-data anomaly ---
  {
    id: "prod_counter_display_standard",
    sku: "CD-STD-3001",
    name: "Standard Checkout Counter Display",
    familyId: "fam_counter_displays",
    customerIds: ["cust_walmart", "cust_kroger"],
    packFormat: "24ct display box",
    formulationFamily: "single_serve_bar",
    isFormal: true,
  },
  {
    id: "prod_counter_display_fall_reset",
    sku: "CD-FR-3002",
    name: "Walmart Fall Reset Counter Display",
    familyId: "fam_counter_displays",
    eventId: "evt_walmart_fall_reset",
    customerIds: ["cust_walmart"],
    packFormat: "24ct display box",
    formulationFamily: "single_serve_bar",
    isFormal: true,
  },

  // --- Molded Novelty: Diwali ---
  {
    id: "prod_diwali_molded_assortment",
    sku: "MN-DIW-4001",
    name: "Diwali Molded Novelty Assortment",
    familyId: "fam_molded_novelty",
    eventId: "evt_diwali_2027",
    customerIds: ["cust_walmart", "cust_kroger"],
    packFormat: "16ct box",
    formulationFamily: "molded_shape",
    isFormal: true,
  },
];

/**
 * AI-proposed analogue candidates for the Valentine's Premium Tin NPI
 * (Golden Scenario B). Mother's Day Tin is the stronger match (same
 * formulation family, same tin format); Holiday Premium Tin is offered as
 * an alternative the planner can swap in, matching the PRD's worked example
 * of replacing one analogue with another (§13.14).
 */
export const ANALOGUES: Analogue[] = [
  {
    id: "analogue_mothers_day_tin",
    candidateProductId: "prod_mothers_day_tin_2027",
    similarityScore: 0.86,
    sameDimensions: ["pack_format", "formulation_family", "tin_construction"],
    differentDimensions: ["event_seasonality", "artwork_theme"],
    dataQuality: "high",
    bomAvailable: true,
    lineHistoryAvailable: true,
  },
  {
    id: "analogue_holiday_premium_tin",
    candidateProductId: "prod_holiday_premium_tin",
    similarityScore: 0.64,
    sameDimensions: ["formulation_family", "customer_set"],
    differentDimensions: ["pack_format", "tin_construction", "event_seasonality"],
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
