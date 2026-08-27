export interface Supplier {
  id: string;
  name: string;
  materialIds: string[];
  region: string;
  reliabilityScore: number; // 0-1, illustrative only
}

export const SUPPLIERS: Supplier[] = [
  { id: "sup_barry_callebaut", name: "Barry Callebaut", materialIds: ["mat_cocoa"], region: "West Africa / EU", reliabilityScore: 0.91 },
  { id: "sup_asr_group", name: "ASR Group", materialIds: ["mat_sugar"], region: "US Gulf Coast", reliabilityScore: 0.95 },
  { id: "sup_land_o_lakes", name: "Land O'Lakes", materialIds: ["mat_milk_solids"], region: "US Midwest", reliabilityScore: 0.93 },
  { id: "sup_amcor", name: "Amcor", materialIds: ["mat_printed_film"], region: "US / APAC", reliabilityScore: 0.74 },
  { id: "sup_constantia", name: "Constantia Flexibles", materialIds: ["mat_foil"], region: "EU", reliabilityScore: 0.86 },
  { id: "sup_westrock", name: "WestRock", materialIds: ["mat_corrugate"], region: "US", reliabilityScore: 0.92 },
  { id: "sup_sonoco", name: "Sonoco", materialIds: ["mat_tray"], region: "US", reliabilityScore: 0.88 },
  { id: "sup_rexam_tin", name: "Rexam Tin", materialIds: ["mat_tin_trim"], region: "US / China", reliabilityScore: 0.79 },
];

export const supplierForMaterial = (materialId: string): Supplier => {
  const s = SUPPLIERS.find((x) => x.materialIds.includes(materialId));
  if (!s) throw new Error(`No supplier configured for material: ${materialId}`);
  return s;
};
