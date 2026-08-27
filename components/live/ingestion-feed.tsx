import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAge, recentSignals } from "./signal-feed";
import { SIGNAL_DISPOSITION_LABEL, SIGNAL_KIND_LABEL, type IngestionSignal } from "@/data/synthetic/signals";

/**
 * The integration inbox, rendered as a log rather than as cards.
 *
 * Density over decoration: one hairline-separated row per arrival, the
 * source system and its document reference in monospace on the left, the
 * fact on the right. Where an arrival bears on a detected gap, the row
 * carries a link into that gap's workspace — the signal states what
 * arrived, the gap states what it means.
 *
 * `disposition` is the only place a risk token appears: "Needs review" is a
 * genuine status. Source system and kind are neutral labels, never coloured
 * as though they were a data series.
 */
export function IngestionFeed({ signals, asOf, limit = 6 }: { signals: IngestionSignal[]; asOf: string; limit?: number }) {
  const rows = recentSignals(signals, limit);

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-6 text-center text-[12px] text-[var(--text-secondary)]">
        No signals have been ingested yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
      {rows.map((s) => {
        const body = (
          <>
            <div className="flex w-[168px] flex-none flex-col gap-0.5 pt-px">
              <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{s.sourceSystem}</span>
              <span className="font-mono text-[10.5px] text-[var(--text-muted)]">{s.sourceRef}</span>
              <span className="text-[10.5px] tabular-nums text-[var(--text-muted)]">{formatAge(s.receivedAt, asOf)}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-medium">{s.headline}</span>
                <Badge variant="neutral">{SIGNAL_KIND_LABEL[s.kind]}</Badge>
                {s.disposition === "needs_review" && <Badge variant="warning">{SIGNAL_DISPOSITION_LABEL.needs_review}</Badge>}
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{s.detail}</p>
            </div>
            {s.relatedGapId && <ArrowRight className="mt-1 size-3.5 flex-none text-[var(--text-muted)]" />}
          </>
        );

        return s.relatedGapId ? (
          <Link
            key={s.id}
            href={`/gaps/${s.relatedGapId}`}
            className="flex items-start gap-3.5 px-3.5 py-3 transition-colors hover:bg-[var(--surface-sunken)]"
          >
            {body}
          </Link>
        ) : (
          <div key={s.id} className="flex items-start gap-3.5 px-3.5 py-3">
            {body}
          </div>
        );
      })}
    </div>
  );
}
