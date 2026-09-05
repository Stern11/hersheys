"use client";

/**
 * Plan Supply (V2 §44).
 *
 * One question: what can already be planned? A full BOM is never required —
 * this page's job is to separate the components stable enough to commit from
 * the ones that still have to wait, without ever implying the uncertain ones
 * can be ordered too (V2 §15.6).
 *
 * Cards carry only what is needed to triage; the derivation, the range, and
 * the timing basis sit behind a click (V2 §30.2, §60, §61) in an inline
 * detail panel below the grid, mirroring how the Capacity page reveals a
 * cell's build-up only once it is selected.
 */

import { use, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSituation } from "@/components/dataset/dataset-provider";
import { MaterialCardGrid } from "@/components/v2/material-card";
import { MaterialDetail } from "@/components/v2/material-detail";
import { HeroMetric, Label, MetricRow, NotAvailable, Page, SectionRule } from "@/components/v2/page";
import type { MaterialExposureRow } from "@/types/situation";
import { fmtDateShort, fmtWeeks } from "@/lib/utils/format";

export default function SupplyPage({ params }: { params: Promise<{ situationId: string }> }) {
  const { situationId } = use(params);
  const situation = useSituation(situationId);
  const [selected, setSelected] = useState<MaterialExposureRow | null>(
    situation?.materialExposure.rows[0] ?? null
  );

  if (!situation) return <Page>{null}</Page>;

  const { materialExposure } = situation;

  if (!materialExposure.available) {
    return (
      <Page>
        <SectionRule label="Material readiness" />
        <NotAvailable
          title="Material readiness cannot be calculated"
          detail={materialExposure.unavailableReason ?? "The required BOM and lead-time data was not provided."}
        />
      </Page>
    );
  }

  const rows = materialExposure.rows;
  const waitRows = rows.filter((r) => r.status === "WAIT");
  const row = selected;

  return (
    <Page>
      <div className="flex items-end justify-between gap-8 pt-7">
        <HeroMetric
          label="Can be planned now"
          value={materialExposure.planNowCount}
          tone={materialExposure.planNowCount > 0 ? "positive" : "muted"}
          sub={
            materialExposure.earliestDecisionDate
              ? `Earliest decision ${fmtDateShort(materialExposure.earliestDecisionDate)}`
              : "No decision date is pending"
          }
        />
        <MetricRow
          items={[
            { label: "Review", value: materialExposure.reviewCount, tone: "warning" },
            { label: "Wait", value: materialExposure.waitCount, tone: "muted" },
            {
              label: "Earliest decision",
              value: materialExposure.earliestDecisionDate ? fmtDateShort(materialExposure.earliestDecisionDate) : "—",
              sub: materialExposure.earliestDecisionDate
                ? fmtWeeks(
                    rows.find((r) => r.decisionDate === materialExposure.earliestDecisionDate)?.weeksToDecision ?? 0
                  )
                : undefined,
              tone: "neutral",
            },
          ]}
        />
      </div>

      <MaterialCardGrid rows={rows} selectedId={row?.materialId} onSelect={setSelected} />

      <SectionRule label={row ? `Detail · ${row.materialName}` : "Detail"} />
      {row ? (
        <MaterialDetail row={row} situationId={situationId} />
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">Select a material above to see its basis.</p>
      )}

      <p className="mt-8 text-[12.5px] text-[var(--text-muted)]">
        {materialExposure.planNowCount} material{materialExposure.planNowCount === 1 ? "" : "s"} can be committed
        now.{" "}
        {waitRows.length > 0
          ? `${waitRows.length} wait${waitRows.length === 1 ? "s" : ""} on decisions that have not been made.`
          : "None are waiting on an unresolved decision."}
      </p>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-5">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          <Label className="mb-1">Next</Label>
          Where this load lands on the manufacturing lines
        </p>
        <Link
          href={`/workspace/${situationId}/capacity`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-on-accent)] transition-opacity hover:opacity-90"
        >
          Check capacity
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Page>
  );
}
