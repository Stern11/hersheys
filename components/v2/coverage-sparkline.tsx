/**
 * Portfolio coverage over the next few months (V2 §39).
 *
 * A snapshot ("62% represented today") can't say whether the plan is closing
 * the gap or falling further behind. A monthly trend answers that — but a
 * full monthly matrix or a separate horizon page is exactly the dashboard
 * clutter V2 collapsed when it dropped V1's "Plan Horizon" page. A sparkline
 * is the smallest visual that still answers "is this getting better or
 * worse", sized as a supporting figure inside the Manufacturing tile rather
 * than a section of its own.
 */

import { formatMonthLabel } from "@/lib/dataset/periods";
import { fmtPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { MonthCoverage } from "@/lib/situations/portfolio";

export function CoverageSparkline({ months }: { months: MonthCoverage[] }) {
  const withData = months.filter((m) => m.coveragePct !== undefined);
  if (withData.length < 2) return null;

  return (
    <div className="mt-2.5">
      <div className="flex h-6 items-end gap-[3px]">
        {months.map((m) => (
          <div
            key={m.period}
            title={`${formatMonthLabel(m.period)} · ${m.coveragePct !== undefined ? fmtPct(m.coveragePct) : "no load"}`}
            className="flex h-full min-w-[10px] flex-1 items-end"
          >
            <span
              className={cn(
                "block w-full rounded-t-[1.5px]",
                m.coveragePct === undefined
                  ? "bg-[var(--border)]"
                  : m.coveragePct >= 0.8
                    ? "bg-[var(--risk-positive)]"
                    : m.coveragePct >= 0.5
                      ? "bg-[var(--risk-warning)]"
                      : "bg-[var(--risk-critical)]"
              )}
              style={{ height: `${Math.max(8, (m.coveragePct ?? 0.05) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
        <span>{formatMonthLabel(months[0]!.period)}</span>
        <span>coverage, next {months.length} months</span>
        <span>{formatMonthLabel(months[months.length - 1]!.period)}</span>
      </div>
    </div>
  );
}
