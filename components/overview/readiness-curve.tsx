/**
 * The season readiness curve (V2 §39, PRD §16, §23.2 — "Planning Gap Curve").
 *
 * One question per card: for this season, are we ahead of or behind where
 * last year was at this point, how long is left, and what is the one thing
 * that could still keep an unrepresented item from making it?
 *
 * Deliberately plain: one reference curve (last year, from real — if
 * synthetic-in-demo — weekly history), and two vertical lines — today and
 * drop-dead — each with its own shaded zone rather than a bare mark, so the
 * three sections ("already elapsed", "runway left", "past the point of no
 * return") read as regions, not as something to infer from a dot. A dot marks
 * every place the reference curve actually crosses one of those lines, and
 * hovering anywhere on the curve holds a read-out of that point's value. The
 * chart is compact on the card by default; an expand button opens the same
 * chart larger, where the same hover is easier to aim. It does not try to
 * also plot this season's own history as a connected line — that series is
 * built independently of the live "today" figure and is not guaranteed to
 * meet it smoothly, which read as a rendering bug rather than a real kink.
 */

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { weeksBetween } from "@/lib/dataset/periods";
import { fmtDateShort, fmtPct } from "@/lib/utils/format";
import type { ReadinessCurve } from "@/lib/situations/readiness-curve";
import type { PlanningSituation } from "@/types/situation";

const W = 600;
const H = 150;
const PAD_L = 4;
const PAD_R = 4;

type Point = { weeksBeforeProductionStart: number; representedPct: number };

function pathFor(points: Point[], horizonWeeks: number): string {
  if (points.length === 0) return "";
  const x = (weeks: number) => PAD_L + ((horizonWeeks - weeks) / horizonWeeks) * (W - PAD_L - PAD_R);
  const y = (pct: number) => H - Math.max(0, Math.min(1, pct)) * H;
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.weeksBeforeProductionStart).toFixed(1)},${y(p.representedPct).toFixed(1)}`).join(" ");
}

/** Linear interpolation along a curve sorted by descending weeks-before. Undefined off both ends of empty data. */
function interpolate(points: Point[], weeks: number): number | undefined {
  if (points.length === 0) return undefined;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (weeks >= first.weeksBeforeProductionStart) return first.representedPct;
  if (weeks <= last.weeksBeforeProductionStart) return last.representedPct;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (weeks <= a.weeksBeforeProductionStart && weeks >= b.weeksBeforeProductionStart) {
      const span = a.weeksBeforeProductionStart - b.weeksBeforeProductionStart;
      const t = span > 0 ? (a.weeksBeforeProductionStart - weeks) / span : 0;
      return a.representedPct + (b.representedPct - a.representedPct) * t;
    }
  }
  return undefined;
}

interface Zone {
  from: number;
  to: number;
  fill: string;
  opacity: number;
}

const ELAPSED: Pick<Zone, "fill" | "opacity"> = { fill: "var(--surface-sunken)", opacity: 1 };
const RUNWAY: Pick<Zone, "fill" | "opacity"> = { fill: "var(--risk-positive)", opacity: 0.08 };
const OVERDUE: Pick<Zone, "fill" | "opacity"> = { fill: "var(--risk-critical)", opacity: 0.08 };

/**
 * Three possible bands, left to right: already elapsed (neutral), runway
 * still open (positive tint), and past drop-dead (critical tint) — only the
 * ones the data actually supports. Mirrors the same token treatment
 * `components/workspace/runway.tsx` already uses for "before today" and "the
 * runway band", so a planner reads the same visual language in both places.
 */
function zonesFor(todayX: number | undefined, dropDeadX: number | undefined): Zone[] {
  const zones: Zone[] = [];
  if (todayX !== undefined) {
    zones.push({ from: 0, to: todayX, ...ELAPSED });
    if (dropDeadX !== undefined && dropDeadX >= todayX) {
      zones.push({ from: todayX, to: dropDeadX, ...RUNWAY });
      zones.push({ from: dropDeadX, to: W, ...OVERDUE });
    } else if (dropDeadX !== undefined) {
      zones.push({ from: todayX, to: W, ...OVERDUE });
    }
  } else if (dropDeadX !== undefined) {
    zones.push({ from: 0, to: dropDeadX, ...RUNWAY });
    zones.push({ from: dropDeadX, to: W, ...OVERDUE });
  }
  return zones;
}

/**
 * The chart itself, reused at two sizes: compact on the card, and larger
 * inside the zoom dialog. The `<svg>`'s internal coordinate space (`W`/`H`)
 * never changes — hover precision comes from the element's actual rendered
 * pixel size, which the dialog gives more of, not from a different viewBox.
 */
function ReadinessChart({ curve, heightClass }: { curve: ReadinessCurve; heightClass: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverWeeks, setHoverWeeks] = useState<number | null>(null);

  const horizonWeeks = Math.max(curve.horizonWeeks, 1);
  const x = (weeks: number) => PAD_L + ((horizonWeeks - weeks) / horizonWeeks) * (W - PAD_L - PAD_R);
  const y = (pct: number) => H - Math.max(0, Math.min(1, pct)) * H;

  const hasToday = curve.todayWeeksBeforeProduction !== undefined && curve.todayPct !== undefined;
  const todayX = hasToday ? x(curve.todayWeeksBeforeProduction!) : undefined;

  const dropDeadWeeks =
    curve.dropDeadDate && curve.productionStart ? weeksBetween(curve.dropDeadDate, curve.productionStart) : undefined;
  const showDropDead = dropDeadWeeks !== undefined && dropDeadWeeks >= 0 && dropDeadWeeks <= horizonWeeks;
  const dropDeadX = showDropDead ? x(dropDeadWeeks!) : undefined;

  const zones = zonesFor(todayX, dropDeadX);
  const hasCurve = curve.priorSeasonPace.length > 1;

  // Dots wherever the reference curve actually crosses a zone boundary —
  // never a bare line and a bare curve left for the reader to reconcile.
  const todayIntersect = hasCurve && hasToday ? interpolate(curve.priorSeasonPace, curve.todayWeeksBeforeProduction!) : undefined;
  const dropDeadIntersect = hasCurve && showDropDead ? interpolate(curve.priorSeasonPace, dropDeadWeeks!) : undefined;

  const hoverPct = hoverWeeks !== null && hasCurve ? interpolate(curve.priorSeasonPace, hoverWeeks) : undefined;
  const hoverX = hoverWeeks !== null ? x(hoverWeeks) : undefined;

  const updateHover = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const weeks = horizonWeeks - ((svgX - PAD_L) / (W - PAD_L - PAD_R)) * horizonWeeks;
    setHoverWeeks(Math.max(0, Math.min(horizonWeeks, weeks)));
  };

  // Tooltip box in the same SVG coordinate space as everything else, so it
  // never drifts out of sync with the point it is labelling. Clamped inside
  // the viewBox so it cannot render half off-card near either edge.
  const tooltipW = 108;
  const tooltipH = 30;
  const tooltipX = hoverX !== undefined ? Math.max(2, Math.min(W - tooltipW - 2, hoverX - tooltipW / 2)) : 0;
  const tooltipY = hoverPct !== undefined ? Math.max(2, y(hoverPct) - tooltipH - 8) : 0;

  return (
    <div>
      <div className="relative mt-2">
        {/* Y-axis: three labelled gridlines. Without a scale, a filled area
            has no numeric meaning — it just looks like a shape. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-7 flex-col justify-between py-0 text-[9px] text-[var(--text-muted)]">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`${heightClass} w-full cursor-crosshair pl-7`}
          preserveAspectRatio="none"
          onMouseMove={(e) => updateHover(e.clientX)}
          onMouseLeave={() => setHoverWeeks(null)}
        >
          {/* Shaded sections first, so every line drawn afterwards sits on top. */}
          {zones.map((z, i) => (
            <rect key={i} x={z.from} y={0} width={Math.max(0, z.to - z.from)} height={H} fill={z.fill} fillOpacity={z.opacity} />
          ))}

          {[0, 0.5, 1].map((p) => (
            <line key={p} x1={0} x2={W} y1={y(p)} y2={y(p)} stroke="var(--border)" strokeWidth={1} />
          ))}

          {hasCurve ? (
            <path d={pathFor(curve.priorSeasonPace, horizonWeeks)} fill="none" stroke="var(--state-historical)" strokeWidth={1.5} strokeDasharray="4,3" />
          ) : null}

          {showDropDead ? (
            <line x1={dropDeadX} x2={dropDeadX} y1={0} y2={H} stroke="var(--risk-critical)" strokeDasharray="3,3" strokeWidth={1.25} />
          ) : null}

          {hasToday ? (
            <line x1={todayX} x2={todayX} y1={0} y2={H} stroke="var(--text-primary)" strokeWidth={1.5} />
          ) : null}

          {/* Where the reference curve actually crosses a zone boundary. */}
          {todayIntersect !== undefined ? (
            <circle cx={todayX} cy={y(todayIntersect)} r={3} fill="var(--state-historical)" stroke="var(--surface)" strokeWidth={1.25} />
          ) : null}
          {dropDeadIntersect !== undefined ? (
            <circle cx={dropDeadX} cy={y(dropDeadIntersect)} r={3} fill="var(--state-historical)" stroke="var(--surface)" strokeWidth={1.25} />
          ) : null}

          {/* Hover read-out: a guideline, a dot on the curve, and a value that
              holds in place for as long as the pointer stays over the chart. */}
          {hoverX !== undefined ? (
            <line x1={hoverX} x2={hoverX} y1={0} y2={H} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="2,2" />
          ) : null}
          {hoverX !== undefined && hoverPct !== undefined ? (
            <>
              <circle cx={hoverX} cy={y(hoverPct)} r={3.5} fill="var(--state-historical)" stroke="var(--surface)" strokeWidth={1.5} />
              <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx={4} fill="var(--surface-elevated)" stroke="var(--border)" strokeWidth={1} />
              <text x={tooltipX + tooltipW / 2} y={tooltipY + 13} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">
                {Math.round(hoverWeeks!)} wks before
              </text>
              <text x={tooltipX + tooltipW / 2} y={tooltipY + 25} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-primary)">
                {fmtPct(hoverPct)} last year
              </text>
            </>
          ) : null}
        </svg>
      </div>

      <div className="flex items-center justify-between pl-7 text-[10.5px] text-[var(--text-muted)]">
        <span>{horizonWeeks} wks before production</span>
        <span>production start</span>
      </div>

      {/* Every mark on the chart, named — nothing left for the reader to guess. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-7 text-[10.5px] text-[var(--text-muted)]">
        {hasToday ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-[var(--text-primary)]" aria-hidden />
            Today
          </span>
        ) : null}
        {hasCurve ? (
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 border-t border-dashed border-[var(--state-historical)]" aria-hidden />
            Last year, same point — hover for values
          </span>
        ) : null}
        {showDropDead ? (
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 border-t border-dashed border-[var(--risk-critical)]" aria-hidden />
            Drop-dead{curve.dropDeadDate ? ` · ${fmtDateShort(curve.dropDeadDate)}` : ""}
          </span>
        ) : null}
        {showDropDead && hasToday ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-[var(--risk-positive)] opacity-35" aria-hidden />
            Runway left
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ReadinessCurveCard({
  curve,
  situation,
  href,
}: {
  curve: ReadinessCurve;
  /** For the one-line count of what's still unrepresented/undecided — kept as
   *  a light passthrough rather than duplicated onto `ReadinessCurve` itself,
   *  since it is already computed identically wherever a situation is listed. */
  situation: PlanningSituation;
  href: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  const router = useRouter();

  return (
    // A `<button>` inside an `<a>` is invalid HTML and makes the two capture
    // each other's clicks unpredictably, so the whole card navigates via
    // `router.push` on its own click handler instead of wrapping it in a
    // real link — the zoom button just has to stop that click from
    // reaching this one, the same as it would with a nested anchor.
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      className="cursor-pointer rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--interaction-hover)] sm:p-5"
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="text-[13.5px] font-medium text-[var(--text-primary)]">{curve.situationTitle}</div>
        <div className="flex items-center gap-3 text-[11.5px] text-[var(--text-muted)]">
          {curve.todayPct !== undefined ? (
            <span>
              today <span className="font-medium text-[var(--text-primary)] tabular-nums">{fmtPct(curve.todayPct)}</span>
            </span>
          ) : null}
          {curve.runwayWeeks !== undefined ? (
            <span>
              runway{" "}
              <span
                className={curve.runwayWeeks <= 8 ? "font-medium text-[var(--risk-critical)] tabular-nums" : "font-medium text-[var(--text-primary)] tabular-nums"}
              >
                {curve.runwayWeeks}w
              </span>
            </span>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(true);
            }}
            title="Expand chart"
            aria-label="Expand chart"
            className="flex-none rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--interaction-hover)] hover:text-[var(--text-primary)]"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="text-[11px] leading-snug text-[var(--text-muted)]">{metaLine(situation)}</div>

      <ReadinessChart curve={curve} heightClass="h-[92px]" />

      {!curve.historyAvailable ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">{curve.historyUnavailableReason}</p>
      ) : curve.priorSeasonPace.length === 0 ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">No comparable prior season to pace against.</p>
      ) : null}

      {curve.constrainingMaterial ? (
        <p className="mt-2.5 border-t border-[var(--border)] pt-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--risk-warning)]">{curve.constrainingMaterial.materialName}</span> is
          the tightest constraint — order by{" "}
          <span className="font-medium text-[var(--text-primary)]">{fmtDateShort(curve.constrainingMaterial.decisionDate)}</span> or
          {curve.constrainingMaterial.itemCount === 1 ? " the missing item" : ` ${curve.constrainingMaterial.itemCount} missing items`} may not be ready in time.
        </p>
      ) : null}

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{curve.situationTitle}</DialogTitle>
          <div className="text-[11px] leading-snug text-[var(--text-muted)]">{metaLine(situation)}</div>
          <ReadinessChart curve={curve} heightClass="h-[300px]" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function metaLine(situation: PlanningSituation): string {
  const unrepresented = situation.candidateItems.filter((c) => c.match.matchedItemId === undefined).length;
  const undecided = situation.candidateItems.filter(
    (c) => c.disposition === "unreviewed" || c.disposition === "under_review"
  ).length;
  const parts = [
    `${unrepresented} product${unrepresented === 1 ? "" : "s"} unrepresented`,
    undecided > 0 ? `${undecided} still to decide` : undefined,
    situation.productionWindow ? `builds from ${fmtDateShort(situation.productionWindow.start)}` : undefined,
  ].filter((p): p is string => Boolean(p));
  return parts.join(" · ");
}
