import { Badge } from "@/components/ui/badge";
import type { PlanningGapType } from "@/types/gaps";

export const GAP_TYPE_LABEL: Record<PlanningGapType, string> = {
  demand: "Seasonal Demand Gap",
  representation: "Representation Gap",
  product_uncertainty: "Product Uncertainty",
  bom_uncertainty: "Product / BOM Uncertainty",
  master_data: "Planning Assumption Gap",
  capacity: "Capacity Consequence",
  material: "Material Consequence",
};

const GAP_TYPE_VARIANT: Record<PlanningGapType, "formal" | "validated" | "inferred" | "scenario" | "historical" | "unknown"> = {
  demand: "inferred",
  representation: "unknown",
  product_uncertainty: "unknown",
  bom_uncertainty: "inferred",
  master_data: "historical",
  capacity: "validated",
  material: "validated",
};

export function GapTypeBadge({ type }: { type: PlanningGapType }) {
  return <Badge variant={GAP_TYPE_VARIANT[type]}>{GAP_TYPE_LABEL[type]}</Badge>;
}
