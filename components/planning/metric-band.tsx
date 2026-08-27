import { cn } from "@/lib/utils/cn";

export interface MetricBandItem {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "critical" | "neutral";
}

/**
 * The compact situation-header pattern (PRD-phase-2 §9): one dense strip of
 * the handful of numbers that actually matter, instead of 4-6 separate KPI
 * cards. Deliberately has no per-item border/shadow — items are separated
 * by hairline dividers only, so the strip reads as one instrument, not a
 * grid of cards.
 */
export function MetricBand({ items }: { items: MetricBandItem[] }) {
  return (
    <div className="flex divide-x divide-[var(--border)] overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-[128px] flex-1 flex-col gap-0.5 px-3.5 py-2.5">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{item.label}</span>
          <span
            className={cn(
              "text-[16px] font-semibold tabular-nums leading-tight",
              item.tone === "critical" && "text-[var(--risk-critical)]",
              item.tone === "warning" && "text-[var(--risk-warning)]",
              item.tone === "positive" && "text-[var(--risk-positive)]"
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
