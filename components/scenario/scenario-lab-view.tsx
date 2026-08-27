"use client";

import { useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { RotateCcw, Save, Columns3 } from "lucide-react";
import { useScenarioStore } from "@/stores/scenario-store";
import { calculateScenario } from "@/lib/planning-engine/scenarios";
import { buildHalloweenScenarioInput, buildValentinesScenarioInput } from "@/lib/planning-engine/gaps";
import type { CalculateScenarioInput } from "@/lib/planning-engine/scenarios";
import type { Scenario, ScenarioOverrides } from "@/types/scenario";
import { HISTORICAL_PERIODS } from "@/data/synthetic/historical-demand";
import { EVENTS } from "@/data/synthetic/events";
import { materialById } from "@/data/synthetic/materials";
import { PRODUCTION_LINES } from "@/data/synthetic/master-data";
import { capacityBucket } from "@/data/synthetic/capacity";
import { ANALOGUES } from "@/data/synthetic/products";
import { leadTimeStatisticForSample } from "@/data/synthetic/execution-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { EffectiveCapacityChart } from "@/components/charts/effective-capacity-chart";
import { MaterialReadinessView } from "@/components/planning/material-readiness-view";
import { AnalogueSelector } from "@/components/planning/analogue-selector";
import { AiCommandBar } from "@/components/ai/ai-command-bar";
import { HistoricalBasisEditor } from "@/components/planning/historical-basis-editor";
import { LeadTimeBasisEditor } from "@/components/planning/lead-time-basis-editor";
import { AssumptionControl } from "./assumption-control";
import { ScenarioComparisonPanel } from "./scenario-comparison-panel";
import { fmtNum, fmtPct } from "@/lib/utils/format";

const HALLOWEEN_PERIODS = HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_halloween_2027");
const HALLOWEEN_EVENT = EVENTS.find((e) => e.id === "evt_halloween_2027")!;
const PRINTED_FILM = materialById("mat_printed_film");
const LINE_03 = PRODUCTION_LINES.find((l) => l.id === "line_03")!;

/** Context-sensitive dispatch (PRD §39: "One Scenario Lab. Context-sensitive controls based on gap type.") — same shell, same store, different left/center content per gap type. */
function buildInputFor(scenario: Scenario, scenarioId: string, overrides: ScenarioOverrides): CalculateScenarioInput {
  return scenario.linkedGapIds.includes("valentines-premium-tin") ? buildValentinesScenarioInput(scenarioId, overrides) : buildHalloweenScenarioInput(scenarioId, overrides);
}

export function ScenarioLabView({ scenarioId }: { scenarioId: string }) {
  const scenario = useScenarioStore((s) => s.scenarios[scenarioId]);
  const allScenarios = useScenarioStore((s) => s.scenarios);
  const comparisonScenarioIds = useScenarioStore((s) => s.comparisonScenarioIds);
  const resetScenario = useScenarioStore((s) => s.resetScenario);
  const setScenarioStatus = useScenarioStore((s) => s.setScenarioStatus);
  const addComparisonScenario = useScenarioStore((s) => s.addComparisonScenario);
  const setHistoricalLookback = useScenarioStore((s) => s.setHistoricalLookback);
  const includeHistoricalPeriod = useScenarioStore((s) => s.includeHistoricalPeriod);
  const excludeHistoricalPeriod = useScenarioStore((s) => s.excludeHistoricalPeriod);
  const setGrowthAssumption = useScenarioStore((s) => s.setGrowthAssumption);
  const setLeadTimeBasis = useScenarioStore((s) => s.setLeadTimeBasis);
  const setLeadTimeSampleSize = useScenarioStore((s) => s.setLeadTimeSampleSize);
  const setRunRateBasis = useScenarioStore((s) => s.setRunRateBasis);
  const setLeadTime = useScenarioStore((s) => s.setLeadTime);
  const setRunRate = useScenarioStore((s) => s.setRunRate);
  const setTargetUtilization = useScenarioStore((s) => s.setTargetUtilization);
  const setAnalogueWeight = useScenarioStore((s) => s.setAnalogueWeight);
  const addAnalogue = useScenarioStore((s) => s.addAnalogue);
  const removeAnalogue = useScenarioStore((s) => s.removeAnalogue);
  const [showComparison, setShowComparison] = useState(false);

  const isValentines = scenario?.linkedGapIds.includes("valentines-premium-tin") ?? false;

  const baselineResult = useMemo(() => (scenario ? calculateScenario(buildInputFor(scenario, "baseline", {})) : null), [scenario]);
  const result = useMemo(() => (scenario ? calculateScenario(buildInputFor(scenario, scenarioId, scenario.overrides)) : null), [scenario, scenarioId]);

  if (!scenario || !result || !baselineResult) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">Scenario not found.</div>;
  }

  const leadTimeOverride = scenario.overrides.masterAssumptions?.[`material:${PRINTED_FILM.id}:lead_time`];
  const runRateOverride = scenario.overrides.masterAssumptions?.[`line:${LINE_03.id}:run_rate`];
  const runRateBasis = runRateOverride?.selectedBasis ?? "system";
  const leadTimeSample = leadTimeStatisticForSample(PRINTED_FILM.id, leadTimeOverride?.sampleSize ?? 130);
  const targetUtilizationBaseline = capacityBucket(LINE_03.id, "2027-09").targetUtilization;
  const targetUtilizationOverride = scenario.overrides.capacity?.[`${LINE_03.id}:2027-09`]?.targetUtilization;

  const line03Baseline = baselineResult.capacityImpact.find((c) => c.lineId === "line_03");
  const line03Current = result.capacityImpact.find((c) => c.lineId === "line_03");
  const deadlineBaseline = baselineResult.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date;
  const deadlineCurrent = result.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date;

  const hasOverrides = Object.keys(scenario.overrides).length > 0;

  const removedAnalogueIds = scenario.overrides.analogues?.removedAnalogueIds ?? [];
  const analogueWeights: Record<string, number> = {};
  ANALOGUES.forEach((a) => {
    analogueWeights[a.candidateProductId] = scenario.overrides.analogues?.weights?.[a.candidateProductId] ?? a.similarityScore;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Scenario state bar */}
      <div className="flex flex-none items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-[var(--text-muted)]">Baseline →</span>
          <span className="text-[13px] font-semibold">{scenario.name}</span>
          <Badge variant={scenario.status === "preferred" ? "positive" : "neutral"}>{scenario.status.replace("_", " ")}</Badge>
          {hasOverrides && (
            <Badge variant="scenario">
              {Object.keys(scenario.overrides).length} override{Object.keys(scenario.overrides).length === 1 ? "" : "s"} vs. baseline
            </Badge>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => resetScenario(scenarioId)}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button
            variant={showComparison ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              addComparisonScenario(scenarioId);
              setShowComparison((v) => !v);
            }}
          >
            <Columns3 className="size-3.5" /> Compare
          </Button>
          <Button size="sm" onClick={() => setScenarioStatus(scenarioId, "saved")}>
            <Save className="size-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal">
          {/* LEFT: assumptions — context-sensitive by gap type */}
          <Panel defaultSize={28} minSize={22} className="overflow-y-auto">
            <div className="flex flex-col gap-4 p-4">
              {isValentines ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Analogues — Valentine&apos;s Premium Tin</div>
                  <AnalogueSelector
                    candidates={ANALOGUES}
                    removedIds={removedAnalogueIds}
                    weights={analogueWeights}
                    onToggle={(id, removed) => (removed ? addAnalogue(scenarioId, id) : removeAnalogue(scenarioId, id))}
                    onSetWeight={(productId, weight) => setAnalogueWeight(scenarioId, productId, weight)}
                  />
                </>
              ) : (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Demand basis — Halloween 2027</div>
                  <HistoricalBasisEditor
                    periods={HALLOWEEN_PERIODS}
                    override={scenario.overrides.historicalBasis}
                    defaultGrowthPct={HALLOWEEN_EVENT.businessGrowthAssumption}
                    growthOverridePct={scenario.overrides.demand?.growthRatePct}
                    onSetLookback={(n) => setHistoricalLookback(scenarioId, n)}
                    onTogglePeriod={(id, include) => (include ? includeHistoricalPeriod(scenarioId, id) : excludeHistoricalPeriod(scenarioId, id))}
                    onSetGrowth={(pct) => setGrowthAssumption(scenarioId, pct)}
                  />

                  <Separator />

                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Master assumptions</div>
                  <LeadTimeBasisEditor
                    material={PRINTED_FILM}
                    sample={leadTimeSample}
                    override={leadTimeOverride}
                    onSetSampleSize={(n) => setLeadTimeSampleSize(scenarioId, PRINTED_FILM.id, n)}
                    onSetBasis={(basis, statistic) => setLeadTimeBasis(scenarioId, PRINTED_FILM.id, basis, statistic)}
                    onSetScenarioValue={(days) => setLeadTime(scenarioId, PRINTED_FILM.id, days)}
                  />

                  <Separator />

                  <AssumptionControl
                    label="Line 03 run rate basis"
                    baseline={`System (${fmtNum(LINE_03.standardRunRateUnitsPerHour)}/hr)`}
                    scenario={runRateBasis === "system" ? `System (${fmtNum(LINE_03.standardRunRateUnitsPerHour)}/hr)` : runRateBasis === "historical" ? `Historical (${fmtNum(LINE_03.historicalMedianRunRateUnitsPerHour)}/hr)` : `Custom (${fmtNum(runRateOverride?.scenarioValue ?? 8200)}/hr)`}
                    changed={runRateBasis !== "system"}
                  >
                    <div className="flex gap-2">
                      <Select value={runRateBasis} onValueChange={(v) => setRunRateBasis(scenarioId, LINE_03.id, v as "system" | "historical" | "scenario", v === "scenario" ? 8200 : undefined)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System ({fmtNum(LINE_03.standardRunRateUnitsPerHour)}/hr)</SelectItem>
                          <SelectItem value="historical">Historical median ({fmtNum(LINE_03.historicalMedianRunRateUnitsPerHour)}/hr)</SelectItem>
                          <SelectItem value="scenario">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {runRateBasis === "scenario" && (
                        <Input type="number" value={runRateOverride?.scenarioValue ?? 8200} onChange={(e) => setRunRate(scenarioId, LINE_03.id, "2027-09", Number(e.target.value))} className="w-24" />
                      )}
                    </div>
                  </AssumptionControl>

                  <AssumptionControl
                    label="Line 03 utilization alert threshold"
                    baseline={fmtPct(targetUtilizationBaseline)}
                    scenario={fmtPct(targetUtilizationOverride ?? targetUtilizationBaseline)}
                    changed={targetUtilizationOverride != null && targetUtilizationOverride !== targetUtilizationBaseline}
                  >
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round((targetUtilizationOverride ?? targetUtilizationBaseline) * 100)}
                      onChange={(e) => setTargetUtilization(scenarioId, LINE_03.id, "2027-09", Number(e.target.value) / 100)}
                      className="w-24"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">Flags this line as at-risk once effective load crosses this line — it doesn&apos;t change the modeled load itself.</p>
                  </AssumptionControl>
                </>
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="w-px bg-[var(--border)] transition-colors hover:bg-[var(--accent)]" />

          {/* CENTER: visual — context-sensitive by gap type */}
          <Panel defaultSize={46} minSize={30} className="overflow-y-auto">
            <div className="flex flex-col gap-5 p-4">
              {isValentines ? (
                <>
                  <div className="grid grid-cols-3 gap-2.5">
                    <DeltaStat label="Plan now" value={String(result.materialReadiness.filter((r) => r.readiness === "plan_now").length)} changed={false} tone="positive" />
                    <DeltaStat label="Review" value={String(result.materialReadiness.filter((r) => r.readiness === "review").length)} changed={false} tone="warning" />
                    <DeltaStat label="Wait" value={String(result.materialReadiness.filter((r) => r.readiness === "wait").length)} changed={false} />
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Partial BOM readiness</div>
                    <MaterialReadinessView productName="Valentine's Premium Tin 2028" rows={result.materialReadiness.map((r) => ({ ...r, materialName: materialById(r.materialId).name }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2.5">
                    <DeltaStat
                      label="Expected demand"
                      value={`${fmtNum(result.expectedDemandUnits.low)}–${fmtNum(result.expectedDemandUnits.high)}`}
                      changed={result.expectedDemandUnits.base !== baselineResult.expectedDemandUnits.base}
                      deltaText={`${result.expectedDemandUnits.base >= baselineResult.expectedDemandUnits.base ? "+" : ""}${fmtNum(result.expectedDemandUnits.base - baselineResult.expectedDemandUnits.base)} vs. baseline`}
                    />
                    <DeltaStat
                      label="Line 03 effective"
                      value={line03Current ? fmtPct(line03Current.effectiveUtilization) : "—"}
                      changed={!!line03Current && !!line03Baseline && line03Current.effectiveUtilization !== line03Baseline.effectiveUtilization}
                      deltaText={line03Current && line03Baseline ? `${fmtPct(line03Baseline.effectiveUtilization)} → ${fmtPct(line03Current.effectiveUtilization)}` : undefined}
                      tone={line03Current?.riskLevel}
                    />
                    <DeltaStat label="Earliest deadline" value={deadlineCurrent ?? "—"} changed={deadlineCurrent !== deadlineBaseline} deltaText={deadlineCurrent !== deadlineBaseline ? `${deadlineBaseline} → ${deadlineCurrent}` : undefined} />
                  </div>

                  {showComparison ? null : (
                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Effective capacity — September 2027</div>
                      <EffectiveCapacityChart data={result.capacityImpact} />
                    </div>
                  )}
                </>
              )}

              {showComparison && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Baseline vs. scenario</div>
                  <ScenarioComparisonPanel
                    columns={[
                      { label: "Baseline", result: baselineResult, isBaseline: true },
                      { label: scenario.name, result },
                      ...comparisonScenarioIds
                        .filter((id) => id !== scenarioId && allScenarios[id])
                        .slice(0, 2)
                        .map((id) => ({ label: allScenarios[id]!.name, result: calculateScenario(buildInputFor(allScenarios[id]!, id, allScenarios[id]!.overrides)) })),
                    ]}
                  />
                </div>
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="w-px bg-[var(--border)] transition-colors hover:bg-[var(--accent)]" />

          {/* RIGHT: AI copilot */}
          <Panel defaultSize={26} minSize={20} className="overflow-y-auto">
            <div className="flex h-full flex-col gap-3 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Scenario copilot</div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-[12px] text-[var(--text-secondary)]">
                <p>{isValentines ? 'Try: "reweight toward Mother\'s Day Tin" or "add Holiday Premium Tin as an analogue."' : 'Try: "use the P80 lead time for printed film" or "set Line 03\'s run rate to 8,200 an hour."'}</p>
                {result.methodologyTrace.map((t, i) => (
                  <p key={i} className="text-[11.5px] text-[var(--text-muted)]">
                    · {t.step}: {t.outputSummary}
                  </p>
                ))}
              </div>
              <AiCommandBar placeholder="Ask Heizen about this scenario…" scenarioId={scenarioId} />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

function DeltaStat({ label, value, changed, deltaText, tone }: { label: string; value: string; changed: boolean; deltaText?: string; tone?: "positive" | "warning" | "critical" }) {
  return (
    <div className={`rounded-[var(--radius-md)] border p-2.5 transition-colors ${changed ? "border-[var(--accent)] bg-[var(--interaction-selected)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ color: tone ? `var(--risk-${tone})` : undefined }}>
        {value}
      </div>
      {changed && deltaText && <div className="mt-0.5 text-[10.5px] font-medium tabular-nums text-[var(--accent)]">{deltaText}</div>}
    </div>
  );
}
