/**
 * Horizontal step indicator for "Use your own data" (V2 §12).
 *
 * Steps with id < current are treated as complete (a check mark), even if
 * that step was skipped in practice (e.g. mapping wasn't needed) — the
 * planner only needs to know "how far along am I", not a literal visit log.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface UploadStep {
  id: number;
  label: string;
}

export function UploadStepper({ steps, current }: { steps: UploadStep[]; current: number }) {
  return (
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const state = step.id < current ? "done" : step.id === current ? "current" : "upcoming";
        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 flex-none place-items-center rounded-full text-[11px] font-semibold tabular-nums",
                  state === "done" && "bg-[var(--accent)] text-[var(--text-on-accent)]",
                  state === "current" && "border-[1.5px] border-[var(--accent)] text-[var(--accent)]",
                  state === "upcoming" && "border border-[var(--border)] text-[var(--text-muted)]"
                )}
              >
                {state === "done" ? <Check className="size-3.5" /> : step.id}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[13px] font-medium",
                  // Only the current step is named on a phone; the others are
                  // numbered circles, which is all "how far along am I" needs.
                  state !== "current" && "hidden sm:inline",
                  state === "upcoming" ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "mx-2 h-px flex-1 sm:mx-3",
                  step.id < current ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
