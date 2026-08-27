import { notFound } from "next/navigation";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { materialById } from "@/data/synthetic/materials";
import { HalloweenWorkspace } from "@/components/gaps/halloween-workspace";
import { PrintedFilmWorkspace } from "@/components/gaps/printed-film-workspace";
import { ValentinesWorkspace } from "@/components/gaps/valentines-workspace";
import { GapWorkspaceShell } from "@/components/gaps/gap-workspace-shell";
import { GapSection } from "@/components/gaps/gap-section";
import { fmtDate, fmtNum } from "@/lib/utils/format";
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
  // capacity, the Counter Display line-mapping anomaly, and the Holiday
  // representation gap) — proves the shared shell generalizes without
  // requiring five bespoke builds in this pass.
  const { gap, planningBasis, evidence } = result;
  const metrics: MetricBandItem[] = [
    { label: "Formal", value: `${fmtNum(gap.formalValue)} ${gap.unit}` },
    { label: "Expected", value: `${fmtNum(gap.expectedValueLow)}–${fmtNum(gap.expectedValueHigh)} ${gap.unit}`, tone: gap.severity === "critical" ? "critical" : "warning" },
    { label: "Unresolved", value: `${fmtNum(gap.unresolvedValue)} ${gap.unit}` },
    { label: "Confidence", value: `${Math.round(gap.confidence.overall * 100)}%` },
  ];

  return (
    <GapWorkspaceShell gap={gap} planningBasis={planningBasis} evidence={evidence} metrics={metrics} situation={planningBasis.whySelected} scenarioHref="/scenario-lab">
      <GapSection title="Confidence by dimension">
        <div className="flex flex-col gap-2">
          {gap.confidence.dimensions.map((d) => (
            <div key={d.dimension} className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--text-secondary)]">{d.dimension.replace(/_/g, " ")}</span>
              <span className="font-medium tabular-nums">{Math.round(d.score * 100)}%</span>
            </div>
          ))}
        </div>
      </GapSection>
      <GapSection title="Timing">
        <p className="text-[12.5px] text-[var(--text-secondary)]">
          {gap.period.start === gap.period.end ? fmtDate(gap.period.start) : `${fmtDate(gap.period.start)} – ${fmtDate(gap.period.end)}`}
        </p>
      </GapSection>
    </GapWorkspaceShell>
  );
}
