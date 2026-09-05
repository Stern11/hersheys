/**
 * The baseline/scenario toggle. Bound to the single global `viewMode` in
 * `stores/situation-scenario-store.ts` wherever it appears, so the toolbar
 * and the impact panel can never disagree about which state is on screen
 * (V2 §5.7).
 */

"use client";

import { cn } from "@/lib/utils/cn";

const MODES = ["baseline", "scenario"] as const;

export function BaselineScenarioToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: "baseline" | "scenario";
  onChange: (mode: "baseline" | "scenario") => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex flex-none items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] p-0.5 text-[12px]">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-[calc(var(--radius-sm)-2px)] px-2.5 py-1 font-medium capitalize transition-colors",
            mode === m
              ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
