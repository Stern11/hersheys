/**
 * What one SKU does to the plan (V2 §42, §44, §47).
 *
 * The aggregate pages answer "how big is the gap". This answers the question a
 * planner asks the moment they spot a missing item: what does *this one* cost
 * me — how much volume, on which line, and which materials does it put on the
 * clock.
 *
 * Every figure is read from `skuImpact()`, which reads the contributor lists
 * the engine recorded while summing. So a SKU's hours are literally part of
 * the line total shown on the Capacity page, not a parallel calculation that
 * could drift from it.
 */

"use client";

import Link from "next/link";
import { ArrowRight, Sliders } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DISPOSITION_ORDER, dispositionLabel } from "@/components/v2/state-badge";
import { LineLoadChart, MaterialClockChart } from "@/components/v2/sku-charts";
import { Label } from "@/components/v2/page";
import { matchExplanation, skuImpact, type SkuImpact } from "@/lib/situations/sku-impact";
import { cn } from "@/lib/utils/cn";
import { fmtHours, fmtMoney, fmtUnits } from "@/lib/utils/format";
import type { ContributorDisposition, PlanningSituation } from "@/types/situation";

export function SkuImpactDrawer({
  situation,
  candidateId,
  onClose,
  onDisposition,
}: {
  situation: PlanningSituation;
  candidateId: string | null;
  onClose: () => void;
  onDisposition: (candidateId: string, disposition: ContributorDisposition) => void;
}) {
  const impact = candidateId ? skuImpact(situation, candidateId) : undefined;

  return (
    <Drawer open={impact !== undefined} onOpenChange={(open) => (open ? undefined : onClose())}>
      {impact ? (
        <DrawerContent
          title={impact.candidate.itemName}
          description={[
            impact.candidate.brand,
            impact.candidate.productFamily,
            impact.candidate.customer,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <Body impact={impact} situation={situation} onDisposition={onDisposition} />
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function Body({
  impact,
  situation,
  onDisposition,
}: {
  impact: SkuImpact;
  situation: PlanningSituation;
  onDisposition: (candidateId: string, disposition: ContributorDisposition) => void;
}) {
  const { candidate } = impact;
  const currency = situation.bridge.currency;

  return (
    <div className="flex flex-col gap-7">
      {/* ---------------- the decision ---------------- */}
      <section>
        <div className="flex items-end justify-between gap-6">
          <div>
            <Label>Carries forward</Label>
            <div
              className={cn(
                "mt-1 text-[30px] font-semibold leading-none tracking-tight tabular-nums",
                impact.bearsLoad ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              )}
            >
              {fmtUnits(candidate.plannedUnits)}
            </div>
            <div className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
              {fmtMoney(candidate.plannedValue, currency)} · {candidate.plannedBasis.label}
            </div>
          </div>

          <div className="w-[196px]">
            <Label className="mb-1.5">Decision</Label>
            <Select
              value={candidate.disposition}
              onValueChange={(v) => onDisposition(candidate.id, v as ContributorDisposition)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPOSITION_ORDER.map((d) => (
                  <SelectItem key={d} value={d}>
                    {dispositionLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!impact.bearsLoad ? (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--chart-track)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">
            Only <span className="font-medium text-[var(--text-secondary)]">carry forward</span> adds
            load. Everything below is what this item <em>would</em> require if it did.
          </p>
        ) : null}
      </section>

      {/* ---------------- how the number was reached ---------------- */}
      <section>
        <SectionTitle>How this volume was reached</SectionTitle>
        <SeasonLadder impact={impact} />
      </section>

      {/* ---------------- representation ---------------- */}
      <section>
        <SectionTitle>What the plan has for it</SectionTitle>
        <Representation impact={impact} />
      </section>

      {/* ---------------- capacity ---------------- */}
      <section>
        <SectionTitle
          aside={impact.totalHours > 0 ? `${fmtHours(impact.totalHours)} total` : undefined}
        >
          Where it lands
        </SectionTitle>
        {impact.unmappedReason ? (
          <Note>{impact.unmappedReason}</Note>
        ) : impact.lines.length === 0 ? (
          <Note>
            {impact.bearsLoad
              ? "No line hours are attributed to this item."
              : "Mark this item carry forward to see the hours it would add."}
          </Note>
        ) : (
          <LineLoadChart lines={impact.lines} />
        )}
      </section>

      {/* ---------------- materials ---------------- */}
      <section>
        <SectionTitle
          aside={
            impact.materials.length > 0
              ? `${impact.sharedCount} shared · ${impact.itemSpecificCount} only this item`
              : undefined
          }
        >
          What it needs ordered
        </SectionTitle>
        {impact.noBomReason ? (
          <Note>{impact.noBomReason}</Note>
        ) : impact.materials.length === 0 ? (
          <Note>
            {impact.bearsLoad
              ? "No components are attributed to this item."
              : "Mark this item carry forward to see the components it would require."}
          </Note>
        ) : (
          <MaterialClockChart
            materials={impact.materials}
            today={situation.runway.today}
            productionStart={situation.productionWindow?.start}
          />
        )}
      </section>

      {/* ---------------- next ---------------- */}
      <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          Carrying a different number than the basis implies?
        </p>
        <Link
          href={`/scenario-lab?situation=${situation.id}&item=${encodeURIComponent(candidate.id)}`}
          className="inline-flex flex-none items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--interaction-hover)]"
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          <Sliders className="size-3.5" />
          Adjust volume
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * The seasons behind the number, then the growth, then the result — read top
 * to bottom it is the derivation, not a restatement of it.
 */
function SeasonLadder({ impact }: { impact: SkuImpact }) {
  const { candidate } = impact;
  const { plannedBasis: basis, seasonHistory } = candidate;
  const overridden = basis.kind === "planner_override";
  const peak = Math.max(...seasonHistory.map((s) => s.units), candidate.plannedUnits, 1);

  return (
    <div className="flex flex-col gap-1.5">
      {seasonHistory.map((point) => (
        <Bar
          key={point.period}
          label={point.period}
          value={point.units}
          peak={peak}
          tone="historical"
        />
      ))}
      {overridden ? (
        <Bar
          label={`${basis.growthPct >= 0 ? "Basis implied" : "Basis implied"}`}
          value={basis.inferredUnits}
          peak={peak}
          tone="inferred"
          muted
        />
      ) : null}
      <Bar
        label={overridden ? "Your number" : "Carries forward"}
        value={candidate.plannedUnits}
        peak={peak}
        tone={overridden ? "scenario" : "validated"}
        strong
      />
      <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
        {overridden
          ? `Set by hand. The basis would have carried ${fmtUnits(basis.inferredUnits)}.`
          : seasonHistory.length > 1
            ? `${basis.label}, applied to ${fmtUnits(basis.baselineUnits)} from ${
                seasonHistory[seasonHistory.length - 1]?.period
              }.`
            : `${basis.label}. Add a season to the basis to imply growth from observed history.`}
      </p>
    </div>
  );
}

function Bar({
  label,
  value,
  peak,
  tone,
  strong,
  muted,
}: {
  label: string;
  value: number;
  peak: number;
  tone: "historical" | "inferred" | "validated" | "scenario";
  strong?: boolean;
  muted?: boolean;
}) {
  const pct = peak > 0 ? Math.max(2, (value / peak) * 100) : 0;
  return (
    <div className={cn("flex items-center gap-3", muted && "opacity-70")}>
      <span className="w-[112px] flex-none truncate text-[11.5px] text-[var(--text-muted)]">
        {label}
      </span>
      <div className="h-[18px] flex-1 rounded-[2px] bg-[var(--chart-track)]">
        <div
          className="h-full rounded-[2px] transition-[width]"
          style={{
            width: `${pct}%`,
            background: `var(--state-${tone})`,
            transitionDuration: "var(--duration-medium)",
            transitionTimingFunction: "var(--ease-out)",
          }}
        />
      </div>
      <span
        className={cn(
          "w-[76px] flex-none text-right text-[12.5px] tabular-nums",
          strong ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        )}
      >
        {fmtUnits(value)}
      </span>
    </div>
  );
}

/**
 * Which attributes agreed and which differed. Never a bare similarity score —
 * a planner can argue with "different pack size"; they cannot argue with 64%.
 */
function Representation({ impact }: { impact: SkuImpact }) {
  const { candidate } = impact;
  const { same, different } = matchExplanation(candidate);

  if (!candidate.match.matchedItemId) {
    return (
      <Note>
        Nothing in the formal plan stands for this item. That is what puts its volume in the
        unresolved figure.
      </Note>
    );
  }

  const planned = candidate.match.matchedUnits;
  const delta =
    planned !== undefined && candidate.actualUnits > 0
      ? (planned - candidate.actualUnits) / candidate.actualUnits
      : undefined;

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2.5">
      <div className="text-[13px] font-medium text-[var(--text-primary)]">
        {candidate.match.matchedItemName ?? candidate.match.matchedItemId}
      </div>
      {planned !== undefined ? (
        <div className="mt-1 text-[12px] tabular-nums text-[var(--text-muted)]">
          {fmtUnits(candidate.actualUnits)} last season → {fmtUnits(planned)} planned
          {delta !== undefined ? (
            <span
              className={cn(
                "ml-1.5",
                Math.abs(delta) > 0.1
                  ? "font-medium text-[var(--risk-warning)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              ({delta > 0 ? "+" : ""}
              {Math.round(delta * 100)}%)
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {same.map((d) => (
          <Chip key={d} tone="same">
            {d}
          </Chip>
        ))}
        {different.map((d) => (
          <Chip key={d} tone="different">
            {d}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: string; tone: "same" | "different" }) {
  return (
    <span
      className={cn(
        "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px]",
        tone === "same"
          ? "bg-[var(--risk-positive-soft)] text-[var(--risk-positive)]"
          : "bg-[var(--risk-warning-soft)] text-[var(--risk-warning)]"
      )}
    >
      {children}
    </span>
  );
}

/** See the note on `SectionRule` — a heading should sit with its content. */
function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
        {children}
      </span>
      {aside ? <span className="text-[11.5px] text-[var(--text-muted)]">{aside}</span> : null}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-[var(--text-muted)]">{children}</p>;
}
