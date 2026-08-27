import type { Confidence } from "@/types/shared";
import { fmtPct } from "@/lib/utils/format";

/**
 * Confidence-by-dimension display (PRD §31.1) — never a single global
 * score. `overall` is shown small, as a sort/summary aid only.
 */
export function ConfidenceBand({ confidence }: { confidence: Confidence }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Confidence</span>
        <span className="text-[12px] font-semibold tabular-nums">{fmtPct(confidence.overall)}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {confidence.dimensions.map((d, i) => (
          <div key={`${d.dimension}-${i}`} className="flex items-center gap-2" title={d.note}>
            <span className="w-32 flex-none truncate text-[11px] text-[var(--text-secondary)]">{d.note ?? d.dimension.replace(/_/g, " ")}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div className="h-full rounded-full" style={{ width: fmtPct(d.score), background: confidenceColor(d.score) }} />
            </div>
            <span className="w-9 flex-none text-right text-[11px] tabular-nums text-[var(--text-muted)]">{fmtPct(d.score)}</span>
          </div>
        ))}
      </div>
      {(confidence.p50 != null || confidence.p80 != null) && (
        <div className="flex gap-3 text-[11px] text-[var(--text-muted)]">
          {confidence.p50 != null && <span>P50 {confidence.p50.toLocaleString()}</span>}
          {confidence.p80 != null && <span>P80 {confidence.p80.toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return "var(--risk-positive)";
  if (score >= 0.55) return "var(--risk-warning)";
  return "var(--risk-critical)";
}
