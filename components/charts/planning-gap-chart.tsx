"use client";

import { fmtCompact, fmtNum, fmtPct } from "@/lib/utils/format";
import { buildGapChartModel, type GapChartModel, type GapChartRowInput, type GapChartRowModel } from "@/lib/charts/gap-chart-model";
import { ChartLegend, ChartTooltip, HOVER_MARK, HOVER_RULE, type ChartLegendItem } from "@/components/charts/chart-tooltip";

export type PlanningGapChartRow = GapChartRowInput;

/**
 * Signature Visual 1 (PRD §23.2). The one thing this chart exists to say is
 * "the formal plan is materially below what this season is expected to need",
 * so the SHORTFALL is drawn as a mark of its own rather than left as a
 * subtraction the planner performs by eye between a dashed rule and a floating
 * box. The expected season is a full-width, mass-comparable column split at the
 * formal-plan line — covered below, unrepresented above — with the uncertainty
 * envelope preserved as a whisker over the column top (a single-point estimate
 * is never shown alone, per the product principles).
 *
 * Hand-built SVG/CSS: AG Charts' community `range-bar` series did not render
 * the expected band reliably in this environment (silently empty column, no
 * console error), so — matching EffectiveCapacityChart's precedent — this uses
 * direct positioning for guaranteed, exactly-controlled rendering.
 *
 * ALL geometry comes from `lib/charts/gap-chart-model.ts` (unit tested):
 * bar/segment/whisker positions, the shortfall band, the season-over-season
 * deltas and trend path, and every caption's placement. This file renders the
 * model; it computes nothing. Fixed relative to the previous version:
 *   - the shortfall was not drawn at all.
 *   - the expected column was `max-w-14` beside `max-w-20` bars, so the most
 *     important column was the smallest and read as a marker.
 *   - the y scale produced gridlines 2M apart that no value sat on.
 *   - the range caption and the formal-plan caption collided in the top-right;
 *     placement is now resolved in the model against real caption footprints.
 *   - native `title=""` tooltips (an unstyleable OS box drawn OVER the next
 *     row) are replaced by the shared `ChartTooltip`, and every mark now has a
 *     keyboard-reachable hover state.
 */
export function PlanningGapChart({ data, formalValue, unit = "units" }: { data: PlanningGapChartRow[]; formalValue: number; unit?: string }) {
  const model = buildGapChartModel(data, formalValue);
  const chartHeight = 220;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {/* plot area — exactly chartHeight tall; every absolutely-positioned
          child is placed by a percentage of THIS box, from the model */}
      <div className="relative w-full min-w-0" style={{ height: chartHeight }}>
        {model.axis.ticks.map((t) => (
          <div key={t} className="absolute left-9 right-0 border-t border-[var(--chart-gridline-color)]" style={{ top: `${100 - (t / model.axis.max) * 100}%` }}>
            <span className="absolute -top-2 left-0 -translate-x-full pr-1.5 text-[10px] tabular-nums text-[var(--text-muted)]">{fmtCompact(t)}</span>
          </div>
        ))}

        {/* columns — equal flex-1 tracks so the model's centerPct matches the
            rendered centre of every column, which is what the trend path needs */}
        <div className="absolute inset-y-0 left-9 right-0 flex items-stretch">
          {model.rows.map((row) => (
            <div key={row.period} className="relative min-w-0 flex-1 basis-0 px-1.5">
              <div className="relative mx-auto h-full w-full max-w-20">
                <GapColumn row={row} model={model} unit={unit} />
              </div>
            </div>
          ))}
        </div>

        {/* season-over-season path, above the marks, never interactive */}
        <TrendPath model={model} />

        {model.legend.formal && <FormalPlanLine model={model} unit={unit} />}
      </div>

      {/* period labels — same track geometry as the columns above */}
      <div className="flex items-start pl-9">
        {model.rows.map((row) => (
          <div key={row.period} className="min-w-0 flex-1 basis-0 px-1.5 text-center text-[11px] leading-tight text-[var(--text-muted)]">
            {row.period}
          </div>
        ))}
      </div>

      <ChartLegend items={legendItems(model, unit)} note={`Y axis: ${unit}`} className="pl-9" />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Columns
 * ------------------------------------------------------------------------- */

function GapColumn({ row, model, unit }: { row: GapChartRowModel; model: GapChartModel; unit: string }) {
  const formal = model.formal;
  const col = row.column;
  const sf = row.shortfall;

  return (
    <>
      {/* ---- historical actual ---- */}
      {row.actualHeightPct != null && row.actual != null && (
        <>
          <ChartTooltip
            title={row.period}
            subtitle="Historical actual"
            rows={[
              { label: "Actual shipped", value: `${fmtNum(row.actual)} ${unit}`, token: "--state-historical", tone: "emphasis" },
              ...(row.trend
                ? [
                    {
                      key: "sos",
                      label: `vs ${row.trend.prevPeriod}`,
                      value: `${signed(row.trend.delta)} ${unit}`,
                      hint: `${fmtNum(row.trend.prevActual)} → ${fmtNum(row.actual)} ${unit} · ${signedPct(row.trend.pctChange)}`,
                    },
                  ]
                : []),
              ...(model.legend.formal
                ? [
                    {
                      key: "vsformal",
                      label: "vs formal plan",
                      value: `${signed(row.actual - formal.value)} ${unit}`,
                      token: "--state-formal" as const,
                      hint:
                        row.actual > formal.value
                          ? "this prior season already shipped above the plan booked for the season being planned"
                          : "this prior season came in at or below the plan booked for the season being planned",
                    },
                  ]
                : []),
            ]}
            footnote="Closed season. Actuals like this are the comparable basis the expected envelope is measured against — they are not a forecast."
          >
            <div
              className={`absolute inset-x-0 bottom-0 rounded-t-[2px] bg-[var(--state-historical)] ${HOVER_MARK}`}
              style={{ height: `${row.actualHeightPct}%` }}
            />
          </ChartTooltip>

          {row.trend && (
            <div
              className="pointer-events-none absolute inset-x-0 text-center text-[10px] font-medium leading-tight tabular-nums text-[var(--text-secondary)]"
              style={{ top: `${row.trend.labelTopPct}%` }}
            >
              {signedPct(row.trend.pctChange)}
            </div>
          )}
        </>
      )}

      {/* ---- expected column: the part the formal plan already covers ---- */}
      {col && col.coveredHeightPct > 0 && (
        <ChartTooltip
          title="Covered by the formal plan"
          subtitle={row.period}
          rows={[
            { label: "Booked today", value: `${fmtNum(col.coveredValue)} ${unit}`, token: "--state-formal", tone: "emphasis" },
            { label: col.pointIsBase ? "Expected (P50)" : "Expected (high)", value: `${fmtNum(col.point)} ${unit}`, token: "--state-inferred" },
            { label: "Plan covers", value: fmtPct(col.point > 0 ? col.coveredValue / col.point : 0, 1), tone: "muted" },
          ]}
          footnote={`${fmtNum(col.coveredValue)} ÷ ${fmtNum(col.point)} expected = ${fmtPct(col.point > 0 ? col.coveredValue / col.point : 0, 1)} of the season represented`}
        >
          <div
            className={`absolute inset-x-0 bottom-0 border border-[var(--state-formal)] bg-[var(--state-formal-soft)] ${HOVER_MARK}`}
            style={{ height: `${col.coveredHeightPct}%` }}
          />
        </ChartTooltip>
      )}

      {/* ---- THE GAP: expected volume the formal plan does not represent ---- */}
      {sf && (
        <ChartTooltip
          title={`${fmtNum(sf.value)} ${unit} unrepresented`}
          subtitle="Expected demand with no formal representation"
          rows={[
            { label: col?.pointIsBase ? "Expected (P50)" : "Expected (high)", value: `${fmtNum(sf.expectedPoint)} ${unit}`, token: "--state-inferred" },
            { label: "Formal plan", value: `${fmtNum(sf.formalValue)} ${unit}`, token: "--state-formal" },
            { label: "Shortfall", value: `${fmtNum(sf.value)} ${unit}`, tone: "emphasis" },
            {
              label: "Across the envelope",
              value: `${fmtNum(sf.lowValue)} – ${fmtNum(sf.highValue)} ${unit}`,
              hint: "the same shortfall measured against the low and high ends of the expected range",
            },
            { label: "Share of the season", value: fmtPct(sf.shareOfExpected, 1), tone: "muted" },
          ]}
          footnote={`${fmtNum(sf.expectedPoint)} expected − ${fmtNum(sf.formalValue)} formal = ${fmtNum(sf.value)} ${unit}`}
        >
          <div
            className={`absolute inset-x-0 border-x-2 border-b-2 border-[var(--state-inferred)] bg-[var(--state-inferred-soft)] ${HOVER_MARK}`}
            style={{ top: `${sf.topPct}%`, height: `${sf.heightPct}%` }}
          />
        </ChartTooltip>
      )}

      {/* ---- the expected point itself (column top / P50 rule) ---- */}
      {col && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-[3px] bg-[var(--state-inferred)]"
          style={{ top: `${col.pointTopPct}%` }}
        />
      )}

      {/* ---- uncertainty envelope, as a whisker over the column top ---- */}
      {row.range && (
        <ChartTooltip
          title={row.period}
          subtitle="Expected range"
          rows={[
            { label: "High", value: `${fmtNum(row.range.high)} ${unit}`, token: "--state-inferred" },
            ...(row.range.base != null
              ? [
                  {
                    key: "p50",
                    label: "Expected (P50)",
                    value: `${fmtNum(row.range.base)} ${unit}`,
                    token: "--state-inferred" as const,
                    tone: "emphasis" as const,
                  },
                ]
              : []),
            { label: "Low", value: `${fmtNum(row.range.low)} ${unit}`, token: "--state-inferred" },
            {
              label: "Envelope width",
              value: `${fmtNum(row.range.high - row.range.low)} ${unit}`,
              tone: "muted",
              hint: "the season is planned as a range, not a single number — this is the spread the plan has to absorb",
            },
          ]}
          footnote={
            sf
              ? `Even at the low end the formal plan is short by ${fmtNum(sf.lowValue)} ${unit}.`
              : `The formal plan already covers the top of this range.`
          }
        >
          <div className={`absolute inset-x-0 ${HOVER_MARK}`} style={{ top: `${row.range.topPct}%`, height: `${row.range.heightPct}%` }}>
            <div aria-hidden className="absolute inset-x-[22%] top-0 h-0.5 bg-[var(--state-inferred)]" />
            <div aria-hidden className="absolute inset-x-[22%] bottom-0 h-0.5 bg-[var(--state-inferred)]" />
            <div aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--state-inferred)]" />
          </div>
        </ChartTooltip>
      )}

      {/* ---- the shortfall's own caption, inside the band, at rest ---- */}
      {sf && sf.labelFit !== "none" && (
        <div
          className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center text-center leading-tight text-[var(--state-inferred)]"
          style={{ top: `${sf.labelTopPct}%`, height: `${sf.labelHeightPct}%` }}
        >
          <span className="text-[12px] font-semibold tabular-nums">{fmtCompact(sf.value)}</span>
          {sf.labelFit === "full" && <span className="text-[9.5px] font-medium">unrepresented</span>}
        </div>
      )}

      {/* ---- envelope caption, above the whisker ---- */}
      {row.range && (
        <div
          className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-end text-center leading-tight"
          style={{ top: `${row.range.labelTopPct}%`, height: "12%" }}
        >
          <span className="whitespace-nowrap text-[10.5px] font-medium tabular-nums text-[var(--state-inferred)]">
            {fmtCompact(row.range.low)}–{fmtCompact(row.range.high)}
          </span>
          <span className="whitespace-nowrap text-[9.5px] text-[var(--text-muted)]">expected range</span>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Reference line + trend path
 * ------------------------------------------------------------------------- */

function FormalPlanLine({ model, unit }: { model: GapChartModel; unit: string }) {
  const { formal, shortfall, trendSummary } = model;

  return (
    <div className="absolute left-9 right-0" style={{ top: `${formal.topPct}%` }}>
      <ChartTooltip
        title={`Formal plan · ${fmtNum(formal.value)} ${unit}`}
        subtitle="What the planning system carries today"
        rows={[
          { label: "Booked demand", value: `${fmtNum(formal.value)} ${unit}`, token: "--state-formal", tone: "emphasis" },
          ...(shortfall
            ? [
                { key: "exp", label: "Expected", value: `${fmtNum(shortfall.expectedPoint)} ${unit}`, token: "--state-inferred" as const },
                {
                  key: "gap",
                  label: "Unrepresented",
                  value: `${fmtNum(shortfall.value)} ${unit}`,
                  token: "--state-inferred" as const,
                  tone: "emphasis" as const,
                },
              ]
            : []),
          ...(trendSummary
            ? [
                {
                  key: "above",
                  label: "Prior seasons above it",
                  value: `${trendSummary.seasonsAboveFormal} of ${trendSummary.seasons}`,
                  tone: "muted" as const,
                  hint: "closed seasons whose actual already exceeded the volume booked for the season being planned",
                },
              ]
            : []),
        ]}
        footnote="“Formal” is the demand orders and forecasts represent right now. Volume above this line is expected, but nothing in the plan carries it yet."
      >
        {/* 8px hit strip: enough to hover a 1px rule, narrow enough that it
            does not steal hover from the bars it crosses */}
        <div className={`absolute inset-x-0 top-0 h-2 -translate-y-1/2 ${HOVER_RULE}`}>
          <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--state-formal)]" />
        </div>
      </ChartTooltip>

      <span
        className={`pointer-events-none absolute whitespace-nowrap rounded-[2px] border border-[var(--border)] bg-[var(--surface-elevated)] px-1 py-px text-[10.5px] font-medium tabular-nums text-[var(--state-formal)] ${
          formal.labelSide === "left" ? "left-0" : "right-0"
        }`}
        style={{ top: formal.labelBelow ? 5 : -20 }}
      >
        Formal plan: {fmtCompact(formal.value)} {unit}
      </span>
    </div>
  );
}

function TrendPath({ model }: { model: GapChartModel }) {
  const { actual, projection } = model.trendPath;
  if (actual.length < 2 && !projection) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-9 right-0">
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {actual.length >= 2 && (
          <polyline
            points={actual.map((p) => `${p.xPct},${p.yPct}`).join(" ")}
            fill="none"
            stroke="var(--state-historical)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {projection && (
          <polyline
            points={projection.map((p) => `${p.xPct},${p.yPct}`).join(" ")}
            fill="none"
            stroke="var(--state-inferred)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Legend
 * ------------------------------------------------------------------------- */

function legendItems(model: GapChartModel, unit: string): ChartLegendItem[] {
  const { legend, trendSummary, shortfall, formal } = model;

  return [
    {
      key: "historical",
      label: "Historical actual",
      token: "--state-historical",
      shape: "swatch",
      present: legend.historical,
      tooltip: trendSummary
        ? {
            title: "Closed seasons",
            subtitle: `${trendSummary.seasons} comparable seasons`,
            rows: [
              { label: trendSummary.firstPeriod, value: `${fmtNum(trendSummary.firstActual)} ${unit}`, token: "--state-historical" },
              { label: trendSummary.lastPeriod, value: `${fmtNum(trendSummary.lastActual)} ${unit}`, token: "--state-historical" },
              { label: "Total change", value: `${signed(trendSummary.totalDelta)} ${unit}`, tone: "emphasis" },
              { label: "Per season", value: signedPct(trendSummary.cagr), tone: "muted", hint: "compound change across the closed seasons shown" },
              {
                label: "Above the formal plan",
                value: `${trendSummary.seasonsAboveFormal} of ${trendSummary.seasons}`,
                hint: "prior actuals that already exceeded the volume booked for the season being planned",
              },
            ],
          }
        : undefined,
    },
    {
      key: "covered",
      label: "In the formal plan",
      token: "--state-formal",
      shape: "band",
      present: legend.covered,
      tooltip: {
        title: "Covered volume",
        rows: [{ label: "Booked", value: `${fmtNum(formal.value)} ${unit}`, token: "--state-formal" }],
        footnote: "The part of the expected season that orders and forecasts already represent.",
      },
    },
    {
      key: "shortfall",
      label: "Unrepresented",
      token: "--state-inferred",
      shape: "band",
      present: legend.shortfall,
      tooltip: shortfall
        ? {
            title: `${fmtNum(shortfall.value)} ${unit}`,
            subtitle: "Expected minus formal",
            rows: [
              { label: "Share of the season", value: fmtPct(shortfall.shareOfExpected, 1), tone: "emphasis" },
              { label: "Across the envelope", value: `${fmtNum(shortfall.lowValue)} – ${fmtNum(shortfall.highValue)} ${unit}`, tone: "muted" },
            ],
            footnote: "This band is the planning gap: real expected volume that no formal demand record carries.",
          }
        : undefined,
    },
    {
      key: "range",
      label: legend.base ? "Expected range (P50 marked)" : "Expected range",
      token: "--state-inferred",
      shape: "marker",
      present: legend.range,
      tooltip: {
        title: "Expected range",
        footnote: "Uncertainty is preserved: the whisker spans the low and high ends, the solid rule is the expected point the column is drawn to.",
      },
    },
    {
      key: "formal",
      label: "Formal plan",
      token: "--state-formal",
      shape: "dashed",
      present: legend.formal,
    },
    {
      key: "trend",
      label: "Season path",
      token: "--state-historical",
      shape: "line",
      present: legend.trend,
      tooltip: {
        title: "Season-over-season path",
        footnote: "Joins the plotted season values. The dashed leg connects the last closed season to the expected point — it is a connector between two plotted values, not an extrapolation.",
      },
    },
  ];
}

/* ---------------------------------------------------------------------------
 * Local presentation helpers (formatting only — no geometry lives here)
 * ------------------------------------------------------------------------- */

function signed(n: number): string {
  if (!Number.isFinite(n) || n === 0) return `±0`;
  return `${n > 0 ? "+" : "−"}${fmtNum(Math.abs(n))}`;
}

function signedPct(fraction: number): string {
  if (!Number.isFinite(fraction) || fraction === 0) return "±0%";
  return `${fraction > 0 ? "+" : "−"}${fmtPct(Math.abs(fraction), 1)}`;
}
