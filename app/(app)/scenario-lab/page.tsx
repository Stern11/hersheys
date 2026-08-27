"use client";

import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useScenarioStore } from "@/stores/scenario-store";
import { Badge } from "@/components/ui/badge";

/**
 * Scenario Lab's secondary landing view — a recent-scenarios picker, not
 * the primary surface. Opening a scenario is what leads into the full
 * analytical workspace at /scenario-lab/[scenarioId].
 */
export default function ScenarioLabIndexPage() {
  const scenarios = useScenarioStore((s) => s.scenarios);
  const list = Object.values(scenarios).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-[17px] font-semibold">Scenario Lab</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Recent scenarios. Open one to enter the full analytical workspace, or open any Planning Gap and start from there.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {list.map((s) => (
          <Link
            key={s.id}
            href={`/scenario-lab/${s.id}`}
            className="group flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 transition-colors hover:border-[var(--border-strong)]"
          >
            <div className="flex size-9 flex-none items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <FlaskConical className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">{s.name}</div>
              {/* A scenario note is a full sentence of planning rationale. It
                  was clipped to one line with no way to read the rest — not
                  even a tooltip. Two lines by default, the whole thing on
                  hover. */}
              <p className="line-clamp-2 text-[12px] leading-snug text-[var(--text-muted)]" title={s.note}>
                {s.note}
              </p>
            </div>
            <Badge variant={s.status === "preferred" ? "positive" : "neutral"}>{s.status.replace("_", " ")}</Badge>
            <ArrowRight className="size-4 flex-none text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] px-4 py-5 text-center">
        <p className="text-[12.5px] text-[var(--text-muted)]">
          New scenarios start from a Planning Gap — open any gap and select{" "}
          <span className="font-medium text-[var(--text-secondary)]">Open in Scenario Lab</span>.
        </p>
      </div>
    </div>
  );
}
