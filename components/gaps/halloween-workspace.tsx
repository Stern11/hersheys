import type { GapDetectionResult } from "@/lib/planning-engine/gaps";
import { HISTORICAL_PERIODS } from "@/data/synthetic/historical-demand";
import { EVENTS } from "@/data/synthetic/events";
import { materialById } from "@/data/synthetic/materials";
import { fmtDate, fmtNum, fmtPct } from "@/lib/utils/format";
import { GapWorkspaceShell } from "./gap-workspace-shell";
import { GapSection } from "./gap-section";
import { PlanningGapChart, type PlanningGapChartRow } from "@/components/charts/planning-gap-chart";
import { EffectiveCapacityChart } from "@/components/charts/effective-capacity-chart";
import { MaterialReadinessView } from "@/components/planning/material-readiness-view";
import { DecisionRunwayTimeline } from "@/components/planning/decision-runway-timeline";
import { DEMO_NOW } from "@/data/synthetic/master-data";
import type { MetricBandItem } from "@/components/planning/metric-band";

/**
 * Golden Scenario A (PRD §28.1), given the highest visual polish first
 * (PRD-phase-2 §22). Production timing (the RCCP capacity section) and
 * sales timing (the event window on the runway) are rendered as visually
 * distinct sections so a planner never conflates them.
 */
export function HalloweenWorkspace({ result }: { result: GapDetectionResult }) {
  const { gap, planningBasis, evidence, scenarioResult } = result;
  if (!scenarioResult) return null;
  const event = EVENTS.find((e) => e.id === "evt_halloween_2027")!;

  const gapChartRows: PlanningGapChartRow[] = [
    ...HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_halloween_2027" && !p.isAtypical).map((p) => ({ period: p.periodLabel, actual: p.actualUnits })),
    { period: "2027 (Expected)", low: gap.expectedValueLow, high: gap.expectedValueHigh, base: (gap.expectedValueLow + gap.expectedValueHigh) / 2 },
  ];

  const readinessRows = scenarioResult.materialReadiness.map((r) => ({ ...r, materialName: materialById(r.materialId).name }));

  const line03 = scenarioResult.capacityImpact.find((c) => c.lineId === "line_03");

  const metrics: MetricBandItem[] = [
    { label: "Planning completeness", value: fmtPct(scenarioResult.planningCompletenessPct / 100) },
    { label: "Formal demand", value: fmtNum(gap.formalValue) },
    { label: "Expected (P80)", value: fmtNum(gap.expectedValueHigh) },
    { label: "Primary constraint", value: "Line 03", tone: line03?.riskLevel },
    { label: "Line 03 effective", value: line03 ? fmtPct(line03.effectiveUtilization) : "—", tone: line03?.riskLevel },
    { label: "Earliest action", value: (() => { const d = scenarioResult.decisionDeadlines.find((x) => x.isEarliestConstraint)?.date; return d ? fmtDate(d) : "—"; })() },
  ];

  return (
    <GapWorkspaceShell
      gap={gap}
      planningBasis={planningBasis}
      evidence={evidence}
      metrics={metrics}
      situation={`Formal demand sits at ${fmtNum(gap.formalValue)} units, but the last three comparable Halloween seasons — growing at ${Math.round(event.businessGrowthAssumption * 100)}% a year — point to ${fmtNum(gap.expectedValueLow)}-${fmtNum(gap.expectedValueHigh)} units. Line 03 appears safe on the formal plan alone; adding the unresolved ${fmtNum(gap.unresolvedValue)} units changes that.`}
      scenarioHref="/scenario-lab/scn_halloween_line03_relief"
    >
      <GapSection title="Planning gap" description="Historical actuals vs. the current formal plan vs. the expected range this season">
        <PlanningGapChart data={gapChartRows} formalValue={gap.formalValue} />
      </GapSection>

      <GapSection title="Capacity consequence" description="Formal load looks safe on Line 03 — effective load (once unresolved demand is included) tells a different story">
        <EffectiveCapacityChart data={scenarioResult.capacityImpact} />
      </GapSection>

      <GapSection title="Material readiness" description="Classic Variety Bag BOM — every component is formal, so this section reads as fully plan-now">
        <MaterialReadinessView productName="Halloween Variety Bag — Classic" rows={readinessRows} />
      </GapSection>

      <GapSection title="Decision runway" description="Production timing and sales timing, on one shared axis">
        <DecisionRunwayTimeline today={DEMO_NOW.slice(0, 10)} deadlines={scenarioResult.decisionDeadlines} productionWindow={event.productionWindow} salesWindow={event.salesWindow} />
      </GapSection>
    </GapWorkspaceShell>
  );
}
