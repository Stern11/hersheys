import { formatAge, latestSignalTimestamp, sourceFreshness } from "./signal-feed";
import { SIGNAL_SOURCE_SYSTEMS, type IngestionSignal } from "@/data/synthetic/signals";

/**
 * Honest freshness, not a "live" ornament.
 *
 * The "as of" is the arrival time of the newest signal in the ingestion log
 * — not a wall clock, not a render time. If a source has sent nothing, its
 * row says so rather than borrowing the overall as-of and implying traffic
 * that never happened.
 *
 * No animation, no pulse dot. A planner needs to know how old the picture
 * is; a blinking light does not tell them that.
 */
export function SyncStatusStrip({ signals, asOf }: { signals: IngestionSignal[]; asOf: string }) {
  const latest = latestSignalTimestamp(signals);
  const rows = sourceFreshness(signals, SIGNAL_SOURCE_SYSTEMS, asOf);

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Last signal received</span>
        {latest ? (
          <>
            <span className="text-[12px] font-medium tabular-nums">
              {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(latest))} UTC
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]">· {formatAge(latest, asOf)}</span>
          </>
        ) : (
          <span className="text-[12px] text-[var(--text-secondary)]">No signals ingested</span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.sourceSystem} className="flex items-baseline gap-1.5">
            <span className="text-[11.5px] text-[var(--text-secondary)]">{r.sourceSystem}</span>
            <span className="text-[11.5px] tabular-nums text-[var(--text-muted)]">
              {r.lastReceivedAt ? formatAge(r.lastReceivedAt, asOf) : "no traffic"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
