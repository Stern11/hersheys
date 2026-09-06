/**
 * Scenario Lab's landing view (V2 §13.2).
 *
 * Intent: a planner who wants to test one product's volume, not "a season".
 * The lab used to ask which programme to open, which is a filing question —
 * they arrive thinking about a product they are unsure of, and had to pick the
 * folder it lives in first.
 *
 * Hierarchy: the product name leads (13.5px/500/primary); the programme is
 * demoted to metadata beneath it; the number it currently carries sits right,
 * tabular, so the column scans. One focal action per row.
 *
 * Depth: borders only, matching the dense tables elsewhere in the product.
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, Search } from "lucide-react";
import { useDataset } from "@/components/dataset/dataset-provider";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { NotAvailable, Page, PageHeader, SectionRule } from "@/components/v2/page";
import { NewBadge } from "@/components/v2/new-badge";
import { cn } from "@/lib/utils/cn";
import { fmtMoney, fmtUnits } from "@/lib/utils/format";
import type { CandidateItem, PlanningSituation } from "@/types/situation";

interface Row {
  item: CandidateItem;
  situation: PlanningSituation;
}

export function SkuPicker() {
  const { situations } = useDataset();
  const scenarios = useSituationScenarioStore((s) => s.scenarios);
  const [query, setQuery] = useState("");

  // Only products that bear load: a volume that moves nothing is not something
  // to open a scenario on.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const situation of situations) {
      for (const item of situation.candidateItems) {
        if (item.disposition !== "carry_forward") continue;
        out.push({ item, situation });
      }
    }
    return out.sort((a, b) => b.item.plannedValue - a.item.plannedValue);
  }, [situations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ item, situation }) =>
      `${item.itemName} ${item.brand} ${item.productFamily} ${situation.title}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const savedCount = Object.keys(scenarios).length;

  if (situations.length === 0) {
    return (
      <Page>
        <PageHeader title="Scenario Lab" subtitle="Test a product's volume before you commit it" />
        <NotAvailable
          title="Nothing to test yet"
          detail="There are no planning situations loaded."
          action={
            <Link
              href="/workspace"
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-on-accent)]"
            >
              Go to Planning Workspace
            </Link>
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Scenario Lab"
        subtitle="Pick a product to test — you will see what it does to the whole season"
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a product"
            aria-label="Find a product"
            className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--ring)] focus-visible:outline-none sm:w-[280px]"
          />
        </div>
        <span className="text-[12px] text-[var(--text-muted)]">
          {filtered.length} carrying forward
          {savedCount > 0 ? ` · ${savedCount} saved scenario${savedCount === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <NotAvailable
          title="Nothing is carrying forward"
          detail="Mark a product carry forward on Reconcile, then come back to test its volume."
        />
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">No product matches “{query}”.</p>
      ) : (
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {filtered.map(({ item, situation }) => (
            <SkuRow key={`${situation.id}:${item.id}`} item={item} situation={situation} />
          ))}
        </div>
      )}

      <SectionRule label="Or start from a whole programme" />
      <div className="flex flex-wrap gap-2">
        {situations.map((situation) => (
          <Link
            key={situation.id}
            href={`/scenario-lab?situation=${situation.id}`}
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            <FlaskConical className="size-3.5" />
            {situation.title}
          </Link>
        ))}
      </div>
    </Page>
  );
}

function SkuRow({ item, situation }: { item: CandidateItem; situation: PlanningSituation }) {
  const moved = item.plannedUnits !== item.actualUnits;

  return (
    <Link
      href={`/scenario-lab?situation=${situation.id}&item=${encodeURIComponent(item.id)}`}
      className="group flex flex-wrap items-center gap-x-6 gap-y-1.5 py-3.5 transition-colors hover:bg-[var(--interaction-hover)]"
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium text-[var(--text-primary)] sm:truncate">
            {item.itemName}
          </span>
          {item.isNewThisSeason ? <NewBadge /> : null}
          {item.derivation === "analogue" ? (
            <span className="flex-none rounded-[var(--radius-sm)] bg-[var(--border)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--text-secondary)]">
              inferred BOM
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)] sm:truncate">
          {situation.title} · {item.productFamily}
          {item.customer ? ` · ${item.customer}` : ""}
        </div>
      </div>

      <div className="flex flex-none items-center gap-7">
        <div className="text-right">
          <div className="text-[13px] font-medium tabular-nums text-[var(--text-primary)]">
            {fmtUnits(item.plannedUnits)}
          </div>
          <div
            className={cn(
              "text-[11px] tabular-nums",
              moved ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
            )}
          >
            {moved
              ? `from ${fmtUnits(item.actualUnits)} sold`
              : fmtMoney(item.plannedValue, situation.bridge.currency)}
          </div>
        </div>
        <ArrowRight className="size-3.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
