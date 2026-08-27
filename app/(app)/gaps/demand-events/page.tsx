import Link from "next/link";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { getCategory, categoryForGapType } from "@/components/gaps/gap-category";
import { CategoryPageHeader } from "@/components/gaps/category-page-header";
import { GapTypeBadge } from "@/components/gaps/gap-type-badge";
import { fmtDate, fmtNum, fmtPct } from "@/lib/utils/format";
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
          const line = scenarioResult?.capacityImpact.reduce((worst, c) => (!worst || c.effectiveUtilization > worst.effectiveUtilization ? c : worst), scenarioResult.capacityImpact[0]);
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

              <div className="grid grid-cols-3 gap-3">
                <Metric label="Formal demand" value={fmtNum(gap.formalValue)} />
                <Metric label="Expected P80" value={fmtNum(gap.expectedValueHigh)} />
                <Metric label="Unresolved" value={fmtNum(gap.unresolvedValue)} tone="warning" />
              </div>

              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: fmtPct(scenarioResult ? scenarioResult.planningCompletenessPct / 100 : 0) }} />
                </div>
                <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{scenarioResult ? fmtPct(scenarioResult.planningCompletenessPct / 100) : "—"} complete</span>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-[12px]">
                <span className="text-[var(--text-secondary)]">
                  Primary consequence: <span className="font-medium text-[var(--text-primary)]">{line ? `${line.lineId.replace("line_", "Line ")} at ${fmtPct(line.effectiveUtilization)}` : "—"}</span>
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
