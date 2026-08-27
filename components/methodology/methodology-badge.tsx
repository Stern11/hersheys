"use client";

import { BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getMethodology } from "@/lib/methodology/registry";
import type { PlanningMethodologyId } from "@/types/methodology";
import { MethodologyDetails } from "./methodology-details";

/**
 * The credibility control from PRD §8 — "View Method" without letting the
 * label dominate the page. A small pill; the popover carries the actual
 * why-selected / basis / limitations detail.
 */
export function MethodologyBadge({ methodologyId, whySelected }: { methodologyId: PlanningMethodologyId; whySelected?: string }) {
  const def = getMethodology(methodologyId);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
          <BookOpen className="size-3" />
          {def.shortName}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <MethodologyDetails methodologyId={methodologyId} whySelected={whySelected} />
      </PopoverContent>
    </Popover>
  );
}
