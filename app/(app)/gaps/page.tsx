import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { DEMO_NOW } from "@/data/synthetic/master-data";
import { GAP_CATEGORIES, categoryForGapType } from "@/components/gaps/gap-category";
import { gapConsequence, gapEarliestDate, weeksFromNow } from "@/components/gaps/gap-summary";
import { GapSituationRow } from "@/components/gaps/gap-situation-row";

export default function GapsLandingPage() {
  const results = detectPlanningGaps();
  const today = DEMO_NOW.slice(0, 10);

  // Only categorized situations are itemized on this page (capacity/material
  // gaps are consequence lenses, surfaced from within a gap, not here) — the
  // summary count must match what's actually listed below, not the raw total.
  const categorized = results.filter((r) => categoryForGapType(r.gap.type) != null);
  const dated = categorized.map((r) => ({ r, earliest: gapEarliestDate(r) }));
  const dueSoon = dated.filter((d) => d.earliest != null && weeksFromNow(today, d.earliest) <= 6).length;

  return (
    <div className="flex flex-col gap-7 p-6">
      <div>
        <h1 className="text-[17px] font-semibold">Planning Gaps</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {categorized.length} active situation{categorized.length === 1 ? "" : "s"} across your current plan
          {dueSoon > 0 ? ` · ${dueSoon} ${dueSoon === 1 ? "requires" : "require"} action within 6 weeks` : ""}
        </p>
      </div>

      {GAP_CATEGORIES.map((category) => {
        const situations = results.filter((r) => categoryForGapType(r.gap.type) === category.slug);
        if (situations.length === 0) return null;

        return (
          <section key={category.slug} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="text-[13.5px] font-semibold">{category.label}</h2>
                <p className="text-[12px] text-[var(--text-muted)]">{category.description}</p>
              </div>
              <Link href={`/gaps/${category.slug}`} className="flex flex-none items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline">
                View {category.label} <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1">
              {situations.map((r) => (
                <GapSituationRow key={r.gap.id} gap={r.gap} consequence={gapConsequence(r)} earliestDate={gapEarliestDate(r)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
