import type { GapDetectionResult } from "@/lib/planning-engine/gaps";
import { HISTORICAL_PERIODS } from "@/data/synthetic/historical-demand";
import { EVENTS } from "@/data/synthetic/events";
import { materialById } from "@/data/synthetic/materials";
import { productById } from "@/data/synthetic/products";
import { fmtDate, fmtNum } from "@/lib/utils/format";
import { fmtUtilization, lineDisplayName, planningCompleteness, worstCapacityImpact } from "@/lib/gaps/gap-metrics";
import { GapWorkspaceShell } from "./gap-workspace-shell";
import { GapSection } from "./gap-section";
import { PlanningGapChart, type PlanningGapChartRow } from "@/components/charts/planning-gap-chart";
import { EffectiveCapacityChart } from "@/components/charts/effective-capacity-chart";
import { MaterialReadinessView } from "@/components/planning/material-readiness-view";
import { DecisionRunwayTimeline } from "@/components/planning/decision-runway-timeline";
import { DEMO_NOW } from "@/data/synthetic/master-data";
import type { MetricBandItem } from "@/components/planning/metric-band";

const PRODUCT_ID = "prod_halloween_variety_classic";

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
  const product = productById(PRODUCT_ID);

  const gapChartRows: PlanningGapChartRow[] = [
    ...HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_halloween_2027" && !p.isAtypical).map((p) => ({ period: p.periodLabel, actual: p.actualUnits })),
    { period: "2027 (Expected)", low: gap.expectedValueLow, high: gap.expectedValueHigh, base: (gap.expectedValueLow + gap.expectedValueHigh) / 2 },
  ];

  const readinessRows = scenarioResult.materialReadiness.map((r) => ({ ...r, materialName: materialById(r.materialId).name }));

  const constraint = worstCapacityImpact(scenarioResult);

  // Planning completeness divides by the P50 expected point, not the P80.
  // The band used to show "80% complete" next to "EXPECTED (P80) 4,942,080"
  // and nothing else, so the only division a planner could perform on screen
  // gave 76.9%. The P50 denominator is now a metric of its own, and the
  // completeness item carries the arithmetic.
  const completeness = planningCompleteness(gap.formalValue, scenarioResult.expectedDemandUnits.base);

  const metrics: MetricBandItem[] = [
    { label: "Formal demand", value: fmtNum(completeness.numerator) },
    { label: "Expected (P50)", value: fmtNum(completeness.denominator) },
    { label: "Expected (P80)", value: fmtNum(gap.expectedValueHigh) },
    { label: "Complete vs P50", value: `${completeness.pct}%`, hint: completeness.derivation },
    { label: "Primary constraint", value: constraint ? lineDisplayName(constraint.lineId) : "—", tone: constraint?.riskLevel },
    {
      label: "Effective utilization",
      value: constraint ? fmtUtilization(constraint.effectiveUtilization) : "—",
      tone: constraint?.riskLevel,
      hint: constraint ? `${fmtUtilization(constraint.formalUtilization)} formal load + the unresolved volume, in ${constraint.period}` : undefined,
    },
    {
      label: "Earliest action",
      value: (() => {
        const d = scenarioResult.decisionDeadlines.find((x) => x.isEarliestConstraint)?.date;
        return d ? fmtDate(d) : "—";
      })(),
    },
  ];

  return (
    <GapWorkspaceShell
      gap={gap}
      planningBasis={planningBasis}
      evidence={evidence}
      metrics={metrics}
      situation={`Formal demand sits at ${fmtNum(gap.formalValue)} units, but the last three comparable Halloween seasons — growing at ${Math.round(event.businessGrowthAssumption * 100)}% a year — point to ${fmtNum(gap.expectedValueLow)}-${fmtNum(gap.expectedValueHigh)} units. ${constraint ? lineDisplayName(constraint.lineId) : "The constraint line"} appears safe on the formal plan alone; adding the unresolved ${fmtNum(gap.unresolvedValue)} units changes that.`}
      scenarioHref="/scenario-lab/scn_halloween_line03_relief"
    >
      <GapSection title="Planning gap" description="Historical actuals vs. the current formal plan vs. the expected range this season">
        <PlanningGapChart data={gapChartRows} formalValue={gap.formalValue} />
      </GapSection>

      <GapSection
        title="Capacity consequence"
        description={`Formal load looks safe on ${constraint ? lineDisplayName(constraint.lineId) : "the constraint line"} — effective load (once unresolved demand is included) tells a different story`}
      >
        <EffectiveCapacityChart data={scenarioResult.capacityImpact} />
      </GapSection>

      <GapSection
        title="Material readiness"
        description="Every component is formal, so this section reads as fully plan-now — but the lead-time basis column shows which of them the plan is no longer using the ERP norm for"
      >
        <MaterialReadinessView productName={product.name} rows={readinessRows} />
      </GapSection>

      <GapSection title="Decision runway" description="Production timing and sales timing, on one shared axis">
        <DecisionRunwayTimeline today={DEMO_NOW.slice(0, 10)} deadlines={scenarioResult.decisionDeadlines} productionWindow={event.productionWindow} salesWindow={event.salesWindow} />
      </GapSection>
    </GapWorkspaceShell>
  );
}
