"use client";

import type { Material } from "@/types/planning";
import type { MasterAssumptionOverride } from "@/types/scenario";
import type { LeadTimeSampleResult } from "@/data/synthetic/execution-history";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssumptionControl } from "@/components/scenario/assumption-control";
import { HistoricalVsSystemChart } from "./historical-vs-system-chart";

const SAMPLE_SIZE_OPTIONS = [50, 100];

/**
 * The editable analytical basis for a master-data/historical-performance
 * gap (PRD-phase-2 §23/§37): sample size, statistic, and basis selection,
 * with the System / Historical / Scenario comparison rendered live.
 */
export function LeadTimeBasisEditor({
  material,
  sample,
  override,
  onSetSampleSize,
  onSetBasis,
  onSetScenarioValue,
}: {
  material: Material;
  sample: LeadTimeSampleResult;
  override: MasterAssumptionOverride | undefined;
  onSetSampleSize: (n: number) => void;
  onSetBasis: (basis: "system" | "historical" | "scenario", statistic?: "median" | "p80" | "custom") => void;
  onSetScenarioValue: (days: number) => void;
}) {
  const basis = override?.selectedBasis ?? "system";
  const statistic = override?.leadTimeStatistic ?? "median";
  const sampleSize = override?.sampleSize ?? sample.sampleCount;

  const activeValue = basis === "system" ? material.systemLeadTimeDays : basis === "historical" ? (statistic === "p80" ? sample.p80 : sample.median) : (override?.scenarioValue ?? material.systemLeadTimeDays);

  return (
    <div className="flex flex-col gap-4">
      <HistoricalVsSystemChart
        unit="days"
        sampleContext={`${sample.sampleCount} non-outlier receipts, ${sample.dateRange.start} – ${sample.dateRange.end}`}
        rows={[
          { label: "System assumption", value: material.systemLeadTimeDays, token: "--state-formal", active: basis === "system" },
          { label: "Historical median", value: sample.median, token: "--state-historical", active: basis === "historical" && statistic === "median" },
          { label: "Historical P80", value: sample.p80, token: "--state-inferred", active: basis === "historical" && statistic === "p80" },
          { label: "Scenario value", value: activeValue, token: "--state-scenario", active: basis === "scenario" },
        ]}
      />

      <AssumptionControl label="Planning basis" baseline={`System (${material.systemLeadTimeDays}d)`} scenario={`${basisLabel(basis, statistic)} (${activeValue}d)`} delta={`${activeValue - material.systemLeadTimeDays >= 0 ? "+" : ""}${activeValue - material.systemLeadTimeDays}d`} changed={basis !== "system"}>
        <div className="flex min-w-0 gap-2">
          <Select value={basis === "historical" ? `historical_${statistic}` : basis} onValueChange={(v) => (v.startsWith("historical") ? onSetBasis("historical", v.endsWith("p80") ? "p80" : "median") : onSetBasis(v as "system" | "scenario"))}>
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System assumption</SelectItem>
              <SelectItem value="historical_median">Historical median</SelectItem>
              <SelectItem value="historical_p80">Historical P80</SelectItem>
              <SelectItem value="scenario">Custom scenario value</SelectItem>
            </SelectContent>
          </Select>
          {basis === "scenario" && (
            <input
              type="number"
              value={override?.scenarioValue ?? material.systemLeadTimeDays}
              onChange={(e) => onSetScenarioValue(Number(e.target.value))}
              className="h-8 w-16 flex-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] tabular-nums outline-none focus-visible:border-[var(--ring)]"
            />
          )}
        </div>
      </AssumptionControl>

      <AssumptionControl label="Sample size" baseline={`${sample.sampleCount} orders (all available)`} scenario={`Last ${sampleSize} orders`} changed={override?.sampleSize != null}>
        <div className="flex gap-1.5">
          {SAMPLE_SIZE_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => onSetSampleSize(n)}
              className={`rounded-[var(--radius-sm)] border px-2.5 py-1 text-[12px] transition-colors ${sampleSize === n ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"}`}
            >
              Last {n}
            </button>
          ))}
        </div>
      </AssumptionControl>
    </div>
  );
}

function basisLabel(basis: "system" | "historical" | "scenario", statistic: "median" | "p80" | "custom"): string {
  if (basis === "system") return "System";
  if (basis === "historical") return statistic === "p80" ? "Historical P80" : "Historical median";
  return "Custom";
}
