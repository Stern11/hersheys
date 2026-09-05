/**
 * Step 4 — Issues (V2 §12, §28).
 *
 * The headline is the count, not a wall of rows. Grouped by sheet, expanded
 * only where there's an error to see. Warnings and infos never block —
 * `summary.ready` (errors === 0) is the only gate on Continue.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { DataIssue, IssueSummary } from "@/lib/dataset/issues";

const SEVERITY_DOT: Record<DataIssue["severity"], string> = {
  error: "bg-[var(--risk-critical)]",
  warning: "bg-[var(--risk-warning)]",
  info: "bg-[var(--text-muted)]",
};

function rowsCaption(issue: DataIssue): string | null {
  if (issue.rowNumbers.length === 0) return null;
  const shown = issue.rowNumbers.slice(0, 6);
  const extraRows = issue.rowNumbers.length - shown.length;
  let caption = `Rows ${shown.join(", ")}`;
  if (extraRows > 0) caption += ` +${extraRows} more`;
  if (issue.count > issue.rowNumbers.length) caption += ` · ${issue.count} total`;
  return caption;
}

export function StepIssues({
  summary,
  onBack,
  onContinue,
}: {
  summary: IssueSummary;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(summary.bySheet.filter((s) => s.errors > 0).map((s) => s.sheet))
  );

  const toggle = (sheet: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(sheet)) next.delete(sheet);
      else next.add(sheet);
      return next;
    });

  const headline =
    summary.total === 0
      ? "Workbook ready"
      : `${summary.total} issue${summary.total === 1 ? "" : "s"} need attention` +
        (summary.errors > 0 ? ` · ${summary.errors} blocking` : "");

  return (
    <div>
      <p className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{headline}</p>

      {summary.total === 0 ? (
        <div className="mt-5 flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3.5 text-[13px] text-[var(--text-secondary)]">
          <CircleCheck className="size-4 flex-none text-[var(--risk-positive)]" />
          No issues found. Your workbook matches the template.
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {summary.bySheet.map((group) => {
            const isOpen = expanded.has(group.sheet);
            return (
              <div key={group.sheet} className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => toggle(group.sheet)}
                  className="flex w-full items-center justify-between gap-3 bg-[var(--surface-sunken)] px-4 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="size-3.5 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="size-3.5 text-[var(--text-muted)]" />
                    )}
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{group.sheet}</span>
                  </span>
                  <span className="flex items-center gap-3 text-[12px] text-[var(--text-muted)]">
                    {group.errors > 0 ? (
                      <span className="text-[var(--risk-critical)]">{group.errors} error{group.errors === 1 ? "" : "s"}</span>
                    ) : null}
                    {group.warnings > 0 ? (
                      <span>{group.warnings} warning{group.warnings === 1 ? "" : "s"}</span>
                    ) : null}
                    {group.issues.length === group.errors + group.warnings ? null : (
                      <span>{group.issues.length - group.errors - group.warnings} info</span>
                    )}
                  </span>
                </button>
                {isOpen ? (
                  <div className="divide-y divide-[var(--border)]">
                    {group.issues.map((issue) => (
                      <div key={issue.id} className="flex items-start gap-2.5 px-4 py-2.5">
                        <span className={cn("mt-1.5 size-1.5 flex-none rounded-full", SEVERITY_DOT[issue.severity])} />
                        <div className="min-w-0">
                          <p className="text-[13px] text-[var(--text-primary)]">{issue.message}</p>
                          {rowsCaption(issue) ? (
                            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{rowsCaption(issue)}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!summary.ready}>
          Continue
        </Button>
      </div>
    </div>
  );
}
