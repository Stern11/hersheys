/**
 * The two per-SKU visuals (V2 §63).
 *
 * Both replace what used to be a stack of cards and a column of dates. The
 * question in each case is comparative — is *this* line the tight one, is
 * *this* component the one setting my deadline — and a comparison is a shape,
 * not a list of figures to hold in your head.
 *
 * All geometry comes from `lib/charts/sku-charts.ts`, so a bar's length and
 * the number printed beside it cannot drift apart.
 */

"use client";

import {
  buildLineLoadChart,
  buildMaterialClock,
  type LineLoadBar,
  type MaterialClockMark,
} from "@/lib/charts/sku-charts";
import type { SkuLineLoad, SkuMaterialNeed } from "@/lib/situations/sku-impact";
import { formatMonthLabel } from "@/lib/dataset/periods";
import { cn } from "@/lib/utils/cn";
import { fmtDateShort, fmtHours, fmtNum, fmtPct } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/* Where it lands                                                      */
/* ------------------------------------------------------------------ */

export function LineLoadChart({ lines }: { lines: readonly SkuLineLoad[] }) {
  const chart = buildLineLoadChart(lines);
  if (chart.bars.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
        <LegendSwatch className="bg-[var(--state-formal)]">Already on the line</LegendSwatch>
        <LegendSwatch className="bg-[var(--state-validated)]">This item</LegendSwatch>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-px border-l border-dashed border-[var(--text-muted)]" />
          Target
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-[2px] bg-[var(--text-primary)]" />
          Ceiling
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {chart.bars.map((bar) => (
          <LineBar key={bar.lineId} bar={bar} />
        ))}
      </div>

      <Axis ticks={chart.axis.ticks} max={chart.axis.max} suffix="h" />

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        Each line at its tightest month, on one shared scale so the bars are comparable.
        {chart.anyPushedOver
          ? " Highlighted rows are lines this item takes past target on its own."
          : ""}
      </p>
    </div>
  );
}

function LineBar({ bar }: { bar: LineLoadBar }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] px-2.5 py-2 transition-colors",
        bar.pushedOverByThisItem && "bg-[var(--risk-warning-soft)]"
      )}
      style={{ transitionDuration: "var(--duration-medium)" }}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
          {bar.lineName}
          <span className="ml-1.5 font-normal text-[var(--text-muted)]">
            {bar.period ? formatMonthLabel(bar.period) : ""}
          </span>
        </span>
        <span className="flex-none text-[12.5px] tabular-nums">
          <span
            className={cn(
              "font-semibold",
              bar.overTarget ? "text-[var(--risk-warning)]" : "text-[var(--text-primary)]"
            )}
          >
            {fmtPct(bar.effectiveUtilization)}
          </span>
          <span className="ml-1.5 text-[var(--text-muted)]">
            {fmtHours(bar.thisItemHours)} from this item
          </span>
        </span>
      </div>

      <div className="relative h-[22px] rounded-[3px] bg-[var(--surface-sunken)]">
        <div
          className="absolute inset-y-0 left-0 rounded-l-[3px] bg-[var(--state-formal)] transition-[width]"
          style={{
            width: `${bar.otherPct}%`,
            transitionDuration: "var(--duration-medium)",
            transitionTimingFunction: "var(--ease-out)",
          }}
        />
        <div
          className="absolute inset-y-0 bg-[var(--state-validated)] transition-[width,left]"
          style={{
            left: `${bar.otherPct}%`,
            width: `${bar.thisItemPct}%`,
            transitionDuration: "var(--duration-medium)",
            transitionTimingFunction: "var(--ease-out)",
          }}
        />
        {/* Target: where the plan wants to stop. */}
        <div
          className="absolute inset-y-[-2px] w-px border-l border-dashed border-[var(--text-muted)]"
          style={{ left: `${bar.targetPct}%` }}
          title={`Target ${fmtHours(bar.targetHours)}`}
        />
        {/* Ceiling: where the month physically ends. */}
        <div
          className="absolute inset-y-[-3px] w-[2px] bg-[var(--text-primary)]"
          style={{ left: `${bar.ceilingPct}%` }}
          title={`Ceiling ${fmtHours(bar.availableHours)}`}
        />
      </div>

      <div className="mt-1 text-[11px] tabular-nums text-[var(--text-muted)]">
        {fmtHours(bar.otherHours)} already + {fmtHours(bar.thisItemHours)} this item ={" "}
        <span className="text-[var(--text-secondary)]">{fmtHours(bar.effectiveHours)}</span> of{" "}
        {fmtHours(bar.availableHours)}
        {bar.pushedOverByThisItem ? (
          <span className="ml-1.5 font-medium text-[var(--risk-warning)]">
            — this item is what takes it over target
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What it puts on the clock                                           */
/* ------------------------------------------------------------------ */

export function MaterialClockChart({
  materials,
  today,
  productionStart,
}: {
  materials: readonly SkuMaterialNeed[];
  today: string;
  productionStart?: string;
}) {
  const clock = buildMaterialClock(materials, today, productionStart);
  if (!clock) return null;

  return (
    <div>
      {clock.binding ? (
        <p className="mb-3 text-[12.5px] text-[var(--text-secondary)]">
          <span
            className={cn(
              "font-semibold tabular-nums",
              clock.binding.weeksToDecision <= 0
                ? "text-[var(--risk-critical)]"
                : clock.binding.weeksToDecision <= 8
                  ? "text-[var(--risk-warning)]"
                  : "text-[var(--text-primary)]"
            )}
          >
            {clock.binding.weeksToDecision <= 0
              ? "Already past"
              : `${clock.binding.weeksToDecision}w`}
          </span>{" "}
          until the first thing this item commits you to —{" "}
          <span className="font-medium text-[var(--text-primary)]">
            {clock.binding.materialName}
          </span>
          , {fmtDateShort(clock.binding.decisionDate)}
        </p>
      ) : null}

      {/* Month scale */}
      <div className="relative mb-1.5 h-[14px]">
        {clock.ticks.map((tick) => (
          <span
            key={tick.label + tick.pct}
            className="absolute -translate-x-1/2 text-[10.5px] text-[var(--text-muted)]"
            style={{ left: `${tick.pct}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <div className="relative flex flex-col gap-1">
        {/* Gridlines and today, drawn behind every row. */}
        <div className="pointer-events-none absolute inset-0">
          {clock.ticks.map((tick) => (
            <div
              key={tick.label + tick.pct}
              className="absolute inset-y-0 w-px bg-[var(--chart-gridline-color)]"
              style={{ left: `${tick.pct}%` }}
            />
          ))}
          <div
            className="absolute inset-y-0 w-[1.5px] bg-[var(--text-primary)]"
            style={{ left: `${clock.todayPct}%` }}
            title={`Today · ${fmtDateShort(today)}`}
          />
        </div>

        {clock.marks.map((mark) => (
          <ClockRow key={mark.materialId} mark={mark} />
        ))}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        Each component sits on the date it has to be ordered by to arrive before production. The
        leftmost is what runs out of time first.{" "}
        <span className="text-[var(--text-secondary)]">Shared</span> means another item you have
        already carried forward needs it too, so it can be ordered whatever you decide here.
      </p>
    </div>
  );
}

function ClockRow({ mark }: { mark: MaterialClockMark }) {
  const tone =
    mark.status === "PLAN_NOW"
      ? "var(--risk-positive)"
      : mark.status === "REVIEW"
        ? "var(--risk-warning)"
        : "var(--state-unknown)";

  // Labels flip to the left of the mark once it sits past the midpoint, so a
  // late date never renders its text off the edge of the chart.
  const flip = mark.datePct > 55;

  return (
    <div className="relative h-[30px]">
      {/* The label keeps its reading order whichever side of the mark it sits
          on — flipping the flex direction as well would print the date before
          the component name and read backwards. */}
      <div
        className="absolute top-1/2 z-10 flex -translate-y-1/2 items-baseline gap-1.5"
        style={
          flip
            ? { right: `calc(${100 - mark.datePct}% + 10px)` }
            : { left: `calc(${mark.datePct}% + 10px)` }
        }
      >
        <span className="whitespace-nowrap text-[11.5px] font-medium text-[var(--text-primary)]">
          {mark.materialName}
        </span>
        <span className="whitespace-nowrap text-[11px] tabular-nums text-[var(--text-muted)]">
          {fmtDateShort(mark.decisionDate)} · {fmtNum(Math.round(mark.requirement))} {mark.uom} ·{" "}
          {mark.leadTimeDays}d lead
          {mark.standsWithoutThisItem ? "" : " · waits on this item"}
        </span>
      </div>

      <div
        className={cn(
          "absolute top-1/2 h-[15px] w-[3px] -translate-y-1/2 rounded-full",
          mark.isBinding && "h-[21px] w-[4px]"
        )}
        style={{ left: `${mark.datePct}%`, background: tone }}
        title={`${mark.materialName} — order by ${fmtDateShort(mark.decisionDate)}`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Axis({ ticks, max, suffix }: { ticks: number[]; max: number; suffix: string }) {
  return (
    <div className="relative mt-1.5 h-[14px]">
      {ticks.map((tick) => (
        <span
          key={tick}
          className={cn(
            "absolute text-[10.5px] tabular-nums text-[var(--text-muted)]",
            tick === 0 ? "left-0" : "-translate-x-1/2"
          )}
          style={tick === 0 ? undefined : { left: `${(tick / max) * 100}%` }}
        >
          {Math.round(tick)}
          {tick === ticks[ticks.length - 1] ? suffix : ""}
        </span>
      ))}
    </div>
  );
}

function LegendSwatch({ children, className }: { children: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-[2px]", className)} />
      {children}
    </span>
  );
}
