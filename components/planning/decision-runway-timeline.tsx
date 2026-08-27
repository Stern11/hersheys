"use client";

import type { DecisionDeadline } from "@/types/planning";
import { fmtDate } from "@/lib/utils/format";

const DEADLINE_LABEL: Record<DecisionDeadline["kind"], string> = {
  business_confirmation: "Business confirmation",
  sku_setup: "SKU / item setup",
  material_order_by: "Material order-by",
  supplier_capacity_decision: "Supplier capacity decision",
  production_start: "Production start",
  prebuild_window_open: "Prebuild window opens",
  sales_window_open: "Sales window opens",
  frozen_horizon: "Frozen horizon",
};

/**
 * Signature Visual: Decision Runway (communicates remaining optionality —
 * PRD-phase-2 §11C). Today, the decision deadlines, and the production vs.
 * sales windows on one shared, honest time axis — production timing and
 * sales timing are rendered as visually distinct bars so a planner never
 * conflates "when we sell" with "when we must build." When many deadlines
 * (e.g. per-material order-by dates) fall within days of each other, only
 * the earliest of each cluster is labeled — the rest still render as
 * unlabeled ticks so nothing is hidden, but the runway stays readable
 * rather than a pile of overlapping text.
 */
export function DecisionRunwayTimeline({
  today,
  deadlines,
  productionWindow,
  salesWindow,
}: {
  today: string;
  deadlines: DecisionDeadline[];
  productionWindow: { start: string; end: string };
  salesWindow: { start: string; end: string };
}) {
  const allDates = [today, productionWindow.start, productionWindow.end, salesWindow.start, salesWindow.end, ...deadlines.map((d) => d.date)];
  const times = allDates.map((d) => new Date(d).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;
  const pctNum = (iso: string) => ((new Date(iso).getTime() - min) / span) * 100;
  const pct = (iso: string) => `${pctNum(iso)}%`;

  const earliest = deadlines.find((d) => d.isEarliestConstraint);
  const weeksRemaining = earliest ? Math.round(((new Date(earliest.date).getTime() - new Date(today).getTime()) / (7 * 86_400_000)) * 10) / 10 : null;
  const isOverdue = weeksRemaining != null && weeksRemaining < 0;

  // Label only the earliest deadline in each ~10%-of-span cluster.
  const sorted = [...deadlines].sort((a, b) => (a.date < b.date ? -1 : 1));
  let lastLabeledPct = -Infinity;
  const withLabelFlag = sorted.map((d) => {
    const p = pctNum(d.date);
    const show = d.isEarliestConstraint || p - lastLabeledPct >= 11;
    if (show) lastLabeledPct = p;
    return { d, showLabel: show };
  });

  return (
    <div className="flex flex-col gap-4">
      {weeksRemaining != null && (
        <div className="flex items-baseline gap-2">
          <span className={`text-[20px] font-semibold tabular-nums ${isOverdue ? "text-[var(--risk-critical)]" : ""}`}>{Math.abs(weeksRemaining)}</span>
          <span className="text-[12px] text-[var(--text-secondary)]">
            weeks {isOverdue ? "past" : "until"} the earliest deadline ({earliest ? DEADLINE_LABEL[earliest.kind] : ""})
          </span>
        </div>
      )}

      <div className="relative pb-14 pt-6">
        {/* window bars */}
        <div className="relative mb-2 h-4">
          <span className="absolute -top-3.5 left-0 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Production window</span>
          <div className="absolute inset-y-0 rounded-[3px] bg-[var(--state-formal)] opacity-80" style={{ left: pct(productionWindow.start), right: `calc(100% - ${pct(productionWindow.end)})` }} />
        </div>
        <div className="relative mb-8 h-4">
          <span className="absolute -top-3.5 left-0 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Sales / event window</span>
          <div className="absolute inset-y-0 rounded-[3px] bg-[var(--state-scenario)] opacity-80" style={{ left: pct(salesWindow.start), right: `calc(100% - ${pct(salesWindow.end)})` }} />
        </div>

        {/* axis */}
        <div className="relative h-px bg-[var(--border)]">
          {/* today */}
          <div className="absolute top-0 -translate-x-1/2" style={{ left: pct(today) }}>
            <div className="h-2.5 w-px bg-[var(--text-primary)]" />
            <div className="mt-1 whitespace-nowrap text-[10.5px] font-semibold text-[var(--text-primary)]">Today</div>
          </div>

          {/* deadlines */}
          {withLabelFlag.map(({ d, showLabel }) => (
            <div key={d.id} className="absolute top-0 -translate-x-1/2" style={{ left: pct(d.date) }} title={`${DEADLINE_LABEL[d.kind]} — ${fmtDate(d.date)}`}>
              <div className={`h-2.5 w-px ${d.isEarliestConstraint ? "bg-[var(--risk-critical)]" : "bg-[var(--text-muted)]"}`} />
              {showLabel && (
                <div className={`mt-1 w-24 whitespace-normal text-center text-[10px] leading-tight ${d.isEarliestConstraint ? "font-semibold text-[var(--risk-critical)]" : "text-[var(--text-muted)]"}`}>
                  {DEADLINE_LABEL[d.kind]}
                  <div className="tabular-nums">{fmtDate(d.date)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
