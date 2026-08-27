"use client";

import type { CapacityImpactByLine } from "@/types/scenario";
import { fmtNum, fmtNum1, fmtPct } from "@/lib/utils/format";
import { anchorTransform, labelAnchor } from "@/lib/charts/axis";
import { softToken } from "@/lib/charts/tooltip-model";
import { ChartLegend, ChartTooltip, HOVER_MARK, HOVER_ROW, HOVER_RULE } from "@/components/charts/chart-tooltip";
import {
  type CapacityRowModel,
  type CapacitySegmentModel,
  buildCapacityChartModel,
  formalContrastNote,
  riskLevelExplanation,
} from "@/lib/charts/capacity-chart-model";

/**
 * Signature Visual 2 (PRD §23.3): formal load, validated unresolved, AI
 * inferred, scenario adjustment, capacity ceiling and target headroom in ONE
 * bar per line/period — so a planner can see whether a line "only looks safe
 * because demand is absent".
 *
 * All geometry comes from `lib/charts/capacity-chart-model.ts`, which is unit
 * tested. The component only renders it.
 *
 * WHAT THE EARLIER PASSES FIXED (do not regress):
 * 1. Cross-row comparability — one labelled hours axis for the whole chart,
 *    gridlines through every track, and the load/ceiling hours printed beside
 *    the percentage so the bar can be checked against the number.
 * 2. Ceiling and target are 2px/dashed markers whose values are written out at
 *    rest, not hidden in a hover.
 *
 * WHAT THIS PASS FIXES:
 * 3. Native `title=""` tooltips are gone. They rendered as an unstyled OS box
 *    that appeared ~1s late and was drawn OVER the neighbouring row (visible in
 *    the reported screenshot, where "Ceiling 380.0h" covered the L03 bar).
 *    Every mark now uses the shared `ChartTooltip`, which portals to `body`
 *    and flips/clamps instead of covering.
 * 4. The six-value grey metadata run is split into two weighted groups —
 *    COMPOSITION (swatched hours that tie back to the bar) and REFERENCE
 *    (target / ceiling / headroom, each behind the glyph of its marker).
 * 5. The formal-only vs effective contrast is promoted out of the end of that
 *    run into a first-class chip on the row header, because it is the whole
 *    claim of the section: "formal load looks safe on Stuarts Draft L03 —
 *    effective load tells a different story."
 * 6. An at-risk row is now identifiable in peripheral vision: a `--risk-*`
 *    left rail plus a `-soft` row tint. That is a legitimate use of the risk
 *    tokens — it is STATUS about the line, not a label for a data series. The
 *    series fills stay `--state-*` throughout.
 * 7. Segment separability in BOTH themes. `--state-formal` inverts between
 *    themes (dark: near-white oklch(0.85 …), light: oklch(0.32 …)), so no
 *    single stacking order makes every adjacency safe. Instead each segment
 *    after the first draws a 1px INSET separator in the track colour
 *    (`--surface-sunken`: near-black in dark, near-white in light), which
 *    contrasts against every series fill in both themes and costs no layout
 *    (inset box-shadow, so the percentage geometry is untouched). The stack
 *    order is kept because it encodes a provenance-certainty gradient — see
 *    the comment on `CAPACITY_SERIES`.
 *
 * Layout note (cannot be unit tested — pure CSS): the chart renders inside a
 * `react-resizable-panels` Panel that can get very narrow. There are no
 * fixed-width side columns; the identity/number row is `flex-wrap` and the
 * track is `w-full min-w-0`, so the chart reflows instead of forcing the
 * panel to scroll horizontally.
 */
/**
 * Left inset of a row's plot track: row `px-2` (8px) + status rail (3px) +
 * `gap-2.5` (10px) = 21px; right inset is the row's own 8px. The legend and
 * the shared hours axis use the same inset so ticks line up with gridlines.
 */
const ROW_TRACK_INSET = "pl-[21px] pr-2";

export function EffectiveCapacityChart({ data }: { data: CapacityImpactByLine[] }) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-[12.5px] text-[var(--text-muted)]">No capacity buckets in scope.</div>;
  }

  const model = buildCapacityChartModel(data);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {/* `ROW_TRACK_INSET` keeps the legend and the shared axis aligned with the
          plot tracks, which are inset by the row padding + status rail + gap.
          A full-width axis under inset tracks would put every gridline label a
          few px off its own gridline. */}
      <ChartLegend
        className={ROW_TRACK_INSET}
        items={[
          ...model.visibleSeries.map((s) => ({
            key: s.key,
            label: s.label,
            token: s.token,
            shape: "swatch" as const,
            tooltip: {
              title: s.label,
              subtitle: "Load series",
              footnote: s.meaning,
            },
          })),
          {
            key: "ceiling",
            label: "Ceiling",
            token: "--text-primary" as const,
            shape: "marker" as const,
            tooltip: {
              title: "Capacity ceiling",
              subtitle: "Reference marker",
              footnote: "Available hours minus planned downtime, per line and period. Load past this marker cannot be produced on that line in that period.",
            },
          },
          {
            key: "target",
            label: "Target",
            token: "--text-muted" as const,
            shape: "dashed" as const,
            tooltip: {
              title: "Target utilization",
              subtitle: "Reference marker",
              footnote: "An alert threshold, not a load lever: it never enters the utilization arithmetic, it only sets the row's risk level. The gap to the ceiling is the buffer left for changeovers and variability.",
            },
          },
          {
            key: "at-risk",
            label: "At-risk line",
            token: "--risk-warning" as const,
            shape: "swatch" as const,
            present: model.anyAtRisk,
            tooltip: {
              title: "At-risk line",
              subtitle: "Status, not a series",
              footnote: "A tinted row with a coloured rail is flagged by the engine's risk level. Amber: effective load is over the target. Red: effective load is over the ceiling.",
            },
          },
        ]}
      />

      <div className="flex w-full min-w-0 flex-col gap-1">
        {model.rows.map((r) => (
          <LineRow key={r.key} r={r} ticks={model.axis.ticks} axisMax={model.axis.max} />
        ))}
      </div>

      <div className={`flex flex-col gap-1 ${ROW_TRACK_INSET}`}>
        <HoursAxis ticks={model.axis.ticks} axisMax={model.axis.max} />
        <p className="text-[10px] text-[var(--text-muted)]">
          Production hours — one shared scale across every line, so bar lengths are comparable between rows. Each row&apos;s percentage is its own load ÷ its own ceiling.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Row
 * ---------------------------------------------------------------------- */

function LineRow({ r, ticks, axisMax }: { r: CapacityRowModel; ticks: number[]; axisMax: number }) {
  const risk = `var(${r.risk})`;

  return (
    <div
      className="flex w-full min-w-0 gap-2.5 rounded-[4px] px-2 py-2"
      style={r.atRisk ? { background: `var(${softToken(r.risk)})` } : undefined}
    >
      {/* Status rail. Always occupies width so every track starts at the same
          x — a rail that appeared only on at-risk rows would shift their bars
          relative to the others and break cross-row comparison. */}
      <span aria-hidden className="w-[3px] shrink-0 rounded-full" style={{ background: r.atRisk ? risk : "transparent" }} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <RowIdentity r={r} />
          <UtilizationContrast r={r} />
        </div>

        <div className="relative h-7 w-full min-w-0 overflow-hidden rounded-[3px] bg-[var(--surface-sunken)]">
          {/* gridlines share the axis below, so headroom is readable per row */}
          {ticks.slice(1, -1).map((t) => (
            <div key={t} aria-hidden className="absolute inset-y-0 w-px bg-[var(--border)]" style={{ left: `${(t / axisMax) * 100}%` }} />
          ))}

          {r.segments.map((s) => (
            <ChartTooltip key={s.key} {...segmentTooltip(r, s)}>
              <div
                className={`absolute inset-y-0 ${HOVER_MARK}`}
                style={{
                  left: `${s.leftPct}%`,
                  width: `${s.widthPct}%`,
                  background: `var(${s.token})`,
                  // 1px separator in the TRACK colour — see the header note.
                  // Inset, so the segment's percentage geometry is unchanged.
                  boxShadow: s.index > 0 ? "inset 1px 0 0 0 var(--surface-sunken)" : undefined,
                }}
              />
            </ChartTooltip>
          ))}

          {/* target headroom — dashed. The 9px box is the hover/focus target;
              the inner span draws the 1.5px rule. */}
          <ChartTooltip {...targetTooltip(r)} side="top">
            <div
              className={`absolute inset-y-0 flex w-[9px] -translate-x-1/2 justify-center rounded-[2px] ${HOVER_RULE}`}
              style={{ left: `${r.targetPct}%` }}
            >
              <span aria-hidden className="block h-full w-0 border-l-[1.5px] border-dashed border-[var(--text-muted)]" />
            </div>
          </ChartTooltip>

          {/* ceiling — solid, 2px so it reads at any width */}
          <ChartTooltip {...ceilingTooltip(r)} side="top">
            <div
              className={`absolute inset-y-0 flex w-[9px] -translate-x-1/2 justify-center rounded-[2px] ${HOVER_RULE}`}
              style={{ left: `${r.ceilingPct}%` }}
            >
              <span aria-hidden className="block h-full w-[2px] bg-[var(--text-primary)]" />
            </div>
          </ChartTooltip>
        </div>

        <RowBreakdown r={r} />
      </div>
    </div>
  );
}

function RowIdentity({ r }: { r: CapacityRowModel }) {
  return (
    <ChartTooltip
      title={r.lineLabel}
      subtitle={r.plant ?? undefined}
      rows={[
        { label: "Period", value: r.period },
        { label: "Capacity ceiling", value: `${fmtNum1(r.ceilingHours)}h`, token: "--text-primary", tone: "muted" },
        { label: "Target utilization", value: `${fmtPct(r.targetUtilization)} · ${fmtNum1(r.targetHours)}h`, token: "--text-muted", tone: "muted" },
        {
          label: "Run rate",
          value: r.runRateUnitsPerHour === null ? null : `${fmtNum(r.runRateUnitsPerHour)} units/h`,
          hint: r.runRateSource ?? undefined,
          tone: "muted",
        },
      ]}
      footnote="The rate above is what the RCCP pass divided this line's demand by to get hours — every hour figure in this row traces back to it."
      side="top"
      align="start"
    >
      <span className={`rounded-[3px] px-1 -mx-1 text-[12px] font-medium ${HOVER_ROW}`}>
        {r.lineLabel} <span className="font-normal text-[var(--text-muted)]">· {r.period}</span>
      </span>
    </ChartTooltip>
  );
}

/**
 * The section's actual claim, made a first-class element: formal-only
 * utilization -> effective utilization, with the gap in utilization points.
 * It used to be the last item of a six-value grey run ("Formal only 57%").
 */
function UtilizationContrast({ r }: { r: CapacityRowModel }) {
  const deltaPts = Math.round(r.utilizationDelta * 100);
  const showDelta = Math.abs(r.utilizationDelta) >= 0.005;
  const deltaLabel = `${r.utilizationDelta > 0 ? "+" : "−"}${Math.abs(deltaPts)} pts`;

  return (
    <ChartTooltip
      title="Formal-only vs effective load"
      subtitle={`${r.lineLabel} · ${r.period}`}
      rows={[
        {
          label: "Formal only",
          value: `${fmtPct(r.formalUtilization, 1)} · ${fmtNum1(r.formalHours)}h`,
          token: "--state-formal",
          hint: "What the ERP/APS reports for this line today",
        },
        {
          label: "Unresolved added",
          value: r.unresolvedHours > 0 ? `${fmtNum1(r.unresolvedHours)}h` : null,
          token: "--state-inferred",
          hint: r.unresolvedUnits === null ? undefined : `≈ ${fmtNum(r.unresolvedUnits)} units at this line's run rate`,
        },
        {
          label: "Effective",
          value: `${fmtPct(r.effectiveUtilization, 1)} · ${fmtNum1(r.loadHours)}h`,
          token: r.risk,
          tone: "emphasis",
        },
        {
          label: "Gap",
          value: showDelta ? `${deltaLabel} of utilization` : null,
        },
        {
          label: "Risk",
          value: r.riskLevel === "critical" ? "Over ceiling" : r.riskLevel === "warning" ? "Over target" : "Within target",
          token: r.risk,
          hint: riskLevelExplanation(r.riskLevel),
        },
      ]}
      footnote={formalContrastNote(r)}
      ariaLabel={`${r.lineLabel} ${r.period}. Formal-only utilization ${fmtPct(r.formalUtilization, 1)}, effective utilization ${fmtPct(r.effectiveUtilization, 1)}.`}
      side="top"
      align="end"
    >
      <span className={`inline-flex items-baseline gap-1.5 rounded-[3px] border border-[var(--border)] px-1.5 py-0.5 ${HOVER_ROW}`}>
        <span className="text-[9.5px] uppercase tracking-wide text-[var(--text-muted)]">Formal</span>
        <span className="text-[11.5px] tabular-nums text-[var(--text-secondary)]">{fmtPct(r.formalUtilization)}</span>
        <span aria-hidden className="text-[11px] text-[var(--text-muted)]">→</span>
        <span className="text-[9.5px] uppercase tracking-wide text-[var(--text-muted)]">Effective</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: `var(${r.risk})` }}>
          {fmtPct(r.effectiveUtilization)}
        </span>
        {showDelta && <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{deltaLabel}</span>}
      </span>
    </ChartTooltip>
  );
}

/**
 * The old single grey run is now two groups with different weights:
 * COMPOSITION (swatched, ties back to the bar) and REFERENCE (behind each
 * marker's own glyph). The hours carry the emphasis; the words do not.
 */
function RowBreakdown({ r }: { r: CapacityRowModel }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] tabular-nums text-[var(--text-muted)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {r.segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            {s.index > 0 && (
              <span aria-hidden className="text-[var(--text-muted)]">
                +
              </span>
            )}
            {/* Same content as the segment's own tooltip: the bar segment is
                the focusable mark, this duplicate is a wider pointer target
                for a thin segment and is kept out of the tab order. */}
            <ChartTooltip {...segmentTooltip(r, s)} focusable={false} side="bottom">
              <span className={`flex items-center gap-1.5 rounded-[3px] px-1 -mx-1 ${HOVER_ROW}`}>
                <span aria-hidden className="size-2 shrink-0 rounded-[1px]" style={{ background: `var(${s.token})` }} />
                <span className="font-medium text-[var(--text-secondary)]">{fmtNum1(s.hours)}h</span>
                <span>{s.label}</span>
              </span>
            </ChartTooltip>
          </div>
        ))}
        <span>
          = <span className="font-medium text-[var(--text-primary)]">{fmtNum1(r.loadHours)}h</span> effective load
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-0 shrink-0 border-l-[1.5px] border-dashed border-[var(--text-muted)]" />
          Target {fmtNum1(r.targetHours)}h
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-[2px] shrink-0 bg-[var(--text-primary)]" />
          Ceiling {fmtNum1(r.ceilingHours)}h
        </span>
        {r.crossesTarget ? (
          <span className="font-medium" style={{ color: `var(${r.risk})` }}>
            {r.crossesCeiling
              ? `${fmtNum1(r.overCeilingHours)}h over ceiling`
              : `${fmtNum1(r.overTargetHours)}h over target`}
          </span>
        ) : (
          <span>{fmtNum1(r.targetHours - r.loadHours)}h under target</span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Tooltip content — every number below comes from the model, none is invented
 * ---------------------------------------------------------------------- */

function segmentTooltip(r: CapacityRowModel, s: CapacitySegmentModel) {
  return {
    title: `${r.lineLabel} · ${r.period}`,
    subtitle: s.label,
    rows: [
      { label: "Hours", value: `${fmtNum1(s.hours)}h`, token: s.token, tone: "emphasis" as const },
      {
        label: "At run rate",
        value: s.units === null ? null : `${fmtNum(s.units)} units`,
        hint:
          r.runRateUnitsPerHour === null
            ? undefined
            : `${fmtNum(r.runRateUnitsPerHour)} units/h${r.runRateSource ? ` · ${r.runRateSource}` : ""}`,
        tone: "muted" as const,
      },
      { label: "Share of ceiling", value: s.shareOfCeiling === null ? null : fmtPct(s.shareOfCeiling, 1) },
      {
        label: "Load through here",
        value: `${fmtNum1(s.cumulativeHours)}h`,
        hint: s.cumulativeUtilization === null ? undefined : `${fmtPct(s.cumulativeUtilization, 1)} of the ${fmtNum1(r.ceilingHours)}h ceiling`,
        tone: "muted" as const,
      },
    ],
    footnote: s.meaning,
    ariaLabel: `${r.lineLabel} ${r.period}, ${s.label}, ${fmtNum1(s.hours)} hours. ${s.meaning}`,
  };
}

function ceilingTooltip(r: CapacityRowModel) {
  return {
    title: `Capacity ceiling · ${fmtNum1(r.ceilingHours)}h`,
    subtitle: `${r.lineLabel} · ${r.period}`,
    rows: [
      { label: "Effective load", value: `${fmtNum1(r.loadHours)}h`, token: r.risk, tone: "emphasis" as const },
      r.headroomHours >= 0
        ? { label: "Headroom left", value: `${fmtNum1(r.headroomHours)}h` }
        : { label: "Over ceiling", value: `${fmtNum1(-r.headroomHours)}h`, token: r.risk },
      { label: "Target sits at", value: `${fmtNum1(r.targetHours)}h`, token: "--text-muted" as const, tone: "muted" as const },
    ],
    footnote: "Available hours minus planned downtime. Load past this marker cannot be produced on this line in this period — it has to move line, move period, or not happen.",
    ariaLabel: `Capacity ceiling ${fmtNum1(r.ceilingHours)} hours on ${r.lineLabel} ${r.period}. Effective load ${fmtNum1(r.loadHours)} hours.`,
  };
}

function targetTooltip(r: CapacityRowModel) {
  return {
    title: `Target ${fmtPct(r.targetUtilization)} · ${fmtNum1(r.targetHours)}h`,
    subtitle: `${r.lineLabel} · ${r.period}`,
    rows: [
      { label: "Effective load", value: `${fmtNum1(r.loadHours)}h`, token: r.risk, tone: "emphasis" as const },
      r.crossesTarget
        ? { label: "Over target by", value: `${fmtNum1(r.overTargetHours)}h`, token: r.risk }
        : { label: "Under target by", value: `${fmtNum1(r.targetHours - r.loadHours)}h` },
      { label: "Formal only", value: `${fmtNum1(r.formalHours)}h`, token: "--state-formal" as const, tone: "muted" as const },
      { label: "Buffer to ceiling", value: `${fmtNum1(r.ceilingHours - r.targetHours)}h`, tone: "muted" as const },
    ],
    footnote: "An alert threshold, not a load lever: it never enters the utilization arithmetic, it only sets this row's risk level. The gap to the ceiling is the buffer kept for changeovers and variability.",
    ariaLabel: `Target ${fmtPct(r.targetUtilization)}, ${fmtNum1(r.targetHours)} hours on ${r.lineLabel} ${r.period}.`,
  };
}

/* ---------------------------------------------------------------------- *
 * Axis
 * ---------------------------------------------------------------------- */

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
