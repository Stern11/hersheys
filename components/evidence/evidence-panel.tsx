import type { EvidenceSignal } from "@/types/shared";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/utils/format";

const QUALITY_VARIANT = { high: "positive", medium: "warning", low: "critical" } as const;

/** Every evidence row from PRD §12.4: source, date/freshness, system/planner-supplied, quality. */
export function EvidencePanel({ evidence }: { evidence: EvidenceSignal[] }) {
  if (evidence.length === 0) {
    return <p className="text-[12.5px] text-[var(--text-muted)]">No evidence rows in scope.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
      <table className="w-full min-w-[620px] border-collapse text-[12px]">
        <thead>
          <tr className="bg-[var(--surface-sunken)] text-left text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">
            <th className="px-2.5 py-1.5 font-medium">Source</th>
            <th className="px-2.5 py-1.5 font-medium">Value</th>
            <th className="px-2.5 py-1.5 font-medium">Range</th>
            <th className="px-2.5 py-1.5 font-medium">Quality</th>
            <th className="px-2.5 py-1.5 font-medium">Supplied by</th>
            <th className="px-2.5 py-1.5 font-medium">Included</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((e) => (
            <tr key={e.id} className={`border-t border-[var(--border)] ${!e.included ? "opacity-55" : ""}`}>
              <td className="px-2.5 py-1.5">
                <div className="font-medium">{e.source}</div>
                <div className="text-[10.5px] text-[var(--text-muted)]">{e.sourceObjectType}</div>
              </td>
              <td className="px-2.5 py-1.5 tabular-nums">
                {typeof e.value === "number" ? e.value.toLocaleString() : e.value} {e.unit && e.unit}
              </td>
              <td className="px-2.5 py-1.5 text-[var(--text-muted)]">{e.dateRange ? `${fmtDate(e.dateRange.start)} – ${fmtDate(e.dateRange.end)}` : "—"}</td>
              <td className="px-2.5 py-1.5">
                <Badge variant={QUALITY_VARIANT[e.quality]}>{e.quality}</Badge>
              </td>
              <td className="px-2.5 py-1.5 capitalize text-[var(--text-muted)]">{e.suppliedBy}</td>
              <td className="px-2.5 py-1.5">
                {e.included ? <Badge variant="positive">Included</Badge> : <Badge variant="neutral">{e.excludedReason ?? "Excluded"}</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
