"use client";

/**
 * Overview (V2 §39).
 *
 * One question: how much of my future business has no product in the plan, and
 * what does that do to me?
 *
 * The page used to lead with one situation's four metrics and then repeat the
 * same four on every row below it, which answered "tell me about this one
 * thing" on a page whose only job is "tell me about everything". It now opens
 * on the count of unrepresented products and reads out the consequence in the
 * three currencies a planner actually works in — money, factory hours, and
 * time left to order.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { useDataset } from "@/components/dataset/dataset-provider";
import { StateBadge } from "@/components/v2/state-badge";
import { Label, Page, PageHeader, SectionRule, NotAvailable } from "@/components/v2/page";
import { summarizePortfolio, type ExposedLine, type PortfolioSummary } from "@/lib/situations/portfolio";
import { WelcomePanel } from "@/components/v2/welcome-panel";
import { formatMonthLabel } from "@/lib/dataset/periods";
import { cn } from "@/lib/utils/cn";
import { fmtDateShort, fmtHours, fmtMoney, fmtPct, fmtUnits, fmtWeeks } from "@/lib/utils/format";
import type { PlanningSituation } from "@/types/situation";

export default function OverviewPage() {
  const { situations } = useDataset();
  const summary = useMemo(() => summarizePortfolio(situations), [situations]);

  if (situations.length === 0) {
    return (
      <Page>
        <PageHeader title="Overview" subtitle="What is not represented, and what it costs" />
        <NotAvailable
          title="No planning situations found"
          detail="Your business plan and formal plan reconcile, or there is no business plan data to compare against."
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Overview"
        subtitle={`${summary.situationCount} programme${summary.situationCount === 1 ? "" : "s"} in the planning horizon`}
      />

      <WelcomePanel summary={summary} firstSituationId={situations[0]?.id} />

      <Headline summary={summary} />

      <SectionRule label="What that does to the plan" />
      <Consequences summary={summary} />

      {summary.exposedLines.length > 0 ? (
        <>
          <SectionRule label="Lines this pushes past target" />
          <div className="flex flex-col gap-2">
            {summary.exposedLines.map((line) => (
              <ExposedLineRow key={`${line.lineId}-${line.period}`} line={line} />
            ))}
          </div>
        </>
      ) : null}

      <SectionRule label="Programmes" />
      <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {situations.map((situation) => (
          <SituationRow key={situation.id} situation={situation} />
        ))}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Headline                                                            */
/* ------------------------------------------------------------------ */

function Headline({ summary }: { summary: PortfolioSummary }) {
  const {
    unrepresentedSkuCount,
    carryingForwardSkuCount,
    undecidedSkuCount,
    unresolvedValue,
    currency,
  } = summary;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-7 py-6">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <Label>Products with nothing in the plan</Label>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className={cn(
                "text-[52px] font-semibold leading-none tracking-[-0.025em] tabular-nums",
                unrepresentedSkuCount > 0 ? "text-[var(--risk-critical)]" : "text-[var(--risk-positive)]"
              )}
            >
              {unrepresentedSkuCount}
            </span>
            <span className="text-[15px] text-[var(--text-secondary)]">
              of {summary.totalCandidateCount} prior products
            </span>
          </div>
          <div className="mt-2.5 text-[13px] text-[var(--text-secondary)]">
            {fmtMoney(unresolvedValue, currency)} of expected business has no product carrying it
          </div>
        </div>

        <div className="flex gap-8">
          <Tally
            value={carryingForwardSkuCount}
            label="Carrying forward"
            sub="bear load in the plan"
            tone="validated"
          />
          <Tally
            value={undecidedSkuCount}
            label="Still to decide"
            sub={undecidedSkuCount > 0 ? "count as nothing until decided" : "nothing outstanding"}
            tone={undecidedSkuCount > 0 ? "warning" : "muted"}
          />
        </div>
      </div>
    </div>
  );
}

function Tally({
  value,
  label,
  sub,
  tone,
}: {
  value: number;
  label: string;
  sub: string;
  tone: "validated" | "warning" | "muted";
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        className={cn(
          "mt-1 text-[28px] font-semibold leading-none tabular-nums",
          tone === "validated" && "text-[var(--state-validated)]",
          tone === "warning" && "text-[var(--risk-warning)]",
          tone === "muted" && "text-[var(--text-secondary)]"
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-[var(--text-muted)]">{sub}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Consequences                                                        */
/* ------------------------------------------------------------------ */

function Consequences({ summary }: { summary: PortfolioSummary }) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
      <Consequence
        heading="Sales"
        question="How much of the expected business is represented?"
        value={fmtPct(summary.representedPct)}
        tone={summary.representedPct >= 0.95 ? "positive" : summary.representedPct >= 0.8 ? "warning" : "critical"}
        detail={`${fmtMoney(summary.formalValue, summary.currency)} planned of ${fmtMoney(
          summary.expectedValue,
          summary.currency
        )} expected`}
        footnote={`${fmtUnits(summary.validatedUnits, true)} accepted as carrying forward`}
      />

      <Consequence
        heading="Manufacturing"
        question="How many hours does that add to the factory?"
        value={summary.capacityUnavailable ? "—" : fmtHours(summary.unresolvedHours)}
        tone={summary.exposedLines.length > 0 ? "critical" : "neutral"}
        detail={
          summary.capacityUnavailable
            ? "Add line capacity and item-line mapping to calculate this."
            : `on top of ${fmtHours(summary.formalHours)} already planned, across ${
                summary.linesCarryingLoadCount
              } line${summary.linesCarryingLoadCount === 1 ? "" : "s"}`
        }
        footnote={
          summary.capacityUnavailable
            ? undefined
            : summary.exposedLines.length > 0
              ? `${summary.exposedLines.length} line${
                  summary.exposedLines.length === 1 ? "" : "s"
                } go past target`
              : "every line stays inside target"
        }
      />

      <Consequence
        heading="Time"
        question="When does the first decision stop being reversible?"
        value={
          summary.nearestDeadline ? fmtWeeks(summary.nearestDeadline.weeksAway) : "—"
        }
        tone={
          !summary.nearestDeadline
            ? "neutral"
            : summary.nearestDeadline.weeksAway <= 0
              ? "critical"
              : summary.nearestDeadline.weeksAway <= 8
                ? "warning"
                : "neutral"
        }
        detail={
          summary.nearestDeadline
            ? `${summary.nearestDeadline.label} · ${fmtDateShort(summary.nearestDeadline.date)} · ${
                summary.nearestDeadline.situationTitle
              }`
            : "No decision date is pending."
        }
        footnote={
          summary.materialsUnavailable
            ? "Add BOM data to see material deadlines."
            : `${summary.planNowCount} component${
                summary.planNowCount === 1 ? "" : "s"
              } can be ordered now · ${summary.waitCount} must wait`
        }
      />
    </div>
  );
}

function Consequence({
  heading,
  question,
  value,
  detail,
  footnote,
  tone,
}: {
  heading: string;
  question: string;
  value: string;
  detail: string;
  footnote?: string;
  tone: "positive" | "warning" | "critical" | "neutral";
}) {
  return (
    <div className="bg-[var(--surface)] px-5 py-4">
      <Label>{heading}</Label>
      <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-muted)]">{question}</div>
      <div
        className={cn(
          "mt-3 text-[30px] font-semibold leading-none tabular-nums",
          tone === "positive" && "text-[var(--risk-positive)]",
          tone === "warning" && "text-[var(--risk-warning)]",
          tone === "critical" && "text-[var(--risk-critical)]",
          tone === "neutral" && "text-[var(--text-primary)]"
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-[12px] leading-snug text-[var(--text-secondary)]">{detail}</div>
      {footnote ? (
        <div className="mt-1 text-[11.5px] leading-snug text-[var(--text-muted)]">{footnote}</div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exposed lines                                                       */
/* ------------------------------------------------------------------ */

function ExposedLineRow({ line }: { line: ExposedLine }) {
  const formalPct = Math.min(100, line.formalUtilization * 100);
  const unresolvedPct = Math.min(
    100 - formalPct,
    Math.max(0, (line.effectiveUtilization - line.formalUtilization) * 100)
  );
  const targetPct = Math.min(100, line.targetUtilizationPct * 100);

  return (
    <Link
      href={`/workspace/${line.situationId}/reconcile`}
      className="block rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--interaction-hover)]"
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
          {line.lineName}
          <span className="ml-2 font-normal text-[var(--text-muted)]">
            {formatMonthLabel(line.period)}
            {line.monthsOverTarget > 1 ? ` +${line.monthsOverTarget - 1} more month${line.monthsOverTarget > 2 ? "s" : ""}` : ""}
          </span>
        </span>
        <span className="flex-none text-[13px] tabular-nums">
          <span className="text-[var(--text-muted)]">{fmtPct(line.formalUtilization)} formal →</span>{" "}
          <span className="font-semibold text-[var(--risk-critical)]">
            {fmtPct(line.effectiveUtilization)}
          </span>
        </span>
      </div>

      <div className="relative mt-2 h-[14px] rounded-[3px] bg-[var(--chart-track)]">
        <div
          className="absolute inset-y-0 left-0 rounded-l-[3px] bg-[var(--state-formal)]"
          style={{ width: `${formalPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-[var(--risk-critical)]"
          style={{ left: `${formalPct}%`, width: `${unresolvedPct}%` }}
        />
        <div
          className="absolute inset-y-[-2px] w-px border-l border-dashed border-[var(--text-muted)]"
          style={{ left: `${targetPct}%` }}
        />
      </div>

      <div className="mt-1.5 truncate text-[11.5px] text-[var(--text-muted)]">
        {fmtHours(line.unresolvedHours)} unresolved
        {line.drivers.length > 0 ? (
          <>
            {" "}
            · driven by{" "}
            <span className="text-[var(--text-secondary)]">
              {line.drivers.map((d) => d.itemName).join(", ")}
            </span>
          </>
        ) : null}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Programme rows                                                      */
/* ------------------------------------------------------------------ */

function SituationRow({ situation }: { situation: PlanningSituation }) {
  const { bridge, runway, candidateItems } = situation;
  const unrepresented = candidateItems.filter((c) => c.match.matchedItemId === undefined).length;
  const undecided = candidateItems.filter(
    (c) => c.disposition === "unreviewed" || c.disposition === "under_review"
  ).length;

  return (
    <Link
      href={`/workspace/${situation.id}/reconcile`}
      className="group grid grid-cols-[1fr_auto] items-center gap-6 py-3.5 transition-colors hover:bg-[var(--interaction-hover)]"
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <StateBadge state={situation.state} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
            {situation.title}
          </div>
          <div className="truncate text-[11.5px] text-[var(--text-muted)]">
            {unrepresented} product{unrepresented === 1 ? "" : "s"} unrepresented
            {undecided > 0 ? ` · ${undecided} still to decide` : ""}
            {situation.productionWindow
              ? ` · builds from ${fmtDateShort(situation.productionWindow.start)}`
              : ""}
          </div>
        </div>
      </div>

      <div className="flex flex-none items-center gap-7">
        <Cell label="Unresolved" value={fmtMoney(bridge.unresolvedValue, bridge.currency)} />
        <Cell
          label="First deadline"
          value={runway.weeksOfRunway !== undefined ? fmtWeeks(runway.weeksOfRunway) : "—"}
          critical={(runway.weeksOfRunway ?? 99) <= 8}
        />
        <ArrowRight className="size-3.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function Cell({ label, value, critical }: { label: string; value: string; critical?: boolean }) {
  return (
    <div className="text-right">
      <div
        className={cn(
          "text-[13px] font-medium tabular-nums",
          critical ? "text-[var(--risk-critical)]" : "text-[var(--text-primary)]"
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
