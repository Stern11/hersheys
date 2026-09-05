/**
 * Step 5 — Scope preview (V2 §12, §30).
 *
 * The compact review before committing: what Heizen found in the workbook,
 * and — honestly, not alarmingly — what it can't yet answer because a sheet
 * was left out.
 */

"use client";

import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricRow } from "@/components/v2/page";
import type { PlanningScopePreview } from "@/lib/excel/validate";

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-[12.5px] text-[var(--text-muted)]">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="neutral">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function StepScope({
  scope,
  persistenceAvailable,
  saving,
  onBack,
  onRunPlanning,
}: {
  scope: PlanningScopePreview;
  persistenceAvailable: boolean;
  saving: boolean;
  onBack: () => void;
  onRunPlanning: () => void;
}) {
  return (
    <div>
      <p className="max-w-[560px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        Here&apos;s what Heizen found in your workbook before it becomes your planning dataset.
      </p>

      <div className="mt-6">
        <MetricRow
          items={[
            { label: "Current items", value: scope.currentItemCount.toLocaleString() },
            { label: "Historical items", value: scope.historicalItemCount.toLocaleString() },
            { label: "Lines", value: scope.lineCount.toLocaleString() },
            { label: "BOM components", value: scope.bomComponentCount.toLocaleString() },
          ]}
        />
      </div>

      <div className="mt-7 space-y-5">
        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Planning periods
          </span>
          <ChipList items={scope.periods} />
        </div>
        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Historical periods
          </span>
          <ChipList items={scope.historicalPeriods} />
        </div>
        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Brands
          </span>
          <ChipList items={scope.brands} />
        </div>
        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Events / programs
          </span>
          <ChipList items={scope.eventsOrPrograms} />
        </div>
      </div>

      {scope.unavailable.length > 0 ? (
        <div className="mt-7 space-y-2 border-t border-[var(--border)] pt-5">
          {scope.unavailable.map((line) => (
            <div key={line} className="flex items-start gap-2 text-[12.5px] text-[var(--text-secondary)]">
              <Info className="mt-0.5 size-3.5 flex-none text-[var(--text-muted)]" />
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {!persistenceAvailable ? (
        <p className="mt-6 text-[12px] text-[var(--text-muted)]">
          This browser can&apos;t save your data locally — it will be lost if you refresh.
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <Button variant="secondary" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button size="lg" onClick={onRunPlanning} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Run planning
        </Button>
      </div>
    </div>
  );
}
