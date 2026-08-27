import type { LucideIcon } from "lucide-react";
import { AlertCircle, Info, Inbox } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Professional empty/insufficient-data/error states (PRD-phase-2 §27) —
 * "Insufficient comparable PO history to calculate a reliable P80" beats
 * fake precision every time.
 */
export function StateMessage({
  variant = "info",
  title,
  description,
  icon,
  className,
}: {
  variant?: "info" | "empty" | "error";
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? (variant === "error" ? AlertCircle : variant === "empty" ? Inbox : Info);
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-6 py-8 text-center", className)}>
      <Icon className={cn("size-4", variant === "error" ? "text-[var(--risk-critical)]" : "text-[var(--text-muted)]")} />
      <div className="text-[12.5px] font-medium">{title}</div>
      {description && <p className="max-w-sm text-[11.5px] text-[var(--text-muted)]">{description}</p>}
    </div>
  );
}
