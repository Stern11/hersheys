/**
 * What the plan looks like before the absent SKUs are counted, and after
 * (V2 §39, feedback request: "show the final plan before/after absence
 * inclusion for senior leadership").
 *
 * A rollup of numbers already derived on this page — demand, factory hours,
 * material components that start moving — not a fabricated MRP/PO object.
 * Same before→after tile shape as the pull-forward chart in Scenario Lab, so
 * the two surfaces read as one visual language.
 */

import { Label } from "@/components/v2/page";
import { fmtHours, fmtMoney } from "@/lib/utils/format";
import type { PortfolioBeforeAfter } from "@/lib/situations/portfolio";

export function BeforeAfterPlan({ beforeAfter }: { beforeAfter: PortfolioBeforeAfter }) {
  const { demandValueBefore, demandValueAfter, hoursBefore, hoursAfter, materialPlanNowAfter, currency } =
    beforeAfter;

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
      <Tile
        heading="Demand plan"
        before={fmtMoney(demandValueBefore, currency)}
        after={fmtMoney(demandValueAfter, currency)}
        caption="Formal only, vs. formal plus validated carry-forward"
        changed={demandValueAfter > demandValueBefore}
      />
      <Tile
        heading="Factory hours"
        before={fmtHours(hoursBefore)}
        after={fmtHours(hoursAfter)}
        caption="Formal load, vs. formal plus unresolved load"
        changed={hoursAfter > hoursBefore}
      />
      <Tile
        heading="Materials moving"
        before="0 components"
        after={`${materialPlanNowAfter} component${materialPlanNowAfter === 1 ? "" : "s"}`}
        caption="Ordered today, vs. ready to order once these SKUs count"
        changed={materialPlanNowAfter > 0}
      />
    </div>
  );
}

function Tile({
  heading,
  before,
  after,
  caption,
  changed,
}: {
  heading: string;
  before: string;
  after: string;
  caption: string;
  changed: boolean;
}) {
  return (
    <div className="bg-[var(--surface)] px-5 py-4">
      <Label>{heading}</Label>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[18px] font-medium tabular-nums text-[var(--text-muted)]">{before}</span>
        <span className="text-[14px] text-[var(--text-muted)]">→</span>
        <span
          className={
            changed
              ? "text-[22px] font-semibold tabular-nums text-[var(--risk-critical)]"
              : "text-[22px] font-semibold tabular-nums text-[var(--text-primary)]"
          }
        >
          {after}
        </span>
      </div>
      <div className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-muted)]">{caption}</div>
    </div>
  );
}
