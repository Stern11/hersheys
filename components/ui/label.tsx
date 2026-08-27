import * as React from "react";
import { cn } from "@/lib/utils/cn";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)] select-none",
        className
      )}
      {...props}
    />
  );
}

export { Label };
