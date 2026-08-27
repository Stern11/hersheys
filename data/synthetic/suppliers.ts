export interface Supplier {
  id: string;
  name: string;
  materialIds: string[];
  region: string;
  reliabilityScore: number; // 0-1, illustrative only
  /** Why this supplier's execution behaves the way it does — shown as evidence rationale. */
  note?: string;
}

/**
 * One supplier per material, matching how these commodities are really
 * sourced. Amcor's low reliability score is the Printed Seasonal Film
 * story: seasonal laminate is art- and plate-dependent, so a graphics
 * revision restarts the clock and the ERP's 6-week norm stops holding.
 * Offshore litho tin is the other long pole — 16-20 weeks, ocean freight,
 * and no reorder window once a season is committed.
 */
export const SUPPLIERS: Supplier[] = [
  {
    id: "sup_barry_callebaut",
    name: "Barry Callebaut",
    materialIds: ["mat_cocoa", "mat_cocoa_butter"],
    region: "West Africa origin / EU + US processing",
    reliabilityScore: 0.91,
    note: "Contracted cocoa liquor and butter, 8-16 week nominal lead time depending on origin arrival.",
  },
  {
    id: "sup_asr_group",
    name: "ASR Group",
    materialIds: ["mat_sugar"],
    region: "US Gulf Coast refining",
    reliabilityScore: 0.95,
    note: "Refined cane sugar on annual contract, drawn in cwt against a rolling call-off.",
  },
  {
    id: "sup_dfa",
    name: "Dairy Farmers of America",
    materialIds: ["mat_milk_solids"],
    region: "US Midwest",
    reliabilityScore: 0.93,
    note: "NFDM / milk solids, 4-6 week replenishment.",
  },
  {
    id: "sup_golden_peanut",
    name: "Golden Peanut & Tree Nuts",
    materialIds: ["mat_peanut_paste"],
    region: "US Southeast",
    reliabilityScore: 0.94,
    note: "Roasted peanut paste delivered in bulk to Stuarts Draft and the Reese plant.",
  },
  {
    id: "sup_adm",
    name: "ADM",
    materialIds: ["mat_lecithin"],
    region: "US Midwest",
    reliabilityScore: 0.89,
    note: "Soy lecithin emulsifier, 6-10 week lead time.",
  },
  {
    id: "sup_amcor",
    name: "Amcor Flexibles",
    materialIds: ["mat_printed_film"],
    region: "US converting / APAC substrate",
    reliabilityScore: 0.74,
    note: "Printed seasonal laminate. Art approval and cylinder/plate cutting sit ahead of the print run, so any graphics revision restarts an 8-12 week clock.",
  },
  {
    id: "sup_constantia",
    name: "Constantia Flexibles",
    materialIds: ["mat_foil"],
    region: "EU / US",
    reliabilityScore: 0.86,
    note: "Foil wrap for Kisses and miniature cups.",
  },
  {
    id: "sup_smurfit_westrock",
    name: "Smurfit Westrock",
    materialIds: ["mat_corrugate", "mat_pdq_display"],
    region: "US",
    reliabilityScore: 0.92,
    note: "Corrugate shippers and PDQ display shells, 3-5 week lead time from regional plants.",
  },
  {
    id: "sup_sonoco",
    name: "Sonoco",
    materialIds: ["mat_tray"],
    region: "US",
    reliabilityScore: 0.88,
    note: "Thermoformed trays and inserts for gift tins.",
  },
  {
    id: "sup_massilly",
    name: "Massilly North America",
    materialIds: ["mat_tin_trim"],
    region: "US import / China litho",
    reliabilityScore: 0.79,
    note: "Offshore litho-printed tin, 16-20 weeks including ocean freight — the longest pole in any seasonal gift-tin program.",
  },
];

export const supplierForMaterial = (materialId: string): Supplier => {
  const s = SUPPLIERS.find((x) => x.materialIds.includes(materialId));
  if (!s) throw new Error(`No supplier configured for material: ${materialId}`);
  return s;
};
