import type { EvidenceSignal } from "@/types/shared";
import { fmtDate } from "@/lib/utils/format";
import { isPercentUnit, summarizeEvidence } from "@/lib/gaps/gap-metrics";

const QUALITY_DOT = { high: "var(--risk-positive)", medium: "var(--risk-warning)", low: "var(--risk-critical)" } as const;

/**
 * Every evidence row from PRD §12.4 — source, value, date/freshness,
 * system/planner/AI-supplied, quality, and whether it is in the basis.
 *
 * LAYOUT: this renders inside the Gap Workspace's ~288px control rail. The
 * previous implementation was a six-column table with `min-w-[620px]`, so
 * QUALITY / SUPPLIED BY / INCLUDED were pushed ~335px off-screen behind a
 * horizontal scrollbar nobody finds — and the exclusion rationale, which is
 * the single most important thing in this rail, lived in the columns that
 * were cut off. Six columns do not fit in 288px, so this is not a table any
 * more: each signal is a stacked block whose widest element is one line of
 * wrapping text. Nothing here has an intrinsic minimum width, so nothing
 * can be clipped at any rail width.
 *
 * The rationale / exclusion reason sits behind a native <details>
 * disclosure so fourteen signals stay scannable while every one of them
 * stays reachable without JavaScript — and, unlike the old "Included"
 * cell, a disclosure triangle is an honest affordance: it discloses, it
 * does not toggle inclusion. Inclusion is decided by the planning basis,
 * not by this rail.
 */
export function EvidencePanel({ evidence, initiallyShown = 6 }: { evidence: EvidenceSignal[]; initiallyShown?: number }) {
  if (evidence.length === 0) {
    return <p className="text-[12.5px] text-[var(--text-muted)]">No evidence rows in scope.</p>;
  }

  const { total, included, excluded } = summarizeEvidence(evidence);
  const head = evidence.slice(0, initiallyShown);
  const rest = evidence.slice(initiallyShown);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-[var(--text-muted)]">
        {included} in basis{excluded > 0 ? ` · ${excluded} excluded` : ""} · {total} total
      </p>

      <ul className="flex flex-col gap-1.5">
        {head.map((e) => (
          <EvidenceRow key={e.id} signal={e} />
        ))}
      </ul>

      {rest.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] px-2.5 py-1.5 text-center text-[11.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">
              Show {rest.length} more signal{rest.length === 1 ? "" : "s"}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {rest.map((e) => (
              <EvidenceRow key={e.id} signal={e} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EvidenceRow({ signal: e }: { signal: EvidenceSignal }) {
  const detail = e.included ? e.rationale : e.excludedReason ?? e.rationale;
  // A percentage evidence row carries unit "%", which rendered as a separate
  // span produced "90 %". Percent signs glue to their number; every other
  // unit ("hours", "units/hr", "MSI") is a real word and stays separate.
  const percentGlued = typeof e.value === "number" && e.unit != null && isPercentUnit(e.unit);
  const valueText = typeof e.value === "number" ? `${e.value.toLocaleString()}${percentGlued ? "%" : ""}` : e.value;
  const unitText = percentGlued ? undefined : e.unit;

  return (
    <li className={`rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 ${e.included ? "" : "opacity-70"}`}>
      <div className="flex items-start gap-1.5">
        <span aria-hidden title={`${e.quality} data quality`} className="mt-[6px] size-1.5 flex-none rounded-full" style={{ background: QUALITY_DOT[e.quality] }} />
        <div className="min-w-0 flex-1">
          {/* Value first — it is what a planner scans this rail for. */}
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="break-words text-[13px] font-semibold leading-tight tabular-nums">{valueText}</span>
            {unitText && <span className="text-[11px] text-[var(--text-muted)]">{unitText}</span>}
          </div>

          <div className="mt-0.5 break-words text-[11.5px] leading-snug text-[var(--text-secondary)]">{e.source}</div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            <span className={`rounded-[3px] px-1 py-px ${e.included ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "border border-[var(--border-strong)]"}`}>
              {e.included ? "In basis" : "Excluded"}
            </span>
            <span>{e.quality} quality</span>
            <span aria-hidden>·</span>
            <span>{e.suppliedBy}</span>
            {e.dateRange && (
              <>
                <span aria-hidden>·</span>
                <span className="normal-case tracking-normal">
                  {e.dateRange.start === e.dateRange.end ? fmtDate(e.dateRange.start) : `${fmtDate(e.dateRange.start)} – ${fmtDate(e.dateRange.end)}`}
                </span>
              </>
            )}
          </div>

          {detail && (
            <details className="group/why mt-1">
              <summary className="cursor-pointer list-none text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] [&::-webkit-details-marker]:hidden">
                <span className="group-open/why:hidden">{e.included ? "Why it counts ▸" : "Why it's excluded ▸"}</span>
                <span className="hidden group-open/why:inline">{e.included ? "Why it counts ▾" : "Why it's excluded ▾"}</span>
              </summary>
              <p className="mt-1 break-words text-[11.5px] leading-relaxed text-[var(--text-secondary)]">{detail}</p>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
