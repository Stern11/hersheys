"use client";

import * as React from "react";
import type { DecisionDeadline } from "@/types/planning";
import { MATERIALS } from "@/data/synthetic/materials";
import { fmtDate, fmtNum } from "@/lib/utils/format";
import { anchorTransform } from "@/lib/charts/axis";
import { ChartLegend, ChartTooltip, HOVER_MARK, HOVER_ROW, HOVER_RULE, type ChartLegendItem } from "@/components/charts/chart-tooltip";
import {
  RUNWAY_WARNING_WEEKS,
  buildRunwayModel,
  urgencyNote,
  windowRelationNote,
  type RunwayDeadlineModel,
  type RunwayModel,
  type RunwayMonth,
  type RunwayWindowModel,
} from "@/lib/charts/runway-model";

/**
 * Signature Visual: Decision Runway (PRD §11C — remaining optionality).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS CHART EXISTS TO SAY
 * ─────────────────────────────────────────────────────────────────────────
 * Halloween 2027 is BUILT March–July 2027 and SOLD September–October 2027.
 * Production timing and sales timing are separate windows on `BusinessEvent`
 * and conflating them is the single most expensive mistake this workspace can
 * let a planner make (CLAUDE.md). So they are drawn as two named lanes with a
 * label of their own, their own series colour, their own date range and
 * duration printed at rest, and a hover that says what each window MEANS —
 * not two 10px uppercase captions floating over a grey and a teal bar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS PASS FIXED (do not regress)
 * ─────────────────────────────────────────────────────────────────────────
 * 1. NO DATE SCALE. Ticks appeared only where a deadline happened to fall, so
 *    a planner could not tell where June was. There are now month gridlines
 *    and month labels spanning a padded, month-snapped domain
 *    (`runwayDomain`), and every position is a percentage of that domain.
 * 2. EIGHT NATIVE `title=""` TOOLTIPS on the deadline ticks — the unstyleable,
 *    late, keyboard-unreachable OS box the redesign exists to remove. Every
 *    mark now uses the shared `ChartTooltip`, which portals to `body` and
 *    flips/clamps instead of covering the next mark. There is no `title`
 *    attribute anywhere in this file.
 * 3. ZERO HOVERABLE MARKS. Windows, every deadline tick (labelled or not),
 *    Today, the runway bracket, each month band and each legend entry are now
 *    hoverable AND keyboard-focusable.
 * 4. SIX OF EIGHT TICKS UNIDENTIFIABLE. The at-rest anti-collision rule is
 *    kept — a pile of overlapping captions is not legibility — but the
 *    labelled leader now says how many dates it stands for and through what
 *    date, and every hidden tick carries its own kind, exact date,
 *    weeks-from-today and owning material on hover.
 * 5. NO LEGEND. "Production = grey, sales = teal" was decodable only from two
 *    small uppercase captions.
 * 6. "TODAY" WITH NO DATE, JAMMED INTO THE LEFT EDGE against the production
 *    window start. The domain is padded out to whole months, and Today is a
 *    full-height rule with a dated chip.
 * 7. THE RUNWAY CALLOUT WAS DISCONNECTED from the mark it described. The
 *    "10.1 weeks" is now also drawn as a bracket in the plot, spanning
 *    literally from the Today rule to the binding deadline's tick.
 *
 * ALL geometry and date maths comes from `lib/charts/runway-model.ts`, which
 * is unit tested (month tick generation, percentage positioning, cluster
 * labelling, and signed weeks-from-today including the overdue case). This
 * file renders that model and computes nothing.
 *
 * TOKENS. The two windows are DATA SERIES, so they take `--state-*`
 * (`--state-validated` for the build, `--state-scenario` for the sell) and
 * never a risk colour. Urgency — overdue / inside two weeks / inside six
 * weeks / clear — is STATUS about a date, so it takes `--risk-*`, and only
 * the binding deadline, the runway bracket and the headline number wear it.
 */

/* ---------------------------------------------------------------------------
 * Layout constants. The lane-label gutter is a fixed pixel column, and the
 * gridline/Today overlay is inset by exactly the same amount, so a gridline
 * lines up with the mark above it at any container width.
 * ------------------------------------------------------------------------- */
const GUTTER_W = 74;
const GUTTER_GAP = 12;
const PLOT_LEFT = GUTTER_W + GUTTER_GAP;

export function DecisionRunwayTimeline({
  today,
  deadlines,
  productionWindow,
  salesWindow,
}: {
  today: string;
  deadlines: DecisionDeadline[];
  productionWindow: { start: string; end: string };
  salesWindow: { start: string; end: string };
}) {
  const model = React.useMemo(
    () => buildRunwayModel({ today, deadlines, productionWindow, salesWindow }),
    [today, deadlines, productionWindow, salesWindow]
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <RunwayHeadline model={model} />

      <div className="relative w-full min-w-0">
        {/* Month gridlines, behind every mark. Never interactive: the month
            BANDS in the header row carry the hover, so a gridline crossing a
            bar cannot steal that bar's hover. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0" style={{ left: PLOT_LEFT }}>
          {model.months.map((m) =>
            m.startPct <= 0 ? null : (
              <span key={m.key} className="absolute inset-y-0 w-px bg-[var(--chart-gridline-color)]" style={{ left: `${m.startPct}%` }} />
            )
          )}
        </div>

        {/* Today — one full-height rule across every lane, with its date.
            The wrapper spans the whole plot, so it MUST be pointer-transparent:
            an interactive full-plot box at z-20 silently swallows the hover of
            every window bar, tick and month label underneath it. Only the 11px
            rule itself takes the pointer back. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20" style={{ left: PLOT_LEFT }}>
          <ChartTooltip {...todayTooltip(model)} side="right" align="start">
            <div
              className={`pointer-events-auto absolute inset-y-0 flex w-[11px] -translate-x-1/2 justify-center ${HOVER_RULE}`}
              style={{ left: `${model.today.pct}%` }}
            >
              <span aria-hidden className="h-full w-[1.5px] bg-[var(--text-primary)]" />
            </div>
          </ChartTooltip>
          <span
            className="pointer-events-none absolute top-0 whitespace-nowrap rounded-[3px] border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-1.5 py-px text-[10px] font-semibold text-[var(--text-primary)]"
            style={{ left: `${model.today.pct}%`, transform: anchorTransform(model.today.anchor) }}
          >
            Today · <span className="tabular-nums font-normal text-[var(--text-secondary)]">{fmtDate(model.today.iso)}</span>
          </span>
        </div>

        {/* row 1 — clearance for the Today chip */}
        <PlotRow className="h-[19px]" />

        {/* row 2 — the date scale */}
        <PlotRow label={null} className="h-[17px]">
          {model.months.map((m) => (
            <MonthBand key={m.key} month={m} model={model} />
          ))}
        </PlotRow>

        {/* rows 3-4 — the two windows, as two named lanes */}
        <WindowLane window={model.production} model={model} gutter="Production" gutterNote="build it" />
        <WindowLane window={model.sales} model={model} gutter="Sales" gutterNote="sell it" />

        {/* row 5 — the runway itself, drawn between the marks it measures */}
        <RunwayBracket model={model} />

        {/* row 6 — the decision dates */}
        <DeadlineAxis model={model} />
      </div>

      {/* The legend and the derivation note are inset by the same gutter as the
          plot, so they start where the marks they describe start. */}
      <div className="flex flex-col gap-1.5" style={{ paddingLeft: PLOT_LEFT }}>
        <ChartLegend items={legendItems(model)} />
        <p className="text-[10.5px] leading-snug text-[var(--text-muted)]">{separationSentence(model)}</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Row scaffolding — a fixed gutter label plus a percentage-positioned plot box
 * ------------------------------------------------------------------------- */

function PlotRow({
  label,
  note,
  className,
  children,
}: {
  label?: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 items-start" style={{ gap: GUTTER_GAP }}>
      <div className="shrink-0 text-right" style={{ width: GUTTER_W }}>
        {label != null && (
          <div className="pt-0.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--text-secondary)]">{label}</div>
        )}
        {note != null && <div className="text-[9.5px] leading-tight text-[var(--text-muted)]">{note}</div>}
      </div>
      <div className={`relative min-w-0 flex-1 ${className ?? ""}`}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Date scale
 * ------------------------------------------------------------------------- */

function MonthBand({ month, model }: { month: RunwayMonth; model: RunwayModel }) {
  const inside = model.deadlines.filter((d) => d.dateISO >= month.startISO && d.dateISO <= month.endISO);

  return (
    <ChartTooltip
      title={month.longLabel}
      subtitle="Month band on the runway scale"
      rows={[
        { label: "Spans", value: `${fmtDate(month.startISO)} – ${fmtDate(month.endISO)}` },
        { label: "Days", value: `${month.days}` },
        {
          label: "Decision dates here",
          value: `${inside.length}`,
          token: inside.length > 0 ? "--text-primary" : undefined,
          hint: inside.length > 0 ? inside.map((d) => fmtDate(d.dateISO)).join(", ") : "nothing in this workspace is decided this month",
        },
        { label: "Building", value: overlapText(month, model.production), token: model.production.token, tone: "muted" },
        { label: "Selling", value: overlapText(month, model.sales), token: model.sales.token, tone: "muted" },
      ]}
      footnote={`${month.days} of the ${model.domain.days} days plotted = ${month.widthPct.toFixed(1)}% of the width. Band widths are real month lengths, so a February band is genuinely shorter than a March one.`}
      focusable={false}
      side="bottom"
    >
      <span
        className={`absolute top-0 whitespace-nowrap rounded-[2px] px-1 text-[10px] font-medium leading-[17px] text-[var(--text-muted)] ${HOVER_ROW}`}
        style={{ left: `${month.midPct}%`, transform: "translateX(-50%)" }}
      >
        {month.label}
        {month.showYear && <span className="ml-0.5 tabular-nums text-[9.5px] text-[var(--text-muted)]">&rsquo;{String(month.year).slice(2)}</span>}
      </span>
    </ChartTooltip>
  );
}

function overlapText(month: RunwayMonth, w: RunwayWindowModel): string | null {
  if (month.endISO < w.startISO || month.startISO > w.endISO) return null;
  const from = month.startISO > w.startISO ? month.startISO : w.startISO;
  const to = month.endISO < w.endISO ? month.endISO : w.endISO;
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

/* ---------------------------------------------------------------------------
 * The two windows
 * ------------------------------------------------------------------------- */

function WindowLane({
  window: w,
  model,
  gutter,
  gutterNote,
}: {
  window: RunwayWindowModel;
  model: RunwayModel;
  gutter: string;
  gutterNote: string;
}) {
  const other = w.key === "production" ? model.sales : model.production;

  return (
    <PlotRow
      className="h-[44px]"
      label={<span style={{ color: `var(${w.token})` }}>{gutter}</span>}
      note={gutterNote}
    >
      {/* the track the bar sits in, so an empty stretch still reads as time */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-[22px] rounded-[3px] bg-[var(--surface-sunken)]" />

      <ChartTooltip {...windowTooltip(w, other, model)} side="top">
        <div
          className={`absolute top-0 h-[22px] rounded-[3px] ${HOVER_MARK}`}
          style={{ left: `${w.startPct}%`, width: `${Math.max(w.widthPct, 0.6)}%`, background: `var(${w.token})` }}
        >
          {/* how much of the window is already spent — a second visual channel
              on the same mark, never a second colour */}
          {w.progressPct != null && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-l-[3px]"
              style={{ width: `${w.progressPct}%`, background: "color-mix(in oklab, var(--text-primary) 26%, transparent)" }}
            />
          )}
        </div>
      </ChartTooltip>

      {/* date range + duration, at rest, BELOW the bar — never over it */}
      <span
        className="pointer-events-none absolute top-[25px] whitespace-nowrap text-[10px] leading-tight text-[var(--text-secondary)]"
        style={{ left: `${w.midPct}%`, transform: anchorTransform(w.labelAnchor) }}
      >
        <span className="tabular-nums">
          {fmtDate(w.startISO)} – {fmtDate(w.endISO)}
        </span>
        <span className="text-[var(--text-muted)]"> · {w.weeks} weeks</span>
      </span>
    </PlotRow>
  );
}

/* ---------------------------------------------------------------------------
 * The runway bracket — the callout, attached to the marks it measures
 * ------------------------------------------------------------------------- */

function RunwayBracket({ model }: { model: RunwayModel }) {
  const r = model.runway;
  if (!r) return <PlotRow className="h-0" />;
  const color = `var(${r.riskToken})`;

  return (
    <PlotRow className="h-[26px]" label="Runway" note={r.isOverdue ? "overdue" : "left"}>
      <ChartTooltip {...runwayTooltip(model)} side="bottom">
        <div
          className={`absolute top-[7px] flex h-[12px] items-center ${HOVER_RULE}`}
          style={{ left: `${r.fromPct}%`, width: `${Math.max(r.widthPct, 0.4)}%` }}
        >
          <span aria-hidden className="h-[9px] w-[1.5px] shrink-0" style={{ background: color }} />
          <span aria-hidden className="h-px flex-1" style={{ background: color }} />
          <span aria-hidden className="h-[9px] w-[1.5px] shrink-0" style={{ background: color }} />
        </div>
      </ChartTooltip>

      <span
        className="pointer-events-none absolute top-[6px] whitespace-nowrap rounded-[2px] bg-[var(--surface)] px-1 text-[10px] font-medium leading-[14px]"
        style={{ left: `${(r.fromPct + r.toPct) / 2}%`, transform: "translateX(-50%)", color }}
      >
        <span className="tabular-nums">{r.weeks}</span> weeks {r.isOverdue ? "overdue" : "of runway"}
      </span>
    </PlotRow>
  );
}

/* ---------------------------------------------------------------------------
 * Decision dates
 * ------------------------------------------------------------------------- */

function DeadlineAxis({ model }: { model: RunwayModel }) {
  if (model.deadlines.length === 0) {
    return (
      <PlotRow className="h-[26px]" label="Deadlines">
        <span className="absolute inset-x-0 top-0 h-px bg-[var(--border-strong)]" />
        <span className="absolute left-0 top-2 text-[10.5px] text-[var(--text-muted)]">No decision deadlines in scope.</span>
      </PlotRow>
    );
  }

  return (
    <PlotRow className="h-[98px]" label="Deadlines" note={model.hiddenLabelCount > 0 ? "hover any tick" : undefined}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[var(--border-strong)]" />

      {model.deadlines.map((d) => (
        <ChartTooltip key={d.id} {...deadlineTooltip(d, model)} side="bottom">
          <div
            className={`absolute top-0 flex -translate-x-1/2 justify-center ${HOVER_RULE}`}
            style={{
              left: `${d.pct}%`,
              height: d.isBinding ? 17 : 11,
              // never wider than the distance to the next tick, so two order-by
              // dates two days apart cannot swallow each other's hover
              width: `min(11px, ${d.hitWidthPct}%)`,
            }}
          >
            <span
              aria-hidden
              className="h-full"
              style={{ width: d.isBinding ? 2 : 1, background: d.isBinding ? `var(${d.riskToken})` : "var(--text-secondary)" }}
            />
          </div>
        </ChartTooltip>
      ))}

      {model.deadlines
        .filter((d) => d.showLabel)
        .map((d) => (
          <span
            key={`label_${d.id}`}
            className="pointer-events-none absolute top-[21px] block w-[104px] text-center text-[10px] leading-tight"
            style={{ left: `${d.pct}%`, transform: anchorTransform(d.anchor) }}
          >
            <span className={d.isBinding ? "font-semibold" : "text-[var(--text-secondary)]"} style={d.isBinding ? { color: `var(${d.riskToken})` } : undefined}>
              {d.kindLabel}
            </span>
            <span className="block tabular-nums text-[var(--text-secondary)]">{fmtDate(d.dateISO)}</span>
            {materialName(d.materialId) && <span className="block text-[9.5px] text-[var(--text-muted)]">{materialName(d.materialId)}</span>}
            {d.clusterSize > 1 && (
              <span className="block text-[9.5px] text-[var(--text-muted)]">
                +{d.clusterSize - 1} more to {fmtDayMonth(d.clusterLastISO)}
              </span>
            )}
          </span>
        ))}
    </PlotRow>
  );
}

/* ---------------------------------------------------------------------------
 * Headline
 * ------------------------------------------------------------------------- */

function RunwayHeadline({ model }: { model: RunwayModel }) {
  const r = model.runway;
  if (!r) {
    return (
      <p className="text-[12px] text-[var(--text-secondary)]">
        No decision deadline is in scope for this gap yet — the runway below shows the build and sell windows only.
      </p>
    );
  }
  const name = materialName(r.materialId);

  return (
    <ChartTooltip {...runwayTooltip(model)} side="bottom" align="start">
      <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 self-start rounded-[3px] px-1 -mx-1 ${HOVER_ROW}`}>
        <span className="text-[20px] font-semibold leading-none tabular-nums" style={{ color: `var(${r.riskToken})` }}>
          {r.weeks}
        </span>
        <span className="text-[12px] text-[var(--text-secondary)]">
          weeks {r.isOverdue ? "past" : "until"} the earliest deadline — <span className="font-medium text-[var(--text-primary)]">{r.kindLabel}</span>,{" "}
          <span className="tabular-nums">{fmtDate(r.dateISO)}</span>
          {name && <span className="text-[var(--text-muted)]"> · {name}</span>}
        </span>
      </div>
    </ChartTooltip>
  );
}

/* ---------------------------------------------------------------------------
 * Tooltip content — every number below is read off the model
 * ------------------------------------------------------------------------- */

function todayTooltip(model: RunwayModel) {
  const r = model.runway;
  const p = model.production;
  const s = model.sales;
  return {
    title: `Today · ${fmtDate(model.today.iso)}`,
    subtitle: "Where the plan stands right now",
    rows: [
      {
        label: "Runway left",
        value: r ? `${r.weeks} weeks` : null,
        token: r?.riskToken,
        tone: "emphasis" as const,
        hint: r ? `to ${r.kindLabel.toLowerCase()}, ${fmtDate(r.dateISO)}` : undefined,
      },
      {
        label: p.label,
        value: windowStatusText(p),
        token: p.token,
        hint: p.dayOfWindow != null ? `day ${fmtNum(p.dayOfWindow)} of ${fmtNum(p.days)}` : undefined,
      },
      {
        label: s.label,
        value: windowStatusText(s),
        token: s.token,
        hint: s.status === "upcoming" ? `first selling day ${fmtDate(s.startISO)}` : undefined,
      },
    ],
    footnote: `Everything left of this rule has happened; everything right of it is still a decision. The scale runs ${fmtDate(model.domain.startISO)} → ${fmtDate(model.domain.endISO)} (${model.domain.days} days), so today sits ${model.today.pct.toFixed(1)}% across it.`,
    ariaLabel: `Today, ${fmtDate(model.today.iso)}.${r ? ` ${r.weeks} weeks of runway left.` : ""}`,
  };
}

function windowStatusText(w: RunwayWindowModel): string {
  if (w.status === "open") return `open · ${Math.round(w.progressPct ?? 0)}% through`;
  if (w.status === "upcoming") return `opens in ${w.weeksToStart} weeks`;
  return `closed ${Math.abs(w.weeksToEnd)} weeks ago`;
}

function windowTooltip(w: RunwayWindowModel, other: RunwayWindowModel, model: RunwayModel) {
  const sep = model.separation;
  const inside = model.deadlines.filter((d) => d.dateISO >= w.startISO && d.dateISO <= w.endISO);

  return {
    title: `${w.label} · ${fmtDate(w.startISO)} – ${fmtDate(w.endISO)}`,
    subtitle: w.key === "production" ? "When this season is BUILT" : "When this season is SOLD",
    rows: [
      { label: "Duration", value: `${fmtNum(w.days)} days · ${w.weeks} weeks`, token: w.token, tone: "emphasis" as const },
      {
        label: "Status today",
        value: windowStatusText(w),
        hint:
          w.dayOfWindow != null
            ? `${fmtDate(w.startISO)} + ${fmtNum(w.dayOfWindow - 1)} days = today; ${fmtNum(w.days - w.dayOfWindow)} days left in the window. The shaded head of the bar is that elapsed part.`
            : undefined,
      },
      {
        label: "Decision dates inside",
        value: `${inside.length} of ${model.deadlines.length}`,
        hint: inside.length > 0 ? `${fmtDate(inside[0]!.dateISO)} – ${fmtDate(inside[inside.length - 1]!.dateISO)}` : undefined,
      },
      {
        label: other.label,
        value: `${fmtDate(other.startISO)} – ${fmtDate(other.endISO)}`,
        token: other.token,
        tone: "muted" as const,
        hint: sep.overlaps
          ? `overlaps this window — building and selling run at the same time`
          : w.key === "production"
            ? `starts ${sep.gapWeeks} weeks after the last build day`
            : `the last build day was ${sep.gapWeeks} weeks before the first selling day`,
      },
    ],
    footnote: `${w.meaning} Derivation: ${fmtDate(w.startISO)} → ${fmtDate(w.endISO)} = ${fmtNum(w.days)} days ÷ 7 = ${w.weeks} weeks.`,
    ariaLabel: `${w.label}, ${fmtDate(w.startISO)} to ${fmtDate(w.endISO)}, ${w.weeks} weeks. ${w.meaning}`,
  };
}

function runwayTooltip(model: RunwayModel) {
  const r = model.runway!;
  const name = materialName(r.materialId);
  const p = model.production;

  return {
    title: `${r.weeks} weeks ${r.isOverdue ? "past" : "of runway"}`,
    subtitle: r.isOverdue ? "Today → the deadline that has already passed" : "Today → the earliest binding deadline",
    rows: [
      { label: "From", value: fmtDate(model.today.iso), hint: "today" },
      { label: "To", value: fmtDate(r.dateISO), token: r.riskToken, hint: `${r.kindLabel.toLowerCase()}${name ? ` · ${name}` : ""}` },
      { label: "Elapsed", value: `${fmtNum(r.days)} days`, tone: "emphasis" as const },
      {
        label: "Build must finish",
        value: fmtDate(p.endISO),
        token: p.token,
        tone: "muted" as const,
        hint: `${p.weeksToEnd} weeks from today — this deadline is what protects that date`,
      },
      { label: "Status", value: urgencyWord(model), token: r.riskToken },
    ],
    footnote: `${fmtNum(r.days)} days ÷ 7 = ${r.weeks} weeks. ${urgencyNote(r.urgency)} It is the earliest of ${model.deadlines.length} decision dates, so it — not the average — is what sets how much optionality is left.`,
    ariaLabel: `${r.weeks} weeks ${r.isOverdue ? "past" : "until"} ${r.kindLabel}, ${fmtDate(r.dateISO)}.`,
  };
}

function urgencyWord(model: RunwayModel): string {
  const u = model.runway!.urgency;
  if (u === "overdue") return "Overdue";
  if (u === "critical") return "No room to re-plan";
  if (u === "warning") return "Options narrowing";
  return "Still fully open";
}

function deadlineTooltip(d: RunwayDeadlineModel, model: RunwayModel) {
  const name = materialName(d.materialId);
  const peers = model.deadlines.filter((x) => x.clusterIndex === d.clusterIndex);

  return {
    title: `${d.kindLabel} · ${fmtDate(d.dateISO)}`,
    subtitle: name ?? (d.isBinding ? "Earliest binding constraint" : "Decision deadline"),
    rows: [
      {
        label: d.isOverdue ? "Past by" : "From today",
        value: `${Math.abs(d.weeksFromToday)} weeks`,
        token: d.riskToken,
        tone: "emphasis" as const,
        hint: `${fmtDate(model.today.iso)} → ${fmtDate(d.dateISO)} = ${fmtNum(Math.abs(d.daysFromToday))} days`,
      },
      {
        label: "Rank",
        value: d.isBinding ? `earliest of ${model.deadlines.length}` : `${ordinal(model.deadlines.indexOf(d) + 1)} of ${model.deadlines.length}`,
        hint: d.isBinding ? "this is the date the runway headline is measured to" : `the binding one is ${fmtDate(model.runway?.dateISO ?? d.dateISO)}`,
      },
      {
        label: "Falls in",
        value: d.inWindow === "production" ? model.production.label : d.inWindow === "sales" ? model.sales.label : windowGapLabel(d),
        token: d.inWindow === "production" ? model.production.token : d.inWindow === "sales" ? model.sales.token : undefined,
        tone: "muted" as const,
      },
      {
        label: "Shares this tick cluster",
        value: peers.length > 1 ? `${peers.length} dates` : null,
        hint: peers.length > 1 ? `${fmtDate(d.clusterFirstISO)} – ${fmtDate(d.clusterLastISO)}; only the earliest is labelled so the captions stay readable` : undefined,
        tone: "muted" as const,
      },
      {
        label: "Moved by scenario",
        value: d.movedWeeks == null ? null : `${d.movedWeeks > 0 ? "+" : "−"}${Math.abs(d.movedWeeks)} weeks`,
        hint: d.moveReason ?? (d.movedFromDate ? `was ${fmtDate(d.movedFromDate)}` : undefined),
      },
    ],
    footnote: `${d.driverNote} ${windowRelationNote(d.inWindow)}`,
    ariaLabel: `${d.kindLabel} ${fmtDate(d.dateISO)}${name ? `, ${name}` : ""}, ${Math.abs(d.weeksFromToday)} weeks ${d.isOverdue ? "ago" : "from today"}.`,
  };
}

function windowGapLabel(d: RunwayDeadlineModel): string {
  if (d.inWindow === "before_production") return "before the build starts";
  if (d.inWindow === "between_windows") return "between build and sell";
  return "after the season closes";
}

/* ---------------------------------------------------------------------------
 * Legend
 * ------------------------------------------------------------------------- */

function legendItems(model: RunwayModel): ChartLegendItem[] {
  const r = model.runway;
  const p = model.production;
  const s = model.sales;

  return [
    {
      key: "production",
      label: "Production window — build",
      token: p.token,
      shape: "swatch",
      tooltip: {
        title: p.label,
        subtitle: "When this season is BUILT",
        rows: [{ label: "Spans", value: `${fmtDate(p.startISO)} – ${fmtDate(p.endISO)}`, token: p.token }],
        footnote: p.meaning,
      },
    },
    {
      key: "sales",
      label: "Sales / event window — sell",
      token: s.token,
      shape: "swatch",
      tooltip: {
        title: s.label,
        subtitle: "When this season is SOLD",
        rows: [{ label: "Spans", value: `${fmtDate(s.startISO)} – ${fmtDate(s.endISO)}`, token: s.token }],
        footnote: s.meaning,
      },
    },
    {
      key: "today",
      label: "Today",
      token: "--text-primary",
      shape: "line",
      tooltip: {
        title: `Today · ${fmtDate(model.today.iso)}`,
        footnote: "The demo clock. Every weeks-from-today figure in this section is measured from this rule.",
      },
    },
    {
      key: "deadline",
      label: `Decision deadline (${model.deadlines.length})`,
      token: "--text-secondary",
      shape: "marker",
      present: model.deadlines.length > 0,
      tooltip: {
        title: "Decision deadlines",
        subtitle: `${model.deadlines.length} in scope · ${model.hiddenLabelCount} unlabelled at rest`,
        rows: [
          { label: "Earliest", value: model.deadlines[0] ? fmtDate(model.deadlines[0].dateISO) : null },
          { label: "Latest", value: model.deadlines.length > 0 ? fmtDate(model.deadlines[model.deadlines.length - 1]!.dateISO) : null },
        ],
        footnote: "Every tick is hoverable, labelled or not. Only the earliest of each cluster carries a caption at rest, because eight captions inside a six-week band overlap into an unreadable pile.",
      },
    },
    {
      key: "binding",
      label: "Earliest binding constraint",
      token: r?.riskToken ?? "--risk-critical",
      shape: "marker",
      present: r != null,
      tooltip: r
        ? {
            title: `${r.kindLabel} · ${fmtDate(r.dateISO)}`,
            subtitle: "Status, not a series",
            rows: [{ label: "Runway", value: `${r.weeks} weeks ${r.isOverdue ? "overdue" : "left"}`, token: r.riskToken, tone: "emphasis" as const }],
            footnote: `Colour here is STATUS: red inside ${2} weeks or already past, amber inside ${RUNWAY_WARNING_WEEKS} weeks, green beyond that. The window colours above are data series and never mean severity.`,
          }
        : undefined,
    },
  ];
}

function separationSentence(model: RunwayModel): string {
  const sep = model.separation;
  const p = model.production;
  const s = model.sales;
  if (sep.overlaps) {
    return `Building runs ${fmtDate(p.startISO)} – ${fmtDate(p.endISO)} and selling runs ${fmtDate(s.startISO)} – ${fmtDate(s.endISO)}; the two windows overlap, so build decisions and sell-through both apply at once. They are still separate windows and are never summed.`;
  }
  return `Built ${fmtDate(p.startISO)} – ${fmtDate(p.endISO)} (${p.weeks} weeks); sold ${fmtDate(s.startISO)} – ${fmtDate(s.endISO)} (${s.weeks} weeks). The first selling day is ${sep.gapWeeks} weeks after the last build day and ${sep.leadWeeks} weeks after the first — so no build decision on this runway can wait for a sell-through signal.`;
}

/* ---------------------------------------------------------------------------
 * Presentation helpers — lookups and wording only, no geometry
 * ------------------------------------------------------------------------- */

/**
 * The material a deadline belongs to, read from the data layer via the id the
 * engine minted (see `materialIdFromDeadlineId`). Returns `null` — and the UI
 * then shows nothing — rather than inventing a name for an unknown id.
 */
function materialName(materialId: string | null): string | null {
  if (!materialId) return null;
  return MATERIALS.find((m) => m.id === materialId)?.name ?? null;
}

/**
 * `"Jun 26"` — the at-rest cluster caption only, where the year is already
 * printed on the line above it and repeating it forces a wrap. Every date the
 * planner might read in isolation (tooltips, window captions, the headline)
 * uses the app-wide `fmtDate`, which always carries the year.
 */
const DAY_MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
function fmtDayMonth(iso: string): string {
  return DAY_MONTH_FMT.format(new Date(iso));
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
