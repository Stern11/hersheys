import { notFound } from "next/navigation";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { materialById } from "@/data/synthetic/materials";
import { HalloweenWorkspace } from "@/components/gaps/halloween-workspace";
import { PrintedFilmWorkspace } from "@/components/gaps/printed-film-workspace";
import { ValentinesWorkspace } from "@/components/gaps/valentines-workspace";
import { GapWorkspaceShell } from "@/components/gaps/gap-workspace-shell";
import { GapSection } from "@/components/gaps/gap-section";
import { genericGapMetrics, genericGapSituation } from "@/lib/gaps/gap-metrics";
import { fmtDate } from "@/lib/utils/format";
import type { MetricBandItem } from "@/components/planning/metric-band";

export default async function GapWorkspacePage({ params }: { params: Promise<{ gapId: string }> }) {
  const { gapId } = await params;
  const result = detectPlanningGaps().find((g) => g.gap.id === gapId);
  if (!result) notFound();

  if (result.gap.id === "halloween-2027") {
    return <HalloweenWorkspace result={result} />;
  }
  if (result.gap.id === "printed-film-lead-time") {
    return <PrintedFilmWorkspace result={result} material={materialById("mat_printed_film")} />;
  }
  if (result.gap.id === "valentines-premium-tin") {
    return <ValentinesWorkspace result={result} />;
  }

  // Generic fallback for gaps without a bespoke workspace yet (Line 03
  // capacity, the PDQ counter-display routing anomaly, and the Holiday
  // club-exclusive representation gap) — proves the shared shell
  // generalizes without requiring five bespoke builds in this pass.
  //
  // Both the metric band and the situation line are derived in
  // lib/gaps/gap-metrics.ts rather than assembled here: a routing anomaly
  // measured in "% of execution" and a capacity gap measured in utilization
  // points cannot share one Formal / Expected / Unresolved triple without
  // producing nonsense like "FORMAL 0 %" or an "UNRESOLVED 84 %" that is not
  // a plan quantity at all.
  const { gap, planningBasis, evidence } = result;
  const metrics: MetricBandItem[] = genericGapMetrics(gap);

  return (
    <GapWorkspaceShell
      gap={gap}
      planningBasis={planningBasis}
      evidence={evidence}
      metrics={metrics}
      situation={genericGapSituation(gap)}
      scenarioHref="/scenario-lab"
    >
      <GapSection title="Confidence by dimension" description="Every dimension carries its own note — confidence is never one global score used alone">
        <div className="flex flex-col gap-3">
          {gap.confidence.dimensions.map((d) => (
            <div key={d.dimension} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-4 text-[12px]">
                <span className="font-medium capitalize">{d.dimension.replace(/_/g, " ")}</span>
                <span className="flex-none font-medium tabular-nums">{Math.round(d.score * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div className="h-full rounded-full bg-[var(--state-inferred)]" style={{ width: `${Math.round(d.score * 100)}%` }} />
              </div>
              {d.note && <p className="text-[11.5px] leading-relaxed text-[var(--text-muted)]">{d.note}</p>}
            </div>
          ))}
        </div>
      </GapSection>

      <GapSection title="Timing" description="The window this situation describes">
        <p className="text-[12.5px] text-[var(--text-secondary)]">
          {gap.period.start === gap.period.end ? fmtDate(gap.period.start) : `${fmtDate(gap.period.start)} – ${fmtDate(gap.period.end)}`}
        </p>
      </GapSection>
    </GapWorkspaceShell>
  );
}
