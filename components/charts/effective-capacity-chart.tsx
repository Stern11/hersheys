"use client";

import type { CapacityImpactByLine } from "@/types/scenario";
import { fmtNum, fmtPct } from "@/lib/utils/format";

/**
 * Signature Visual 2 (PRD §23.3): formal load, validated unresolved, AI
 * inferred, scenario adjustment, capacity ceiling, and target headroom in
 * ONE stacked bar per line — so a planner can see whether a line "only
 * looks safe because demand is absent" at a glance. Hand-built SVG rather
 * than a charting-library primitive so the ceiling line, target-headroom
 * shading, and stacked-segment colors can map exactly to the planning-state
 * token palette (never reusing a risk color for a data series).
 */
export function EffectiveCapacityChart({ data }: { data: CapacityImpactByLine[] }) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-[12.5px] text-[var(--text-muted)]">No capacity buckets in scope.</div>;
  }

  const maxHours = Math.max(...data.map((d) => Math.max(d.ceilingHours, d.formalLoadHours + d.validatedUnresolvedLoadHours + d.aiInferredLoadHours + d.scenarioAdjustmentHours))) * 1.08;

  return (
    <div className="flex flex-col gap-4">
      <Legend />
      <div className="flex flex-col gap-3">
        {data.map((d) => (
          <LineRow key={`${d.lineId}-${d.period}`} d={d} maxHours={maxHours} />
        ))}
      </div>
    </div>
  );
}

function LineRow({ d, maxHours }: { d: CapacityImpactByLine; maxHours: number }) {
  const pct = (hours: number) => `${Math.max(0, (hours / maxHours) * 100)}%`;
  const ceilingPct = pct(d.ceilingHours);
  const targetPct = pct(d.ceilingHours * d.targetUtilization);

  const segments: { hours: number; token: string }[] = [
    { hours: d.formalLoadHours, token: "--state-formal" },
    { hours: d.validatedUnresolvedLoadHours, token: "--state-validated" },
    { hours: d.aiInferredLoadHours, token: "--state-inferred" },
    { hours: d.scenarioAdjustmentHours, token: "--state-scenario" },
  ];

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 flex-none text-[12px] font-medium">
        {d.lineId.replace("line_", "Line ").replace(/^Line (\d)$/, "Line 0$1")} <span className="text-[var(--text-muted)]">· {d.period}</span>
      </div>
      <div className="relative h-6 flex-1 rounded-[3px] bg-[var(--surface-sunken)]">
        {/* stacked load segments */}
        <div className="absolute inset-y-0 left-0 flex overflow-hidden rounded-[3px]" style={{ width: pct(segments.reduce((s, x) => s + x.hours, 0)) }}>
          {segments.map((s, i) => (
            <div key={i} className="h-full" style={{ width: `${(s.hours / segments.reduce((sum, x) => sum + x.hours, 0)) * 100}%`, background: `var(${s.token})` }} />
          ))}
        </div>
        {/* ceiling marker */}
        <div className="absolute inset-y-[-3px] w-px bg-[var(--text-primary)]" style={{ left: ceilingPct }} title={`Ceiling ${fmtNum(d.ceilingHours)}h`} />
        {/* target headroom marker */}
        <div className="absolute inset-y-[-3px] w-px border-l border-dashed border-[var(--text-muted)]" style={{ left: targetPct }} title={`Target ${fmtPct(d.targetUtilization)}`} />
      </div>
      <div className="w-16 flex-none text-right text-[12px] font-semibold tabular-nums" style={{ color: d.riskLevel === "critical" ? "var(--risk-critical)" : d.riskLevel === "warning" ? "var(--risk-warning)" : "var(--risk-positive)" }}>
        {fmtPct(d.effectiveUtilization)}
      </div>
    </div>
  );
}

function Legend() {
  const items: { label: string; token: string }[] = [
    { label: "Formal", token: "--state-formal" },
    { label: "Validated unresolved", token: "--state-validated" },
    { label: "AI inferred", token: "--state-inferred" },
    { label: "Scenario adjustment", token: "--state-scenario" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
      {items.map((it) => (
        <div key={it.token} className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-[1px]" style={{ background: `var(${it.token})` }} />
          {it.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-px bg-[var(--text-primary)]" />
        Ceiling
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-px border-l border-dashed border-[var(--text-muted)]" />
        Target
      </div>
    </div>
  );
}
