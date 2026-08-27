import type { BomComponent } from "@/types/planning";

/**
 * Formal BOMs for already-formalized products, plus the analogue-derived
 * partial BOM for the Valentine's Premium Tin NPI (Golden Scenario B,
 * PRD §15.6 / §28.2): 3 components plan-now, 2 review, 2 wait.
 */
export const BOM_COMPONENTS: BomComponent[] = [
  // Halloween Variety Bag — Classic (formal)
  { id: "bom_vb_classic_cocoa", parentProductId: "prod_halloween_variety_classic", materialId: "mat_cocoa", quantityPerUnit: 0.045, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_sugar", parentProductId: "prod_halloween_variety_classic", materialId: "mat_sugar", quantityPerUnit: 0.038, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_milk", parentProductId: "prod_halloween_variety_classic", materialId: "mat_milk_solids", quantityPerUnit: 0.022, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_film", parentProductId: "prod_halloween_variety_classic", materialId: "mat_printed_film", quantityPerUnit: 0.06, uom: "m2", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_classic_foil", parentProductId: "prod_halloween_variety_classic", materialId: "mat_foil", quantityPerUnit: 0.01, uom: "m2", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // Halloween Variety Bag — Fun Size (formal)
  { id: "bom_vb_fun_cocoa", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_cocoa", quantityPerUnit: 0.03, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_fun_sugar", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_sugar", quantityPerUnit: 0.026, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_vb_fun_film", parentProductId: "prod_halloween_variety_fun_size", materialId: "mat_printed_film", quantityPerUnit: 0.045, uom: "m2", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // Holiday Premium Tin (formal)
  { id: "bom_holiday_tin_cocoa", parentProductId: "prod_holiday_premium_tin", materialId: "mat_cocoa", quantityPerUnit: 0.08, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_sugar", parentProductId: "prod_holiday_premium_tin", materialId: "mat_sugar", quantityPerUnit: 0.05, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_milk", parentProductId: "prod_holiday_premium_tin", materialId: "mat_milk_solids", quantityPerUnit: 0.03, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_tin", parentProductId: "prod_holiday_premium_tin", materialId: "mat_tin_trim", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_tray", parentProductId: "prod_holiday_premium_tin", materialId: "mat_tray", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_holiday_tin_corrugate", parentProductId: "prod_holiday_premium_tin", materialId: "mat_corrugate", quantityPerUnit: 0.2, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // Mother's Day Tin 2027 (formal — used as an analogue source below)
  { id: "bom_md_tin_cocoa", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_cocoa", quantityPerUnit: 0.072, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_sugar", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_sugar", quantityPerUnit: 0.046, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_milk", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_milk_solids", quantityPerUnit: 0.027, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_tin", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_tin_trim", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_md_tin_foil", parentProductId: "prod_mothers_day_tin_2027", materialId: "mat_foil", quantityPerUnit: 0.014, uom: "m2", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // Counter Display — Standard (formal)
  { id: "bom_cd_std_cocoa", parentProductId: "prod_counter_display_standard", materialId: "mat_cocoa", quantityPerUnit: 0.03, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_sugar", parentProductId: "prod_counter_display_standard", materialId: "mat_sugar", quantityPerUnit: 0.025, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_milk", parentProductId: "prod_counter_display_standard", materialId: "mat_milk_solids", quantityPerUnit: 0.015, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_corrugate", parentProductId: "prod_counter_display_standard", materialId: "mat_corrugate", quantityPerUnit: 1, uom: "ea", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_cd_std_film", parentProductId: "prod_counter_display_standard", materialId: "mat_printed_film", quantityPerUnit: 0.04, uom: "m2", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // Diwali Molded Novelty Assortment (formal)
  { id: "bom_diwali_cocoa", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_cocoa", quantityPerUnit: 0.05, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_sugar", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_sugar", quantityPerUnit: 0.04, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_milk", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_milk_solids", quantityPerUnit: 0.025, uom: "kg", provenance: "formal", confidence: 1, readiness: "plan_now" },
  { id: "bom_diwali_foil", parentProductId: "prod_diwali_molded_assortment", materialId: "mat_foil", quantityPerUnit: 0.015, uom: "m2", provenance: "formal", confidence: 1, readiness: "plan_now" },

  // --- Valentine's Premium Tin 2028: analogue-derived partial BOM ---
  // Stable raw ingredients: high confidence, plan now.
  {
    id: "bom_val_tin_cocoa",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_cocoa",
    quantityPerUnit: 0.075,
    uom: "kg",
    provenance: "inferred",
    confidence: 0.93,
    readiness: "plan_now",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  {
    id: "bom_val_tin_sugar",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_sugar",
    quantityPerUnit: 0.048,
    uom: "kg",
    provenance: "inferred",
    confidence: 0.91,
    readiness: "plan_now",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  {
    id: "bom_val_tin_milk",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_milk_solids",
    quantityPerUnit: 0.028,
    uom: "kg",
    provenance: "inferred",
    confidence: 0.89,
    readiness: "plan_now",
    sourceAnalogueId: "prod_mothers_day_tin_2027",
  },
  // Mid-confidence packaging: worth reviewing before committing.
  {
    id: "bom_val_tin_foil",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_foil",
    quantityPerUnit: 0.013,
    uom: "m2",
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
  // Unresolved packaging: artwork/spec not final, wait.
  {
    id: "bom_val_tin_printed_wrapper",
    parentProductId: "prod_valentines_premium_tin_2028",
    materialId: "mat_printed_film",
    quantityPerUnit: 0.02,
    uom: "m2",
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
