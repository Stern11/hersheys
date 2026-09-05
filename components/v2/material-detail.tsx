/**
 * The detail behind one material card on Plan Supply (V2 §44).
 *
 * Everything the card face deliberately leaves out lives here: the honest
 * derivation of the status, the full requirement range, the net position
 * when inventory data exists, and the timing basis. Nothing here is a
 * restatement of the card — it is the evidence for it.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { MaterialExposureRow } from "@/types/situation";
import { Label } from "@/components/v2/page";
import { componentTypeLabel } from "@/components/v2/material-card";
import { fmtDateShort, fmtUnits, fmtWeeks } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const LEAD_TIME_BASIS_LABEL: Record<MaterialExposureRow["leadTimeBasis"], string> = {
  system: "System assumption",
  historical_median: "Historical median",
  historical_p80: "Historical P80",
  scenario: "Scenario value",
};

// Mirrors STABLE_COVERAGE (0.85) and THIN_COVERAGE (0.5) in
// lib/situations/build.ts — the classification thresholds themselves, not a
// per-material figure, so they are named here for the rule line rather than
// re-derived from the row.
const STABLE_COVERAGE_PCT = 85;
const THIN_COVERAGE_PCT = 50;

function isIngredientType(componentType: string): boolean {
  return componentType === "RAW_MATERIAL" || componentType === "SEMI_FINISHED";
}

interface WhyExplanation {
  lines: string[];
  rule: string;
}

/** Builds the honest "why this status" story from the row's own fields. */
function explainStatus(row: MaterialExposureRow): WhyExplanation {
  const pct = Math.round(row.analogueCoverage * 100);
  const ingredient = isIngredientType(row.componentType);
  const blockedByArtwork = /artwork/i.test(row.reason);
  const blockedBySpec = /still moving/i.test(row.reason);

  const lines: string[] = [`On ${pct}% of the volume carrying forward.`];

  if (blockedByArtwork) {
    lines.push("Artwork has not been released — that is what is blocking it.");
  } else if (blockedBySpec) {
    lines.push("The specification is still unsettled — that is what is blocking it.");
  } else if (row.status === "WAIT") {
    lines.push(`Only ${pct}% coverage across comparable items — too thin to act on yet.`);
  } else if (row.status === "REVIEW") {
    lines.push(
      ingredient
        ? `Below ${STABLE_COVERAGE_PCT}% coverage, so not yet settled enough to commit.`
        : `${componentTypeLabel(row.componentType)}, so the decision follows the final item.`
    );
  } else {
    lines.push(
      ingredient
        ? "A settled ingredient, evidenced across most comparable items."
        : "Settled and evidenced across most comparable items."
    );
  }

  const rule =
    blockedByArtwork || blockedBySpec
      ? "An unsettled component waits no matter how well evidenced the volume is."
      : ingredient
        ? `A settled ingredient on ${STABLE_COVERAGE_PCT}% or more of the volume can be committed.`
        : `Packaging stays in review until the final item is set — below ${THIN_COVERAGE_PCT}% coverage it waits.`;

  return { lines, rule };
}

function suggestedQuestion(row: MaterialExposureRow): string {
  if (row.status === "WAIT") return `why is ${row.materialName} on wait`;
  if (row.status === "REVIEW") return `why is ${row.materialName} in review`;
  return `why can ${row.materialName} be planned now`;
}

export function MaterialDetail({ row, situationId }: { row: MaterialExposureRow; situationId: string }) {
  const why = explainStatus(row);
  const hasNet = row.netRequirement !== undefined;
  const historicalBasis = row.leadTimeBasis === "historical_median" || row.leadTimeBasis === "historical_p80";
  const deadlineTone =
    row.weeksToDecision <= 0
      ? "text-[var(--risk-critical)]"
      : row.weeksToDecision <= 4
        ? "text-[var(--risk-warning)]"
        : "text-[var(--text-primary)]";

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
      <div>
        <Label className="mb-2">Why this status</Label>
        <div className="space-y-1 text-[13px] leading-snug text-[var(--text-secondary)]">
          {why.lines.map((line, i) => (
            <p key={i} className={i === 0 ? "text-[var(--text-primary)]" : undefined}>
              {line}
            </p>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] italic text-[var(--text-muted)]">{why.rule}</p>
      </div>

      <div>
        <Label className="mb-2">Requirement</Label>
        <div className="text-[13px] text-[var(--text-secondary)]">
          <p className="text-[var(--text-primary)]">
            {fmtUnits(row.requirementBase)} {row.uom}
            <span className="ml-2 text-[12px] text-[var(--text-muted)]">
              range {fmtUnits(row.requirementLow)} – {fmtUnits(row.requirementHigh)} {row.uom}
            </span>
          </p>
          {hasNet ? (
            <p className="mt-1">
              Net {fmtUnits(row.netRequirement ?? 0)} {row.uom} · on hand {fmtUnits(row.onHandQty ?? 0)} {row.uom}
              {row.inboundQty ? ` · inbound ${fmtUnits(row.inboundQty)} ${row.uom}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-[var(--text-muted)]">Add Inventory_Supply data to see a net requirement.</p>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-2">Timing</Label>
        <div className="text-[13px] text-[var(--text-secondary)]">
          <p className="text-[var(--text-primary)]">
            {row.leadTimeDays}d lead time
            <span className="ml-2 text-[12px] text-[var(--text-muted)]">{LEAD_TIME_BASIS_LABEL[row.leadTimeBasis]}</span>
          </p>
          <p className={cn("mt-1 tabular-nums", deadlineTone)}>
            {fmtDateShort(row.decisionDate)} · {fmtWeeks(row.weeksToDecision)}
          </p>
          {historicalBasis ? (
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Observed lead time set this date, not the system assumption.
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <Label className="mb-2">Ask Heizen about this</Label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
          <span className="text-[var(--text-secondary)]">
            Try <span className="text-[var(--text-primary)]">&ldquo;{suggestedQuestion(row)}&rdquo;</span> in the
            command bar, or
          </span>
          <Link
            href={`/scenario-lab?situation=${situationId}`}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:opacity-80"
          >
            open in Scenario Lab
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
