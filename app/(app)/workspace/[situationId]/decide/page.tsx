"use client";

/**
 * Decide (V2 §49-50).
 *
 * One question: what do I have to decide, and by when?
 *
 * The page used to open on "Runway remaining: 10 weeks" — a number with no
 * subject, which left a planner to reconstruct what was actually running out.
 * Every row now names the thing being decided, the date it stops being
 * reversible, and the products that put it on the calendar.
 */

import { use, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { useSituation } from "@/components/dataset/dataset-provider";
import { useDatasetStore } from "@/stores/dataset-store";
import { RunwayTimeline } from "@/components/v2/runway";
import { Label, NotAvailable, Page, SectionRule } from "@/components/v2/page";
import {
  blockedMaterials,
  pendingDecisions,
  type DecisionUrgency,
  type PendingDecision,
} from "@/lib/situations/decisions";
import { cn } from "@/lib/utils/cn";
import { fmtDateShort, fmtNum, fmtUnits, fmtWeeks } from "@/lib/utils/format";
import type { MaterialRelease, VolumeCommitment } from "@/types/situation";

const EMPTY_COMMITMENTS: Record<string, VolumeCommitment> = {};
const EMPTY_RELEASES: Record<string, MaterialRelease> = {};

export default function DecidePage({ params }: { params: Promise<{ situationId: string }> }) {
  const { situationId } = use(params);
  const situation = useSituation(situationId);
  const stored = useDatasetStore((s) => s.overridesBySituation[situationId]?.commitments);
  const releaseCommitment = useDatasetStore((s) => s.releaseCommitment);
  const commitments = Object.values(stored ?? EMPTY_COMMITMENTS);

  const storedReleases = useDatasetStore((s) => s.overridesBySituation[situationId]?.releases);
  const releaseMaterial = useDatasetStore((s) => s.releaseMaterial);
  const undoMaterialRelease = useDatasetStore((s) => s.undoMaterialRelease);
  const releases = storedReleases ?? EMPTY_RELEASES;

  const decisions = useMemo(
    () => (situation ? pendingDecisions(situation, releases) : []),
    [situation, releases]
  );
  const blocked = useMemo(() => (situation ? blockedMaterials(situation) : []), [situation]);

  if (!situation) return <Page>{null}</Page>;

  // A released decision has been taken; it should stop being the thing the
  // page shouts about.
  const next = decisions.find((d) => !d.released && d.urgency !== "later") ?? decisions.find((d) => !d.released);

  const onRelease = (decision: PendingDecision) => {
    if (!decision.materialId || !decision.date) return;
    releaseMaterial(situationId, {
      materialId: decision.materialId,
      materialName: decision.title.replace(/^Order /, ""),
      quantity: decision.quantity ?? 0,
      uom: decision.uom ?? "",
      decisionDate: decision.date,
      // Dataset time, never wall-clock.
      releasedAt: situation.calculatedAt,
    });
  };

  return (
    <Page>
      <div className="pt-5">
        {next ? (
          <NextDecision decision={next} onRelease={() => onRelease(next)} />
        ) : (
          <NotAvailable
            title="Nothing is waiting on you"
            detail="No dated commitment follows from what is currently carrying forward."
          />
        )}
      </div>

      <SectionRule label={`Everything on the calendar · ${decisions.length}`} />
      {decisions.length > 0 ? (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {decisions.map((decision) => (
            <DecisionRow
              key={decision.id}
              decision={decision}
              onRelease={() => onRelease(decision)}
              onUndo={
                decision.materialId
                  ? () => undoMaterialRelease(situationId, decision.materialId!)
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]">
          Nothing carries forward yet, so nothing has a date on it.
        </p>
      )}

      {blocked.length > 0 ? (
        <>
          <SectionRule label={`Cannot be committed yet · ${blocked.length}`} />
          <div className="flex flex-col gap-1.5">
            {blocked.map((row) => (
              <div
                key={row.materialName}
                className="flex items-baseline justify-between gap-4 rounded-[var(--radius-sm)] bg-[var(--surface)] px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">
                    {row.materialName}
                  </span>
                  <span className="ml-2 text-[12px] text-[var(--text-muted)]">{row.reason}</span>
                </span>
                {row.blockedBy ? (
                  <span className="flex-none text-[11.5px] text-[var(--text-muted)]">
                    waiting on {row.blockedBy}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
            These are held by a decision rather than by a lead time. Ordering them early is the risk
            this product exists to avoid — stable ingredients being predictable does not make
            uncertain packaging orderable.
          </p>
        </>
      ) : null}

      {commitments.length > 0 ? (
        <>
          <SectionRule label={`Committed by you · ${commitments.length}`} />
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {commitments.map((c) => (
              <div key={c.candidateId} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                    {c.itemName}
                  </div>
                  <div className="truncate text-[11.5px] text-[var(--text-muted)]">
                    {c.basisLabel} would have carried {fmtUnits(c.basisUnits)} · committed{" "}
                    {fmtDateShort(c.committedAt)}
                  </div>
                </div>
                <div className="flex flex-none items-baseline gap-4">
                  <span className="text-[13px] font-medium tabular-nums text-[var(--state-scenario)]">
                    {fmtUnits(c.units)}
                  </span>
                  <button
                    type="button"
                    onClick={() => releaseCommitment(situationId, c.candidateId)}
                    className="text-[11.5px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    style={{ transitionDuration: "var(--duration-fast)" }}
                  >
                    Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <SectionRule label="Production and sales timing" />
      <RunwayTimeline runway={situation.runway} />

      <SectionRule label="What this is built from" />
      <div className="grid grid-cols-1 gap-x-10 gap-y-1 sm:grid-cols-2">
        {situation.evidence.map((row) => (
          <div
            key={row.id}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-[var(--text-primary)]">{row.label}</div>
              <div className="truncate text-[11.5px] text-[var(--text-muted)]">
                {row.source}
                {row.detail ? ` · ${row.detail}` : ""}
              </div>
            </div>
            <div className="flex-none text-[12.5px] tabular-nums text-[var(--text-secondary)]">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function NextDecision({
  decision,
  onRelease,
}: {
  decision: PendingDecision;
  onRelease: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border px-5 py-5 sm:px-7 sm:py-6",
        decision.urgency === "overdue"
          ? "border-[var(--risk-critical)] bg-[var(--risk-critical-soft)]"
          : decision.urgency === "urgent"
            ? "border-[var(--risk-warning)] bg-[var(--risk-warning-soft)]"
            : "border-[var(--border)] bg-[var(--surface)]"
      )}
    >
      <Label>Next decision</Label>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[21px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[26px]">
          {decision.title}
        </span>
        {decision.date ? (
          <span className="text-[15px] tabular-nums text-[var(--text-secondary)]">
            by {fmtDateShort(decision.date)}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <UrgencyText urgency={decision.urgency} weeksAway={decision.weeksAway} />
        <span className="text-[13px] text-[var(--text-secondary)]">{decision.consequence}</span>
      </div>

      {decision.drivenBy.length > 0 ? (
        <div className="mt-3 text-[12.5px] text-[var(--text-muted)]">
          Needed for{" "}
          <span className="text-[var(--text-secondary)]">{decision.drivenBy.join(", ")}</span>
        </div>
      ) : null}

      {/* An order decision is settled here, not somewhere else. Sending the
          planner to another page to "see the items" was navigation dressed up
          as an action. */}
      <div className="mt-5 flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        {decision.materialId ? (
          <button
            type="button"
            onClick={onRelease}
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--text-on-accent)] transition-opacity hover:opacity-90 sm:py-2"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            <Check className="size-3.5" />
            {decision.quantity && decision.quantity > 0
              ? `Release ${fmtNum(Math.round(decision.quantity))} ${decision.uom} for ordering`
              : "Release for ordering"}
          </button>
        ) : null}
        <Link
          href={decision.href}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-2.5 text-[13px] font-medium transition-colors sm:py-2",
            decision.materialId
              ? "border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--interaction-hover)]"
              : "bg-[var(--accent)] text-[var(--text-on-accent)] hover:opacity-90"
          )}
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          {decision.cta}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function DecisionRow({
  decision,
  onRelease,
  onUndo,
}: {
  decision: PendingDecision;
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

function UrgencyText({
  urgency,
  weeksAway,
}: {
  urgency: DecisionUrgency;
  weeksAway: number | undefined;
}) {
  if (urgency === "overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--risk-critical)]">
        <AlertTriangle className="size-3.5" />
        Already past
      </span>
    );
  }
  if (weeksAway === undefined) {
    return <span className="text-[13px] text-[var(--text-muted)]">No date yet</span>;
  }
  return (
    <span
      className={cn(
        "text-[13px] font-semibold tabular-nums",
        urgency === "urgent" ? "text-[var(--risk-warning)]" : "text-[var(--text-primary)]"
      )}
    >
      {fmtWeeks(weeksAway)} left
    </span>
  );
}
