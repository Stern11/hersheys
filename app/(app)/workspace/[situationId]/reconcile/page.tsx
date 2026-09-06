"use client";

/**
 * Reconcile (V2 §42).
 *
 * One question: what future business is not represented yet? The bridge shows
 * the size of the gap, and the contributor list is where the planner turns a
 * number into decisions — every downstream page reads from those decisions.
 */

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, RotateCcw } from "lucide-react";
import { useDataset, useSituation } from "@/components/dataset/dataset-provider";
import { useDatasetStore } from "@/stores/dataset-store";
import { BusinessToPlanBridge } from "@/components/v2/bridge";
import { CandidateFilterBar } from "@/components/v2/candidate-filters";
import { DataTable, type Column } from "@/components/v2/data-table";
import { SeasonBasis } from "@/components/v2/season-basis";
import { NewBadge } from "@/components/v2/new-badge";
import { SkuImpactDrawer } from "@/components/v2/sku-impact-drawer";
import { MaterialDrawer } from "@/components/v2/material-drawer";
import { DispositionBadge, DISPOSITION_ORDER, dispositionLabel } from "@/components/v2/state-badge";
import { HeroMetric, Label, MetricRow, Page, SectionRule } from "@/components/v2/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyFilters, filterOptions, type CandidateFilters } from "@/lib/situations/filters";
import { cn } from "@/lib/utils/cn";
import { LOAD_BEARING_DISPOSITIONS, type CandidateItem, type ContributorDisposition } from "@/types/situation";
import { fmtMoney, fmtUnits } from "@/lib/utils/format";

export default function ReconcilePage({ params }: { params: Promise<{ situationId: string }> }) {
  const { situationId } = use(params);
  const situation = useSituation(situationId);
  const { dataset } = useDataset();
  const setDisposition = useDatasetStore((s) => s.setDisposition);
  const resetDispositions = useDatasetStore((s) => s.resetDispositions);
  const setSeasonBasis = useDatasetStore((s) => s.setSeasonBasis);
  const overrides = useDatasetStore((s) => s.overridesBySituation[situationId]);

  const [filters, setFilters] = useState<CandidateFilters>({});
  const [openSkuId, setOpenSkuId] = useState<string | null>(null);
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null);

  const candidates = useMemo(() => situation?.candidateItems ?? [], [situation]);
  const options = useMemo(() => filterOptions(candidates), [candidates]);
  const visible = useMemo(() => applyFilters(candidates, filters), [candidates, filters]);

  const counts = useMemo(() => {
    const out: Partial<Record<ContributorDisposition, number>> = {};
    for (const c of candidates) out[c.disposition] = (out[c.disposition] ?? 0) + 1;
    return out;
  }, [candidates]);

  if (!situation) return <Page>{null}</Page>;

  const { bridge } = situation;
  const edited = Object.keys(overrides?.dispositions ?? {}).length;

  const columns: Column<CandidateItem>[] = [
    {
      key: "item",
      header: "Prior item",
      width: "26%",
      sortValue: (row) => row.itemName,
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-[var(--text-primary)]">{row.itemName}</span>
            {row.isNewThisSeason ? <NewBadge /> : null}
          </div>
          <div className="truncate text-[11.5px] text-[var(--text-muted)]">
            {row.productFamily}
            {row.customer ? ` · ${row.customer}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "units",
      header: "Prior units",
      numeric: true,
      sortValue: (row) => row.actualUnits,
      render: (row) => fmtUnits(row.actualUnits),
    },
    {
      key: "planned",
      header: "Carries forward",
      numeric: true,
      sortValue: (row) => row.plannedUnits,
      render: (row) => {
        const moved = row.plannedUnits !== row.actualUnits;
        return (
          <div>
            <div className="tabular-nums text-[var(--text-primary)]">
              {fmtUnits(row.plannedUnits)}
            </div>
            {moved ? (
              <div className="text-[11.5px] text-[var(--text-muted)]">
                {row.plannedBasis.kind === "planner_override"
                  ? "set by hand"
                  : `${row.plannedBasis.growthPct >= 0 ? "+" : ""}${(
                      row.plannedBasis.growthPct * 100
                    ).toFixed(1)}%`}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "coverage",
      header: "In this year's plan",
      width: "30%",
      render: (row) => {
        const cover = coverageOf(row);
        if (!cover) {
          return (
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-[var(--text-primary)]">Nothing in the plan covers this</div>
              <div className="truncate text-[11.5px] text-[var(--text-muted)]">
                {[row.brand, row.productFamily, row.customer].filter(Boolean).join(" · ")}
              </div>
            </div>
          );
        }
        return (
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-[var(--text-primary)]">{cover.name}</div>
            <div className="truncate text-[11.5px] text-[var(--text-muted)]">
              {fmtUnits(row.actualUnits)} last year → {fmtUnits(cover.planned)} planned{" "}
              <span
                className={
                  cover.aligned ? "text-[var(--text-muted)]" : "font-medium text-[var(--risk-warning)]"
                }
              >
                ({cover.delta > 0 ? "+" : ""}
                {Math.round(cover.delta * 100)}%)
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "disposition",
      header: "Decision",
      width: "196px",
      render: (row) => (
        // The row opens the drawer; the decision control must not, or changing
        // a disposition would always be followed by a panel the planner did
        // not ask for.
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <DecisionCell
            candidate={row}
            settled={isSettled(row)}
            onChange={(value) => setDisposition(situationId, row.id, value)}
          />
        </div>
      ),
    },
  ];

  return (
    <Page>
      <div className="flex items-end justify-between gap-8 pt-7">
        <HeroMetric
          label="Not represented"
          value={fmtMoney(bridge.unresolvedValue, bridge.currency)}
          tone={bridge.unresolvedValue > 0 ? "critical" : "positive"}
          sub={`${fmtUnits(bridge.unresolvedUnits, true)} of expected business have no item in the formal plan`}
        />
        <MetricRow
          items={[
            {
              label: "Carrying forward",
              value: fmtMoney(bridge.validatedValue, bridge.currency),
              sub: `${fmtUnits(bridge.validatedUnits, true)} · drives supply and capacity`,
              tone: "neutral",
            },
            {
              label: "Unexplained",
              value: fmtMoney(bridge.unexplainedValue, bridge.currency),
              sub: "No prior item accounts for this",
              tone: bridge.unexplainedValue > bridge.unresolvedValue * 0.2 ? "warning" : "muted",
            },
          ]}
        />
      </div>

      <SectionRule label="Expected business against the formal plan" />
      <div className="mb-5">
        <SeasonBasis situation={situation} onChange={(periods) => setSeasonBasis(situationId, periods)} />
      </div>
      <BusinessToPlanBridge bridge={bridge} candidates={candidates} />

      <SectionRule
        label={`Possible contributors · ${candidates.length} prior items`}
        action={
          edited > 0 ? (
            <button
              type="button"
              onClick={() => resetDispositions(situationId)}
              className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw className="size-3" />
              Reset {edited} change{edited === 1 ? "" : "s"}
            </button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {DISPOSITION_ORDER.filter((d) => (counts[d] ?? 0) > 0).map((d) => (
          <span key={d} className="flex items-center gap-2">
            <DispositionBadge disposition={d} />
            <span className="text-[12.5px] tabular-nums text-[var(--text-secondary)]">{counts[d]}</span>
            {LOAD_BEARING_DISPOSITIONS.includes(d) ? (
              <span className="text-[11.5px] text-[var(--text-muted)]">counts as load</span>
            ) : null}
          </span>
        ))}
      </div>

      <CandidateFilterBar
        filters={filters}
        options={options}
        visible={visible}
        total={candidates.length}
        currency={bridge.currency}
        onChange={setFilters}
      />

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => setOpenSkuId(row.id)}
        isRowActive={(row) => row.id === openSkuId}
        rowClassName={(row) => (isSettled(row) ? undefined : "bg-[var(--surface)]")}
        initialSort={{ key: "planned", direction: "desc" }}
        empty={
          candidates.length === 0
            ? `No prior-season items comparable to ${situation.title} were found, so nothing can be offered as an explanation.`
            : "No items match these filters."
        }
      />

      <SkuImpactDrawer
        situation={situation}
        candidateId={openSkuId}
        onClose={() => setOpenSkuId(null)}
        onDisposition={(candidateId, disposition) =>
          setDisposition(situationId, candidateId, disposition)
        }
        onSelectMaterial={setOpenMaterialId}
      />

      <MaterialDrawer
        dataset={dataset}
        situation={situation}
        materialId={openMaterialId}
        onClose={() => setOpenMaterialId(null)}
      />

      <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-5">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          <Label className="mb-1">Next</Label>
          What {fmtUnits(bridge.validatedUnits, true)} carrying forward commits you to, and by when
        </p>
        <Link
          href={`/workspace/${situationId}/decide`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-on-accent)] transition-opacity hover:opacity-90"
        >
          Decide
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Page>
  );
}

/** How much this prior item's volume differs from the plan item covering it. */
interface Coverage {
  name: string;
  planned: number;
  /** Fractional change from prior actual to planned. */
  delta: number;
  /** Within a margin where the plan can be taken as carrying the same business. */
  aligned: boolean;
}

/** Beyond this the plan covers the item in name but not in volume. */
const ALIGNED_TOLERANCE = 0.1;

function coverageOf(row: CandidateItem): Coverage | undefined {
  const planned = row.match.matchedUnits;
  if (!row.match.matchedItemId || planned === undefined) return undefined;
  const delta = row.actualUnits === 0 ? 0 : (planned - row.actualUnits) / row.actualUnits;
  return {
    name: row.match.matchedItemName ?? row.match.matchedItemId,
    planned,
    delta,
    aligned: Math.abs(delta) <= ALIGNED_TOLERANCE,
  };
}

/**
 * A settled row is one the planner has nothing left to decide: the plan
 * already carries this business at a comparable volume. Those stay read-only
 * so the twenty-row list reads as "five things to decide" rather than twenty
 * identical dropdowns — but a plan item that covers the name while carrying a
 * materially different volume is NOT settled, because that difference is
 * exactly the kind of thing a planner should look at.
 */
function isSettled(row: CandidateItem): boolean {
  if (row.disposition !== "already_represented") return false;
  return coverageOf(row)?.aligned === true;
}

function DecisionCell({
  candidate,
  settled,
  onChange,
}: {
  candidate: CandidateItem;
  settled: boolean;
  onChange: (value: ContributorDisposition) => void;
}) {
  const [unlocked, setUnlocked] = useState(false);

  if (settled && !unlocked) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-[var(--text-muted)]">Covered</span>
        <button
          type="button"
          onClick={() => setUnlocked(true)}
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11.5px] text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--interaction-hover)] hover:text-[var(--text-primary)] focus-visible:opacity-100 group-hover:opacity-100 [tr:hover_&]:opacity-100"
        >
          <Pencil className="size-3" />
          Change
        </button>
      </div>
    );
  }

  const needsAttention = candidate.disposition === "under_review" || candidate.disposition === "unreviewed";

  return (
    <Select value={candidate.disposition} onValueChange={(value) => onChange(value as ContributorDisposition)}>
      <SelectTrigger
        className={cn(
          "w-[186px]",
          needsAttention && "border-[var(--state-inferred)] ring-1 ring-[var(--state-inferred)]/30",
          candidate.disposition === "carry_forward" && "border-[var(--state-validated)]"
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DISPOSITION_ORDER.map((option) => (
          <SelectItem key={option} value={option}>
            {dispositionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
