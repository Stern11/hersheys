/**
 * Scenario Lab's landing view when no `?situation=` is present.
 *
 * Every entry point into the lab elsewhere in the product (a Planning Gap,
 * Capacity, Materials, the workspace step nav) already knows which situation
 * it wants — this page is only reached directly, so it has to ask.
 */

"use client";

import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useDataset } from "@/components/dataset/dataset-provider";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { StateBadge } from "@/components/v2/state-badge";
import { NotAvailable, Page, PageHeader } from "@/components/v2/page";
import { fmtMoney } from "@/lib/utils/format";

export function SituationPicker() {
  const { situations } = useDataset();
  const scenarios = useSituationScenarioStore((s) => s.scenarios);
  const setActiveScenario = useSituationScenarioStore((s) => s.setActiveScenario);

  return (
    <Page>
      <PageHeader title="Scenario Lab" subtitle="Pick a situation to test assumptions against" />

      {situations.length === 0 ? (
        <NotAvailable
          title="No planning situations"
          detail="There is nothing to open in Scenario Lab yet."
          action={
            <Link
              href="/workspace"
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-on-accent)]"
            >
              Go to Planning Workspace
            </Link>
          }
        />
      ) : (
        <div className="border-t border-[var(--border)]">
          {situations.map((situation) => {
            const savedScenarios = Object.values(scenarios).filter((s) => s.situationId === situation.id);
            return (
              <div key={situation.id} className="border-b border-[var(--border)] py-4">
                <Link
                  href={`/scenario-lab?situation=${situation.id}`}
                  className="group flex items-center gap-4 transition-colors hover:bg-[var(--interaction-hover)]"
                >
                  <FlaskConical className="size-4 flex-none text-[var(--text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[14.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                        {situation.title}
                      </span>
                      <StateBadge state={situation.state} />
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                      {situation.businessScope}
                    </div>
                  </div>
                  <div className="w-[104px] flex-none text-right">
                    <div className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                      {fmtMoney(situation.bridge.unresolvedValue, situation.bridge.currency)}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">Unresolved</div>
                  </div>
                  <ArrowRight className="size-4 flex-none text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>

                {savedScenarios.length > 0 ? (
                  <div className="ml-8 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {savedScenarios.map((s) => (
                      <Link
                        key={s.id}
                        href={`/scenario-lab?situation=${situation.id}`}
                        onClick={() => setActiveScenario(s.id)}
                        className="text-[12px] text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text-primary)]"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
