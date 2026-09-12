"use client";

/**
 * Decisions (V2 §57, PRD §20-21).
 *
 * One question: what have I decided, and what happens when the real items
 * arrive? Everything here reads from the same overrides and scenario stores
 * every other V2 page reads from — nothing is computed or persisted here.
 */

import { useMemo } from "react";
import { useDataset } from "@/components/dataset/dataset-provider";
import { useDatasetStore } from "@/stores/dataset-store";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { HeroMetric, MetricRow, Page, PageHeader, SectionRule } from "@/components/v2/page";
import { SituationRows } from "@/components/decisions/situation-rows";
import { DecisionsTable } from "@/components/decisions/decisions-table";
import { SavedScenarios } from "@/components/decisions/saved-scenarios";
import { countAdjustments } from "@/lib/situations/scenario";
import { ReconciliationPanel } from "@/components/decisions/reconciliation-panel";
import { fmtMoney, fmtNum } from "@/lib/utils/format";

export default function DecisionsPage() {
  const { situations } = useDataset();
  const overridesBySituation = useDatasetStore((s) => s.overridesBySituation);
  const scenariosById = useSituationScenarioStore((s) => s.scenarios);
  // Scenario Lab opens every situation on a fresh "Scenario 1" so the
  // planner never lands on an empty column. Counting that untouched scenario
  // as "saved" here made every visited situation look like a decision had
  // been worked through — so only scenarios that change something, or carry
  // a note, are listed and counted.
  const scenarios = useMemo(
    () =>
      Object.values(scenariosById).filter(
        (s) => countAdjustments(s.adjustments) > 0 || Boolean(s.note?.trim())
      ),
    [scenariosById]
  );

  const currency = situations[0]?.bridge.currency ?? "USD";

  const totalValidatedValue = useMemo(
    () => situations.reduce((sum, s) => sum + s.bridge.validatedValue, 0),
    [situations]
  );

  const situationsWithDecisions = useMemo(
    () =>
      situations.filter((s) => Object.keys(overridesBySituation[s.id]?.dispositions ?? {}).length > 0).length,
    [situations, overridesBySituation]
  );

  const stillToDecide = useMemo(
    () =>
      situations.reduce(
        (sum, s) =>
          sum +
          s.candidateItems.filter((c) => c.disposition === "unreviewed" || c.disposition === "under_review").length,
        0
      ),
    [situations]
  );

  return (
    <Page>
      <PageHeader
        title="Decisions"
        subtitle="What has been decided across every situation, and what happens when the real items arrive"
      />

      <div className="flex items-end justify-between gap-8">
        <HeroMetric
          label="Validated, carrying forward"
          value={fmtMoney(totalValidatedValue, currency)}
          sub={`In ${currency}, summed across ${situations.length} situation${situations.length === 1 ? "" : "s"}`}
        />
        <MetricRow
          items={[
            { label: "Situations with decisions", value: fmtNum(situationsWithDecisions) },
            { label: "Saved scenarios", value: fmtNum(scenarios.length) },
            {
              label: "Still to decide",
              value: fmtNum(stillToDecide),
              tone: stillToDecide > 0 ? "warning" : "positive",
              sub: "Candidate items unreviewed or under review",
            },
          ]}
        />
      </div>

      <SectionRule label="Situations" />
      <SituationRows situations={situations} overridesBySituation={overridesBySituation} />

      <SectionRule label="Decisions recorded" />
      <DecisionsTable situations={situations} overridesBySituation={overridesBySituation} />

      <SectionRule label="Saved scenarios" />
      <SavedScenarios scenarios={scenarios} situations={situations} />

      <SectionRule label="When the real items arrive" />
      <ReconciliationPanel situations={situations} />
    </Page>
  );
}
