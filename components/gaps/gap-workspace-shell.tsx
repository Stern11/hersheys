"use client";

import type { PlanningGap } from "@/types/gaps";
import type { PlanningBasis } from "@/types/methodology";
import type { EvidenceSignal } from "@/types/shared";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricBand, type MetricBandItem } from "@/components/planning/metric-band";
import { MethodologyBadge } from "@/components/methodology/methodology-badge";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { GapTypeBadge } from "./gap-type-badge";

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

  return (
    <div className="flex h-full flex-col">
      {/* Header — Level 1/2: what am I looking at, what's the primary risk */}
      <div className="flex-none border-b border-[var(--border)] px-6 py-4">
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

      {/* Body — Level 3-6: evidence/method/impact/time (left), control surface (right rail) */}
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">{children}</div>
        </div>

        <div className="w-80 flex-none overflow-y-auto border-l border-[var(--border)] bg-[var(--surface-sunken)] p-4">
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Methodology</div>
              <div className="flex flex-wrap gap-1.5">
                {planningBasis.methodologyIds.map((id) => (
                  <MethodologyBadge key={id} methodologyId={id} whySelected={id === planningBasis.primaryMethodologyId ? planningBasis.whySelected : undefined} />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Why this basis</div>
              <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{planningBasis.whySelected}</p>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Evidence ({evidence.length})</div>
              <EvidencePanel evidence={evidence} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
