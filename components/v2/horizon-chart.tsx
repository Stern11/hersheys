/**
 * Future load versus formal plan (V2 §39).
 *
 * One bar per situation, split into what the plan already represents and what
 * it does not. Ordered by production timing so the reader sees not just how
 * thin the plan is, but how soon that matters.
 */

"use client";

import type { PlanningSituation } from "@/types/situation";
import { fmtMoney, fmtPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function HorizonChart({
  situations,
  activeId,
  onSelect,
}: {
  situations: PlanningSituation[];
  activeId?: string | null;
  onSelect?: (situation: PlanningSituation) => void;
}) {
  if (situations.length === 0) return null;

  const max = Math.max(...situations.map((s) => s.bridge.expectedValue), 1);
  // Earliest production first: a bigger gap further out is the less urgent one.
  const ordered = [...situations].sort((a, b) =>
    (a.productionWindow?.start ?? "9999").localeCompare(b.productionWindow?.start ?? "9999")
  );

  return (
    <div className="space-y-2.5">
      {ordered.map((situation) => {
        const { formalValue, unresolvedValue, expectedValue, representedPct, currency } = situation.bridge;
        const active = situation.id === activeId;
        return (
          <button
            key={situation.id}
            type="button"
            onClick={() => onSelect?.(situation)}
            className={cn(
              "group grid w-full grid-cols-[190px_1fr_128px] items-center gap-4 rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors",
              onSelect && "hover:bg-[var(--interaction-hover)]",
              active && "bg-[var(--interaction-selected)]"
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                {situation.title}
              </div>
              <div className="truncate text-[11.5px] text-[var(--text-muted)]">
                {situation.runway.weeksOfRunway !== undefined
                  ? `${situation.runway.weeksOfRunway}w runway`
                  : situation.planningPeriod}
              </div>
            </div>

            <div className="flex h-6 items-center">
              <div className="relative h-[18px] w-full overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--state-formal)]"
                  style={{ width: `${(formalValue / max) * 100}%` }}
                  title={`Formal plan ${fmtMoney(formalValue, currency)}`}
                />
                <div
                  className="absolute inset-y-0 bg-[var(--state-inferred)] opacity-70"
                  style={{
                    left: `${(formalValue / max) * 100}%`,
                    width: `${(unresolvedValue / max) * 100}%`,
                  }}
                  title={`Unresolved ${fmtMoney(unresolvedValue, currency)}`}
                />
                <div
                  className="absolute inset-y-0 w-px bg-[var(--border-strong)]"
                  style={{ left: `${(expectedValue / max) * 100}%` }}
                  title={`Expected ${fmtMoney(expectedValue, currency)}`}
                />
              </div>
            </div>

            <div className="text-right">
              <div className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtMoney(unresolvedValue, currency)}
              </div>
              <div className="text-[11.5px] text-[var(--text-muted)]">
                {fmtPct(representedPct)} represented
              </div>
            </div>
          </button>
        );
      })}

      <div className="flex items-center gap-5 px-2 pt-1 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[var(--state-formal)]" aria-hidden />
          Formal plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[var(--state-inferred)] opacity-70" aria-hidden />
          Unresolved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-[var(--border-strong)]" aria-hidden />
          Expected business
        </span>
      </div>
    </div>
  );
}
