import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[11px] font-medium leading-none w-fit",
  {
    variants: {
      variant: {
        neutral: "border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
        positive: "border-transparent bg-[var(--risk-positive-soft)] text-[var(--risk-positive)]",
        warning: "border-transparent bg-[var(--risk-warning-soft)] text-[var(--risk-warning)]",
        critical: "border-transparent bg-[var(--risk-critical-soft)] text-[var(--risk-critical)]",
        formal: "border-transparent bg-[var(--state-formal-soft)] text-[var(--state-formal)]",
        validated: "border-transparent bg-[var(--state-validated-soft)] text-[var(--state-validated)]",
        inferred: "border-transparent bg-[var(--state-inferred-soft)] text-[var(--state-inferred)]",
        scenario: "border-transparent bg-[var(--state-scenario-soft)] text-[var(--state-scenario)]",
        historical: "border-transparent bg-[var(--state-historical-soft)] text-[var(--state-historical)]",
        unknown: "border-transparent bg-[var(--state-unknown-soft)] text-[var(--state-unknown)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
