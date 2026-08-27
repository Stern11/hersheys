import Link from "next/link";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { getCategory, categoryForGapType } from "@/components/gaps/gap-category";
import { CategoryPageHeader } from "@/components/gaps/category-page-header";

/**
 * Analytical / diagnostic — System Assumption vs. Historical Performance
 * vs. Decision Impact, never labeling the system value as simply "wrong."
 */
export default function PlanningAssumptionsPage() {
  const category = getCategory("planning-assumptions");
  const situations = detectPlanningGaps().filter((r) => categoryForGapType(r.gap.type) === "planning-assumptions");

  return (
    <div className="flex flex-col gap-6 p-6">
      <CategoryPageHeader category={category} />

      <div className="flex flex-col gap-3">
        {situations.map(({ gap }) => {
          const isLeadTime = gap.unit === "days";

          return (
            <Link key={gap.id} href={`/gaps/${gap.id}`} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[14px] font-semibold">{gap.title}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{isLeadTime ? "Lead time" : "Routing"}</span>
              </div>

              {isLeadTime ? (
                <div className="grid grid-cols-4 gap-4">
                  <Row label="System assumption" value={`${gap.formalValue}d`} />
                  <Row label="Historical median" value={`${gap.expectedValueLow}d`} />
                  <Row label="Historical P80" value={`${gap.expectedValueHigh}d`} tone="warning" />
                  <Row label="Decision impact" value={`${gap.unresolvedValue}d earlier`} tone="critical" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <Row label="System routing" value="Line 02" />
                  <Row label="Observed majority" value={`${Math.round(gap.expectedValueHigh)}% Line 01`} tone="warning" />
                  <Row label="Impact" value="Line 01 capacity understated" tone="critical" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "warning" | "critical" }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${tone === "critical" ? "text-[var(--risk-critical)]" : tone === "warning" ? "text-[var(--risk-warning)]" : ""}`}>{value}</div>
    </div>
  );
}
