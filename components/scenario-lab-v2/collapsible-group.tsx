/**
 * A collapsible left-column control group (V2 §13.3, §52).
 *
 * Only Capacity starts open — the headline control (V2 §46, §53). The reset
 * action sits outside the toggle button so a click on it never also
 * collapses the group.
 */

"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function CollapsibleGroup({
  title,
  defaultOpen = false,
  action,
  children,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--border)] py-3 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <ChevronDown
            className={cn(
              "size-3.5 flex-none text-[var(--text-muted)] transition-transform",
              open && "rotate-180"
            )}
          />
          <span className="truncate text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-secondary)]">
            {title}
          </span>
        </button>
        {action}
      </div>
      {open ? <div className="mt-3 pl-5">{children}</div> : null}
    </div>
  );
}
