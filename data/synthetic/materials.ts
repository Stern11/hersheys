import type { Material } from "@/types/planning";

/**
 * Printed Film is the golden Master-Data gap (PRD §11.2, §18.2, §28.3):
 * system says 42 days, historical execution says otherwise.
 */
export const MATERIALS: Material[] = [
  {
    id: "mat_cocoa",
    name: "Cocoa",
    category: "raw_ingredient",
    unit: "kg",
    systemLeadTimeDays: 35,
    historicalMedianLeadTimeDays: 33,
    historicalP80LeadTimeDays: 38,
    scrapFactorSystem: 0.02,
    scrapFactorHistorical: 0.021,
    supplier: "Barry Callebaut",
  },
  {
    id: "mat_sugar",
    name: "Sugar",
    category: "raw_ingredient",
    unit: "kg",
    systemLeadTimeDays: 21,
    historicalMedianLeadTimeDays: 20,
    historicalP80LeadTimeDays: 24,
    scrapFactorSystem: 0.015,
    scrapFactorHistorical: 0.016,
    supplier: "ASR Group",
  },
  {
    id: "mat_milk_solids",
    name: "Milk Solids",
    category: "raw_ingredient",
    unit: "kg",
    systemLeadTimeDays: 28,
    historicalMedianLeadTimeDays: 27,
    historicalP80LeadTimeDays: 31,
    scrapFactorSystem: 0.018,
    scrapFactorHistorical: 0.019,
    supplier: "Land O'Lakes",
  },
  {
    id: "mat_printed_film",
    name: "Printed Film",
    category: "packaging",
    unit: "m2",
    systemLeadTimeDays: 42,
    historicalMedianLeadTimeDays: 67,
    historicalP80LeadTimeDays: 81,
    scrapFactorSystem: 0.03,
    scrapFactorHistorical: 0.041,
    supplier: "Amcor",
  },
  {
    id: "mat_foil",
    name: "Foil",
    category: "packaging",
    unit: "m2",
    systemLeadTimeDays: 30,
    historicalMedianLeadTimeDays: 34,
    historicalP80LeadTimeDays: 40,
    scrapFactorSystem: 0.025,
    scrapFactorHistorical: 0.028,
    supplier: "Constantia Flexibles",
  },
  {
    id: "mat_corrugate",
    name: "Corrugate",
    category: "packaging",
    unit: "ea",
    systemLeadTimeDays: 18,
    historicalMedianLeadTimeDays: 19,
    historicalP80LeadTimeDays: 22,
    scrapFactorSystem: 0.01,
    scrapFactorHistorical: 0.011,
    supplier: "WestRock",
  },
  {
    id: "mat_tray",
    name: "Tray",
    category: "packaging",
    unit: "ea",
    systemLeadTimeDays: 25,
    historicalMedianLeadTimeDays: 29,
    historicalP80LeadTimeDays: 35,
    scrapFactorSystem: 0.012,
    scrapFactorHistorical: 0.014,
    supplier: "Sonoco",
  },
  {
    id: "mat_tin_trim",
    name: "Tin / Trim",
    category: "packaging",
    unit: "ea",
    systemLeadTimeDays: 45,
    historicalMedianLeadTimeDays: 52,
    historicalP80LeadTimeDays: 63,
    scrapFactorSystem: 0.02,
    scrapFactorHistorical: 0.023,
    supplier: "Rexam Tin",
  },
];

export const materialById = (id: string): Material => {
  const m = MATERIALS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown material id: ${id}`);
  return m;
};
