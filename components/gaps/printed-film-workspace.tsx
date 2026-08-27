"use client";

import type { GapDetectionResult } from "@/lib/planning-engine/gaps";
import { useScenarioStore } from "@/stores/scenario-store";
import { purchaseOrdersForMaterial, leadTimeStatisticForSample } from "@/data/synthetic/execution-history";
import { resolveLeadTimeDays, decisionDeadlineFromLeadTime, weeksBetween } from "@/lib/planning-engine/lead-times";
import { EVENTS } from "@/data/synthetic/events";
import { productById } from "@/data/synthetic/products";
import { DEMO_NOW } from "@/data/synthetic/master-data";
import { fmtDate } from "@/lib/utils/format";
import { GapWorkspaceShell } from "./gap-workspace-shell";
import { GapSection } from "./gap-section";
import { LeadTimeBasisEditor } from "@/components/planning/lead-time-basis-editor";
import { LeadTimeHistogram } from "@/components/planning/lead-time-histogram";
import { leadTimeBasisMarkers } from "@/lib/charts/histogram";
import { DecisionRunwayTimeline } from "@/components/planning/decision-runway-timeline";
import type { Material } from "@/types/planning";
import type { MetricBandItem } from "@/components/planning/metric-band";

const SCENARIO_ID = "scn_halloween_line03_relief";
const HALLOWEEN_EVENT = EVENTS.find((e) => e.id === "evt_halloween_2027")!;

/**
 * Golden Scenario C (PRD §28.3). Primary visual focus is the lead-time
 * distribution itself — System vs. Historical vs. Scenario is a claim
 * about a whole distribution, not a single number, so the raw spread of
 * receipts is shown alongside the summary statistics (PRD-phase-2 §23).
 * Edits here write into the same seeded scenario Scenario Lab uses, so
 * both surfaces always agree.
 */
export function PrintedFilmWorkspace({ result, material }: { result: GapDetectionResult; material: Material }) {
  const scenario = useScenarioStore((s) => s.scenarios[SCENARIO_ID]);
  const setLeadTimeBasis = useScenarioStore((s) => s.setLeadTimeBasis);
  const setLeadTimeSampleSize = useScenarioStore((s) => s.setLeadTimeSampleSize);
  const setLeadTime = useScenarioStore((s) => s.setLeadTime);

  const { gap, planningBasis, evidence } = result;
  const override = scenario?.overrides.masterAssumptions?.[`material:${material.id}:lead_time`];
  const sample = leadTimeStatisticForSample(material.id, override?.sampleSize ?? 130);
  const activeDays = resolveLeadTimeDays(material, sample.p80, override);

  const productionRequirementDate = HALLOWEEN_EVENT.productionWindow.end;
  const deadline = decisionDeadlineFromLeadTime(productionRequirementDate, activeDays);
  const systemDeadline = decisionDeadlineFromLeadTime(productionRequirementDate, material.systemLeadTimeDays);
  const weeksRemaining = weeksBetween(DEMO_NOW.slice(0, 10), deadline);

  const allElapsed = purchaseOrdersForMaterial(material.id)
    .filter((p) => !p.excluded)
    .map((p) => p.elapsedDays);

  // Markers and their caption come from one list, so the chart can never
  // advertise a basis it does not draw (punch item 13).
  const leadTimeMarkers = leadTimeBasisMarkers({
    systemDays: material.systemLeadTimeDays,
    medianDays: sample.median,
    p80Days: sample.p80,
    scenarioDays: override?.selectedBasis === "scenario" ? override.scenarioValue : null,
  });

  const isOverdue = weeksRemaining < 0;
  const metrics: MetricBandItem[] = [
    { label: "System assumption", value: `${material.systemLeadTimeDays}d` },
    { label: "Historical P80", value: `${sample.p80}d`, tone: "warning" },
    { label: "Active basis", value: `${activeDays}d`, tone: activeDays > material.systemLeadTimeDays ? "warning" : undefined },
    { label: "Deadline shift", value: `${Math.abs(weeksBetween(systemDeadline, deadline))}w ${deadline < systemDeadline ? "earlier" : "later"}` },
    { label: "Order-by date", value: fmtDate(deadline), tone: "warning" },
    { label: isOverdue ? "Order-by has passed" : "Weeks remaining", value: isOverdue ? `${Math.abs(weeksRemaining)}w overdue` : `${weeksRemaining}w`, tone: isOverdue ? "critical" : undefined },
  ];

  return (
    <GapWorkspaceShell
      gap={gap}
      planningBasis={planningBasis}
      evidence={evidence}
      metrics={metrics}
      situation={`ERP carries a ${material.systemLeadTimeDays}-day lead time for ${material.name}, but ${sample.sampleCount} non-outlier receipts over the last year show a ${sample.median}-day median and a ${sample.p80}-day P80 — the system assumption may be optimistic by ${sample.p80 - material.systemLeadTimeDays} days.${isOverdue ? " Under the true historical P80, the order-by date for the Halloween production window has already passed." : ""}`}
      scenarioHref={`/scenario-lab/${SCENARIO_ID}`}
    >
      <GapSection title="Lead-time distribution" description={leadTimeMarkers.caption}>
        <div className="flex flex-col gap-4">
          <LeadTimeHistogram values={allElapsed} markers={leadTimeMarkers.markers} />
        </div>
      </GapSection>

      {scenario && (
        <GapSection title="Editable planning basis" description="Choose which basis feeds the material order-by date — every change updates the deadline below and the shared scenario">
          <LeadTimeBasisEditor
            material={material}
            sample={sample}
            override={override}
            onSetSampleSize={(n) => setLeadTimeSampleSize(SCENARIO_ID, material.id, n)}
            onSetBasis={(basis, statistic) => setLeadTimeBasis(SCENARIO_ID, material.id, basis, statistic)}
            onSetScenarioValue={(days) => setLeadTime(SCENARIO_ID, material.id, days)}
          />
        </GapSection>
      )}

      <GapSection
        title="Deadline consequence"
        description={`Production timing this material feeds (${productById("prod_halloween_variety_classic").name}) vs. when the order must go out under the active basis`}
      >
        <DecisionRunwayTimeline
          today={DEMO_NOW.slice(0, 10)}
          deadlines={[
            { id: "d_system", gapId: gap.id, kind: "material_order_by", date: systemDeadline, isEarliestConstraint: false, drivenBy: "lead_time" },
            { id: "d_active", gapId: gap.id, kind: "material_order_by", date: deadline, isEarliestConstraint: true, drivenBy: "lead_time" },
          ]}
          productionWindow={HALLOWEEN_EVENT.productionWindow}
          salesWindow={HALLOWEEN_EVENT.salesWindow}
        />
      </GapSection>
    </GapWorkspaceShell>
  );
}
