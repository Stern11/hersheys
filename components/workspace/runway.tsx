/**
 * The decision runway (V2 §50, §63).
 *
 * One question: what becomes irreversible first, and how long is left?
 *
 * Form: a swimlane timeline, not a single annotated line. The earlier version
 * hung every label off one axis, alternating above and below — which collided
 * in the middle and clipped at both ends, and could only ever convey dates.
 * Giving each milestone its own row puts the name in a fixed column where it
 * can never be cut off, leaves space to say what the date actually commits,
 * and lets the production and sales windows show their real duration instead
 * of two faint bars.
 *
 * Today is a rule through every lane and the past is shaded out, so "how much
 * runway is left" is read as a distance rather than counted from labels.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { DecisionRunway, RunwayMarker, RunwayMarkerKind } from "@/types/situation";
import { addMonths, daysBetween, formatMonthLabel, monthKeyOf } from "@/lib/dataset/periods";
import { fmtDateShort } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const MARKER_TOKEN: Record<RunwayMarkerKind, string> = {
  today: "--text-primary",
  material_commitment: "--state-validated",
  capacity_decision: "--state-inferred",
  production_start: "--state-formal",
  production_end: "--state-formal",
  sales_start: "--state-scenario",
  sales_end: "--state-scenario",
};

const LABEL_COL_WIDE = 178;
const LABEL_COL_COMPACT = 112;

/** The chart is laid out against real pixels, so it has to measure them. */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function RunwayTimeline({ runway }: { runway: DecisionRunway }) {
  const { ref, width } = useMeasuredWidth();
  const milestones = runway.markers.filter((m) => m.kind !== "today");
  if (milestones.length === 0) {
    return <p className="text-[13px] text-[var(--text-muted)]">Not enough dated data to build a runway.</p>;
  }

  // Pad the scale to whole months so the axis ticks land on real boundaries.
  const dates = [
    runway.today,
    ...milestones.map((m) => m.date),
    runway.productionWindow?.start,
    runway.productionWindow?.end,
    runway.salesWindow?.start,
    runway.salesWindow?.end,
  ].filter((d): d is string => Boolean(d));

  const first = dates.reduce((a, b) => (a < b ? a : b));
  const last = dates.reduce((a, b) => (a > b ? a : b));
  const start = `${monthKeyOf(first)}-01`;
  const end = `${addMonths(monthKeyOf(last), 1)}-01`;
  const span = Math.max(1, daysBetween(start, end));
  const pct = (date: string) => (daysBetween(start, date) / span) * 100;

  const todayPct = pct(runway.today);

  const months: string[] = [];
  for (let m = monthKeyOf(first); m < monthKeyOf(last) || months.length === 0; m = addMonths(m, 1)) {
    months.push(m);
    if (months.length > 48) break;
  }

  // Only meaningful while the first commitment is still ahead.
  const earliest = runway.earliest;
  const runwayBand =
    earliest && earliest.weeksAway > 0
      ? {
          from: todayPct,
          to: pct(earliest.date),
          label: `${earliest.weeksAway}w of runway`,
        }
      : undefined;

  // Below this the label gutter would take more than a third of the chart.
  const compact = width > 0 && width < 560;
  const labelCol = compact ? LABEL_COL_COMPACT : LABEL_COL_WIDE;
  const plotWidth = Math.max(1, width - labelCol);
  // Ticks are dropped rather than allowed to collide: a month label needs
  // roughly 46px of its own, and an axis that overprints itself is worse than
  // one with fewer marks on it.
  const tickStep = Math.max(1, Math.ceil((months.length * 46) / plotWidth));
  // The Today chip is about 100px wide and is anchored differently depending
  // on where today falls, so the ticks it hides are not a symmetric window.
  const chipPct = (108 / plotWidth) * 100;
  // A tick is centred on its date, so half its own label has to clear the chip
  // too — without this the month reads as a bare "27".
  const tickHalfPct = (24 / plotWidth) * 100;
  const chipAnchor = todayPct > 88 ? "right" : todayPct < 4 ? "left" : "centre";
  const hiddenByChip = (at: number) =>
    chipAnchor === "left"
      ? at >= todayPct - tickHalfPct && at <= todayPct + chipPct + tickHalfPct
      : chipAnchor === "right"
        ? at <= todayPct + tickHalfPct && at >= todayPct - chipPct - tickHalfPct
        : Math.abs(at - todayPct) < chipPct / 2 + tickHalfPct;
  // A trailing detail needs somewhere to be read; under this it is only the
  // tooltip's job.
  const showMarkerDetail = plotWidth >= 260;
  const runwayBandPx = runwayBand ? plotWidth * ((runwayBand.to - runwayBand.from) / 100) : 0;

  const windows = [
    runway.productionWindow
      ? { key: "production", label: "Production", token: "--state-formal", range: runway.productionWindow }
      : null,
    runway.salesWindow
      ? { key: "sales", label: "Sales", token: "--state-scenario", range: runway.salesWindow }
      : null,
  ].filter((w): w is { key: string; label: string; token: string; range: { start: string; end: string } } => w !== null);

  return (
    <div className="w-full" ref={ref}>
      <div className="relative">
        {/* Month axis. Solid hairline ticks — a dashed rule would read as a
            threshold rather than a scale. */}
        <div className="relative h-6" style={{ marginLeft: labelCol }}>
          {months.map((month, i) => {
            if (i % tickStep !== 0) return null;
            const at = pct(`${month}-01`);
            // The Today chip is wider than a month tick and outranks it, so a
            // tick it would sit on top of is dropped rather than overlapped.
            if (hiddenByChip(at)) return null;
            return (
              <span
                key={month}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10.5px] text-[var(--text-muted)] sm:text-[11px]"
                style={{ left: `${at}%` }}
              >
                {formatMonthLabel(month)}
              </span>
            );
          })}
          {/* The rule through the lanes needs a name, or it reads as an
              arbitrary divider rather than the present moment. */}
          <span
            className="absolute top-0 whitespace-nowrap rounded-[3px] bg-[var(--risk-critical)] px-1.5 py-[1px] text-[10.5px] font-medium text-[var(--text-on-accent)]"
            style={{
              left: `${todayPct}%`,
              transform:
                chipAnchor === "right"
                  ? "translateX(-100%)"
                  : chipAnchor === "left"
                    ? "none"
                    : "translateX(-50%)",
            }}
          >
            Today · {fmtDateShort(runway.today)}
          </span>
        </div>

        <div className="relative">
          {/* Everything before today is settled, so it recedes. */}
          <div
            className="pointer-events-none absolute inset-y-0 z-0 bg-[var(--surface-sunken)]"
            style={{ left: labelCol, width: `calc((100% - ${labelCol}px) * ${todayPct / 100})` }}
            aria-hidden
          />

          {/* The runway is the whole point of the chart, so it is drawn as a
              measured distance rather than left to be inferred from two dates.
              It is omitted once the first commitment has passed — there is no
              runway left to show. */}
          {runwayBand ? (
            <div
              className="pointer-events-none absolute inset-y-0 z-0 flex items-start justify-center border-x border-dashed border-[var(--risk-positive)]/40 bg-[var(--risk-positive)]/[0.07]"
              style={{
                left: `calc(${labelCol}px + (100% - ${labelCol}px) * ${runwayBand.from / 100})`,
                width: `calc((100% - ${labelCol}px) * ${(runwayBand.to - runwayBand.from) / 100})`,
              }}
              aria-hidden
            >
              {runwayBandPx >= 68 ? (
                <span className="mt-1 whitespace-nowrap rounded-[3px] bg-[var(--risk-positive)] px-1.5 py-[1px] text-[10.5px] font-medium text-[var(--text-on-accent)]">
                  {runwayBand.label}
                </span>
              ) : null}
            </div>
          ) : null}
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[var(--risk-critical)]"
            style={{ left: `calc(${labelCol}px + (100% - ${labelCol}px) * ${todayPct / 100})` }}
            aria-hidden
          />

          {milestones.map((marker) => (
            <MilestoneLane
              key={`${marker.kind}-${marker.date}`}
              marker={marker}
              left={pct(marker.date)}
              labelCol={labelCol}
              showDetail={showMarkerDetail}
            />
          ))}

          {windows.map((window) => {
            const from = pct(window.range.start);
            const to = pct(window.range.end);
            return (
              <div
                key={window.key}
                className="relative grid items-center border-t border-[var(--border)]"
                style={{ gridTemplateColumns: `${labelCol}px 1fr`, minHeight: 42 }}
              >
                <div className="pr-3 sm:pr-4">
                  <div className="text-[12px] font-medium leading-tight text-[var(--text-primary)] sm:truncate sm:text-[12.5px]">{window.label}</div>
                  <div className="text-[10.5px] leading-tight text-[var(--text-muted)] sm:text-[11px]">
                    {fmtDateShort(window.range.start)} – {fmtDateShort(window.range.end)}
                  </div>
                </div>
                <div className="relative h-full">
                  <span
                    className="absolute top-1/2 h-[14px] -translate-y-1/2 rounded-[4px]"
                    style={{
                      left: `${from}%`,
                      width: `${Math.max(to - from, 0.6)}%`,
                      background: `var(${window.token})`,
                      opacity: 0.85,
                    }}
                    title={`${window.label} · ${fmtDateShort(window.range.start)} – ${fmtDateShort(window.range.end)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-[13px] text-[var(--text-secondary)]">{summarise(runway)}</p>
    </div>
  );
}

function MilestoneLane({
  marker,
  left,
  labelCol,
  showDetail,
}: {
  marker: RunwayMarker;
  left: number;
  labelCol: number;
  showDetail: boolean;
}) {
  const overdue = marker.weeksAway < 0;
  const first = marker.isEarliestIrreversible;
  return (
    <div
      className="relative grid items-center border-t border-[var(--border)]"
      style={{ gridTemplateColumns: `${labelCol}px 1fr`, minHeight: 42 }}
    >
      <div className="pr-3 sm:pr-4">
        <div
          className={cn(
            "text-[12px] font-medium leading-tight sm:truncate sm:text-[12.5px]",
            first ? "text-[var(--risk-critical)]" : "text-[var(--text-primary)]"
          )}
        >
          {marker.label}
        </div>
        <div className="mt-0.5 text-[10.5px] leading-tight text-[var(--text-muted)] sm:truncate sm:text-[11px]">
          {fmtDateShort(marker.date)} · {overdue ? `${Math.abs(marker.weeksAway)}w overdue` : `in ${marker.weeksAway}w`}
        </div>
      </div>

      <div className="relative h-full">
        {/* The dot is 10px; the thing you hover is 28px around it. A marker a
            planner has to aim at is a marker they will not read. */}
        <span
          className="group absolute top-1/2 z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-default items-center justify-center"
          style={{ left: `${left}%` }}
          tabIndex={0}
          role="button"
          aria-label={`${marker.label}, ${fmtDateShort(marker.date)}`}
        >
          <span
            className={cn(
              "rounded-full ring-2 ring-[var(--surface)] transition-transform",
              first ? "size-3" : "size-2.5",
              "group-hover:scale-125 group-focus-visible:scale-125"
            )}
            style={{
              background: first ? "var(--risk-critical)" : `var(${MARKER_TOKEN[marker.kind]})`,
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out)",
            }}
          />
          <span
            role="tooltip"
            className={cn(
              // Hidden rather than transparent: a 280px box parked off the
              // right edge of a phone still counts as layout, and it was
              // enough to make the whole page scroll sideways.
              "pointer-events-none absolute bottom-[calc(100%+2px)] left-1/2 hidden w-max max-w-[min(280px,60vw)] -translate-x-1/2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-left shadow-lg",
              "group-hover:block group-focus-visible:block"
            )}
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            <span className="block text-[12px] font-medium text-[var(--text-primary)]">
              {marker.label}
            </span>
            <span className="block text-[11.5px] tabular-nums text-[var(--text-secondary)]">
              {fmtDateShort(marker.date)} ·{" "}
              {overdue ? `${Math.abs(marker.weeksAway)}w overdue` : `in ${marker.weeksAway}w`}
            </span>
            {marker.detail ? (
              <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-muted)]">
                {marker.detail}
              </span>
            ) : null}
          </span>
        </span>
        {marker.detail && showDetail ? (
          <span
            className="absolute top-1/2 max-w-[46%] -translate-y-1/2 truncate pl-3 text-[11.5px] text-[var(--text-muted)]"
            style={{ left: `${left}%` }}
          >
            {marker.detail}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Reads naturally whether the first commitment is ahead or already behind. */
function summarise(runway: DecisionRunway): string {
  const earliest = runway.earliest;
  if (!earliest) return "No dated commitment ahead.";
  const detail = earliest.detail ? ` — ${earliest.detail}.` : ".";
  if (earliest.weeksAway < 0) {
    return `${earliest.label} was the first commitment and is ${Math.abs(earliest.weeksAway)} weeks overdue${detail}`;
  }
  if (earliest.weeksAway === 0) {
    return `${earliest.label} is the first commitment and falls this week${detail}`;
  }
  return `${earliest.label} is the first commitment, ${earliest.weeksAway} weeks away${detail}`;
}
