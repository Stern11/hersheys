/**
 * What this scenario is about (V2 §13.3).
 *
 * Intent: the planner arrived from one product and needs the lab to confirm it
 * opened on that product — and to say, in one line, what changing anything
 * here will and will not do.
 *
 * Hierarchy: the product name is the focal element of the whole left column;
 * the instruction beneath it is deliberately muted, because it is read once.
 */

"use client";

import { fmtUnits } from "@/lib/utils/format";
import type { PlanningSituation } from "@/types/situation";

export function FocusHeader({
  baseline,
  focusItemId,
}: {
  baseline: PlanningSituation;
  focusItemId?: string;
}) {
  const item = focusItemId ? baseline.candidateItems.find((c) => c.id === focusItemId) : undefined;

  if (!item) {
    return (
      <p className="mb-4 text-[12px] leading-snug text-[var(--text-muted)]">
        Change an assumption below; every figure on the right recomputes against the baseline.
        Nothing here touches the plan until you add it.
      </p>
    );
  }

  return (
    <div className="mb-4 border-b border-[var(--border)] pb-3.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
        Testing
      </div>
      <div className="mt-1 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
        {item.itemName}
      </div>
      <div className="mt-1 text-[11.5px] tabular-nums text-[var(--text-secondary)]">
        Carries {fmtUnits(item.plannedUnits)} · {item.plannedBasis.label}
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-muted)]">
        Change its volume below and the whole of {baseline.title} recomputes with it — lines,
        components and dates. Nothing touches the plan until you add it.
      </p>
    </div>
  );
}
