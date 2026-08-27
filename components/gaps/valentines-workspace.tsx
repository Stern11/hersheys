"use client";

import { useMemo } from "react";
import type { GapDetectionResult } from "@/lib/planning-engine/gaps";
import { buildValentinesScenarioInput } from "@/lib/planning-engine/gaps";
import { calculateScenario } from "@/lib/planning-engine/scenarios";
import { useScenarioStore } from "@/stores/scenario-store";
import { ANALOGUES, productById } from "@/data/synthetic/products";
import { materialById } from "@/data/synthetic/materials";
import { fmtPct } from "@/lib/utils/format";
import { formatReadinessCount, summarizeBomReadiness } from "@/lib/gaps/gap-metrics";
import { GapWorkspaceShell } from "./gap-workspace-shell";
import { GapSection } from "./gap-section";
import { AnalogueSelector } from "@/components/planning/analogue-selector";
import { MaterialReadinessView } from "@/components/planning/material-readiness-view";
import type { MetricBandItem } from "@/components/planning/metric-band";

const SCENARIO_ID = "scn_valentines_tin_analogues";
const PRODUCT_ID = "prod_valentines_premium_tin_2028";

/**
 * Golden Scenario B (PRD §28.2). Primary focus is the certainty/readiness
 * progression — what's known, inferred, and unresolved — not a single
 * demand number, since nothing about this product is formal yet
 * (PRD-phase-2 §24).
 */
export function ValentinesWorkspace({ result: baselineResult }: { result: GapDetectionResult }) {
  const scenario = useScenarioStore((s) => s.scenarios[SCENARIO_ID]);
  const setAnalogueWeight = useScenarioStore((s) => s.setAnalogueWeight);
  const addAnalogue = useScenarioStore((s) => s.addAnalogue);
  const removeAnalogue = useScenarioStore((s) => s.removeAnalogue);

  const { gap, planningBasis, evidence } = baselineResult;
  const product = productById(PRODUCT_ID);
  const analogueNames = ANALOGUES.map((a) => productById(a.candidateProductId).name);

  const liveResult = useMemo(() => {
    if (!scenario) return null;
    return calculateScenario(buildValentinesScenarioInput(SCENARIO_ID, scenario.overrides));
  }, [scenario]);

  const readiness = liveResult?.materialReadiness ?? [];
  const readinessRows = readiness.map((r) => ({ ...r, materialName: materialById(r.materialId).name }));

  /**
   * ONE readiness figure, from lib/gaps/gap-metrics.ts, shared with
   * /gaps/product-readiness, /gaps and /decisions.
   *
   * This band used to show "BOM readiness 69%" — an unweighted mean of the
   * seven component confidences, computed inline here, labelled as
   * value-weighted readiness, and 4 points away from the 65% that every
   * other surface showed for the same product. There is no cost per
   * material in the data and the requirement quantities are in
   * incommensurable units (MT, cwt, lbs, MSI, ea), so a genuinely
   * value-weighted readiness figure is not computable and is therefore not
   * shown. The component counts are, and they are their own denominator.
   */
  const summary = summarizeBomReadiness(readiness);

  const metrics: MetricBandItem[] = [
    { label: "Formal SKU", value: "None" },
    { label: "Plan now", value: formatReadinessCount(summary), tone: "positive", hint: `${summary.planNow} of ${summary.total} modelled components` },
    { label: "Review", value: String(summary.review), tone: summary.review > 0 ? "warning" : undefined },
    { label: "Wait", value: String(summary.wait), tone: summary.wait > 0 ? "warning" : undefined },
    { label: "Analogues in basis", value: String(ANALOGUES.length - (scenario?.overrides.analogues?.removedAnalogueIds?.length ?? 0)) },
    { label: "Gap confidence", value: fmtPct(gap.confidence.overall), hint: "Overall confidence across every dimension of this gap" },
  ];

  const removedIds = scenario?.overrides.analogues?.removedAnalogueIds ?? [];
  const weights: Record<string, number> = {};
  ANALOGUES.forEach((a) => {
    weights[a.candidateProductId] = scenario?.overrides.analogues?.weights?.[a.candidateProductId] ?? a.similarityScore;
  });

  return (
    <GapWorkspaceShell
      gap={gap}
      planningBasis={planningBasis}
      evidence={evidence}
      metrics={metrics}
      situation={`No formal SKU, artwork, or BOM exists yet for the ${product.name} — but ${analogueNames.length} analogues (${analogueNames.join(", ")}) let the platform infer which components are stable enough to plan now, which need review, and which should wait.`}
      scenarioHref={`/scenario-lab/${SCENARIO_ID}`}
    >
      <GapSection title="Analogues" description="Accept, reject, or reweight — every change re-blends the BOM live">
        <AnalogueSelector
          candidates={ANALOGUES}
          removedIds={removedIds}
          weights={weights}
          onToggle={(id, removed) => (removed ? addAnalogue(SCENARIO_ID, id) : removeAnalogue(SCENARIO_ID, id))}
          onSetWeight={(productId, weight) => setAnalogueWeight(SCENARIO_ID, productId, weight)}
        />
      </GapSection>

      <GapSection title="Partial BOM readiness" description="Formal vs. inferred, and plan-now / review / wait, for every component the analogue mix implies">
        <MaterialReadinessView productName={`${product.name} (analogue-derived)`} rows={readinessRows} />
      </GapSection>
    </GapWorkspaceShell>
  );
}
