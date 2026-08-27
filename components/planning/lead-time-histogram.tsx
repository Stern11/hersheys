"use client";

import { anchorTransform, labelAnchor } from "@/lib/charts/axis";
import { buildHistogramModel, type HistogramMarkerInput } from "@/lib/charts/histogram";

/**
 * Lead-time distribution (PRD-phase-2 §23) — the raw spread of elapsed
 * PO-to-goods-receipt days, with the reference statistics overlaid, so a
 * planner can see not just the summary numbers but how much real variance
 * sits behind them.
 *
 * All bucketing and positioning comes from `lib/charts/histogram.ts`, which is
 * unit tested. Fixed here relative to the previous version:
 *   - there were NO axes: bars were bare flex children with no count scale and
 *     the day domain had no ticks, so a bar's height and a marker's position
 *     were both unreadable as values. Both axes are now drawn and labelled.
 *   - marker captions mixed `position: relative` with `left: 50%`, so a marker
 *     at the edge of the domain pushed its own text out of the plot box.
 *     Labels are now anchored by `labelAnchor()`.
 *   - the chart now names the reference lines it actually drew, in a legend,
 *     instead of leaving the caller's section caption to promise an overlay
 *     the chart may not have been given.
 */
export function LeadTimeHistogram({
  values,
  markers,
}: {
  values: number[];
  markers: HistogramMarkerInput[];
}) {
  const model = buildHistogramModel(values, markers);
  const plotHeight = 128;
  const labelBand = 16;

  if (model.sampleCount === 0) {
    return <div className="flex h-32 items-center justify-center text-[12.5px] text-[var(--text-muted)]">No receipts in the selected sample.</div>;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {/* marker captions live in their own band above the plot so they can
          never overlap the bars */}
      <div className="flex w-full min-w-0">
        <div className="w-7 flex-none" />
        <div className="relative min-w-0 flex-1" style={{ height: labelBand }}>
          {model.markers.map((m) => (
            <span
              key={m.label}
              className="absolute bottom-0 block whitespace-nowrap text-[10px] font-medium tabular-nums"
              style={{ left: `${m.pct}%`, transform: anchorTransform(labelAnchor(m.pct)), color: `var(${m.token})` }}
            >
              {m.label} {Math.round(m.value)}d
            </span>
          ))}
        </div>
      </div>

      <div className="flex w-full min-w-0">
        {/* count (y) axis */}
        <div className="relative w-7 flex-none" style={{ height: plotHeight }}>
          {model.countAxis.ticks.map((t) => (
            <span
              key={t}
              className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-[var(--text-muted)]"
              style={{ top: `${100 - (t / model.countAxis.max) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1 border-b border-l border-[var(--border-strong)]" style={{ height: plotHeight }}>
          {/* count gridlines */}
          {model.countAxis.ticks.slice(1).map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-[var(--border)]" style={{ top: `${100 - (t / model.countAxis.max) * 100}%` }} />
          ))}

          {/* buckets — equal width, so bucket boundaries stay linear in the
              same day domain the markers are positioned in */}
          <div className="absolute inset-0 flex items-end">
            {model.buckets.map((b, i) => (
              <div
                key={i}
                className="flex h-full flex-1 items-end border-r border-[var(--surface)]"
                title={`${Math.round(b.from)}-${Math.round(b.to)}d: ${b.count} receipt${b.count === 1 ? "" : "s"}`}
              >
                <div
                  className="w-full rounded-t-[2px] bg-[var(--state-historical)]"
                  style={{ height: `${(b.count / model.countAxis.max) * 100}%`, opacity: 0.85 }}
                />
              </div>
            ))}
          </div>

          {/* Reference markers. The Median marker carries `--state-historical`
              — the same token as the bars it crosses — so without a separating
              ring it vanished exactly where it matters, inside the tall
              buckets. A 1px `--surface` halo keeps every marker readable over
              a bar in both themes without recolouring it (the token is the
              correct one: it IS the historical series' statistic). */}
          {model.markers.map((m) => (
            <div
              key={m.label}
              className="absolute inset-y-0 w-[1.5px] -translate-x-1/2"
              style={{ left: `${m.pct}%`, background: `var(${m.token})`, boxShadow: "0 0 0 1px var(--surface)" }}
              title={`${m.label} ${Math.round(m.value)}d`}
            />
          ))}
        </div>
      </div>

      {/* day (x) axis */}
      <div className="flex w-full min-w-0">
        <div className="w-7 flex-none" />
        <div className="relative h-4 min-w-0 flex-1">
          {model.valueTicks.map((t) => {
            const pct = ((t - model.min) / (model.max - model.min)) * 100;
            return (
              <span
                key={t}
                className="absolute top-0 block whitespace-nowrap text-[10px] tabular-nums text-[var(--text-muted)]"
                style={{ left: `${pct}%`, transform: anchorTransform(labelAnchor(pct)) }}
              >
                {t}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-[10.5px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-[1px] bg-[var(--state-historical)]" />
          Receipts per bucket
        </span>
        {model.markers.map((m) => (
          <span key={m.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-[1.5px]" style={{ background: `var(${m.token})` }} />
            {m.label}
          </span>
        ))}
      </div>

      <p className="pl-7 text-[11px] text-[var(--text-muted)]">
        {model.sampleCount} receipts, {Math.round(model.min)}–{Math.round(model.max)} days elapsed. X axis: days elapsed. Y axis: receipts per bucket.
      </p>
    </div>
  );
}
