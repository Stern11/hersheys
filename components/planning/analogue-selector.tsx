"use client";

import type { Analogue } from "@/types/planning";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { productById } from "@/data/synthetic/products";

/**
 * PRD-phase-2 §24/§38: each analogue shows similarity, same/different
 * dimensions, BOM/line-history availability, and a weight the planner can
 * adjust — accept, reject, reweight, or blend, all as explicit scenario
 * overrides (never a silent default).
 */
export function AnalogueSelector({
  candidates,
  removedIds,
  weights,
  onToggle,
  onSetWeight,
}: {
  candidates: Analogue[];
  removedIds: string[];
  weights: Record<string, number>; // keyed by candidateProductId, already normalized for display
  onToggle: (analogueId: string, currentlyRemoved: boolean) => void;
  onSetWeight: (candidateProductId: string, weight: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {candidates.map((a) => {
        const product = productById(a.candidateProductId);
        const removed = removedIds.includes(a.id);
        const weight = weights[a.candidateProductId] ?? a.similarityScore;

        return (
          <div key={a.id} className={`rounded-[var(--radius-md)] border p-3 transition-opacity ${removed ? "border-[var(--border)] opacity-45" : "border-[var(--border-strong)]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium">{product.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {a.sameDimensions.map((d) => (
                    <Badge key={d} variant="positive">
                      {d.replace(/_/g, " ")}
                    </Badge>
                  ))}
                  {a.differentDimensions.map((d) => (
                    <Badge key={d} variant="warning">
                      {d.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-1">
                <span className="text-[15px] font-semibold tabular-nums">{Math.round(a.similarityScore * 100)}%</span>
                <span className="text-[10px] text-[var(--text-muted)]">similarity</span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
              <span>Data quality: {a.dataQuality}</span>
              <span>{a.bomAvailable ? "BOM available" : "No BOM"}</span>
              <span>{a.lineHistoryAvailable ? "Line history available" : "No line history"}</span>
            </div>

            <div className="mt-2.5 flex items-center gap-3">
              <button
                onClick={() => onToggle(a.id, removed)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)]"
              >
                {removed ? "Include" : "Exclude"}
              </button>
              {!removed && (
                <div className="flex flex-1 items-center gap-2">
                  <span className="w-10 flex-none text-[11px] text-[var(--text-muted)]">Weight</span>
                  <Slider value={[Math.round(weight * 100)]} max={100} step={5} onValueChange={([v]) => onSetWeight(a.candidateProductId, (v ?? 0) / 100)} className="max-w-40" />
                  <span className="w-9 flex-none text-right text-[11px] tabular-nums text-[var(--text-secondary)]">{Math.round(weight * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
