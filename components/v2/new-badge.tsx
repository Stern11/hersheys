/**
 * Marks a product that did not exist in the earlier comparable seasons.
 *
 * A new item behaves differently from a repeat — there is less history to
 * reason from and its components are more often inferred than specified — so
 * it is worth being able to find at a glance rather than by reading dates.
 *
 * Deliberately the inferred state token, not a risk token: new is not a
 * problem, it is a different kind of certainty.
 */

import { cn } from "@/lib/utils/cn";

export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      title="Did not exist in the earlier comparable seasons"
      className={cn(
        "inline-flex flex-none items-center rounded-[var(--radius-sm)] bg-[var(--state-inferred-soft)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--state-inferred)]",
        className
      )}
    >
      New
    </span>
  );
}
