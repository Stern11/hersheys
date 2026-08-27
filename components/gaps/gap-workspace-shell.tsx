"use client";

import type { PlanningGap } from "@/types/gaps";
import type { PlanningBasis } from "@/types/methodology";
import type { EvidenceSignal } from "@/types/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricBand, type MetricBandItem } from "@/components/planning/metric-band";
import { MethodologyBadge } from "@/components/methodology/methodology-badge";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { GapTypeBadge } from "./gap-type-badge";
import { categoryForGapType, getCategory } from "./gap-category";

const SEVERITY_VARIANT = { critical: "critical", warning: "warning", informational: "neutral" } as const;

/**
 * The one shared Gap Workspace grammar (PRD-phase-2 §8): every gap — no
 * matter how different its content — reads as Situation (header + metric
 * band) → gap-specific evidence/impact/time sections (`children`, ordered
 * by the page itself since which signature visuals apply differs per gap
 * type) → a persistent Method/Basis/Evidence rail (§22's "sidecar") → one
 * Decision CTA. Keeping this shell identical across all three reference
 * gaps is what proves the product grammar generalizes, not just Halloween.
 */
export function GapWorkspaceShell({
  gap,
  planningBasis,
  evidence,
  metrics,
  situation,
  scenarioHref,
  children,
}: {
  gap: PlanningGap;
  planningBasis: PlanningBasis;
  evidence: EvidenceSignal[];
  metrics: MetricBandItem[];
  situation: string;
  scenarioHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  /**
   * A gap workspace was previously a dead end — it could be reached from the
   * worklist, a category page, Decisions or the Overview, but carried no way
   * back, so a planner who opened one had to use the browser's Back button.
   * The trail names the category the gap belongs to, because that (not the
   * flat worklist) is where the sibling situations live. Capacity and
   * material gaps are consequence lenses with no category page of their own
   * (`categoryForGapType` returns null), so they get the worklist crumb only.
   */
  const categorySlug = categoryForGapType(gap.type);
  const category = categorySlug ? getCategory(categorySlug) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header — Level 1/2: what am I looking at, what's the primary risk */}
      <div className="flex-none border-b border-[var(--border)] px-6 py-4">
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]">
          <Link href="/gaps" className="rounded-[var(--radius-sm)] px-1 py-0.5 transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]">
            Planning Gaps
          </Link>
          {category && (
            <>
              <ChevronRight className="size-3 flex-none opacity-60" />
              <Link
                href={`/gaps/${category.slug}`}
                className="rounded-[var(--radius-sm)] px-1 py-0.5 transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                {category.label}
              </Link>
            </>
          )}
          <ChevronRight className="size-3 flex-none opacity-60" />
          <span aria-current="page" className="truncate px-1 py-0.5 text-[var(--text-secondary)]">
            {gap.title}
          </span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold leading-tight">{gap.title}</h1>
              <GapTypeBadge type={gap.type} />
              <Badge variant={SEVERITY_VARIANT[gap.severity]}>{gap.severity}</Badge>
            </div>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">{situation}</p>
          </div>
          <Button onClick={() => router.push(scenarioHref)}>
            Open in Scenario Lab <ArrowRight className="size-3.5" />
          </Button>
        </div>
        <div className="mt-3.5">
          <MetricBand items={metrics} />
        </div>
      </div>

      {/* Body — Level 3-6: evidence/method/impact/time (left), control surface (right rail).
          `min-w-0` on the main column is load-bearing: a flex item's default
          `min-width:auto` makes its intrinsic content width its floor, so one
          wide child (a chart, a readiness table) would widen the whole row and
          squeeze the rail rather than scrolling inside its own container. */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="flex min-w-0 flex-col gap-6">{children}</div>
        </div>

        <div className="w-80 flex-none overflow-y-auto overflow-x-hidden border-l border-[var(--border)] bg-[var(--surface-sunken)] p-4">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Methodology</div>
              <div className="flex flex-wrap gap-1.5">
                {planningBasis.methodologyIds.map((id) => (
                  <MethodologyBadge key={id} methodologyId={id} whySelected={id === planningBasis.primaryMethodologyId ? planningBasis.whySelected : undefined} />
                ))}
              </div>
            </div>

            {/* The situation paragraph in the header and this block used to be
                the same string on every generic gap page. Rendering identical
                prose twice teaches a planner that one of the two is filler, so
                the duplicate is suppressed rather than repeated. */}
            {planningBasis.whySelected !== situation && (
              <div className="min-w-0">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Why this basis</div>
                <p className="break-words text-[12px] leading-relaxed text-[var(--text-secondary)]">{planningBasis.whySelected}</p>
              </div>
            )}

            <div className="min-w-0">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Evidence ({evidence.length})</div>
              <EvidencePanel evidence={evidence} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
