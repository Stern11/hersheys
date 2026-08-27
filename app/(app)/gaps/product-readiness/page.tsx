import Link from "next/link";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { getCategory, categoryForGapType } from "@/components/gaps/gap-category";
import { CategoryPageHeader } from "@/components/gaps/category-page-header";
import { EVENTS } from "@/data/synthetic/events";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtPct } from "@/lib/utils/format";

/**
 * Readiness-oriented — what's known, what's inferred, and how much of the
 * likely BOM value is stable enough to begin planning.
 */
export default function ProductReadinessPage() {
  const category = getCategory("product-readiness");
  const situations = detectPlanningGaps().filter((r) => categoryForGapType(r.gap.type) === "product-readiness");

  return (
    <div className="flex flex-col gap-6 p-6">
      <CategoryPageHeader category={category} />

      <div className="flex flex-col gap-4">
        {situations.map(({ gap, scenarioResult }) => {
          const event = gap.eventId ? EVENTS.find((e) => e.id === gap.eventId) : null;
          const planNow = scenarioResult?.materialReadiness.filter((r) => r.readiness === "plan_now").length ?? 0;
          const total = scenarioResult?.materialReadiness.length ?? 0;

          return (
            <Link key={gap.id} href={`/gaps/${gap.id}`} className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold">{gap.title}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <KnownRow label="Business intent" state="known" />
                <KnownRow label="Launch window" state="known" detail={event ? `${fmtDate(event.salesWindow.start)} – ${fmtDate(event.salesWindow.end)}` : undefined} />
                <KnownRow label="Product family" state="known" />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Likely BOM value ready to plan now</span>
                  <span className="font-medium tabular-nums text-[var(--text-primary)]">{fmtPct(gap.confidence.overall)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div className="h-full rounded-full bg-[var(--risk-positive)]" style={{ width: fmtPct(gap.confidence.overall) }} />
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3 text-[12px] text-[var(--text-secondary)]">
                <Badge variant="positive">{planNow} plan now</Badge>
                <span>of {total} components modeled from the active analogue mix</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function KnownRow({ label, state, detail }: { label: string; state: "known" | "inferred" | "unknown"; detail?: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="flex items-center gap-1.5">
        <Badge variant={state === "known" ? "formal" : state === "inferred" ? "inferred" : "unknown"}>{state}</Badge>
        {detail && <span className="text-[11px] text-[var(--text-secondary)]">{detail}</span>}
      </div>
    </div>
  );
}
