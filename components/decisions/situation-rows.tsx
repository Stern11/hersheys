"use client";

/**
 * One row per situation (Decisions §2).
 *
 * The reconcile screen is where a decision is made; this is where the planner
 * checks what has already been decided — lifecycle, how much of the expected
 * business is represented, how much is validated to carry forward, and how
 * many of those calls the planner has actually made.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PlanningSituation, SituationLifecycle, SituationOverrides } from "@/types/situation";
import { StateBadge } from "@/components/v2/state-badge";
import { cn } from "@/lib/utils/cn";
import { fmtMoney, fmtPct } from "@/lib/utils/format";

const CHIP = "inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-medium leading-none whitespace-nowrap";

/**
 * Local chip for `SituationLifecycle` — data maturity, not planner attention.
 * Deliberately reuses the planning-state token pairs `StateBadge`/
 * `DispositionBadge` already use, rather than the risk palette.
 */
const LIFECYCLE_CHIP: Record<SituationLifecycle, { label: string; className: string }> = {
  UNRESOLVED: { label: "Unresolved", className: "bg-[var(--state-inferred-soft)] text-[var(--state-inferred)]" },
  PARTIALLY_FORMALIZED: {
    label: "Partially formalized",
    className: "bg-[var(--state-validated-soft)] text-[var(--state-validated)]",
  },
  FORMAL: { label: "Formal", className: "bg-[var(--state-formal-soft)] text-[var(--state-formal)]" },
  RECONCILED: { label: "Reconciled", className: "bg-[var(--risk-positive-soft)] text-[var(--risk-positive)]" },
};

function LifecycleChip({ lifecycle }: { lifecycle: SituationLifecycle }) {
  const config = LIFECYCLE_CHIP[lifecycle];
  return <span className={cn(CHIP, config.className)}>{config.label}</span>;
}

export function SituationRows({
  situations,
  overridesBySituation,
}: {
  situations: PlanningSituation[];
  overridesBySituation: Record<string, SituationOverrides>;
}) {
  if (situations.length === 0) {
    return <p className="py-4 text-[13px] text-[var(--text-muted)]">No planning situations found.</p>;
  }

  return (
    <div className="border-t border-[var(--border)]">
      {situations.map((situation) => {
        const decisions = Object.keys(overridesBySituation[situation.id]?.dispositions ?? {}).length;
        const pct = Math.round(situation.bridge.representedPct * 100);
        return (
          <Link
            key={situation.id}
            href={`/workspace/${situation.id}/reconcile`}
            className="group flex flex-col gap-3 border-b border-[var(--border)] py-4 transition-colors hover:bg-[var(--interaction-hover)] md:flex-row md:items-center md:gap-6"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
                  {situation.title}
                </span>
                <StateBadge state={situation.state} />
                <LifecycleChip lifecycle={situation.lifecycle} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 w-32 flex-none overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div
                    className="h-full bg-[var(--state-formal)]"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <span className="text-[11.5px] tabular-nums text-[var(--text-muted)]">{fmtPct(situation.bridge.representedPct)} represented</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 md:contents">
            <div className="min-w-0 text-left md:w-[110px] md:flex-none md:text-right">
              <div className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtMoney(situation.bridge.validatedValue, situation.bridge.currency)}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">validated</div>
            </div>

            <div className="min-w-0 text-left md:w-[90px] md:flex-none md:text-right">
              <div className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">{decisions}</div>
              <div className="text-[11px] text-[var(--text-muted)]">decisions made</div>
            </div>
            </div>

            <ArrowRight className="hidden size-4 flex-none text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 md:block" />
          </Link>
        );
      })}
    </div>
  );
}
