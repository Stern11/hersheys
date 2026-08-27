"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { RotateCcw, Save, Columns3, AlertTriangle } from "lucide-react";
import { useScenarioStore, type AppliedChange } from "@/stores/scenario-store";
import { calculateScenario } from "@/lib/planning-engine/scenarios";
import { buildScenarioInput } from "@/lib/planning-engine/scenario-limits";
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
import { CopilotToggle } from "@/components/ai/copilot-toggle";
import { HistoricalBasisEditor } from "@/components/planning/historical-basis-editor";
import { LeadTimeBasisEditor } from "@/components/planning/lead-time-basis-editor";
import {
  basisBanner,
  controlNotice,
  demandDisplay,
  fmtRunRate,
  fmtThreshold,
  periodLabel,
  resetPlan,
  runRateControlModel,
  targetUtilizationControlModel,
  type ControlNotice,
} from "@/lib/scenario-lab/controls";
import { AssumptionControl } from "./assumption-control";
import { ScenarioComparisonPanel } from "./scenario-comparison-panel";
import { fmtNum, fmtPct } from "@/lib/utils/format";

const HALLOWEEN_PERIODS = HISTORICAL_PERIODS.filter((p) => p.eventId === "evt_halloween_2027");
const HALLOWEEN_EVENT = EVENTS.find((e) => e.id === "evt_halloween_2027")!;
const PRINTED_FILM = materialById("mat_printed_film");
const LINE_03 = PRODUCTION_LINES.find((l) => l.id === "line_03")!;

export function ScenarioLabView({ scenarioId }: { scenarioId: string }) {
  const scenario = useScenarioStore((s) => s.scenarios[scenarioId]);
  const allScenarios = useScenarioStore((s) => s.scenarios);
  const comparisonScenarioIds = useScenarioStore((s) => s.comparisonScenarioIds);
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
  const setActiveScenario = useScenarioStore((s) => s.setActiveScenario);
  const overrideDiffsOf = useScenarioStore((s) => s.overrideDiffs);
  const resetScenario = useScenarioStore((s) => s.resetScenario);
  const saveScenario = useScenarioStore((s) => s.saveScenario);
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
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [runRateNotice, setRunRateNotice] = useState<ControlNotice | null>(null);
  const [thresholdNotice, setThresholdNotice] = useState<ControlNotice | null>(null);

  /**
   * The copilot in the top bar answers about the ACTIVE scenario. Opening a
   * scenario workspace has to make that scenario active, or "why is Line 03
   * red" typed on this page would be answered from a different scenario's
   * engine output.
   */
  useEffect(() => {
    if (scenario && activeScenarioId !== scenarioId) setActiveScenario(scenarioId);
  }, [scenario, activeScenarioId, scenarioId, setActiveScenario]);

  const isValentines = scenario?.linkedGapIds.includes("valentines-premium-tin") ?? false;

  // One engine input, used both to run the scenario and to read the basis the
  // controls edit — so a control can never point at a bucket or a material the
  // scenario does not actually evaluate.
  const input = useMemo(() => (scenario ? buildScenarioInput(scenario, scenarioId, scenario.overrides) : null), [scenario, scenarioId]);
  const result = useMemo(() => (input ? calculateScenario(input) : null), [input]);
  const baselineResult = useMemo(() => (scenario ? calculateScenario(buildScenarioInput(scenario, "baseline", {})) : null), [scenario]);
  const diffs = useMemo(() => (scenario ? overrideDiffsOf(scenarioId) : []), [scenario, scenarioId, overrideDiffsOf]);

  if (!scenario || !result || !baselineResult || !input) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">Scenario not found.</div>;
  }

  /** The PRODUCTION bucket this scenario evaluates. Read from the engine input, never a literal month. */
  const period = input.capacityBuckets.find((b) => b.lineId === LINE_03.id)?.period ?? input.capacityBuckets[0]?.period ?? "";

  const leadTimeOverride = scenario.overrides.masterAssumptions?.[`material:${PRINTED_FILM.id}:lead_time`];
  const leadTimeSample = leadTimeStatisticForSample(PRINTED_FILM.id, leadTimeOverride?.sampleSize ?? 130);

  const observedRunRate = input.observedRunRateByLine.get(LINE_03.id) ?? LINE_03.historicalMedianRunRateUnitsPerHour;
  const runRate = runRateControlModel({
    line: LINE_03,
    runRateOverride: scenario.overrides.masterAssumptions?.[`line:${LINE_03.id}:run_rate`],
    capacityOverride: scenario.overrides.capacity?.[`${LINE_03.id}:${period}`],
    observedMedianRunRate: observedRunRate,
  });

  const threshold = targetUtilizationControlModel({
    baselineTargetUtilization: period ? capacityBucket(LINE_03.id, period).targetUtilization : 0,
    override: scenario.overrides.capacity?.[`${LINE_03.id}:${period}`]?.targetUtilization,
  });

  const line03Baseline = baselineResult.capacityImpact.find((c) => c.lineId === LINE_03.id);
  const line03Current = result.capacityImpact.find((c) => c.lineId === LINE_03.id);
  const deadlineBaseline = baselineResult.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date;
  const deadlineCurrent = result.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date;
  const banner = basisBanner(result.basis);
  const reset = resetPlan({ scenarioName: scenario.name, status: scenario.status, diffs });

  const removedAnalogueIds = scenario.overrides.analogues?.removedAnalogueIds ?? [];
  const analogueWeights: Record<string, number> = {};
  ANALOGUES.forEach((a) => {
    analogueWeights[a.candidateProductId] = scenario.overrides.analogues?.weights?.[a.candidateProductId] ?? a.similarityScore;
  });

  function applyRunRate(value: number) {
    const applied: AppliedChange = setRunRate(scenarioId, LINE_03.id, period, value);
    setRunRateNotice(controlNotice(applied, fmtRunRate));
  }
  function applyThreshold(pct: number) {
    const applied: AppliedChange = setTargetUtilization(scenarioId, LINE_03.id, period, pct);
    setThresholdNotice(controlNotice(applied, fmtThreshold));
  }

  return (
    <div className="flex h-full flex-col">
      {/* Scenario state bar */}
      <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--border)] px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-[var(--text-muted)]">Baseline →</span>
          <span className="text-[13px] font-semibold">{scenario.name}</span>
          <Badge variant={scenario.status === "preferred" ? "positive" : "neutral"}>{scenario.status.replace("_", " ")}</Badge>
          {/* Count and chips come from the SAME list, so they cannot disagree —
              and a restated value that resolves to the baseline is not counted. */}
          {diffs.length > 0 && (
            <Badge variant="scenario">
              {diffs.length} override{diffs.length === 1 ? "" : "s"} vs. baseline
            </Badge>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <CopilotToggle />
          <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)} aria-expanded={confirmingReset}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
          <Button
            variant={showComparison ? "default" : "secondary"}
            size="sm"
            aria-pressed={showComparison}
            onClick={() => {
              addComparisonScenario(scenarioId);
              setShowComparison((v) => !v);
            }}
          >
            <Columns3 className="size-3.5" /> {showComparison ? "Hide comparison" : "Compare"}
          </Button>
          <Button size="sm" onClick={() => saveScenario(scenarioId)}>
            <Save className="size-3.5" /> Save
          </Button>
        </div>
        {diffs.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-1.5">
            {diffs.map((d) => (
              <span key={d.key} className="rounded-[var(--radius-sm)] bg-[var(--state-scenario-soft)] px-1.5 py-0.5 text-[10.5px] tabular-nums text-[var(--state-scenario)]" title={`${d.label}: ${d.baseline} → ${d.scenario}`}>
                {d.label}: {d.baseline} → {d.scenario}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reset confirmation — Reset used to clear a named scenario instantly,
          with no statement of what was lost and no undo. */}
      {confirmingReset && (
        <div className="flex flex-none flex-col gap-2 border-b border-[var(--risk-warning)] bg-[var(--surface-sunken)] px-4 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 flex-none text-[var(--risk-warning)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium">{reset.title}</p>
              {reset.losses.map((loss, i) => (
                <p key={i} className="mt-0.5 text-[11.5px] tabular-nums text-[var(--text-secondary)]">
                  · {loss}
                </p>
              ))}
              {reset.standingWarning && <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">{reset.standingWarning}</p>}
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(false)}>
                Cancel
              </Button>
              <Button
                variant={reset.destructive ? "default" : "secondary"}
                size="sm"
                onClick={() => {
                  resetScenario(scenarioId);
                  setRunRateNotice(null);
                  setThresholdNotice(null);
                  setConfirmingReset(false);
                }}
              >
                {reset.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal">
          {/*
            LEFT: assumptions.
            The scroll container is the CHILD div, never the Panel. Panel writes
            `overflow: hidden` into its own inline style
            (`computePanelFlexBoxStyle` in react-resizable-panels), and an inline
            style beats any class — so `className="overflow-y-auto"` on the Panel
            clipped ~393px of controls with no scrollbar and no wheel response.
            The run-rate card and the threshold card below were physically
            unreachable at every panel width.
          */}
          <Panel defaultSize={34} minSize={26} className="flex flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
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

                    <AssumptionControl label={`${LINE_03.name} run rate basis`} baseline={runRate.baselineLabel} scenario={runRate.scenarioLabel} changed={runRate.changed}>
                      <div className="flex gap-2">
                        <Select
                          value={runRate.basis}
                          onValueChange={(v) => {
                            // No magic seed value: the store preserves whatever
                            // custom rate is already stored, so System → Custom
                            // no longer wipes the planner's own number.
                            setRunRateBasis(scenarioId, LINE_03.id, v as "system" | "historical" | "scenario");
                            setRunRateNotice(null);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">System ({fmtNum(LINE_03.standardRunRateUnitsPerHour)}/hr)</SelectItem>
                            <SelectItem value="historical">Historical median ({fmtNum(observedRunRate)}/hr)</SelectItem>
                            <SelectItem value="scenario">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        {runRate.basis === "scenario" && (
                          <Input
                            type="number"
                            aria-label={`${LINE_03.name} custom run rate, units per hour`}
                            min={runRate.range.min}
                            max={runRate.range.max}
                            step={runRate.range.step}
                            value={runRate.inputValue}
                            onChange={(e) => applyRunRate(Number(e.target.value))}
                            className="w-28"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {runRate.sourceNote} Legal range {fmtNum(runRate.range.min)}–{fmtNum(runRate.range.max)} {runRate.range.unit}.
                      </p>
                      {runRateNotice && <ControlNoticeLine notice={runRateNotice} />}
                    </AssumptionControl>

                    <AssumptionControl
                      label={`${LINE_03.name} utilization alert threshold`}
                      baseline={fmtPct(period ? capacityBucket(LINE_03.id, period).targetUtilization : 0)}
                      scenario={fmtPct(threshold.fraction)}
                      changed={threshold.changed}
                    >
                      <Input
                        type="number"
                        aria-label={`${LINE_03.name} utilization alert threshold, percent`}
                        min={threshold.minPct}
                        max={threshold.maxPct}
                        step={threshold.stepPct}
                        value={threshold.inputPct}
                        onChange={(e) => applyThreshold(Number(e.target.value) / 100)}
                        className="w-24"
                      />
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Flags this line as at-risk once effective load in {periodLabel(period)} crosses this line — it doesn&apos;t change the modeled load itself. {threshold.rationale}
                      </p>
                      {thresholdNotice && <ControlNoticeLine notice={thresholdNotice} />}
                    </AssumptionControl>
                  </>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-px bg-[var(--border)] transition-colors hover:bg-[var(--accent)]" />

          {/*
            CENTER: the analytical workspace, now holding the width the static
            copilot panel used to occupy. Same child-div scroll container as the
            left panel, for the same reason.
          */}
          <Panel defaultSize={66} minSize={40} className="flex flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-5 p-4">
                {banner.show && (
                  <div className="rounded-[var(--radius-md)] border border-[var(--risk-warning)] bg-[var(--surface-sunken)] px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--risk-warning)]">
                      <AlertTriangle className="size-3.5" /> {banner.headline}
                    </div>
                    {banner.detail.map((d, i) => (
                      <p key={i} className="mt-1 text-[11.5px] text-[var(--text-secondary)]">
                        {d}
                      </p>
                    ))}
                  </div>
                )}

                {isValentines ? (
                  <>
                    <div className="grid grid-cols-3 gap-2.5">
                      <DeltaStat label="Plan now" value={String(result.readinessCounts.planNow)} changed={result.readinessCounts.planNow !== baselineResult.readinessCounts.planNow} tone="positive" />
                      <DeltaStat label="Review" value={String(result.readinessCounts.review)} changed={result.readinessCounts.review !== baselineResult.readinessCounts.review} tone="warning" />
                      <DeltaStat label="Wait" value={String(result.readinessCounts.wait)} changed={result.readinessCounts.wait !== baselineResult.readinessCounts.wait} />
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
                        value={demandDisplay({ basis: result.basis, low: result.expectedDemandUnits.low, high: result.expectedDemandUnits.high })}
                        changed={result.expectedDemandUnits.base !== baselineResult.expectedDemandUnits.base}
                        deltaText={
                          result.basis.sufficient
                            ? `${result.expectedDemandUnits.base >= baselineResult.expectedDemandUnits.base ? "+" : ""}${fmtNum(result.expectedDemandUnits.base - baselineResult.expectedDemandUnits.base)} vs. baseline`
                            : undefined
                        }
                      />
                      <DeltaStat
                        label={`${LINE_03.name} effective`}
                        value={line03Current ? fmtPct(line03Current.effectiveUtilization) : "—"}
                        changed={!!line03Current && !!line03Baseline && line03Current.effectiveUtilization !== line03Baseline.effectiveUtilization}
                        deltaText={line03Current && line03Baseline ? `${fmtPct(line03Baseline.effectiveUtilization)} → ${fmtPct(line03Current.effectiveUtilization)}` : undefined}
                        tone={line03Current?.riskLevel}
                      />
                      <DeltaStat label="Earliest deadline" value={deadlineCurrent ?? "—"} changed={deadlineCurrent !== deadlineBaseline} deltaText={deadlineCurrent !== deadlineBaseline ? `${deadlineBaseline} → ${deadlineCurrent}` : undefined} />
                    </div>

                    {showComparison ? null : (
                      <div>
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Effective capacity — {periodLabel(period)} (production)</div>
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
                          .map((id) => ({ label: allScenarios[id]!.name, result: calculateScenario(buildScenarioInput(allScenarios[id]!, id, allScenarios[id]!.overrides)) })),
                      ]}
                    />
                  </div>
                )}

                {/* The methodology trace: relocated out of the copilot panel,
                    where it was static text pretending to be a conversation.
                    It belongs under the workspace it explains. */}
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">How this was derived</div>
                  <ol className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2.5">
                    {result.methodologyTrace.map((t, i) => (
                      <li key={i} className="text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-primary)]">{t.step}</span> — in: {t.inputSummary}; out: {t.outputSummary}
                      </li>
                    ))}
                    <li className="text-[11.5px] text-[var(--text-muted)]">
                      Basis: {result.basis.seasonsUsed} of {result.basis.seasonsAvailable} comparable season(s) read
                      {result.basis.seasonsRequested != null ? `, ${result.basis.seasonsRequested} requested` : ""}. Ask the copilot &ldquo;why is {LINE_03.name} red&rdquo; or &ldquo;what changed&rdquo; for the same numbers explained
                      against this scenario.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

function ControlNoticeLine({ notice }: { notice: ControlNotice }) {
  const color = notice.tone === "noop" ? "var(--text-muted)" : "var(--risk-warning)";
  return (
    <p role="status" className="text-[11px] font-medium" style={{ color }}>
      {notice.text}
    </p>
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
