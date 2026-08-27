import { cn } from "@/lib/utils/cn";
import { Label } from "@/components/ui/label";

/**
 * The shared "Baseline / Scenario / Δ" wrapper every Scenario Lab control
 * uses (PRD-phase-2 §17). A changed control gets a visible accent rail and
 * background tint — a planner should never have to hunt for what they
 * touched (§18).
 */
export function AssumptionControl({
  label,
  baseline,
  scenario,
  delta,
  changed,
  children,
}: {
  label: string;
  baseline: string;
  scenario: string;
  delta?: string;
  changed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-[var(--radius-md)] border-l-2 px-2.5 py-2 transition-colors", changed ? "border-l-[var(--accent)] bg-[var(--interaction-selected)]" : "border-l-transparent")}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {changed && <span className="rounded-[var(--radius-sm)] bg-[var(--state-scenario-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--state-scenario)]">Scenario override</span>}
      </div>
      {children}
      <div className="flex items-center gap-2.5 text-[11px] text-[var(--text-muted)]">
        <span>
          Baseline <span className="font-medium tabular-nums text-[var(--text-secondary)]">{baseline}</span>
        </span>
        {changed && (
          <>
            <span>→</span>
            <span>
              Scenario <span className="font-medium tabular-nums text-[var(--state-scenario)]">{scenario}</span>
            </span>
            {delta && <span className="font-semibold tabular-nums text-[var(--accent)]">Δ {delta}</span>}
          </>
        )}
      </div>
    </div>
  );
}
