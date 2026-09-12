/**
 * Status chips for V2.
 *
 * V1 showed severity, type, methodology, confidence and status simultaneously,
 * which meant none of them registered. V2 shows one planner-friendly state
 * (V2 §62) and, on the reconcile screen only, the disposition of a candidate.
 */

import type { ContributorDisposition, MaterialPlanningStatus, SituationState } from "@/types/situation";
import { cn } from "@/lib/utils/cn";

const SITUATION_STATE: Record<SituationState, { label: string; className: string }> = {
  ACTION_NEEDED: {
    label: "Action needed",
    className: "bg-[var(--risk-critical-soft)] text-[var(--risk-critical)]",
  },
  MONITOR: {
    label: "Monitor",
    className: "bg-[var(--risk-warning-soft)] text-[var(--risk-warning)]",
  },
  FORMING: {
    label: "Forming",
    className: "bg-[var(--state-inferred-soft)] text-[var(--state-inferred)]",
  },
  RECONCILED: {
    label: "Reconciled",
    className: "bg-[var(--risk-positive-soft)] text-[var(--risk-positive)]",
  },
};

const CHIP = "inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-medium leading-none whitespace-nowrap";

export function StateBadge({ state, className }: { state: SituationState; className?: string }) {
  const config = SITUATION_STATE[state];
  return <span className={cn(CHIP, config.className, className)}>{config.label}</span>;
}

const MATERIAL_STATUS: Record<MaterialPlanningStatus, { label: string; className: string }> = {
  PLAN_NOW: { label: "Plan now", className: "bg-[var(--risk-positive-soft)] text-[var(--risk-positive)]" },
  REVIEW: { label: "Review", className: "bg-[var(--risk-warning-soft)] text-[var(--risk-warning)]" },
  WAIT: { label: "Wait", className: "bg-[var(--state-unknown-soft)] text-[var(--text-secondary)]" },
};

export function MaterialStatusBadge({ status }: { status: MaterialPlanningStatus }) {
  const config = MATERIAL_STATUS[status];
  return <span className={cn(CHIP, config.className)}>{config.label}</span>;
}

/**
 * Dispositions use the planning-state palette rather than the risk palette:
 * they describe what a piece of business *is*, not how dangerous it is. The
 * two token sets are kept structurally separate.
 */
const DISPOSITION: Record<ContributorDisposition, { label: string; className: string }> = {
  unreviewed: { label: "Unreviewed", className: "bg-[var(--state-unknown-soft)] text-[var(--text-secondary)]" },
  carry_forward: { label: "Carry forward", className: "bg-[var(--state-validated-soft)] text-[var(--state-validated)]" },
  already_represented: { label: "Already represented", className: "bg-[var(--state-formal-soft)] text-[var(--state-formal)]" },
  intentional_exit: { label: "Intentional exit", className: "bg-[var(--state-historical-soft)] text-[var(--text-secondary)]" },
  under_review: { label: "Under review", className: "bg-[var(--state-inferred-soft)] text-[var(--state-inferred)]" },
  new_or_changed: { label: "New or changed", className: "bg-[var(--state-scenario-soft)] text-[var(--state-scenario)]" },
};

export function DispositionBadge({ disposition }: { disposition: ContributorDisposition }) {
  const config = DISPOSITION[disposition];
  return <span className={cn(CHIP, config.className)}>{config.label}</span>;
}

export const DISPOSITION_ORDER: ContributorDisposition[] = [
  "carry_forward",
  "already_represented",
  "intentional_exit",
  "under_review",
  "new_or_changed",
];

export function dispositionLabel(disposition: ContributorDisposition): string {
  return DISPOSITION[disposition].label;
}
