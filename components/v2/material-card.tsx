/**
 * Material readiness cards for Plan Supply (V2 §44).
 *
 * The prior page put ten columns in front of the reader before they had
 * decided which components even mattered. A card shows only what is needed to
 * triage — name, status, the one requirement number, and the decision date —
 * and the rest sits behind a click (V2 §30.2, §60, §61).
 */

import type { MaterialExposureRow } from "@/types/situation";
import { MaterialStatusBadge } from "@/components/v2/state-badge";
import { SectionRule } from "@/components/v2/page";
import { fmtDateShort, fmtUnits, fmtWeeks } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

// `componentType` on MaterialExposureRow is the BomRow ComponentType union
// widened to `string`; this label map is a display-only fallback, not the
// source of truth — an unrecognised value just falls back to itself.
const COMPONENT_TYPE_LABEL: Record<string, string> = {
  RAW_MATERIAL: "Raw material",
  PACKAGING: "Packaging",
  SEMI_FINISHED: "Semi-finished",
  FINISHED_COMPONENT: "Finished component",
  ARTWORK: "Artwork",
  OTHER: "Other",
};

export function componentTypeLabel(type: string): string {
  return COMPONENT_TYPE_LABEL[type] ?? type;
}

/** Deadline color follows the same rule the row's decision date carries elsewhere in V2. */
function deadlineTone(weeksToDecision: number): string {
  if (weeksToDecision <= 0) return "text-[var(--risk-critical)]";
  if (weeksToDecision <= 4) return "text-[var(--risk-warning)]";
  return "text-[var(--text-secondary)]";
}

const STATUS_GROUPS: { status: MaterialExposureRow["status"]; label: string }[] = [
  { status: "PLAN_NOW", label: "Plan now" },
  { status: "REVIEW", label: "Review" },
  { status: "WAIT", label: "Wait" },
];

export function MaterialCardGrid({
  rows,
  selectedId,
  onSelect,
}: {
  rows: MaterialExposureRow[];
  selectedId?: string | null;
  onSelect: (row: MaterialExposureRow) => void;
}) {
  return (
    <>
      {STATUS_GROUPS.map((group) => {
        const groupRows = rows.filter((r) => r.status === group.status);
        if (groupRows.length === 0) return null;
        return (
          <div key={group.status}>
            <SectionRule label={`${group.label} · ${groupRows.length}`} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groupRows.map((row) => (
                <MaterialCard
                  key={row.materialId}
                  row={row}
                  selected={row.materialId === selectedId}
                  onClick={() => onSelect(row)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function MaterialCard({
  row,
  selected,
  onClick,
}: {
  row: MaterialExposureRow;
  selected: boolean;
  onClick: () => void;
}) {
  const tone = deadlineTone(row.weeksToDecision);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-md)] border bg-[var(--surface)] p-4 text-left transition-colors",
        "hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]",
        selected ? "border-[var(--interaction-selected-border)] ring-1 ring-[var(--ring)]" : "border-[var(--border)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">{row.materialName}</div>
          <div className="truncate text-[11.5px] text-[var(--text-muted)]">
            {row.componentFamily ?? componentTypeLabel(row.componentType)}
          </div>
        </div>
        <MaterialStatusBadge status={row.status} />
      </div>

      <div className="leading-none">
        <span className="text-[22px] font-semibold tabular-nums text-[var(--text-primary)]">
          {fmtUnits(row.requirementBase)}
        </span>
        <span className="ml-1.5 text-[12px] text-[var(--text-muted)]">{row.uom}</span>
      </div>

      <div className={cn("flex items-baseline justify-between text-[12px] tabular-nums", tone)}>
        <span className="font-medium">{fmtDateShort(row.decisionDate)}</span>
        <span>{fmtWeeks(row.weeksToDecision)}</span>
      </div>
    </button>
  );
}
