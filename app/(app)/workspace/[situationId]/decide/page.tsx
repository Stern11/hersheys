"use client";

/**
 * Decide (V2 §49-50).
 *
 * One question: what do I need to do now? The runway makes the first
 * irreversible date obvious; the action list is built from what the real
 * situation actually justifies, never a fixed menu of buttons.
 */

import { use, useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSituation } from "@/components/dataset/dataset-provider";
import { RunwayTimeline } from "@/components/v2/runway";
import { HeroMetric, Page, SectionRule } from "@/components/v2/page";
import { formatMonthLabel } from "@/lib/dataset/periods";
import { fmtDateShort, fmtMoney, fmtUnits, fmtWeeks } from "@/lib/utils/format";

interface Action {
  key: string;
  title: string;
  rationale: string;
  href: string;
  cta: string;
}

export default function DecidePage({ params }: { params: Promise<{ situationId: string }> }) {
  const { situationId } = use(params);
  const situation = useSituation(situationId);

  const actions = useMemo<Action[]>(() => {
    if (!situation) return [];
    const { capacityExposure, materialExposure, bridge, state } = situation;
    const list: Action[] = [];

    const peak = capacityExposure.peak;
    if (peak && capacityExposure.exposedLineIds.length > 0) {
      const alternate = capacityExposure.cells
        .filter((c) => c.period === peak.period && c.lineId !== peak.lineId)
        .find((c) => c.effectiveUtilization <= c.targetUtilizationPct * 0.85);
      if (alternate) {
        list.push({
          key: "shift",
          title: "Shift load to another line",
          rationale: `${peak.lineName} runs ${Math.round(peak.effectiveUtilization * 100)}% in ${formatMonthLabel(
            peak.period
          )} while ${alternate.lineName} runs ${Math.round(alternate.effectiveUtilization * 100)}%.`,
          href: `/scenario-lab?situation=${situationId}`,
          cta: "Open in Scenario Lab",
        });
      }
    }

    if (peak) {
      const periodIndex = capacityExposure.periods.indexOf(peak.period);
      if (periodIndex > 0) {
        list.push({
          key: "pull-forward",
          title: "Pull production forward",
          rationale: `${peak.lineName} peaks in ${formatMonthLabel(peak.period)} — earlier months have room to absorb some of that load.`,
          href: `/scenario-lab?situation=${situationId}`,
          cta: "Open in Scenario Lab",
        });
      }
    }

    list.push({
      key: "carry-forward",
      title: "Adjust what carries forward",
      rationale: `${fmtUnits(bridge.validatedUnits, true)} is currently validated as carrying forward.`,
      href: `/workspace/${situationId}/reconcile`,
      cta: "Open reconcile",
    });

    const planNow = materialExposure.available
      ? [...materialExposure.rows]
          .filter((r) => r.status === "PLAN_NOW")
          .sort((a, b) => a.decisionDate.localeCompare(b.decisionDate))[0]
      : undefined;
    if (planNow) {
      list.push({
        key: "commit-materials",
        title: "Commit long-lead materials",
        rationale: `${planNow.materialName} is decision-ready by ${fmtDateShort(planNow.decisionDate)}.`,
        href: `/workspace/${situationId}/supply`,
        cta: "Open supply",
      });
    }

    if (bridge.unexplainedValue > 0) {
      list.push({
        key: "firmer-plan",
        title: "Request a firmer plan",
        rationale: `${fmtMoney(bridge.unexplainedValue, bridge.currency)} of the unresolved amount has no prior item explaining it.`,
        href: `/workspace/${situationId}/reconcile`,
        cta: "Open reconcile",
      });
    }

    if (state === "MONITOR" || state === "FORMING") {
      list.push({
        key: "monitor",
        title: "Keep monitoring",
        rationale: "Nothing here requires action yet — revisit as more of the plan formalizes.",
        href: "/workspace",
        cta: "Back to workspace",
      });
    }

    return list;
  }, [situation, situationId]);

  if (!situation) return <Page>{null}</Page>;

  const { runway } = situation;

  return (
    <Page>
      <div className="pt-7">
        <HeroMetric
          label="Runway remaining"
          value={runway.weeksOfRunway !== undefined ? fmtWeeks(runway.weeksOfRunway) : "—"}
          tone={
            runway.weeksOfRunway === undefined
              ? "muted"
              : runway.weeksOfRunway <= 8
                ? "critical"
                : "positive"
          }
          sub={
            runway.earliest
              ? `${runway.earliest.label} · ${fmtDateShort(runway.earliest.date)}`
              : "No dated decision found"
          }
        />
      </div>

      <SectionRule label="Decision runway" />
      <RunwayTimeline runway={runway} />

      <SectionRule label="What you can do now" />
      {actions.length > 0 ? (
        <div>
          {actions.map((action) => (
            <div
              key={action.key}
              className="flex items-center justify-between gap-6 border-b border-[var(--border)] py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">{action.title}</p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{action.rationale}</p>
              </div>
              <Link
                href={action.href}
                className="inline-flex flex-none items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--interaction-hover)]"
              >
                {action.cta}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">Nothing here currently justifies an action.</p>
      )}

      <SectionRule label="Evidence" />
      <div className="grid grid-cols-2 gap-x-10 gap-y-2.5">
        {situation.evidence.map((row) => (
          <div key={row.id} className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-1.5">
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-[var(--text-primary)]">{row.label}</div>
              <div className="truncate text-[11.5px] text-[var(--text-muted)]">
                {row.source}
                {row.detail ? ` · ${row.detail}` : ""}
              </div>
            </div>
            <div className="flex-none text-[12.5px] tabular-nums text-[var(--text-secondary)]">{row.value}</div>
          </div>
        ))}
      </div>
    </Page>
  );
}
