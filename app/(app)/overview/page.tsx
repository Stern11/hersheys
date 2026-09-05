"use client";

/**
 * Overview (V2 §39).
 *
 * One question: what future planning situations need my attention? The most
 * urgent situation gets the headline; everything else is a row. Source-system
 * health deliberately does not appear here.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useDataset } from "@/components/dataset/dataset-provider";
import { HorizonChart } from "@/components/v2/horizon-chart";
import { StateBadge } from "@/components/v2/state-badge";
import { HeroMetric, MetricRow, Page, PageHeader, SectionRule, NotAvailable } from "@/components/v2/page";
import { fmtMoney, fmtUnits, fmtWeeks } from "@/lib/utils/format";
import type { PlanningSituation } from "@/types/situation";

export default function OverviewPage() {
  const { situations } = useDataset();
  const router = useRouter();

  const needsAttention = situations.filter((s) => s.state === "ACTION_NEEDED" || s.state === "MONITOR");
  const lead = needsAttention[0] ?? situations[0];

  if (!lead) {
    return (
      <Page>
        <PageHeader title="Overview" subtitle="What needs attention" />
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
        subtitle={
          needsAttention.length > 0
            ? `${needsAttention.length} of ${situations.length} situations need attention`
            : `${situations.length} situations tracked`
        }
      />

      <LeadSituation situation={lead} />

      <SectionRule label="Future load vs formal plan" />
      <HorizonChart
        situations={situations}
        activeId={lead.id}
        onSelect={(s) => router.push(`/workspace/${s.id}/reconcile`)}
      />

      {situations.length > 1 ? (
        <>
          <SectionRule label="All situations" />
          <div className="divide-y divide-[var(--border)]">
            {situations.map((situation) => (
              <SituationRow key={situation.id} situation={situation} />
            ))}
          </div>
        </>
      ) : null}
    </Page>
  );
}

function LeadSituation({ situation }: { situation: PlanningSituation }) {
  const { bridge, capacityExposure, materialExposure, runway } = situation;
  const earlyMaterials = materialExposure.rows.filter((r) => r.status !== "WAIT").length;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-7 py-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-[var(--text-muted)]">
              {situation.title}
            </span>
            <StateBadge state={situation.state} />
          </div>
          <HeroMetric
            label="Unresolved business"
            value={fmtMoney(bridge.unresolvedValue, bridge.currency)}
            tone={situation.state === "ACTION_NEEDED" ? "critical" : "neutral"}
            sub={`${fmtUnits(bridge.unresolvedUnits, true)} not represented at item level`}
          />
        </div>

        <Link
          href={`/workspace/${situation.id}/reconcile`}
          className="inline-flex flex-none items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-on-accent)] transition-opacity hover:opacity-90"
        >
          Continue planning
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="mt-7 border-t border-[var(--border)] pt-5">
        <MetricRow
          items={[
            {
              label: "Lines exposed",
              value: capacityExposure.available ? capacityExposure.exposedLineIds.length : "—",
              tone: capacityExposure.exposedLineIds.length > 0 ? "critical" : "neutral",
              sub: capacityExposure.available
                ? capacityExposure.peak
                  ? `Peak ${Math.round(capacityExposure.peak.effectiveUtilization * 100)}% on ${capacityExposure.peak.lineName}`
                  : "Within target"
                : "Capacity data not provided",
            },
            {
              label: "Materials to act on",
              value: materialExposure.available ? earlyMaterials : "—",
              sub: materialExposure.available
                ? `${materialExposure.planNowCount} plan now · ${materialExposure.waitCount} wait`
                : "Add BOM data",
            },
            {
              label: "Runway",
              value: runway.weeksOfRunway !== undefined ? fmtWeeks(runway.weeksOfRunway) : "—",
              tone: (runway.weeksOfRunway ?? 99) <= 8 ? "critical" : "neutral",
              sub: runway.earliest?.label,
            },
            {
              label: "Represented",
              value: `${Math.round(bridge.representedPct * 100)}%`,
              sub: `${fmtMoney(bridge.formalValue, bridge.currency)} of ${fmtMoney(bridge.expectedValue, bridge.currency)}`,
            },
          ]}
        />
      </div>
    </div>
  );
}

function SituationRow({ situation }: { situation: PlanningSituation }) {
  const { bridge, runway, capacityExposure } = situation;
  return (
    <Link
      href={`/workspace/${situation.id}/reconcile`}
      className="group grid grid-cols-[1fr_130px_130px_120px_20px] items-center gap-4 py-3.5 transition-colors hover:bg-[var(--interaction-hover)]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <StateBadge state={situation.state} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
            {situation.title}
          </div>
          <div className="truncate text-[11.5px] text-[var(--text-muted)]">{situation.businessScope}</div>
        </div>
      </div>
      <Cell label="Unresolved" value={fmtMoney(bridge.unresolvedValue, bridge.currency)} />
      <Cell
        label="Lines exposed"
        value={capacityExposure.available ? String(capacityExposure.exposedLineIds.length) : "—"}
      />
      <Cell
        label="Runway"
        value={runway.weeksOfRunway !== undefined ? fmtWeeks(runway.weeksOfRunway) : "—"}
      />
      <ArrowRight className="size-3.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[13px] font-medium tabular-nums text-[var(--text-primary)]">{value}</div>
      <div className="text-[11px] text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
