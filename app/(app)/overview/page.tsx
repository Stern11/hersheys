import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { CAPACITY_BUCKETS, HALLOWEEN_PEAK_PRODUCTION_PERIOD } from "@/data/synthetic/capacity";
import { PRODUCTION_LINES, DEMO_NOW, lineById } from "@/data/synthetic/master-data";
import { INGESTION_SIGNALS, SIGNAL_CLOCK_NOW } from "@/data/synthetic/signals";
import { latestSignalTimestamp, recentSignals, signalsForGap } from "@/components/live/signal-feed";
import { IngestionFeed } from "@/components/live/ingestion-feed";
import { SyncStatusStrip } from "@/components/live/sync-status-strip";
import { gapEarliestDate, weeksFromNow } from "@/components/gaps/gap-summary";
import { GapTypeBadge } from "@/components/gaps/gap-type-badge";
import { MetricBand, type MetricBandItem } from "@/components/planning/metric-band";
import { CapacityHeatmap, type HeatmapCell } from "@/components/charts/capacity-heatmap";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtNum, fmtPct } from "@/lib/utils/format";

/**
 * The three RCCP buckets that are still open from the demo's "now"
 * (8 Mar 2027) and that the Halloween build actually runs in — Halloween is
 * PRODUCED Mar-Jul and SELLS Sep-Oct, so a risk horizon drawn over the sell
 * months would show a formal load with no seasonal overlay on it at all.
 * June is HALLOWEEN_PEAK_PRODUCTION_PERIOD, the only bucket the scenario
 * engine returns a capacity impact for.
 */
const PERIODS = [
  { key: "2027-04", label: "Apr" },
  { key: "2027-05", label: "May" },
  { key: HALLOWEEN_PEAK_PRODUCTION_PERIOD, label: "Jun" },
];

export default function OverviewPage() {
  const results = detectPlanningGaps();
  const today = DEMO_NOW.slice(0, 10);

  const dated = results.map((r) => ({ r, earliest: gapEarliestDate(r) })).filter((d) => d.earliest != null);
  const mostUrgent = dated.sort((a, b) => weeksFromNow(today, a.earliest!) - weeksFromNow(today, b.earliest!))[0]?.r ?? results[0];
  const attentionCount = results.filter((r) => r.gap.severity !== "informational").length;

  const halloween = results.find((r) => r.gap.id === "halloween-2027");
  const line03 = lineById("line_03");
  const line03Peak = halloween?.scenarioResult?.capacityImpact.find((c) => c.lineId === line03.id && c.period === HALLOWEEN_PEAK_PRODUCTION_PERIOD);

  const heatmapCells: HeatmapCell[] = [];
  PRODUCTION_LINES.forEach((line) => {
    PERIODS.forEach((p) => {
      const bucket = CAPACITY_BUCKETS.find((b) => b.lineId === line.id && b.period === p.key);
      if (!bucket) return;
      const formal = bucket.formalLoadHours / (bucket.availableHours - bucket.plannedDowntimeHours);
      const liveImpact = halloween?.scenarioResult?.capacityImpact.find((c) => c.lineId === line.id && c.period === p.key);
      const cell: HeatmapCell = {
        lineLabel: line.name,
        period: p.key,
        periodLabel: p.label,
        utilization: liveImpact ? liveImpact.formalUtilization : formal,
      };
      if (liveImpact) cell.effective = liveImpact.effectiveUtilization;
      heatmapCells.push(cell);
    });
  });

  const urgentMetrics: MetricBandItem[] = mostUrgent
    ? [
        { label: "Formal", value: `${fmtNum(mostUrgent.gap.formalValue)} ${mostUrgent.gap.unit}` },
        { label: "Expected", value: `${fmtNum(mostUrgent.gap.expectedValueLow)}–${fmtNum(mostUrgent.gap.expectedValueHigh)} ${mostUrgent.gap.unit}` },
        { label: "Unresolved", value: `${fmtNum(mostUrgent.gap.unresolvedValue)} ${mostUrgent.gap.unit}`, tone: "warning" },
        line03Peak && mostUrgent.gap.id === "halloween-2027"
          ? { label: `${line03.name} · Jun`, value: fmtPct(line03Peak.effectiveUtilization), tone: line03Peak.riskLevel }
          : { label: "Confidence", value: fmtPct(mostUrgent.gap.confidence.overall) },
        { label: "Action window", value: gapEarliestDate(mostUrgent) ? `${weeksFromNow(today, gapEarliestDate(mostUrgent)!)}w` : "—", tone: "critical" },
      ]
    : [];

  // --- Live ingestion state ---------------------------------------------
  // "As of" is the demo clock, and every freshness figure below is measured
  // against the arrival time of a real record in the ingestion log — never a
  // render clock, so the server and client renders agree and the page is
  // reproducible. Nothing here is a planning calculation: the feed orders
  // and ages records, it does not derive numbers.
  const asOf = SIGNAL_CLOCK_NOW;
  const latestSignalAt = latestSignalTimestamp(INGESTION_SIGNALS);
  const newestSignal = recentSignals(INGESTION_SIGNALS, 1)[0];
  const signalsOnUrgentGap = mostUrgent ? signalsForGap(INGESTION_SIGNALS, mostUrgent.gap.id) : [];

  return (
    <div className="flex flex-col gap-7 p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-[17px] font-semibold">Overview</h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {attentionCount} planning situation{attentionCount === 1 ? "" : "s"} require attention across your current plan
            {latestSignalAt ? `, recomputed against signals received through ${fmtDate(latestSignalAt)}` : ""}.
          </p>
        </div>
        <SyncStatusStrip signals={INGESTION_SIGNALS} asOf={asOf} />
      </div>

      {mostUrgent && (
        <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold">{mostUrgent.gap.title}</span>
              <GapTypeBadge type={mostUrgent.gap.type} />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/gaps/${mostUrgent.gap.id}`}>View gap</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/scenario-lab">
                  Open scenario <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
          <MetricBand items={urgentMetrics} />
          {signalsOnUrgentGap.length > 0 && (
            <p className="text-[12px] text-[var(--text-secondary)]">
              {signalsOnUrgentGap.length} inbound signal{signalsOnUrgentGap.length === 1 ? "" : "s"} bear on this situation — most recently{" "}
              <span className="text-[var(--text-primary)]">{signalsOnUrgentGap[0]!.headline}</span> from {signalsOnUrgentGap[0]!.sourceSystem}.
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[13px] font-semibold">Multi-line risk horizon</h2>
          <span className="text-[11.5px] text-[var(--text-muted)]">Apr–Jun 2027 production buckets — Halloween is built Mar–Jul and sells Sep–Oct</span>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <CapacityHeatmap lines={PRODUCTION_LINES.map((l) => l.name)} periods={PERIODS} cells={heatmapCells} />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[13px] font-semibold">Recent changes</h2>
          <span className="text-[11.5px] text-[var(--text-muted)]">
            {INGESTION_SIGNALS.length} signals ingested from SAP S/4HANA, Kinaxis, Aera and EDI
          </span>
        </div>
        <IngestionFeed signals={INGESTION_SIGNALS} asOf={asOf} limit={INGESTION_SIGNALS.length} />
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[13px] font-semibold">Planning summary</h2>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {attentionCount} situations need attention this cycle. The most time-sensitive is <strong className="text-[var(--text-primary)]">{mostUrgent?.gap.title}</strong>, with an action window closing{" "}
          {mostUrgent && gapEarliestDate(mostUrgent) ? `on ${fmtDate(gapEarliestDate(mostUrgent)!)}` : "soon"}.
          {newestSignal && (
            <>
              {" "}
              The most recent inbound signal is <strong className="text-[var(--text-primary)]">{newestSignal.headline}</strong> ({newestSignal.sourceSystem}, {newestSignal.sourceRef}).
            </>
          )}
        </div>
      </section>
    </div>
  );
}
