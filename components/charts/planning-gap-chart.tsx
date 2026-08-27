"use client";

import { fmtCompact } from "@/lib/utils/format";

export interface PlanningGapChartRow {
  period: string;
  actual?: number;
  low?: number;
  high?: number;
  base?: number;
}

/**
 * Signature Visual 1 (PRD §23.2): historical actuals, the expected envelope
 * (range + P50 point), and the current formal plan as a reference line — so
 * a planner can see "how much appears missing, and is that normal for this
 * point in the cycle" in one shape. Hand-built SVG/CSS: AG Charts' community
 * `range-bar` series did not render the expected band reliably in this
 * environment (silently empty column, no console error), so — matching
 * EffectiveCapacityChart's precedent — this uses direct positioning for
 * guaranteed, exactly-controlled rendering of the uncertainty band.
 */
export function PlanningGapChart({ data, formalValue, unit = "units" }: { data: PlanningGapChartRow[]; formalValue: number; unit?: string }) {
  const maxValue = Math.max(formalValue, ...data.map((d) => Math.max(d.actual ?? 0, d.high ?? 0))) * 1.22;
  const chartHeight = 220;
  const y = (v: number) => chartHeight - (v / maxValue) * chartHeight; // px from the TOP of a chartHeight-tall box

  return (
    <div className="flex flex-col gap-2">
      {/* plot area — exactly chartHeight tall; every absolutely-positioned child (gridlines, formal line, range bands) uses the same y() calibrated to this box, and nothing else */}
      <div className="relative" style={{ height: chartHeight }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <div key={f} className="absolute left-8 right-0 border-t border-[var(--border)]" style={{ top: chartHeight * (1 - f) }}>
            <span className="absolute -top-2 left-0 -translate-x-full pr-1.5 text-[10px] text-[var(--text-muted)]">{fmtCompact(maxValue * f)}</span>
          </div>
        ))}

        <div className="absolute left-8 right-0 border-t border-dashed border-[var(--state-formal)]" style={{ top: y(formalValue) }}>
          <span className="absolute -top-4.5 right-0 text-[10.5px] font-medium text-[var(--state-formal)]">
            Formal plan: {fmtCompact(formalValue)} {unit}
          </span>
        </div>

        <div className="absolute inset-y-0 left-8 right-0 flex items-end justify-around gap-4">
          {data.map((d) => (
            <div key={d.period} className="relative flex h-full w-full max-w-20 items-end justify-center">
              {d.actual != null && <div className="w-full rounded-t-[2px] bg-[var(--state-historical)]" style={{ height: chartHeight - y(d.actual) }} />}
              {d.low != null && d.high != null && (
                <>
                  <div className="absolute w-full max-w-14 rounded-[2px] border-2 border-[var(--state-inferred)] bg-[var(--state-inferred-soft)]" style={{ top: y(d.high), height: Math.max(4, y(d.low) - y(d.high)) }}>
                    {d.base != null && <div className="absolute inset-x-0 h-1 -translate-y-1/2 bg-[var(--state-inferred)]" style={{ top: y(d.base) - y(d.high) }} />}
                  </div>
                  <div className="absolute w-max -translate-x-1/2 text-center text-[10.5px] font-medium leading-tight text-[var(--state-inferred)]" style={{ left: "50%", top: y(d.high) - 30 }}>
                    {fmtCompact(d.low)}–{fmtCompact(d.high)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* labels — normal flow, sits below the plot area */}
      <div className="flex items-start justify-around gap-4 pl-8">
        {data.map((d) => (
          <div key={d.period} className="w-full max-w-20 text-center text-[11px] text-[var(--text-muted)]">
            {d.period}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pl-8 text-[11px] text-[var(--text-muted)]">
        <Legend swatch="var(--state-historical)" label="Historical actual" />
        <Legend swatch="var(--state-inferred-soft)" border="var(--state-inferred)" label="Expected range (P50 marked)" />
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-px w-3 border-t border-dashed border-[var(--state-formal)]" />
          Formal plan
        </div>
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
