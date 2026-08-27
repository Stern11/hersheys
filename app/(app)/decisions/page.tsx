"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Radar, ShieldCheck } from "lucide-react";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { useAppStore } from "@/stores/app-store";
import { useScenarioStore } from "@/stores/scenario-store";
import { Badge } from "@/components/ui/badge";
import { GapTypeBadge } from "@/components/gaps/gap-type-badge";
import { gapConsequence } from "@/components/gaps/gap-summary";
import { ReconciliationDemo } from "@/components/planning/reconciliation-demo";

export default function DecisionsPage() {
  const results = detectPlanningGaps();
  const monitoredGapIds = useAppStore((s) => s.monitoredGapIds);
  const validatedGapIds = useAppStore((s) => s.validatedGapIds);
  const dismissedGapIds = useAppStore((s) => s.dismissedGapIds);
  const intentionalGapIds = useAppStore((s) => s.intentionalGapIds);
  const toggleMonitored = useAppStore((s) => s.toggleMonitored);
  const toggleValidated = useAppStore((s) => s.toggleValidated);
  const toggleDismissed = useAppStore((s) => s.toggleDismissed);
  const toggleIntentional = useAppStore((s) => s.toggleIntentional);
  const scenarios = useScenarioStore((s) => s.scenarios);

  const decided = new Set([...monitoredGapIds, ...validatedGapIds, ...dismissedGapIds, ...intentionalGapIds]);
  const open = results.filter((r) => !decided.has(r.gap.id));
  const monitored = results.filter((r) => monitoredGapIds.includes(r.gap.id));
  const validated = results.filter((r) => validatedGapIds.includes(r.gap.id));
  const closed = results.filter((r) => dismissedGapIds.includes(r.gap.id) || intentionalGapIds.includes(r.gap.id));
  const savedScenarios = Object.values(scenarios).filter((s) => s.status !== "draft");

  return (
    <div className="flex flex-col gap-7 p-6">
      <div>
        <h1 className="text-[17px] font-semibold">Decisions</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Where every open planning gap stands — monitored, validated, saved, or intentionally left as-is.</p>
      </div>

      {(() => {
        const halloween = results.find((r) => r.gap.id === "halloween-2027");
        return halloween ? (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-semibold">Reconciliation</h2>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <ReconciliationDemo priorProvisional={halloween.gap.unresolvedValue} />
            </div>
          </section>
        ) : null;
      })()}

      {savedScenarios.length > 0 && (
        <Section title="Saved scenarios">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1">
            {savedScenarios.map((s) => (
              <Link key={s.id} href={`/scenario-lab/${s.id}`} className="flex items-center justify-between rounded-[var(--radius-md)] px-3.5 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]">
                <div>
                  <div className="text-[13px] font-medium">{s.name}</div>
                  <div className="text-[12px] text-[var(--text-secondary)]">{s.note}</div>
                </div>
                <Badge variant={s.status === "preferred" ? "positive" : "neutral"}>{s.status.replace("_", " ")}</Badge>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Open (${open.length})`} empty={open.length === 0} emptyText="Every situation has a decision recorded.">
        {open.map((r) => (
          <DecisionRow key={r.gap.id} r={r} actions={[
            { label: "Monitor", icon: Radar, onClick: () => toggleMonitored(r.gap.id) },
            { label: "Validate", icon: ShieldCheck, onClick: () => toggleValidated(r.gap.id) },
            { label: "Mark intentional", icon: CheckCircle2, onClick: () => toggleIntentional(r.gap.id) },
            { label: "Dismiss", icon: EyeOff, onClick: () => toggleDismissed(r.gap.id) },
          ]} />
        ))}
      </Section>

      {monitored.length > 0 && (
        <Section title={`Monitoring (${monitored.length})`}>
          {monitored.map((r) => (
            <DecisionRow key={r.gap.id} r={r} statusBadge="monitoring" actions={[{ label: "Stop monitoring", icon: Radar, onClick: () => toggleMonitored(r.gap.id) }]} />
          ))}
        </Section>
      )}

      {validated.length > 0 && (
        <Section title={`Validated (${validated.length})`}>
          {validated.map((r) => (
            <DecisionRow key={r.gap.id} r={r} statusBadge="validated" actions={[{ label: "Unvalidate", icon: ShieldCheck, onClick: () => toggleValidated(r.gap.id) }]} />
          ))}
        </Section>
      )}

      {closed.length > 0 && (
        <Section title={`Dismissed / intentional (${closed.length})`}>
          {closed.map((r) => (
            <DecisionRow
              key={r.gap.id}
              r={r}
              statusBadge={dismissedGapIds.includes(r.gap.id) ? "dismissed" : "intentional"}
              actions={[
                {
                  label: "Restore",
                  icon: Eye,
                  onClick: () => (dismissedGapIds.includes(r.gap.id) ? toggleDismissed(r.gap.id) : toggleIntentional(r.gap.id)),
                },
              ]}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, empty, emptyText }: { title: string; children: React.ReactNode; empty?: boolean; emptyText?: string }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      {empty ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[12.5px] text-[var(--text-muted)]">{emptyText}</p>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-1">{children}</div>
      )}
    </section>
  );
}

function DecisionRow({
  r,
  statusBadge,
  actions,
}: {
  r: ReturnType<typeof detectPlanningGaps>[number];
  statusBadge?: "monitoring" | "validated" | "dismissed" | "intentional";
  actions: { label: string; icon: typeof Radar; onClick: () => void }[];
}) {
  const badgeVariant = { monitoring: "neutral", validated: "positive", dismissed: "neutral", intentional: "neutral" } as const;
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] px-3.5 py-2.5">
      <Link href={`/gaps/${r.gap.id}`} className="min-w-0 flex-1 hover:underline">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">{r.gap.title}</span>
          <GapTypeBadge type={r.gap.type} />
          {statusBadge && <Badge variant={badgeVariant[statusBadge]}>{statusBadge}</Badge>}
        </div>
        <p className="truncate text-[11.5px] text-[var(--text-muted)]">{gapConsequence(r)}</p>
      </Link>
      <div className="flex flex-none gap-1.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            title={a.label}
            className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <a.icon className="size-3" />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
