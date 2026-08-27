"use client";

import { fmtCompact } from "@/lib/utils/format";
import { buildGapChartModel, type GapChartRowInput } from "@/lib/charts/gap-chart-model";

export type PlanningGapChartRow = GapChartRowInput;

/**
 * Signature Visual 1 (PRD §23.2): historical actuals, the expected envelope
 * (range + P50 point), and the current formal plan as a reference line — so a
 * planner can see "how much appears missing, and is that normal for this point
 * in the cycle" in one shape. Hand-built SVG/CSS: AG Charts' community
 * `range-bar` series did not render the expected band reliably in this
 * environment (silently empty column, no console error), so — matching
 * EffectiveCapacityChart's precedent — this uses direct positioning for
 * guaranteed, exactly-controlled rendering of the uncertainty band.
 *
 * Geometry comes from `lib/charts/gap-chart-model.ts` (unit tested). Fixed
 * relative to the previous version:
 *   - the y scale was `dataMax * 1.22`, so gridlines were labelled with
 *     arbitrary values ("5.4M") a planner cannot read a number off. The axis
 *     is now a nice scale with round ticks.
 *   - the legend always advertised "Historical actual" and "Expected range
 *     (P50 marked)" even when no row carried an actual, a band, or a P50.
 *   - the range caption and the formal-plan caption were positioned a fixed
 *     distance above their mark and could be pushed outside the plot box.
 */
export function PlanningGapChart({ data, formalValue, unit = "units" }: { data: PlanningGapChartRow[]; formalValue: number; unit?: string }) {
  const model = buildGapChartModel(data, formalValue);
  const chartHeight = 220;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {/* plot area — exactly chartHeight tall; every absolutely-positioned
          child is placed by a percentage of THIS box, from the model */}
      <div className="relative w-full min-w-0" style={{ height: chartHeight }}>
        {model.axis.ticks.map((t) => (
          <div key={t} className="absolute left-9 right-0 border-t border-[var(--border)]" style={{ top: `${100 - (t / model.axis.max) * 100}%` }}>
            <span className="absolute -top-2 left-0 -translate-x-full pr-1.5 text-[10px] tabular-nums text-[var(--text-muted)]">{fmtCompact(t)}</span>
          </div>
        ))}

        {model.legend.formal && (
          <div className="absolute left-9 right-0 border-t border-dashed border-[var(--state-formal)]" style={{ top: `${model.formal.topPct}%` }}>
            <span
              className={`absolute right-0 whitespace-nowrap text-[10.5px] font-medium text-[var(--state-formal)] ${model.formal.labelBelow ? "top-0.5" : "-top-4.5"}`}
            >
              Formal plan: {fmtCompact(model.formal.value)} {unit}
            </span>
          </div>
        )}

        <div className="absolute inset-y-0 left-9 right-0 flex items-end justify-around gap-4">
          {model.rows.map((d) => (
            <div key={d.period} className="relative flex h-full w-full min-w-0 max-w-20 items-end justify-center">
              {d.actualHeightPct != null && (
                <div className="w-full rounded-t-[2px] bg-[var(--state-historical)]" style={{ height: `${d.actualHeightPct}%` }} title={`${d.period} actual ${fmtCompact(d.actual!)} ${unit}`} />
              )}
              {d.range && (
                <>
                  <div
                    className="absolute w-full max-w-14 rounded-[2px] border-2 border-[var(--state-inferred)] bg-[var(--state-inferred-soft)]"
                    style={{ top: `${d.range.topPct}%`, height: `${d.range.heightPct}%` }}
                    title={`Expected ${fmtCompact(d.range.low)}–${fmtCompact(d.range.high)} ${unit}${d.range.base != null ? ` (P50 ${fmtCompact(d.range.base)})` : ""}`}
                  >
                    {d.range.baseOffsetPct != null && (
                      <div className="absolute inset-x-0 h-1 -translate-y-1/2 bg-[var(--state-inferred)]" style={{ top: `${(d.range.baseOffsetPct / d.range.heightPct) * 100}%` }} />
                    )}
                  </div>
                  <div
                    className="absolute left-1/2 w-max -translate-x-1/2 whitespace-nowrap text-center text-[10.5px] font-medium leading-tight text-[var(--state-inferred)]"
                    style={{ top: `${d.range.labelTopPct}%` }}
                  >
                    {fmtCompact(d.range.low)}–{fmtCompact(d.range.high)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* labels — normal flow, sits below the plot area */}
      <div className="flex items-start justify-around gap-4 pl-9">
        {model.rows.map((d) => (
          <div key={d.period} className="w-full max-w-20 text-center text-[11px] text-[var(--text-muted)]">
            {d.period}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-[11px] text-[var(--text-muted)]">
        {model.legend.historical && <Legend swatch="var(--state-historical)" label="Historical actual" />}
        {model.legend.range && <Legend swatch="var(--state-inferred-soft)" border="var(--state-inferred)" label={model.legend.base ? "Expected range (P50 marked)" : "Expected range"} />}
        {model.legend.formal && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-px w-3 border-t border-dashed border-[var(--state-formal)]" />
            Formal plan
          </div>
        )}
        <span className="ml-auto tabular-nums">Y axis: {unit}</span>
      </div>
    </div>
  );
}

function Legend({ swatch, border, label }: { swatch: string; border?: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-[2px]" style={{ background: swatch, border: border ? `1px solid ${border}` : undefined }} />
      {label}
    </div>
  );
}
