"use client";

/**
 * Check Capacity (V2 §45-48).
 *
 * One question: where does the unresolved business hit? The matrix is the
 * whole answer — a line can look safe purely because the demand behind it is
 * missing, and the decomposition makes that visible cell by cell.
 */

import { use, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSituation } from "@/components/dataset/dataset-provider";
import { CapacityCellDetail, CapacityMatrix } from "@/components/v2/capacity-matrix";
import { HeroMetric, Label, MetricRow, NotAvailable, Page, SectionRule } from "@/components/v2/page";
import type { CapacityCell } from "@/types/situation";
import { formatMonthLabel } from "@/lib/dataset/periods";
import { fmtHours, fmtPct } from "@/lib/utils/format";

export default function CapacityPage({ params }: { params: Promise<{ situationId: string }> }) {
  const { situationId } = use(params);
  const situation = useSituation(situationId);
  const [selected, setSelected] = useState<CapacityCell | null>(situation?.capacityExposure.peak ?? null);

  if (!situation) return <Page>{null}</Page>;

  const { capacityExposure } = situation;

  if (!capacityExposure.available) {
    return (
      <Page>
        <SectionRule label="Effective utilisation by line and month" />
        <NotAvailable
          title="Capacity exposure cannot be calculated"
          detail={capacityExposure.unavailableReason ?? "The required line and calendar data was not provided."}
        />
      </Page>
    );
  }

  const cell = selected;
  const peak = capacityExposure.peak;

  return (
    <Page>
      <div className="flex items-end justify-between gap-8 pt-7">
        {peak ? (
          <HeroMetric
            label="Peak effective utilisation"
            value={fmtPct(peak.effectiveUtilization)}
            tone={peak.effectiveUtilization > peak.targetUtilizationPct ? "critical" : "positive"}
            sub={`${peak.lineName} in ${formatMonthLabel(peak.period)}`}
          />
        ) : (
          <HeroMetric label="Peak effective utilisation" value="—" tone="muted" sub="No exposed line" />
        )}
        <MetricRow
          items={[
            { label: "Lines exposed", value: capacityExposure.exposedLineIds.length, tone: "neutral" },
            {
              label: "Formal at peak",
              value: peak ? fmtPct(peak.formalUtilization) : "—",
              tone: "muted",
            },
            {
              label: "Unresolved hours at peak",
              value: peak ? fmtHours(peak.unresolvedHours) : "—",
              tone: "neutral",
            },
          ]}
        />
      </div>

      <SectionRule label="Effective utilisation by line and month" />
      <CapacityMatrix exposure={capacityExposure} selected={cell} onSelect={setSelected} />

      <SectionRule
        label={cell ? `Decomposition · ${cell.lineName} · ${formatMonthLabel(cell.period)}` : "Decomposition"}
      />
      {cell ? (
        <>
          <CapacityCellDetail cell={cell} />
          {cell.effectiveUtilization > cell.formalUtilization ? (
            <p className="mt-4 text-[12.5px] text-[var(--text-muted)]">
              Formal load reads {fmtPct(cell.formalUtilization)}. Including unresolved business it is{" "}
              {fmtPct(cell.effectiveUtilization)}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">Select a cell in the matrix above to see its build-up.</p>
      )}

      <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-5">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          <Label className="mb-1">Next</Label>
          What to do about it
        </p>
        <Link
          href={`/workspace/${situationId}/decide`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-on-accent)] transition-opacity hover:opacity-90"
        >
          Decide
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Page>
  );
}
