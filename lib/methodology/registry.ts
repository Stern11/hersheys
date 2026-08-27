import { METHODOLOGY_DEFINITIONS, getMethodologyDefinition } from "./definitions";
import type { MethodologyDefinition, PlanningMethodologyId } from "@/types/methodology";

/**
 * Read-only accessor surface for methodology reference data. UI components
 * (MethodologyBadge, MethodologyDetails, PlanningBasisEditor) should import
 * from here rather than reaching into `definitions.ts` directly, so the
 * lookup behavior (and future additions, e.g. a search/filter) stays in one
 * place.
 */
export function listMethodologies(): MethodologyDefinition[] {
  return METHODOLOGY_DEFINITIONS;
}

export function getMethodology(id: PlanningMethodologyId): MethodologyDefinition {
  return getMethodologyDefinition(id);
}

export function getMethodologies(ids: PlanningMethodologyId[]): MethodologyDefinition[] {
  return ids.map(getMethodologyDefinition);
}
