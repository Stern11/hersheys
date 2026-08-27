import Link from "next/link";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { getCategory, categoryForGapType } from "@/components/gaps/gap-category";
import { CategoryPageHeader } from "@/components/gaps/category-page-header";
import { fmtNum, fmtPct } from "@/lib/utils/format";

/**
 * Reconciliation-oriented — business expectation vs. formal representation
 * vs. what's still unresolved, as a single proportional bar rather than
 * three disconnected numbers.
 */
export default function RepresentationPage() {
  const category = getCategory("representation");
  const situations = detectPlanningGaps().filter((r) => categoryForGapType(r.gap.type) === "representation");

  return (
    <div className="flex flex-col gap-6 p-6">
      <CategoryPageHeader category={category} />

      <div className="flex flex-col gap-4">
        {situations.map(({ gap }) => {
          // The bar and its two segments must foot exactly, so "expected" here
          // is derived from the same two parts it's split into — not pulled from
          // a separate P80 estimate, which would leave an unexplained remainder.
          const represented = gap.formalValue;
          const unresolved = gap.unresolvedValue;
          const expected = represented + unresolved;
          const representedPct = expected > 0 ? represented / expected : 0;
          const unresolvedPct = expected > 0 ? unresolved / expected : 0;

          return (
            <Link key={gap.id} href={`/gaps/${gap.id}`} className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]">
              <span className="text-[14px] font-semibold">{gap.title}</span>

              <div className="flex h-6 overflow-hidden rounded-[4px] bg-[var(--surface-sunken)]">
                <div className="flex items-center justify-center bg-[var(--state-formal)] text-[10.5px] font-medium text-[var(--text-on-accent)]" style={{ width: fmtPct(representedPct) }}>
                  {representedPct > 0.08 ? "Represented" : ""}
                </div>
                <div className="flex items-center justify-center bg-[var(--state-unknown)] text-[10.5px] font-medium" style={{ width: fmtPct(unresolvedPct) }}>
                  {unresolvedPct > 0.08 ? "Unresolved" : ""}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Stat label="Expected value" value={`${fmtNum(expected)} ${gap.unit}`} />
                <Stat label="Represented in formal plan" value={`${fmtNum(represented)} ${gap.unit}`} />
                <Stat label="Unresolved" value={`${fmtNum(unresolved)} ${gap.unit}`} tone="warning" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${tone === "warning" ? "text-[var(--risk-warning)]" : ""}`}>{value}</div>
    </div>
  );
}
