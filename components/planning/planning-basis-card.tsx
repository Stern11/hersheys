import type { PlanningBasis } from "@/types/methodology";
import type { Confidence } from "@/types/shared";
import { MethodologyBadge } from "@/components/methodology/methodology-badge";
import { ConfidenceBand } from "./confidence-band";
import { Button } from "@/components/ui/button";

/**
 * The reusable "What / Basis / Methodology / Confidence / Control" pattern
 * (PRD §21) that every material AI inference should expose. `result` is the
 * headline number the basis explains; `onOpenInScenarioLab` wires the one
 * action every basis card should offer.
 */
export function PlanningBasisCard({
  resultLabel,
  resultValue,
  basis,
  confidence,
  onOpenInScenarioLab,
}: {
  resultLabel: string;
  resultValue: string;
  basis: PlanningBasis;
  confidence: Confidence;
  onOpenInScenarioLab?: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{resultLabel}</div>
          <div className="mt-0.5 text-[20px] font-semibold tabular-nums">{resultValue}</div>
        </div>
        <MethodologyBadge methodologyId={basis.primaryMethodologyId} whySelected={basis.whySelected} />
      </div>

      <div className="my-3 h-px bg-[var(--border)]" />

      <ConfidenceBand confidence={confidence} />

      {onOpenInScenarioLab && (
        <div className="mt-3.5 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onOpenInScenarioLab}>
            Open in Scenario Lab
          </Button>
        </div>
      )}
    </div>
  );
}
