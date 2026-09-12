"use client";

/**
 * One dated decision on a row: when it stops being reversible, what it is,
 * what happens at that date, and the one action that settles it. Shared by a
 * programme's Decide step and the cross-programme Decisions page, so the two
 * cannot drift into describing the same decision differently.
 */

import Link from "next/link";
import { Check } from "lucide-react";
import type { PendingDecision } from "@/lib/situations/decisions";
import { cn } from "@/lib/utils/cn";
import { fmtDateShort, fmtNum, fmtWeeks } from "@/lib/utils/format";

export function DecisionRow({
  decision,
  context,
  onRelease,
  onUndo,
}: {
  decision: PendingDecision;
  /** The programme, when the list spans more than one. */
  context?: string;
  onRelease: () => void;
  onUndo?: () => void;
}) {
  // One definition of the row's action, placed twice: inline at the end of the
  // row where there is room for it, and on its own line underneath where there
  // is not. A phone cannot afford "Test it in Scenario Lab" competing with the
  // title for the same 200px.
  const action = decision.released ? (
    <span className="flex flex-none items-center gap-2.5">
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--risk-positive)]">
        <Check className="size-3.5" />
        Released
      </span>
      {onUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="text-[11.5px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          Undo
        </button>
      ) : null}
    </span>
  ) : decision.materialId ? (
    <button
      type="button"
      onClick={onRelease}
      className="flex-none rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-primary)] transition-opacity hover:bg-[var(--interaction-hover)] focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0"
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      Release
    </button>
  ) : (
    <Link
      href={decision.href}
      className="flex-none rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-primary)] transition-opacity hover:bg-[var(--interaction-hover)] focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0"
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      {decision.cta}
    </Link>
  );

  const urgencyColor =
    decision.urgency === "overdue"
      ? "text-[var(--risk-critical)]"
      : decision.urgency === "urgent"
        ? "text-[var(--risk-warning)]"
        : "text-[var(--text-primary)]";

  return (
    <div
      className={cn("group py-3 transition-colors sm:py-3.5", decision.released && "opacity-70")}
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      <div className="flex items-center gap-3 sm:gap-5">
        {/* A date column costs 100px a phone does not have. Below sm: the date
            leads the second line instead, where it is read in the same glance
            as the lead time. */}
        <div className="hidden w-[104px] flex-none text-right sm:block">
          <div className={cn("text-[13px] font-medium tabular-nums", urgencyColor)}>
            {decision.date ? fmtDateShort(decision.date) : "Undated"}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {decision.weeksAway !== undefined ? fmtWeeks(decision.weeksAway) : "—"}
          </div>
        </div>

        <span
          className={cn(
            "h-8 w-[3px] flex-none rounded-full",
            decision.urgency === "overdue"
              ? "bg-[var(--risk-critical)]"
              : decision.urgency === "urgent"
                ? "bg-[var(--risk-warning)]"
                : decision.urgency === "soon"
                  ? "bg-[var(--state-validated)]"
                  : "bg-[var(--border-strong)]"
          )}
        />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium leading-snug text-[var(--text-primary)] sm:truncate">
              {decision.title}
            </div>
            <div className="text-[12px] leading-snug text-[var(--text-muted)] sm:truncate">
              <span className={cn("font-medium tabular-nums sm:hidden", urgencyColor)}>
                {decision.date ? fmtDateShort(decision.date) : "Undated"}
                {decision.weeksAway !== undefined ? ` · ${fmtWeeks(decision.weeksAway)}` : ""}
              </span>
              <span className="sm:hidden"> · </span>
              {context ? (
                <>
                  <span className="text-[var(--text-secondary)]">{context}</span>
                  {" · "}
                </>
              ) : null}
              {decision.consequence}
              {decision.drivenBy.length > 0
                ? ` · for ${decision.drivenBy[0]}${
                    decision.drivenBy.length > 1 ? ` +${decision.drivenBy.length - 1}` : ""
                  }`
                : ""}
            </div>
          </div>

          {/* On a wide screen the row otherwise trails off into empty space;
              the quantity under decision is the figure that belongs there. */}
          {decision.quantity && decision.quantity > 0 ? (
            <div className="hidden w-[132px] flex-none text-right lg:block">
              <div className="text-[13px] font-medium tabular-nums text-[var(--text-primary)]">
                {fmtNum(Math.round(decision.quantity))}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">{decision.uom ?? "units"}</div>
            </div>
          ) : null}

          <div className="flex-none">{action}</div>
        </div>
      </div>
    </div>
  );
}
