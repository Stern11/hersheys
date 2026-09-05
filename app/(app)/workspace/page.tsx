"use client";

/**
 * Planning Workspace (V2 §40).
 *
 * Situations, not a gap taxonomy. Each row is one story a planner would name
 * out loud — "Halloween 2027" — and opens straight into the flow.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDataset } from "@/components/dataset/dataset-provider";
import { StateBadge } from "@/components/v2/state-badge";
import { Page, PageHeader, NotAvailable } from "@/components/v2/page";
import { fmtMoney, fmtPct, fmtUnits, fmtWeeks } from "@/lib/utils/format";
import { fmtDateShort } from "@/lib/utils/format";

export default function WorkspacePage() {
  const { situations } = useDataset();

  return (
    <Page>
      <PageHeader title="Planning Workspace" subtitle="Future business that is not yet represented at item level" />

      {situations.length === 0 ? (
        <NotAvailable
          title="No planning situations"
          detail="Every business plan line is matched by the formal plan, or there is no business plan to compare against."
        />
      ) : (
        <div className="border-t border-[var(--border)]">
          {situations.map((situation) => {
            const { bridge, capacityExposure, materialExposure, runway } = situation;
            return (
              <Link
                key={situation.id}
                href={`/workspace/${situation.id}/reconcile`}
                className="group flex items-center gap-6 border-b border-[var(--border)] py-5 transition-colors hover:bg-[var(--interaction-hover)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                      {situation.title}
                    </span>
                    <StateBadge state={situation.state} />
                  </div>
                  <div className="mt-1 truncate text-[12.5px] text-[var(--text-muted)]">
                    {situation.businessScope}
                    {situation.productionWindow
                      ? ` · Production ${fmtDateShort(situation.productionWindow.start)} – ${fmtDateShort(situation.productionWindow.end)}`
                      : ""}
                  </div>
                </div>

                <Stat
                  value={fmtMoney(bridge.unresolvedValue, bridge.currency)}
                  label="Unresolved"
                  sub={fmtUnits(bridge.unresolvedUnits, true)}
                />
                <Stat value={fmtPct(bridge.representedPct)} label="Represented" />
                <Stat
                  value={capacityExposure.available ? String(capacityExposure.exposedLineIds.length) : "—"}
                  label="Lines exposed"
                />
                <Stat
                  value={materialExposure.available ? String(materialExposure.planNowCount) : "—"}
                  label="Plan now"
                />
                <Stat
                  value={runway.weeksOfRunway !== undefined ? fmtWeeks(runway.weeksOfRunway) : "—"}
                  label="Runway"
                  critical={(runway.weeksOfRunway ?? 99) <= 8}
                />

                <ArrowRight className="size-4 flex-none text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}

function Stat({
  value,
  label,
  sub,
  critical,
}: {
  value: string;
  label: string;
  sub?: string;
  critical?: boolean;
}) {
  return (
    <div className="w-[104px] flex-none text-right">
      <div
        className={
          critical
            ? "text-[15px] font-semibold tabular-nums text-[var(--risk-critical)]"
            : "text-[15px] font-semibold tabular-nums text-[var(--text-primary)]"
        }
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--text-muted)]">{label}</div>
      {sub ? <div className="text-[11px] text-[var(--text-muted)]">{sub}</div> : null}
    </div>
  );
}
