"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/utils/format";
import type { PlanningGap } from "@/types/gaps";

const SEVERITY_VARIANT = { critical: "critical", warning: "warning", informational: "neutral" } as const;

/**
 * The calm, compact situation row used on the Planning Gaps landing page
 * and category pages — title, what's missing, main consequence, action
 * window, confidence. Deliberately NOT a dense multi-column table row.
 */
export function GapSituationRow({ gap, consequence, earliestDate }: { gap: PlanningGap; consequence: string; earliestDate?: string | null }) {
  const router = useRouter();

  return (
    <button onClick={() => router.push(`/gaps/${gap.id}`)} className="group flex w-full items-center gap-4 rounded-[var(--radius-md)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--surface-sunken)]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium leading-tight">{gap.title}</span>
          <Badge variant={SEVERITY_VARIANT[gap.severity]}>{gap.severity}</Badge>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-secondary)]">{consequence}</p>
      </div>

      <div className="flex flex-none items-center gap-5">
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Action window</div>
          <div className="text-[12.5px] font-medium tabular-nums">{earliestDate ? fmtDate(earliestDate) : "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Confidence</div>
          <div className="text-[12.5px] font-medium tabular-nums">{Math.round(gap.confidence.overall * 100)}%</div>
        </div>
        <ChevronRight className="size-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
