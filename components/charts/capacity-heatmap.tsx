"use client";

import { DEFAULT_TARGET_UTILIZATION, bandBg, bandFg, heatmapLegend, utilizationBand } from "@/lib/charts/heatmap";

export interface HeatmapCell {
  lineLabel: string;
  period: string;
  periodLabel: string;
  utilization: number; // 0-1+, formal unless `effective` is set
  effective?: number; // set only where a live scenario recalculation exists (e.g. the peak month)
}

/**
 * Signature Visual: multi-line risk horizon. Formal utilization for every
 * line/period cell — the one cell where a live scenario recalculation exists
 * (unresolved demand included) also shows its effective figure, so the "looks
 * safe formally, isn't effectively" finding is visible without fabricating
 * effective numbers for periods the engine hasn't actually computed.
 *
 * Same defect class as the other charts, fixed here: the colour encoding had
 * NO key anywhere on the page — three risk bands with hard-coded 0.9/1.0
 * thresholds that a planner had no way to learn — and the second number on a
 * dual-value cell (formal vs. effective) existed only inside a `title`
 * attribute. Banding now comes from `lib/charts/heatmap.ts` (unit tested), the
 * thresholds are printed in a legend, and both figures are rendered.
 *
 * Colour here encodes STATUS (utilization risk) so it uses `--risk-*`. It must
 * never borrow a `--state-*` data-series token.
 */
export function CapacityHeatmap({
  lines,
  periods,
  cells,
  target = DEFAULT_TARGET_UTILIZATION,
}: {
  lines: string[];
  periods: { key: string; label: string }[];
  cells: HeatmapCell[];
  target?: number;
}) {
  const cellFor = (lineLabel: string, period: string) => cells.find((c) => c.lineLabel === lineLabel && c.period === period);
  const anyEffective = cells.some((c) => c.effective != null);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="w-24 text-left text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Line</th>
              {periods.map((p) => (
                <th key={p.key} className="px-2 pb-1.5 text-center text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line}>
                <td className="whitespace-nowrap pr-2 text-[12.5px] font-medium">{line}</td>
                {periods.map((p) => {
                  const cell = cellFor(line, p.key);
                  if (!cell) {
                    return (
                      <td key={p.key} className="p-1">
                        <div className="flex items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-2 py-2 text-[12px] text-[var(--text-muted)]" title="No capacity bucket in scope for this line and period">
                          —
                        </div>
                      </td>
                    );
                  }
                  const value = cell.effective ?? cell.utilization;
                  const band = utilizationBand(value, target);
                  return (
                    <td key={p.key} className="p-1">
                      <div
                        className="flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-2"
                        style={{ background: bandBg(band) }}
                        title={cell.effective != null ? `Formal ${Math.round(cell.utilization * 100)}% · Effective ${Math.round(cell.effective * 100)}%` : `${Math.round(value * 100)}% formal`}
                      >
                        <span className="text-[13px] font-semibold tabular-nums" style={{ color: bandFg(band) }}>
                          {Math.round(value * 100)}%
                        </span>
                        <span className="whitespace-nowrap text-[9px] font-medium uppercase tracking-wide tabular-nums text-[var(--text-muted)]">
                          {cell.effective != null ? `effective · ${Math.round(cell.utilization * 100)}% formal` : "formal"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[var(--text-muted)]">
        {heatmapLegend(target).map((entry) => (
          <span key={entry.band} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[2px]" style={{ background: bandBg(entry.band), border: `1px solid ${bandFg(entry.band)}` }} />
            {entry.label}
          </span>
        ))}
        <span className="ml-auto">
          {anyEffective
            ? "Cells labelled “effective” include unresolved demand the engine has recalculated; the rest are formal load only."
            : "Formal load only — no live scenario recalculation exists for these periods."}
        </span>
      </div>
    </div>
  );
}
