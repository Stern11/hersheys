"use client";

import type { CapacityImpactByLine } from "@/types/scenario";
import { fmtNum, fmtNum1, fmtPct } from "@/lib/utils/format";
import { anchorTransform, labelAnchor } from "@/lib/charts/axis";
import {
  type CapacityRowModel,
  type CapacitySeriesDef,
  buildCapacityChartModel,
  riskToken,
} from "@/lib/charts/capacity-chart-model";

/**
 * Signature Visual 2 (PRD §23.3): formal load, validated unresolved, AI
 * inferred, scenario adjustment, capacity ceiling and target headroom in ONE
 * bar per line/period — so a planner can see whether a line "only looks safe
 * because demand is absent".
 *
 * All geometry comes from `lib/charts/capacity-chart-model.ts`, which is unit
 * tested. The component only renders it. Two things that failed silently in
 * the browser are fixed structurally rather than by eye:
 *
 * 1. Cross-row comparability. Bars were drawn against a shared hours scale
 *    while each label showed that row's OWN utilization, and no axis existed
 *    to reconcile them — three rows implied three scales. There is now one
 *    labelled hours axis for the whole chart, gridlines through every track,
 *    and the load/ceiling hours printed beside the percentage so the bar can
 *    be checked against the number.
 * 2. Ceiling and target were 1px hairlines whose values lived only in `title`
 *    attributes. They are now 2px markers with their values written out in
 *    the row's breakdown line.
 *
 * Layout note (cannot be unit tested — pure CSS): the chart renders inside a
 * `react-resizable-panels` Panel that can get very narrow. There are no
 * fixed-width side columns; the identity/number row is `flex-wrap` and the
 * track is `w-full min-w-0`, so the chart reflows instead of forcing the
 * panel to scroll horizontally.
 */
export function EffectiveCapacityChart({ data }: { data: CapacityImpactByLine[] }) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-[12.5px] text-[var(--text-muted)]">No capacity buckets in scope.</div>;
  }

  const model = buildCapacityChartModel(data);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <Legend series={model.visibleSeries} />
      <div className="flex w-full min-w-0 flex-col gap-3.5">
        {model.rows.map((r) => (
          <LineRow key={r.key} r={r} ticks={model.axis.ticks} axisMax={model.axis.max} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <HoursAxis ticks={model.axis.ticks} axisMax={model.axis.max} />
        <p className="text-[10px] text-[var(--text-muted)]">
          Production hours — one shared scale across every line, so bar lengths are comparable between rows. Each row&apos;s percentage is its own load ÷ its own ceiling.
        </p>
      </div>
    </div>
  );
}

function LineRow({ r, ticks, axisMax }: { r: CapacityRowModel; ticks: number[]; axisMax: number }) {
  const risk = `var(${riskToken(r.riskLevel)})`;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[12px] font-medium" title={r.plant ? `${r.lineLabel} — ${r.plant}` : r.lineLabel}>
          {r.lineLabel} <span className="font-normal text-[var(--text-muted)]">· {r.period}</span>
        </span>
        <span className="text-[11.5px] tabular-nums text-[var(--text-secondary)]">
          {fmtNum1(r.loadHours)}h of {fmtNum1(r.ceilingHours)}h ={" "}
          <span className="text-[12.5px] font-semibold" style={{ color: risk }}>
            {fmtPct(r.effectiveUtilization)}
          </span>
        </span>
      </div>

      <div className="relative h-6 w-full min-w-0 overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
        {/* gridlines share the axis below, so headroom is readable per row */}
        {ticks.slice(1, -1).map((t) => (
          <div key={t} className="absolute inset-y-0 w-px bg-[var(--border)]" style={{ left: `${(t / axisMax) * 100}%` }} />
        ))}

        {r.segments.map((s) => (
          <div
            key={s.key}
            className="absolute inset-y-0"
            style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%`, background: `var(${s.token})` }}
            title={`${s.label} ${fmtNum1(s.hours)}h`}
          />
        ))}

        {/* target headroom — dashed */}
        <div
          className="absolute inset-y-0 w-0 border-l-[1.5px] border-dashed border-[var(--text-muted)]"
          style={{ left: `${r.targetPct}%` }}
          title={`Target ${fmtPct(r.targetUtilization)} = ${fmtNum1(r.targetHours)}h`}
        />
        {/* ceiling — solid, 2px so it reads at any width */}
        <div
          className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-[var(--text-primary)]"
          style={{ left: `${r.ceilingPct}%` }}
          title={`Ceiling ${fmtNum1(r.ceilingHours)}h`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] tabular-nums text-[var(--text-muted)]">
        {r.segments.map((s) => (
          <span key={s.key}>
            {s.label} {fmtNum1(s.hours)}h
          </span>
        ))}
        <span className="text-[var(--text-secondary)]">Ceiling {fmtNum1(r.ceilingHours)}h</span>
        <span>
          Target {fmtPct(r.targetUtilization)} = {fmtNum1(r.targetHours)}h
        </span>
        <span>Formal only {fmtPct(r.formalUtilization)}</span>
      </div>
    </div>
  );
}

function HoursAxis({ ticks, axisMax }: { ticks: number[]; axisMax: number }) {
  return (
    <div className="relative h-[18px] w-full min-w-0 border-t border-[var(--border-strong)]">
      {ticks.map((t, i) => {
        const pct = (t / axisMax) * 100;
        const anchor = labelAnchor(pct);
        return (
          <div key={t} className="absolute top-0" style={{ left: `${pct}%` }}>
            <span className="absolute top-0 block h-1 w-px bg-[var(--border-strong)]" />
            <span
              className="absolute top-[5px] block whitespace-nowrap text-[10px] tabular-nums text-[var(--text-muted)]"
              style={{ transform: anchorTransform(anchor) }}
            >
              {fmtNum(t)}
              {i === ticks.length - 1 ? "h" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Only series with load somewhere in the chart get a swatch. The old legend
 * always advertised "Scenario adjustment" even though the engine only fills
 * `scenarioAdjustmentHours` from a prebuild override, so its swatch pointed at
 * a 0px segment on every row.
 */
function Legend({ series }: { series: CapacitySeriesDef[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-[1px]" style={{ background: `var(${s.token})` }} />
          {s.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-[2px] bg-[var(--text-primary)]" />
        Ceiling
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-0 border-l-[1.5px] border-dashed border-[var(--text-muted)]" />
        Target
      </div>
    </div>
  );
}
