import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { CAPACITY_BUCKETS } from "@/data/synthetic/capacity";
import { PRODUCTION_LINES, DEMO_NOW } from "@/data/synthetic/master-data";
import { gapEarliestDate, weeksFromNow } from "@/components/gaps/gap-summary";
import { GapTypeBadge } from "@/components/gaps/gap-type-badge";
import { MetricBand, type MetricBandItem } from "@/components/planning/metric-band";
import { CapacityHeatmap, type HeatmapCell } from "@/components/charts/capacity-heatmap";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtNum, fmtPct } from "@/lib/utils/format";

const PERIODS = [
  { key: "2027-08", label: "Aug" },
  { key: "2027-09", label: "Sep" },
  { key: "2027-10", label: "Oct" },
];

export default function OverviewPage() {
  const results = detectPlanningGaps();
  const today = DEMO_NOW.slice(0, 10);

  const dated = results.map((r) => ({ r, earliest: gapEarliestDate(r) })).filter((d) => d.earliest != null);
  const mostUrgent = dated.sort((a, b) => weeksFromNow(today, a.earliest!) - weeksFromNow(today, b.earliest!))[0]?.r ?? results[0];
  const attentionCount = results.filter((r) => r.gap.severity !== "informational").length;

  const halloween = results.find((r) => r.gap.id === "halloween-2027");
  const line03Sept = halloween?.scenarioResult?.capacityImpact.find((c) => c.lineId === "line_03" && c.period === "2027-09");

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
        line03Sept && mostUrgent.gap.id === "halloween-2027"
          ? { label: "Line 03", value: fmtPct(line03Sept.effectiveUtilization), tone: line03Sept.riskLevel }
          : { label: "Confidence", value: fmtPct(mostUrgent.gap.confidence.overall) },
        { label: "Action window", value: gapEarliestDate(mostUrgent) ? `${weeksFromNow(today, gapEarliestDate(mostUrgent)!)}w` : "—", tone: "critical" },
      ]
    : [];

  const recentChanges = [
    results.find((r) => r.gap.id === "printed-film-lead-time") && {
      title: "Printed Film",
      detail: `Historical lead time now suggests action ${results.find((r) => r.gap.id === "printed-film-lead-time")!.gap.unresolvedValue}d earlier than the system assumption.`,
      href: "/gaps/printed-film-lead-time",
    },
    results.find((r) => r.gap.id === "valentines-premium-tin") && {
      title: "Valentine's Premium Tin",
      detail: `${results.find((r) => r.gap.id === "valentines-premium-tin")!.scenarioResult?.materialReadiness.filter((m) => m.readiness === "plan_now").length ?? 0} materials are sufficiently stable for provisional planning.`,
      href: "/gaps/valentines-premium-tin",
    },
    results.find((r) => r.gap.id === "halloween-2027") && {
      title: "Halloween 2027",
      detail: `Planning completeness sits at ${Math.round((results.find((r) => r.gap.id === "halloween-2027")!.scenarioResult?.planningCompletenessPct ?? 0))}%, below full representation.`,
      href: "/gaps/halloween-2027",
    },
  ].filter((c): c is { title: string; detail: string; href: string } => Boolean(c));

  return (
    <div className="flex flex-col gap-7 p-6">
      <div>
        <h1 className="text-[17px] font-semibold">Overview</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {attentionCount} planning situation{attentionCount === 1 ? "" : "s"} require attention across your current plan.
        </p>
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
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[13px] font-semibold">Multi-line risk horizon</h2>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <CapacityHeatmap lines={PRODUCTION_LINES.map((l) => l.name)} periods={PERIODS} cells={heatmapCells} />
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[13px] font-semibold">Recent changes</h2>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1">
          {recentChanges.map((c) => (
            <Link key={c.href} href={c.href} className="flex items-center justify-between rounded-[var(--radius-md)] px-3.5 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]">
              <div>
                <div className="text-[13px] font-medium">{c.title}</div>
                <div className="text-[12px] text-[var(--text-secondary)]">{c.detail}</div>
              </div>
              <ArrowRight className="size-3.5 flex-none text-[var(--text-muted)]" />
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Sparkles className="size-3.5 text-[var(--accent)]" /> Planning summary
        </h2>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {attentionCount} situations need attention this cycle. The most time-sensitive is <strong className="text-[var(--text-primary)]">{mostUrgent?.gap.title}</strong>, with an action window closing{" "}
          {mostUrgent && gapEarliestDate(mostUrgent) ? `on ${fmtDate(gapEarliestDate(mostUrgent)!)}` : "soon"}. {recentChanges.length > 0 && `${recentChanges[0]?.title} also moved this cycle — worth a look before it does.`}
        </div>
      </section>
    </div>
  );
}
