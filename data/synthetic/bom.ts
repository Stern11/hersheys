import type { BomComponent } from "@/types/planning";

/**
 * Formal BOMs for already-formalized products, plus the analogue-derived
 * partial BOM for the Valentine's Premium Tin NPI (Golden Scenario B,
 * PRD §15.6 / §28.2): 3 components plan-now, 2 review, 2 wait.
 *
 * UNITS: every `uom` here matches that material's purchasing unit in
 * materials.ts exactly, and every quantity is stated at that unit's real
 * magnitude for one retail unit of the parent item. Concretely:
 *
 *   cocoa liquor / cocoa butter  MT   ~1.6e-5 MT  = ~16 g per 9.6oz bag
 *   refined cane sugar           cwt  0.0267 cwt  = 2.67 lbs = ~121 g
 *   NFDM, peanut paste           lbs
 *   soy lecithin                 kg
 *   printed film / foil          MSI  (1 MSI = 1,000 in2 = 0.645 m2)
 *   corrugate / tray / tin / PDQ ea
 *
 * A 9.6oz laydown bag consumes ~0.085 MSI of printed laminate, so a
 * 4.75M-unit Halloween season explodes to roughly 400,000 MSI of seasonal
 * film — the order of magnitude a packaging buyer actually commits to.
 */
export const BOM_COMPONENTS: BomComponent[] = [
  // --- Reese's Milk Chocolate PB Pumpkins, Snack Size 9.6oz LDB (272 g net) ---
  { id: "bom_vb_classic_cocoa", parentProductId: "prod_halloween_variety_classic", materialId: "mat_cocoa", quantityPerUnit: 0.0000165, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_cocoa_butter", parentProductId: "prod_halloween_variety_classic", materialId: "mat_cocoa_butter", quantityPerUnit: 0.000018, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_sugar", parentProductId: "prod_halloween_variety_classic", materialId: "mat_sugar", quantityPerUnit: 0.0267, uom: "cwt", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_milk", parentProductId: "prod_halloween_variety_classic", materialId: "mat_milk_solids", quantityPerUnit: 0.073, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_peanut", parentProductId: "prod_halloween_variety_classic", materialId: "mat_peanut_paste", quantityPerUnit: 0.161, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_lecithin", parentProductId: "prod_halloween_variety_classic", materialId: "mat_lecithin", quantityPerUnit: 0.00045, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_film", parentProductId: "prod_halloween_variety_classic", materialId: "mat_printed_film", quantityPerUnit: 0.085, uom: "MSI", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_corrugate", parentProductId: "prod_halloween_variety_classic", materialId: "mat_corrugate", quantityPerUnit: 0.0833, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // --- Reese's Assorted Snack Size PB Shapes, 9oz variety bag (255 g net) ---
  { id: "bom_vb_fun_cocoa", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_cocoa", quantityPerUnit: 0.0000155, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_fun_cocoa_butter", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_cocoa_butter", quantityPerUnit: 0.0000169, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_fun_sugar", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_sugar", quantityPerUnit: 0.025, uom: "cwt", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_fun_peanut", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_peanut_paste", quantityPerUnit: 0.151, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_fun_film", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_printed_film", quantityPerUnit: 0.081, uom: "MSI", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // --- Hershey's Kisses Milk Chocolate Holiday Gift Tin 24oz (680 g net) ---
  { id: "bom_holiday_tin_cocoa", parentProductId: "prod_holiday_premium_tin", materialId: "mat_cocoa", quantityPerUnit: 0.000075, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_cocoa_butter", parentProductId: "prod_holiday_premium_tin", materialId: "mat_cocoa_butter", quantityPerUnit: 0.000082, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_sugar", parentProductId: "prod_holiday_premium_tin", materialId: "mat_sugar", quantityPerUnit: 0.0075, uom: "cwt", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_milk", parentProductId: "prod_holiday_premium_tin", materialId: "mat_milk_solids", quantityPerUnit: 0.33, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_lecithin", parentProductId: "prod_holiday_premium_tin", materialId: "mat_lecithin", quantityPerUnit: 0.002, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_foil", parentProductId: "prod_holiday_premium_tin", materialId: "mat_foil", quantityPerUnit: 0.9, uom: "MSI", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_tin", parentProductId: "prod_holiday_premium_tin", materialId: "mat_tin_trim", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_tray", parentProductId: "prod_holiday_premium_tin", materialId: "mat_tray", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_corrugate", parentProductId: "prod_holiday_premium_tin", materialId: "mat_corrugate", quantityPerUnit: 0.167, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // --- Reese's PB Miniature Cups Mother's Day Gift Tin 18oz (510 g) — the strong analogue source ---
  { id: "bom_md_tin_cocoa", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_cocoa", quantityPerUnit: 0.0000309, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_cocoa_butter", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_cocoa_butter", quantityPerUnit: 0.0000337, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_sugar", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_sugar", quantityPerUnit: 0.005, uom: "cwt", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_milk", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_milk_solids", quantityPerUnit: 0.136, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_peanut", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_peanut_paste", quantityPerUnit: 0.304, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_lecithin", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_lecithin", quantityPerUnit: 0.0015, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_foil", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_foil", quantityPerUnit: 0.62, uom: "MSI", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_tin", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_tin_trim", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_tray", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_tray", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // --- Reese's PB Cups Standard Counter PDQ 24ct ---
  { id: "bom_cd_std_cocoa", parentProductId: "prod_counter_display_standard", materialId: "mat_cocoa", quantityPerUnit: 0.0000432, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_sugar", parentProductId: "prod_counter_display_standard", materialId: "mat_sugar", quantityPerUnit: 0.0698, uom: "cwt", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_peanut", parentProductId: "prod_counter_display_standard", materialId: "mat_peanut_paste", quantityPerUnit: 0.421, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_film", parentProductId: "prod_counter_display_standard", materialId: "mat_printed_film", quantityPerUnit: 0.312, uom: "MSI", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_pdq", parentProductId: "prod_counter_display_standard", materialId: "mat_pdq_display", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_corrugate", parentProductId: "prod_counter_display_standard", materialId: "mat_corrugate", quantityPerUnit: 0.25, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // --- Hershey's Kisses Diwali Shell-Molded Assortment 16ct ---
  { id: "bom_diwali_cocoa", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_cocoa", quantityPerUnit: 0.0000242, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_cocoa_butter", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_cocoa_butter", quantityPerUnit: 0.0000264, uom: "MT", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_sugar", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_sugar", quantityPerUnit: 0.0024, uom: "cwt", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_milk", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_milk_solids", quantityPerUnit: 0.106, uom: "lbs", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_foil", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_foil", quantityPerUnit: 0.29, uom: "MSI", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_tray", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_tray", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // --- Valentine's Premium Tin 2028: analogue-derived partial BOM ---
  // The shape is approved but no mold or film part number has been extended
  // to the plant, which is exactly why RCCP/MRP silently under-plan it.
  // Stable formulation inputs inherited from the Mother's Day tin: high
  // confidence, plan now.
  {
    id: "bom_val_tin_cocoa",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_cocoa",
    quantityPerUnit: 0.000032,
    uom: "MT",
    provenance: "inferred",
    confidence: 0.93,
    readiness: "plan_now",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  {
    id: "bom_val_tin_sugar",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_sugar",
    quantityPerUnit: 0.0052,
    uom: "cwt",
    provenance: "inferred",
    confidence: 0.91,
    readiness: "plan_now",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  {
    id: "bom_val_tin_peanut",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_peanut_paste",
    quantityPerUnit: 0.31,
    uom: "lbs",
    provenance: "inferred",
    confidence: 0.89,
    readiness: "plan_now",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  // Mid-confidence packaging: the heart shape changes the wrap footprint and
  // the tin depth, so both are worth a planner review before committing.
  {
    id: "bom_val_tin_foil",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_foil",
    quantityPerUnit: 0.6,
    uom: "MSI",
    provenance: "inferred",
    confidence: 0.68,
    readiness: "review",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  {
    id: "bom_val_tin_tin",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_tin_trim",
    quantityPerUnit: 1,
    uom: "ea",
    provenance: "inferred",
    confidence: 0.65,
    readiness: "review",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  // Unresolved packaging: seasonal artwork not approved, so no film part
  // number and no shipper spec exist yet — wait.
  {
    id: "bom_val_tin_printed_wrapper",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_printed_film",
    quantityPerUnit: 0.09,
    uom: "MSI",
    provenance: "inferred",
    confidence: 0.32,
    readiness: "wait",
    sourceAnalogueId: "prod_holiday_premium_tin",
  },
  {
    id: "bom_val_tin_corrugate",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_corrugate",
    quantityPerUnit: 0.2,
    uom: "ea",
    provenance: "inferred",
    confidence: 0.48,
    readiness: "wait",
    sourceAnalogueId: "prod_holiday_premium_tin",
  },
];

export const bomForProduct = (productId: string): BomComponent[] => BOM_COMPONENTS.filter((b) => b.parentProductId === productId);
