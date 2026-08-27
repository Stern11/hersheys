import type { ScenarioResult } from "@/types/scenario";
import { fmtNum, fmtPct } from "@/lib/utils/format";

export interface ComparisonColumn {
  label: string;
  result: ScenarioResult;
  isBaseline?: boolean;
}

/**
 * Signature Visual F (PRD-phase-2 §11F): Baseline vs. up to 3 scenarios,
 * multi-metric, side by side (PRD §13.12's minimum metric set).
 */
export function ScenarioComparisonPanel({ columns }: { columns: ComparisonColumn[] }) {
  const rows: { label: string; get: (r: ScenarioResult) => string }[] = [
    { label: "Expected demand", get: (r) => `${fmtNum(r.expectedDemandUnits.low)}–${fmtNum(r.expectedDemandUnits.high)}` },
    { label: "Unresolved demand", get: (r) => fmtNum(r.unresolvedDemandUnits) },
    { label: "Plan completeness", get: (r) => fmtPct(r.planningCompletenessPct / 100) },
    { label: "Peak line utilization", get: (r) => (r.capacityImpact.length ? fmtPct(Math.max(...r.capacityImpact.map((c) => c.effectiveUtilization))) : "—") },
    { label: "Material exposure (rows)", get: (r) => String(r.materialExposure.length) },
    { label: "Earliest deadline", get: (r) => r.decisionDeadlines.find((d) => d.isEarliestConstraint)?.date ?? "—" },
    { label: "Confidence", get: (r) => fmtPct(r.confidence.overall) },
    { label: "Open risks", get: (r) => String(r.risks.length) },
  ];

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-[var(--surface-sunken)] text-left text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">
            <th className="px-3 py-1.5 font-medium">Metric</th>
            {columns.map((c) => (
              <th key={c.label} className={`px-3 py-1.5 font-medium ${c.isBaseline ? "" : "text-[var(--state-scenario)]"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 text-[var(--text-secondary)]">{row.label}</td>
              {columns.map((c) => (
                <td key={c.label} className="px-3 py-2 tabular-nums font-medium">
                  {row.get(c.result)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
