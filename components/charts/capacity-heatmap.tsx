"use client";

export interface HeatmapCell {
  lineLabel: string;
  period: string;
  periodLabel: string;
  utilization: number; // 0-1+, formal unless `effective` is set
  effective?: number; // set only where a live scenario recalculation exists (e.g. the peak month)
}

/**
 * Signature Visual: multi-line risk horizon. Formal utilization for every
 * line/period cell — the one cell where a live scenario recalculation
 * exists (peak-month, unresolved demand included) also shows its effective
 * figure, so the "looks safe formally, isn't effectively" finding is
 * visible without fabricating effective numbers for periods the engine
 * hasn't actually computed.
 */
export function CapacityHeatmap({ lines, periods, cells }: { lines: string[]; periods: { key: string; label: string }[]; cells: HeatmapCell[] }) {
  const cellFor = (lineLabel: string, period: string) => cells.find((c) => c.lineLabel === lineLabel && c.period === period);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="w-24 text-left text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]"> </th>
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
              <td className="pr-2 text-[12.5px] font-medium">{line}</td>
              {periods.map((p) => {
                const cell = cellFor(line, p.key);
                if (!cell) return <td key={p.key} className="p-1" />;
                const value = cell.effective ?? cell.utilization;
                return (
                  <td key={p.key} className="p-1">
                    <div className="flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-2 py-2" style={{ background: cellBg(value) }} title={cell.effective ? `Formal ${Math.round(cell.utilization * 100)}% · Effective ${Math.round(cell.effective * 100)}%` : `${Math.round(value * 100)}% formal`}>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: cellFg(value) }}>
                        {Math.round(value * 100)}%
                      </span>
                      {cell.effective != null && <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">effective</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellBg(v: number): string {
  if (v > 1) return "var(--risk-critical-soft)";
  if (v > 0.9) return "var(--risk-warning-soft)";
  return "var(--risk-positive-soft)";
}
function cellFg(v: number): string {
  if (v > 1) return "var(--risk-critical)";
  if (v > 0.9) return "var(--risk-warning)";
  return "var(--risk-positive)";
}
