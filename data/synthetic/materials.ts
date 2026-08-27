import type { Material } from "@/types/planning";

/**
 * Real confectionery BOM inputs, in the UoM they are actually purchased in:
 * cocoa liquor and cocoa butter in metric tonnes, sugar in hundredweight
 * (cwt), peanut paste and NFDM in pounds, lecithin in kilograms, and every
 * flexible film in MSI (thousand square inches — the real purchasing UoM
 * for printed laminate, not m2). Quantities in bom.ts are stated in these
 * same units, so a per-unit quantity multiplied by seasonal volume lands on
 * a number a buyer would recognize.
 *
 * `systemLeadTimeDays` is what the ERP carries; the historical fields are
 * what PO-to-goods-receipt execution actually shows. execution-history.ts
 * generates the underlying receipts and is the source of truth for the
 * computed statistics — the historical values here are kept in sync with it.
 *
 * Printed Seasonal Film is the golden master-data gap (PRD §11.2, §18.2,
 * §28.3) and the classic seasonal constraint in this industry: art- and
 * plate-dependent seasonal laminate genuinely runs 8-12 weeks, but the ERP
 * still carries a 6-week norm that was never re-validated.
 */
export const MATERIALS: Material[] = [
  {
    id: "mat_cocoa",
    name: "Cocoa Liquor",
    category: "raw_ingredient",
    unit: "MT",
    systemLeadTimeDays: 63,
    historicalMedianLeadTimeDays: 66,
    historicalP80LeadTimeDays: 68,
    scrapFactorSystem: 0.02,
    scrapFactorHistorical: 0.021,
    supplier: "Barry Callebaut",
  },
  {
    id: "mat_cocoa_butter",
    name: "Cocoa Butter",
    category: "raw_ingredient",
    unit: "MT",
    systemLeadTimeDays: 56,
    historicalMedianLeadTimeDays: 58,
    historicalP80LeadTimeDays: 60,
    scrapFactorSystem: 0.018,
    scrapFactorHistorical: 0.02,
    supplier: "Barry Callebaut",
  },
  {
    id: "mat_sugar",
    name: "Refined Cane Sugar",
    category: "raw_ingredient",
    unit: "cwt",
    systemLeadTimeDays: 35,
    historicalMedianLeadTimeDays: 38,
    historicalP80LeadTimeDays: 41,
    scrapFactorSystem: 0.015,
    scrapFactorHistorical: 0.016,
    supplier: "ASR Group",
  },
  {
    id: "mat_milk_solids",
    name: "Nonfat Dry Milk (NFDM)",
    category: "raw_ingredient",
    unit: "lbs",
    systemLeadTimeDays: 32,
    historicalMedianLeadTimeDays: 33,
    historicalP80LeadTimeDays: 36,
    scrapFactorSystem: 0.018,
    scrapFactorHistorical: 0.019,
    supplier: "Dairy Farmers of America",
  },
  {
    id: "mat_peanut_paste",
    name: "Roasted Peanut Paste",
    category: "raw_ingredient",
    unit: "lbs",
    systemLeadTimeDays: 30,
    historicalMedianLeadTimeDays: 31,
    historicalP80LeadTimeDays: 34,
    scrapFactorSystem: 0.016,
    scrapFactorHistorical: 0.018,
    supplier: "Golden Peanut & Tree Nuts",
  },
  {
    id: "mat_lecithin",
    name: "Soy Lecithin",
    category: "raw_ingredient",
    unit: "kg",
    systemLeadTimeDays: 49,
    historicalMedianLeadTimeDays: 53,
    historicalP80LeadTimeDays: 55,
    scrapFactorSystem: 0.01,
    scrapFactorHistorical: 0.011,
    supplier: "ADM",
  },
  {
    id: "mat_printed_film",
    name: "Printed Seasonal Film",
    category: "packaging",
    unit: "MSI",
    systemLeadTimeDays: 42,
    historicalMedianLeadTimeDays: 67,
    historicalP80LeadTimeDays: 74,
    scrapFactorSystem: 0.03,
    scrapFactorHistorical: 0.041,
    supplier: "Amcor Flexibles",
  },
  {
    id: "mat_foil",
    name: "Foil Wrap",
    category: "packaging",
    unit: "MSI",
    systemLeadTimeDays: 30,
    historicalMedianLeadTimeDays: 33,
    historicalP80LeadTimeDays: 37,
    scrapFactorSystem: 0.025,
    scrapFactorHistorical: 0.028,
    supplier: "Constantia Flexibles",
  },
  {
    id: "mat_corrugate",
    name: "Corrugate Shipper",
    category: "packaging",
    unit: "ea",
    systemLeadTimeDays: 24,
    historicalMedianLeadTimeDays: 25,
    historicalP80LeadTimeDays: 27,
    scrapFactorSystem: 0.01,
    scrapFactorHistorical: 0.011,
    supplier: "Smurfit Westrock",
  },
  {
    id: "mat_pdq_display",
    name: "PDQ Display Shell",
    category: "packaging",
    unit: "ea",
    systemLeadTimeDays: 25,
    historicalMedianLeadTimeDays: 27,
    historicalP80LeadTimeDays: 29,
    scrapFactorSystem: 0.012,
    scrapFactorHistorical: 0.014,
    supplier: "Smurfit Westrock",
  },
  {
    id: "mat_tray",
    name: "Thermoformed Tray / Insert",
    category: "packaging",
    unit: "ea",
    systemLeadTimeDays: 25,
    historicalMedianLeadTimeDays: 28,
    historicalP80LeadTimeDays: 32,
    scrapFactorSystem: 0.012,
    scrapFactorHistorical: 0.014,
    supplier: "Sonoco",
  },
  {
    id: "mat_tin_trim",
    name: "Litho-Printed Tin (offshore)",
    category: "packaging",
    unit: "ea",
    systemLeadTimeDays: 112,
    historicalMedianLeadTimeDays: 123,
    historicalP80LeadTimeDays: 131,
    scrapFactorSystem: 0.02,
    scrapFactorHistorical: 0.023,
    supplier: "Massilly North America",
  },
];

export const materialById = (id: string): Material => {
  const m = MATERIALS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown material id: ${id}`);
  return m;
};
