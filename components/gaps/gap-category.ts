import type { PlanningGapType } from "@/types/gaps";

/**
 * The four root planning-gap categories a planner navigates by. Capacity
 * and material gaps are deliberately excluded here — they are operational
 * consequences / lenses discoverable from the demand or assumption gap
 * that caused them, not independent root categories (see docs).
 */
export type GapCategorySlug = "demand-events" | "planning-assumptions" | "product-readiness" | "representation";

export interface GapCategoryDef {
  slug: GapCategorySlug;
  label: string;
  description: string;
  question: string;
}

export const GAP_CATEGORIES: GapCategoryDef[] = [
  {
    slug: "demand-events",
    label: "Demand & Events",
    description: "Expected seasonal or commercial demand not sufficiently represented in the formal plan.",
    question: "What business or demand events are coming, and how much of them is already represented?",
  },
  {
    slug: "planning-assumptions",
    label: "Planning Assumptions",
    description: "System planning values that differ materially from historical execution.",
    question: "Where does a formal planning value deserve a second look against what actually happened?",
  },
  {
    slug: "product-readiness",
    label: "Product & BOM Readiness",
    description: "Products expected soon but not yet fully resolved for formal planning.",
    question: "What can already be planned safely, even before everything about a product is known?",
  },
  {
    slug: "representation",
    label: "Representation",
    description: "Business intent that exists upstream but has not yet been translated into the operational plan.",
    question: "What does the business already expect that the plan has not yet absorbed?",
  },
];

const TYPE_TO_CATEGORY: Partial<Record<PlanningGapType, GapCategorySlug>> = {
  demand: "demand-events",
  master_data: "planning-assumptions",
  bom_uncertainty: "product-readiness",
  product_uncertainty: "product-readiness",
  representation: "representation",
  // capacity / material: consequence lenses, not categorized on the landing page
};

export function categoryForGapType(type: PlanningGapType): GapCategorySlug | null {
  return TYPE_TO_CATEGORY[type] ?? null;
}

export function getCategory(slug: GapCategorySlug): GapCategoryDef {
  const def = GAP_CATEGORIES.find((c) => c.slug === slug);
  if (!def) throw new Error(`Unknown gap category: ${slug}`);
  return def;
}
