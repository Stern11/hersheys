import Link from "next/link";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { getCategory, categoryForGapType } from "@/components/gaps/gap-category";
import { CategoryPageHeader } from "@/components/gaps/category-page-header";
import { GapTypeBadge } from "@/components/gaps/gap-type-badge";
import { fmtDate, fmtNum } from "@/lib/utils/format";
import { fmtUtilization, lineDisplayName, planningCompleteness, worstCapacityImpact } from "@/lib/gaps/gap-metrics";
import { Badge } from "@/components/ui/badge";

/**
 * Event/horizon-oriented — each situation is a business event with a
 * production and sales window, not a generic table row.
 */
export default function DemandEventsPage() {
  const category = getCategory("demand-events");
  const situations = detectPlanningGaps().filter((r) => categoryForGapType(r.gap.type) === "demand-events");

  return (
    <div className="flex flex-col gap-6 p-6">
      <CategoryPageHeader category={category} />

      <div className="grid gap-4 lg:grid-cols-2">
        {situations.map(({ gap, scenarioResult }) => {
          const line = worstCapacityImpact(scenarioResult);
          // The completeness percentage divides by the P50 expected point.
          // Showing it beside the P80 alone made the only division a planner
          // could actually perform on screen (3,800,000 / 4,942,080 = 76.9%)
          // disagree with the printed 80%. The P50 is now on the card.
          const completeness = scenarioResult ? planningCompleteness(gap.formalValue, scenarioResult.expectedDemandUnits.base) : null;

          return (
            <Link
              key={gap.id}
              href={`/gaps/${gap.id}`}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold">{gap.title}</span>
                <GapTypeBadge type={gap.type} />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <Metric label="Formal demand" value={fmtNum(gap.formalValue)} />
                <Metric label="Expected P50" value={completeness ? fmtNum(completeness.denominator) : "—"} />
                <Metric label="Expected P80" value={fmtNum(gap.expectedValueHigh)} />
                <Metric label="Unresolved" value={fmtNum(gap.unresolvedValue)} tone="warning" />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${completeness?.pct ?? 0}%` }} />
                  </div>
                  <span className="flex-none text-[11px] tabular-nums text-[var(--text-muted)]">{completeness ? `${completeness.pct}% complete` : "—"}</span>
                </div>
                {completeness && <p className="text-[10.5px] tabular-nums text-[var(--text-muted)]">{completeness.derivation}</p>}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-[12px]">
                <span className="text-[var(--text-secondary)]">
                  Primary consequence:{" "}
                  <span className="font-medium text-[var(--text-primary)]">{line ? `${lineDisplayName(line.lineId)} at ${fmtUtilization(line.effectiveUtilization)}` : "—"}</span>
                </span>
                {gap.earliestDeadlineId || scenarioResult?.decisionDeadlines.length ? (
                  <Badge variant={gap.severity === "critical" ? "critical" : "warning"}>
                    Act by {fmtDate(scenarioResult?.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date ?? gap.period.end)}
                  </Badge>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className={`text-[15px] font-semibold tabular-nums ${tone === "warning" ? "text-[var(--risk-warning)]" : ""}`}>{value}</div>
    </div>
  );
}
