import type { MaterialReadiness } from "@/types/planning";
import { Badge } from "@/components/ui/badge";
import { MaterialReadinessBadge } from "./material-readiness-badge";
import { fmtDate } from "@/lib/utils/format";

export interface MaterialReadinessRow extends MaterialReadiness {
  materialName: string;
}

/**
 * Signature Visual D (PRD-phase-2 §11D): the BOM hierarchy — one row per
 * component, each showing known/inferred state, requirement range,
 * confidence, lead time, and PLAN NOW / REVIEW / WAIT in one scan. The
 * root (parent product) is the section this is rendered under; our BOM
 * model is one level deep (product → component), so the "tree" is a
 * grouped table rather than a multi-level indent — there is no deeper
 * hierarchy in the data to represent honestly.
 */
export function MaterialReadinessView({ productName, rows }: { productName: string; rows: MaterialReadinessRow[] }) {
  const sorted = [...rows].sort((a, b) => confidenceRank(a.readiness) - confidenceRank(b.readiness));

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-1.5 text-[11.5px] font-semibold">{productName}</div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">
            <th className="px-3 py-1.5 font-medium">Component</th>
            <th className="px-3 py-1.5 font-medium">Requirement range</th>
            <th className="px-3 py-1.5 font-medium">Confidence</th>
            <th className="px-3 py-1.5 font-medium">Lead time</th>
            <th className="px-3 py-1.5 font-medium">Order-by</th>
            <th className="px-3 py-1.5 font-medium">Readiness</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{r.materialName}</span>
                  <Badge variant={r.confidence >= 0.999 ? "formal" : "inferred"}>{r.confidence >= 0.999 ? "formal" : "inferred"}</Badge>
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                {r.expectedRequirementLow.toLocaleString()}–{r.expectedRequirementHigh.toLocaleString()} {r.unit}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div className="h-full rounded-full" style={{ width: `${r.confidence * 100}%`, background: confidenceColor(r.confidence) }} />
                  </div>
                  <span className="tabular-nums text-[11px] text-[var(--text-muted)]">{Math.round(r.confidence * 100)}%</span>
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                {r.leadTimeDaysUsed}d <span className="text-[10.5px] text-[var(--text-muted)]">({r.leadTimeBasis.replace("_", " ")})</span>
              </td>
              <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">{fmtDate(r.earliestDecisionDate)}</td>
              <td className="px-3 py-2">
                <MaterialReadinessBadge readiness={r.readiness} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function confidenceRank(readiness: MaterialReadiness["readiness"]): number {
  return { wait: 0, unknown: 1, review: 2, monitor: 2, plan_now: 3 }[readiness];
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return "var(--risk-positive)";
  if (score >= 0.55) return "var(--risk-warning)";
  return "var(--risk-critical)";
}
