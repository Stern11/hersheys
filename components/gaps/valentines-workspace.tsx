"use client";

import { useMemo } from "react";
import type { GapDetectionResult } from "@/lib/planning-engine/gaps";
import { buildValentinesScenarioInput } from "@/lib/planning-engine/gaps";
import { calculateScenario } from "@/lib/planning-engine/scenarios";
import { useScenarioStore } from "@/stores/scenario-store";
import { ANALOGUES } from "@/data/synthetic/products";
import { materialById } from "@/data/synthetic/materials";
import { fmtPct } from "@/lib/utils/format";
import { GapWorkspaceShell } from "./gap-workspace-shell";
import { GapSection } from "./gap-section";
import { AnalogueSelector } from "@/components/planning/analogue-selector";
import { MaterialReadinessView } from "@/components/planning/material-readiness-view";
import type { MetricBandItem } from "@/components/planning/metric-band";

const SCENARIO_ID = "scn_valentines_tin_analogues";

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

  const liveResult = useMemo(() => {
    if (!scenario) return null;
    return calculateScenario(buildValentinesScenarioInput(SCENARIO_ID, scenario.overrides));
  }, [scenario]);

  const readiness = liveResult?.materialReadiness ?? [];
  const readinessRows = readiness.map((r) => ({ ...r, materialName: materialById(r.materialId).name }));

  const planNow = readiness.filter((r) => r.readiness === "plan_now").length;
  const review = readiness.filter((r) => r.readiness === "review").length;
  const wait = readiness.filter((r) => r.readiness === "wait").length;
  const valueWeightedConfidence = readiness.length > 0 ? readiness.reduce((s, r) => s + r.confidence, 0) / readiness.length : 0;

  const metrics: MetricBandItem[] = [
    { label: "Formal SKU", value: "None" },
    { label: "BOM readiness", value: fmtPct(valueWeightedConfidence) },
    { label: "Plan now", value: String(planNow), tone: "positive" },
    { label: "Review", value: String(review), tone: "warning" },
    { label: "Wait", value: String(wait), tone: wait > 0 ? "warning" : undefined },
    { label: "Confidence", value: fmtPct(gap.confidence.overall) },
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
      situation="No formal SKU, artwork, or BOM exists yet for the Valentine's Premium Tin — but two analogues (Mother's Day Tin 2027, Holiday Premium Tin) let the platform infer which components are stable enough to plan now, which need review, and which should wait."
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
        <MaterialReadinessView productName="Valentine's Premium Tin 2028 (analogue-derived)" rows={readinessRows} />
      </GapSection>
    </GapWorkspaceShell>
  );
}
