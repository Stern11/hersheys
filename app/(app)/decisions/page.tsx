"use client";

/**
 * Decisions (V2 §57, PRD §20).
 *
 * One question: across every programme, what do I have to decide next, and
 * what have I already committed to?
 *
 * A programme's Decide step answers the first half for one programme. This is
 * the same calendar with every programme on it — a planner running Halloween
 * and Holiday at once needs one list, not two — followed by the record of
 * what they have released, committed and chosen. Everything is read from the
 * same overrides and scenario stores the rest of the app reads; the lists
 * themselves come from `lib/situations/decisions.ts`.
 */

import { useMemo, useState } from "react";
import { useDataset } from "@/components/dataset/dataset-provider";
import { useDatasetStore } from "@/stores/dataset-store";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { HeroMetric, MetricRow, NotAvailable, Page, PageHeader, SectionRule } from "@/components/shared/page";
import { DecisionRow } from "@/components/decisions/decision-row";
import { CommittedLog } from "@/components/decisions/committed-log";
import { DecisionsTable } from "@/components/decisions/decisions-table";
import { SavedScenarios } from "@/components/decisions/saved-scenarios";
import {
  committedLog,
  releaseFor,
  upcomingDecisions,
  type ProgrammeDecision,
} from "@/lib/situations/decisions";
import { countAdjustments } from "@/lib/situations/scenario";
import { fmtDateShort, fmtNum, fmtWeeks } from "@/lib/utils/format";

/** Enough to see the next month or two without the list becoming the page. */
const PREVIEW_ROWS = 8;

const isDueNow = (d: ProgrammeDecision) => d.urgency === "overdue" || d.urgency === "urgent";

export default function DecisionsPage() {
  const { situations } = useDataset();
  const overridesBySituation = useDatasetStore((s) => s.overridesBySituation);
  const releaseMaterial = useDatasetStore((s) => s.releaseMaterial);
  const scenariosById = useSituationScenarioStore((s) => s.scenarios);
  const [showAll, setShowAll] = useState(false);

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

  const upcoming = useMemo(
    () => upcomingDecisions(situations, overridesBySituation),
    [situations, overridesBySituation]
  );
  const committed = useMemo(
    () => committedLog(situations, overridesBySituation),
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

  const dueNow = upcoming.filter(isDueNow);
  const overdue = upcoming.filter((d) => d.urgency === "overdue").length;
  const dueSoon = upcoming.filter((d) => d.urgency === "soon").length;
  // Soonest first, undated last — so this is the one the planner meets first.
  const next = upcoming[0];

  const onRelease = (decision: ProgrammeDecision) => {
    const situation = situations.find((s) => s.id === decision.situationId);
    if (!situation) return;
    // Dataset time, never wall-clock.
    const release = releaseFor(decision, situation.calculatedAt);
    if (release) releaseMaterial(decision.situationId, release);
  };

  const visible = showAll ? upcoming : upcoming.slice(0, PREVIEW_ROWS);

  return (
    <Page>
      <PageHeader
        title="Decisions"
        subtitle="What is due next across every programme, and what you have already committed"
      />

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
        {/* A count of "due this month" read 0 whenever the nearest date was
            further out, which told the planner nothing. How long until the
            first decision, and what it is, is true and useful at any distance. */}
        <HeroMetric
          label="Next decision"
          value={
            !next
              ? "None open"
              : next.urgency === "overdue"
                ? "Overdue"
                : next.weeksAway === undefined
                  ? "Undated"
                  : `${fmtWeeks(next.weeksAway)} left`
          }
          tone={next?.urgency === "overdue" ? "critical" : next?.urgency === "urgent" ? "warning" : "neutral"}
          sub={
            next
              ? `${next.title} · ${next.situationTitle}${next.date ? ` · by ${fmtDateShort(next.date)}` : ""}`
              : "No programme has a dated decision still open"
          }
        />
        <MetricRow
          items={[
            {
              label: "Due in 4 weeks",
              value: fmtNum(dueNow.length),
              tone: overdue > 0 ? "critical" : dueNow.length > 0 ? "warning" : "neutral",
              sub: overdue > 0 ? `${fmtNum(overdue)} already past` : undefined,
            },
            { label: "Due in 5–12 weeks", value: fmtNum(dueSoon) },
            {
              label: "Committed",
              value: fmtNum(committed.length),
              sub: "Orders released, volumes locked",
            },
            {
              label: "Products undecided",
              value: fmtNum(stillToDecide),
              tone: stillToDecide > 0 ? "warning" : "positive",
              sub: "They carry no load yet",
            },
          ]}
        />
      </div>

      <SectionRule
        label={`Coming up · ${upcoming.length}`}
        action={
          upcoming.length > PREVIEW_ROWS ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              {showAll ? "Show fewer" : `Show all ${upcoming.length}`}
            </button>
          ) : undefined
        }
      />
      {upcoming.length > 0 ? (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {visible.map((decision) => (
            <DecisionRow
              key={decision.key}
              decision={decision}
              context={decision.situationTitle}
              onRelease={() => onRelease(decision)}
            />
          ))}
        </div>
      ) : (
        <NotAvailable
          title="Nothing is waiting on you"
          detail="No programme has a dated decision that is still open."
        />
      )}

      <SectionRule label={`Committed · ${committed.length}`} />
      <CommittedLog entries={committed} />

      <SectionRule label="Products you have decided" />
      <DecisionsTable situations={situations} overridesBySituation={overridesBySituation} />

      <SectionRule label={`Saved scenarios · ${scenarios.length}`} />
      <SavedScenarios scenarios={scenarios} situations={situations} />
    </Page>
  );
}
