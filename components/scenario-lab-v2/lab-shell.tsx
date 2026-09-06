/**
 * The Scenario Lab workspace for one situation (V2 §13).
 *
 * Baseline is read straight from `useDataset()` and is never mutated. The
 * scenario result is a *derived* value: `applyScenarioToDataset` produces a
 * copy of the dataset with the active scenario's overrides substituted in,
 * and `buildSituations` runs over that copy the same way it runs over the
 * real one. Nothing here is persisted — recomputing on every render is what
 * keeps baseline and scenario structurally separate (V2 §53).
 */

"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDataset } from "@/components/dataset/dataset-provider";
import { useDatasetStore } from "@/stores/dataset-store";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { applyScenarioToDataset } from "@/lib/situations/scenario";
import { buildSituations } from "@/lib/situations/build";
import { EMPTY_ADJUSTMENTS } from "@/types/situation";
import { NotAvailable, Page, SectionRule } from "@/components/v2/page";
import { ScenarioToolbar } from "./scenario-toolbar";
import { ControlsVolume } from "./controls-volume";
import { ControlsAnalogues } from "./controls-analogues";
import { ControlsCapacity } from "./controls-capacity";
import { ControlsAllocation } from "./controls-allocation";
import { ControlsMaterials } from "./controls-materials";
import { ImpactPanel } from "./impact-panel";
import { ChangesList } from "./changes-list";
import { CommitBar } from "./commit-bar";
import { FocusHeader } from "./focus-header";

export function ScenarioLabShell({
  situationId,
  focusItemId,
}: {
  situationId: string;
  focusItemId?: string;
}) {
  const router = useRouter();
  const { dataset, situations, loading } = useDataset();
  const overridesBySituation = useDatasetStore((s) => s.overridesBySituation);

  const scenarios = useSituationScenarioStore((s) => s.scenarios);
  const activeScenarioId = useSituationScenarioStore((s) => s.activeScenarioId);
  const viewMode = useSituationScenarioStore((s) => s.viewMode);
  const hasHydrated = useSituationScenarioStore((s) => s.hasHydrated);
  const createScenario = useSituationScenarioStore((s) => s.createScenario);
  const duplicateScenario = useSituationScenarioStore((s) => s.duplicateScenario);
  const renameScenario = useSituationScenarioStore((s) => s.renameScenario);
  const deleteScenario = useSituationScenarioStore((s) => s.deleteScenario);
  const resetScenario = useSituationScenarioStore((s) => s.resetScenario);
  const setActiveScenario = useSituationScenarioStore((s) => s.setActiveScenario);
  const setViewMode = useSituationScenarioStore((s) => s.setViewMode);

  const baseline = useMemo(() => situations.find((s) => s.id === situationId), [situations, situationId]);

  const scenariosForSituation = useMemo(
    () =>
      Object.values(scenarios)
        .filter((s) => s.situationId === situationId)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [scenarios, situationId]
  );

  // Which situation we have already auto-created a scenario for.
  const autoCreatedFor = useRef<string | null>(null);

  const rawActive = activeScenarioId ? scenarios[activeScenarioId] : undefined;
  const activeScenario = rawActive?.situationId === situationId ? rawActive : undefined;

  // Opening a situation's lab should show that situation's own most recent
  // scenario, not whatever was last active elsewhere in the app. The early
  // return is what keeps this from fighting the planner's own selection: once
  // a scenario belonging to this situation is active, the effect does nothing
  // however often it re-runs.
  useEffect(() => {
    if (!hasHydrated) return;
    if (activeScenario) return;
    const fallback = scenariosForSituation[0];
    if (fallback) {
      setActiveScenario(fallback.id);
      return;
    }
    // No scenario for this situation yet: make one rather than showing an
    // empty column and asking the planner to press a button before the page
    // does anything. The lab is supposed to open on the situation ready to
    // work (V2 §10.5), and an untouched scenario is identical to the baseline
    // anyway — so creating it costs nothing and removes a dead first screen.
    //
    // Guarded by a ref, not by the store: the store write is asynchronous, so
    // the effect can re-run with `activeScenario` still undefined and create a
    // second identical scenario before the first one lands.
    if (autoCreatedFor.current === situationId) return;
    autoCreatedFor.current = situationId;
    createScenario(situationId, "Scenario 1", new Date().toISOString());
  }, [
    hasHydrated,
    activeScenario,
    scenariosForSituation,
    setActiveScenario,
    createScenario,
    situationId,
  ]);

  const adjustments = activeScenario?.adjustments ?? EMPTY_ADJUSTMENTS;

  // Volumes already committed are part of the baseline, so the scenario has to
  // start from them — otherwise opening the lab would silently revert a
  // decision the planner had already made. Scenario values win over them.
  const committedVolumes = useMemo(() => {
    const out: Record<string, number> = {};
    for (const commitment of Object.values(overridesBySituation[situationId]?.commitments ?? {})) {
      out[commitment.candidateId] = commitment.units;
    }
    return out;
  }, [overridesBySituation, situationId]);

  const effectiveVolumes = useMemo(
    () => ({ ...committedVolumes, ...(adjustments.volumeUnits ?? {}) }),
    [committedVolumes, adjustments.volumeUnits]
  );

  const scenarioDataset = useMemo(
    () => (dataset ? applyScenarioToDataset(dataset, adjustments) : null),
    [dataset, adjustments]
  );

  const scenarioSituation = useMemo(
    () =>
      scenarioDataset
        ? buildSituations(scenarioDataset, {
            overridesBySituation,
            leadTimeOverrideDays: adjustments.leadTimeDays,
            volumeOverrideUnits: effectiveVolumes,
            analogueWeightOverrides: adjustments.analogueWeights,
          }).find((s) => s.id === situationId)
        : undefined,
    [
      scenarioDataset,
      overridesBySituation,
      adjustments.leadTimeDays,
      adjustments.analogueWeights,
      effectiveVolumes,
      situationId,
    ]
  );

  if (loading) return <Page>{null}</Page>;

  if (!dataset || !baseline) {
    return (
      <Page>
        <NotAvailable
          title="Situation not found"
          detail="It may belong to a dataset that is no longer loaded."
          action={
            <Link
              href="/scenario-lab"
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-on-accent)]"
            >
              Back to Scenario Lab
            </Link>
          }
        />
      </Page>
    );
  }

  const effectiveScenario = scenarioSituation ?? baseline;
  const nowIso = () => new Date().toISOString();

  return (
    <div>
      <ScenarioToolbar
        situationId={situationId}
        situationTitle={baseline.title}
        scenarios={scenariosForSituation}
        activeScenario={activeScenario}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onCreate={() => createScenario(situationId, `Scenario ${scenariosForSituation.length + 1}`, nowIso())}
        onSelect={setActiveScenario}
        onRename={(name) => activeScenario && renameScenario(activeScenario.id, name)}
        onDuplicate={() => activeScenario && duplicateScenario(activeScenario.id, nowIso())}
        onResetAll={() => activeScenario && resetScenario(activeScenario.id)}
        onDelete={() => {
          if (!activeScenario) return;
          if (typeof window !== "undefined" && !window.confirm(`Delete "${activeScenario.name}"?`)) return;
          deleteScenario(activeScenario.id);
        }}
      />

      <Page>
        <div className="flex gap-10">
          {/* The controls scroll inside their own column. Sharing the page's
              scroll meant reaching Line 04's hours dragged the impact panel
              off screen — and the whole point of the panel is to watch it move
              while you change something. */}
          <aside className="sticky top-4 h-[calc(100vh-8rem)] w-[340px] flex-none overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
            {activeScenario ? (
              <>
                <FocusHeader baseline={baseline} focusItemId={focusItemId} />
                {/* Volume first and open by default: a planner opens the lab
                    with a demand question, and leading with hours and run
                    rates answered a question they had not asked. */}
                <ControlsVolume
                  scenarioId={activeScenario.id}
                  baseline={baseline}
                  adjustments={adjustments}
                  focusItemId={focusItemId}
                  onClearFocus={() => router.replace(`/scenario-lab?situation=${situationId}`)}
                />
                <ControlsAnalogues
                  scenarioId={activeScenario.id}
                  baseline={baseline}
                  adjustments={adjustments}
                  focusItemId={focusItemId}
                />
                <ControlsCapacity scenarioId={activeScenario.id} baseline={baseline} adjustments={adjustments} />
                <ControlsAllocation
                  scenarioId={activeScenario.id}
                  dataset={dataset}
                  baseline={baseline}
                  adjustments={adjustments}
                />
                <ControlsMaterials scenarioId={activeScenario.id} baseline={baseline} adjustments={adjustments} />
              </>
            ) : null}
          </aside>

          <div className="min-w-0 flex-1">
            <ImpactPanel baseline={baseline} scenario={effectiveScenario} viewMode={viewMode} />

            <SectionRule label="Changes" />
            <ChangesList
              scenarioId={activeScenario?.id}
              dataset={dataset}
              baseline={baseline}
              adjustments={adjustments}
            />

            <CommitBar baseline={baseline} scenario={effectiveScenario} adjustments={adjustments} />
          </div>
        </div>
      </Page>
    </div>
  );
}
