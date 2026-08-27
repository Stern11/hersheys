"use client";

/* ============================================================================
 * ChartTooltip / ChartLegend — the shared hover primitive for every chart.
 * ============================================================================
 *
 * WHY THIS EXISTS
 * The signature charts each hand-rolled their hover story with native
 * `title=""` attributes. Native tooltips render as an OS box that appears
 * ~1s late, cannot be styled or themed, cannot be reached by keyboard, and
 * — the actual bug in the screenshot — is drawn OVER the adjacent chart row.
 * Every `title` on a chart mark must be replaced by <ChartTooltip>.
 *
 * WHAT IT IS BUILT ON
 * `@radix-ui/react-tooltip`, via the existing `components/ui/tooltip.tsx`
 * primitives. Radix is already a project dependency, so this adds no second
 * tooltip system; it adds a chart-shaped CONTENT layer plus the collision
 * config dense chart marks need. Content is rendered in a PORTAL on `body`,
 * so a narrow `react-resizable-panels` Panel or the `w-80` rail cannot clip
 * it, and `avoidCollisions` flips it to the other side / shifts it along the
 * axis instead of letting it overflow the viewport.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE LAYOUT CONSTRAINT — READ THIS BEFORE YOU WRAP A MARK
 * ─────────────────────────────────────────────────────────────────────────
 * These charts position marks with `absolute` + percentage `left/top/width/
 * height` inside a `relative` plot box. A tooltip wrapper that introduced its
 * own element would become the positioned child and destroy that geometry.
 *
 * ChartTooltip therefore renders **NO box of its own**. It uses Radix
 * `asChild`, which merges its event handlers, `ref`, and a11y attributes
 * onto YOUR element. The DOM you wrote is the DOM you get:
 *
 *     <ChartTooltip title="…" rows={…}>
 *       <div className="absolute inset-y-0" style={{ left: `${x}%`, width: `${w}%` }} />
 *     </ChartTooltip>
 *
 *   -> <div class="absolute inset-y-0" style="left:…;width:…" data-state="closed" tabindex="0" …/>
 *
 * Rules that follow from `asChild`:
 *   1. Pass EXACTLY ONE child element. Not a fragment, not a string, not two
 *      siblings. (Wrap two marks in two ChartTooltips, or in the mark's own
 *      existing container.)
 *   2. The child must accept a `ref` and spread DOM props — a plain
 *      `div`/`span`/`rect`/`button`, or your own component that forwards.
 *      React 19 function components forward `ref` natively.
 *   3. ChartTooltip never sets `className` or `style` on your child, so your
 *      positioning classes are untouched. Style the hover affordance yourself
 *      (see next section).
 *   4. It works on SVG children too (`<rect>`, `<g>`, `<path>`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOVER AFFORDANCE — Radix stamps `data-state` on your mark, style off it
 * ─────────────────────────────────────────────────────────────────────────
 * The wrapped element gets `data-state="closed" | "delayed-open" | "instant-open"`
 * on hover AND on keyboard focus. Use it for the visible affordance — this is
 * how all three charts stay consistent:
 *
 *     className="… transition-[filter,box-shadow] duration-100
 *                data-[state=delayed-open]:brightness-110
 *                data-[state=delayed-open]:ring-1
 *                data-[state=delayed-open]:ring-[var(--border-strong)]"
 *
 * Or use the exported `HOVER_MARK` / `HOVER_ROW` class constants below.
 * Keep the transition <=120ms. Do not add a `cursor-pointer` unless the mark
 * actually navigates — these are read-only marks, cursor stays default.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KEYBOARD / A11Y
 * ─────────────────────────────────────────────────────────────────────────
 * ChartTooltip adds `tabIndex={0}` so a non-interactive `div` mark is
 * reachable, and an `aria-label` flattened from the tooltip content so the
 * mark announces something. Both are defaults you can override on your child
 * (child props win). Pass `focusable={false}` for a mark that is decorative
 * or duplicated by an adjacent labelled mark, so you do not create 60 tab
 * stops in one chart.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   import { ChartTooltip, ChartLegend, HOVER_MARK } from "@/components/charts/chart-tooltip";
 *   import { derivationText, deltaText } from "@/lib/charts/tooltip-model";
 *
 *   <ChartTooltip
 *     title="Line 3 · Mar 2027"
 *     subtitle="Effective load"
 *     rows={[
 *       { label: "Formal",     value: `${fmtNum1(s.formal)}h`,   token: "--state-formal" },
 *       { label: "AI inferred",value: `${fmtNum1(s.inferred)}h`, token: "--state-inferred", omitWhenZero: true },
 *       { label: "Ceiling",    value: `${fmtNum1(r.ceiling)}h`,  token: "--text-primary", tone: "muted" },
 *     ]}
 *     footnote={derivationText({ part: r.load, whole: r.ceiling, unit: "h", wholeLabel: "ceiling" })}
 *     side="top"
 *   >
 *     <div className={`absolute inset-y-0 ${HOVER_MARK}`}
 *          style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%`, background: swatchVar(s.token) }} />
 *   </ChartTooltip>
 *
 * Rows are filtered by `buildTooltipRows` — a row whose `value` is
 * null/undefined/NaN/"" is dropped, and `omitWhenZero` drops an absent series.
 * A tooltip must ADD information (units, derivation, comparison to baseline,
 * what the series means in planning terms) — never restate the visible label.
 *
 * For fully custom content, pass `content` instead of title/rows/footnote:
 *
 *   <ChartTooltip content={<MyBlock/>} ariaLabel="Mar 2027 expected range">…</ChartTooltip>
 *
 * Legend (rule: only list series actually present with a non-zero value —
 * items with `present: false` are dropped for you):
 *
 *   <ChartLegend
 *     items={[
 *       { key: "hist",   label: "Historical actual", token: "--state-historical", present: model.legend.historical },
 *       { key: "range",  label: "Expected range",    token: "--state-inferred", shape: "band",
 *         tooltip: { title: "Expected range", rows: [{ label: "Method", value: "Seasonal analogue P10–P90" }] } },
 *       { key: "formal", label: "Formal plan",       token: "--state-formal", shape: "dashed" },
 *       { key: "ceil",   label: "Ceiling",           token: "--text-primary", shape: "marker" },
 *     ]}
 *     note="Y axis: units"
 *   />
 *
 * ============================================================================ */

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import {
  buildTooltipRows,
  flattenTooltipText,
  softToken,
  swatchVar,
  type SwatchToken,
  type TooltipRowInput,
} from "@/lib/charts/tooltip-model";

export type { SwatchToken, TooltipRowInput } from "@/lib/charts/tooltip-model";

/** Hover affordance for a filled mark (bar, segment, heat cell). <=120ms. */
export const HOVER_MARK =
  "transition-[filter,opacity] duration-100 ease-out outline-none " +
  "data-[state=delayed-open]:brightness-110 data-[state=instant-open]:brightness-110 " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]";

/** Hover affordance for a hairline reference mark (ceiling rule, target rule). */
export const HOVER_RULE =
  "transition-[opacity,box-shadow] duration-100 ease-out outline-none " +
  "data-[state=delayed-open]:shadow-[0_0_0_1px_var(--border-strong)] data-[state=instant-open]:shadow-[0_0_0_1px_var(--border-strong)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]";

/** Hover affordance for a whole row / table cell — a tint, not a brightness shift. */
export const HOVER_ROW =
  "transition-colors duration-100 ease-out outline-none " +
  "data-[state=delayed-open]:bg-[var(--interaction-hover)] data-[state=instant-open]:bg-[var(--interaction-hover)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]";

export type ChartTooltipSide = "top" | "right" | "bottom" | "left";
export type ChartTooltipAlign = "start" | "center" | "end";

export interface ChartTooltipProps {
  /** Single element to wrap. Rendered in place — no wrapper box is added. */
  children: React.ReactElement;
  /** Bold first line. What mark is this? e.g. "Line 3 · Mar 2027". */
  title?: React.ReactNode;
  /** Muted qualifier under the title. e.g. "Effective load". */
  subtitle?: React.ReactNode;
  /** Label/value rows. Empty/absent values are dropped automatically. */
  rows?: readonly TooltipRowInput[];
  /** Derivation line, e.g. `derivationText({…})` -> "266.4h ÷ 405.0h ceiling = 65.8%". */
  footnote?: React.ReactNode;
  /** Fully custom body. Replaces title/subtitle/rows/footnote when provided. */
  content?: React.ReactNode;
  /** Preferred side; flips automatically on collision. Default "top". */
  side?: ChartTooltipSide;
  /** Default "center". */
  align?: ChartTooltipAlign;
  /** Distance from the mark in px. Default 8. */
  sideOffset?: number;
  /** Open delay in ms. Default 60 (imperceptible, still debounces a sweep). */
  delayDuration?: number;
  /** Add `tabIndex={0}` + `aria-label` to the mark. Default true. */
  focusable?: boolean;
  /**
   * Override the generated `aria-label`. The generated one is flattened from
   * `title`/`subtitle`/`rows`/`footnote` and can only read STRING title,
   * subtitle and footnote — pass `ariaLabel` explicitly if any of those is a
   * ReactNode, or if you pass `content`.
   */
  ariaLabel?: string;
  /** Extra classes on the tooltip PANEL (not on your mark). */
  contentClassName?: string;
  /** Render the child untouched, with no tooltip at all (e.g. an empty mark). */
  disabled?: boolean;
}

/**
 * Wraps a chart mark with a rich, theme-aware, collision-aware tooltip.
 * Renders no element of its own — see the layout constraint in the header.
 */
export function ChartTooltip({
  children,
  title,
  subtitle,
  rows,
  footnote,
  content,
  side = "top",
  align = "center",
  sideOffset = 8,
  delayDuration = 60,
  focusable = true,
  ariaLabel,
  contentClassName,
  disabled = false,
}: ChartTooltipProps) {
  const built = React.useMemo(() => buildTooltipRows(rows ?? []), [rows]);

  const hasBody = content != null || title != null || subtitle != null || footnote != null || built.length > 0;
  if (disabled || !hasBody) return children;

  const label =
    ariaLabel ??
    (content != null
      ? undefined
      : flattenTooltipText({
          title: typeof title === "string" ? title : undefined,
          subtitle: typeof subtitle === "string" ? subtitle : undefined,
          rows: built,
          footnote: typeof footnote === "string" ? footnote : undefined,
        }) || undefined);

  // These are DEFAULTS: Radix's Slot lets the child's own props win, so a mark
  // that sets its own tabIndex/aria-label/role keeps them.
  const triggerDefaults: Record<string, unknown> = focusable ? { tabIndex: 0, "aria-label": label } : {};

  return (
    <Tooltip delayDuration={delayDuration} disableHoverableContent>
      <TooltipTrigger asChild {...triggerDefaults}>
        {children}
      </TooltipTrigger>
      {/* Root/Provider/Trigger come from `components/ui/tooltip.tsx` so charts
          share one tooltip system. The PANEL is composed from the Radix
          primitive directly (same dependency, no second system) because
          `ui/TooltipContent` hardcodes prose padding and a `zoom-in-95`
          entrance — a data panel must fade only, per the chart interaction
          rules, and `twMerge` cannot reliably strip a keyframe utility. */}
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          avoidCollisions
          collisionPadding={8}
          sticky="partial"
          className={cn(
            // The panel must never intercept the pointer: dense marks sit
            // millimetres apart and a hoverable panel would block the next one.
            "pointer-events-none z-50 select-none",
            "w-max min-w-[168px] max-w-[min(19rem,var(--radix-tooltip-content-available-width))]",
            "rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-elevated)]",
            "px-2.5 py-2 text-[11.5px] leading-snug text-[var(--text-secondary)] shadow-lg",
            // fade in only; no exit animation so it disappears immediately
            "animate-in fade-in-0 duration-100",
            contentClassName
          )}
        >
          {content ?? <ChartTooltipBody title={title} subtitle={subtitle} rows={built} footnote={footnote} />}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
}

function ChartTooltipBody({
  title,
  subtitle,
  rows,
  footnote,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  rows: ReturnType<typeof buildTooltipRows>;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {(title != null || subtitle != null) && (
        <div className={cn("flex flex-col gap-0.5", rows.length > 0 && "border-b border-[var(--border)] pb-1.5")}>
          {title != null && <span className="text-[12px] font-semibold leading-tight text-[var(--text-primary)]">{title}</span>}
          {subtitle != null && <span className="text-[10.5px] uppercase tracking-wide text-[var(--text-muted)]">{subtitle}</span>}
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-2.5 gap-y-1">
          {rows.map((r) => (
            <React.Fragment key={r.key}>
              <span aria-hidden className="translate-y-[-1px] self-center">
                {r.token ? (
                  <span className="block size-2 rounded-[1px]" style={{ background: swatchVar(r.token) }} />
                ) : (
                  <span className="block size-2" />
                )}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap",
                  r.tone === "muted" ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
                )}
              >
                {r.label}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-right tabular-nums",
                  r.tone === "emphasis" ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-primary)]",
                  r.tone === "muted" && "font-normal text-[var(--text-secondary)]"
                )}
              >
                {r.value}
              </span>
              {r.hint && (
                <span className="col-start-2 col-end-4 -mt-0.5 text-[10.5px] leading-snug text-[var(--text-muted)]">{r.hint}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {footnote != null && (
        <div
          className={cn(
            "text-[10.5px] leading-snug tabular-nums text-[var(--text-muted)]",
            (rows.length > 0 || title != null) && "border-t border-[var(--border)] pt-1.5"
          )}
        >
          {footnote}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ChartLegend
 * ------------------------------------------------------------------------- */

/**
 * How the swatch is drawn — mirror the mark it stands for:
 *  - `swatch`  solid fill (a bar / stacked segment)
 *  - `band`    soft fill + 1px border (an uncertainty range)
 *  - `line`    2px solid rule (a reference line)
 *  - `dashed`  1px dashed rule (a target / formal-plan line)
 *  - `marker`  2px vertical tick (a ceiling marker)
 */
export type LegendShape = "swatch" | "band" | "line" | "dashed" | "marker";

export interface ChartLegendItem {
  key: string;
  label: string;
  token: SwatchToken;
  shape?: LegendShape;
  /**
   * `false` removes the entry. Legends must only list series that are actually
   * present with a non-zero value — pass the model's own flag here.
   */
  present?: boolean;
  /** Optional explainer on hover: what the series MEANS in planning terms. */
  tooltip?: Pick<ChartTooltipProps, "title" | "subtitle" | "rows" | "footnote" | "content">;
}

export interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  /** Muted trailing note, pushed to the right (e.g. "Y axis: units"). */
  note?: React.ReactNode;
  className?: string;
}

/** One legend implementation for all three charts, so they read as one product. */
export function ChartLegend({ items, note, className }: ChartLegendProps) {
  const visible = items.filter((i) => i.present !== false);
  if (visible.length === 0 && note == null) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]", className)}>
      {visible.map((item) => {
        const entry = (
          <span className={cn("flex items-center gap-1.5", item.tooltip && HOVER_ROW, item.tooltip && "rounded-[2px] px-1 -mx-1")}>
            <LegendSwatch token={item.token} shape={item.shape ?? "swatch"} />
            {item.label}
          </span>
        );
        return item.tooltip ? (
          <ChartTooltip key={item.key} side="top" {...item.tooltip}>
            {entry}
          </ChartTooltip>
        ) : (
          <React.Fragment key={item.key}>{entry}</React.Fragment>
        );
      })}
      {note != null && <span className="ml-auto tabular-nums">{note}</span>}
    </div>
  );
}

function LegendSwatch({ token, shape }: { token: SwatchToken; shape: LegendShape }) {
  const color = swatchVar(token);
  switch (shape) {
    case "band":
      return (
        <span
          aria-hidden
          className="inline-block size-2.5 shrink-0 rounded-[2px]"
          style={{ background: `var(${softToken(token)})`, border: `1px solid ${color}` }}
        />
      );
    case "line":
      return <span aria-hidden className="inline-block h-0 w-3 shrink-0 border-t-2" style={{ borderColor: color }} />;
    case "dashed":
      return <span aria-hidden className="inline-block h-0 w-3 shrink-0 border-t border-dashed" style={{ borderColor: color }} />;
    case "marker":
      return <span aria-hidden className="inline-block h-2.5 w-[2px] shrink-0" style={{ background: color }} />;
    default:
      return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />;
  }
}
