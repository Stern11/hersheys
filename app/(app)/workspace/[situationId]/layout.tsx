"use client";

/**
 * The situation workflow frame (V2 §41).
 *
 * Reconcile -> Decide, as top step navigation so a planner can move between
 * steps freely rather than being marched through a wizard. The situation
 * header stays put so the context never disappears.
 *
 * There is deliberately no Plan Supply or Check Capacity step. Material and
 * capacity consequences are not separate subjects a planner visits — they are
 * what a *particular* unrepresented item does, and reading them as portfolio
 * aggregates hid the very thing that caused them. They live inside the SKU
 * drawer on Reconcile, and roll up on Decide.
 */

import Link from "next/link";
import { use } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { useSituation } from "@/components/dataset/dataset-provider";
import { StateBadge } from "@/components/shared/state-badge";
import { NotAvailable, Page } from "@/components/shared/page";
import { cn } from "@/lib/utils/cn";
import { fmtDateShort } from "@/lib/utils/format";

const STEPS = [
  { slug: "reconcile", label: "Reconcile", question: "What isn't represented?" },
  { slug: "decide", label: "Decide", question: "What should I do?" },
];

export default function SituationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ situationId: string }>;
}) {
  const { situationId } = use(params);
  const situation = useSituation(situationId);
  const pathname = usePathname();

  if (!situation) {
    return (
      <Page>
        <NotAvailable
          title="Situation not found"
          detail="It may belong to a dataset that is no longer loaded."
          action={
            <Link
              href="/workspace"
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-on-accent)]"
            >
              Back to workspace
            </Link>
          }
        />
      </Page>
    );
  }

  const activeIndex = STEPS.findIndex((s) => pathname.endsWith(`/${s.slug}`));

  return (
    <div>
      {/* Sticky so the programme and the step you are on stay visible while
          you scroll a long list — losing your place in the workflow is the
          fastest way to stop trusting a number you are looking at. */}
      <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-[1360px] px-4 pt-3 sm:px-8 sm:pt-4">
          <Link
            href="/workspace"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-3" />
            Planning Workspace
          </Link>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                  {situation.title}
                </h1>
                <StateBadge state={situation.state} />
              </div>
              <p className="mt-1 text-[12.5px] text-[var(--text-secondary)] sm:truncate">
                {situation.businessScope}
                {situation.salesWindow
                  ? ` · Sells ${fmtDateShort(situation.salesWindow.start)} – ${fmtDateShort(situation.salesWindow.end)}`
                  : ""}
              </p>
            </div>

            <Link
              href={`/scenario-lab?situation=${situation.id}`}
              className="inline-flex flex-none items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--interaction-hover)]"
            >
              <FlaskConical className="size-3.5" />
              Open in Scenario Lab
            </Link>
          </div>

          <nav className="mt-4 flex gap-1">
            {STEPS.map((step, index) => {
              const active = index === activeIndex;
              return (
                <Link
                  key={step.slug}
                  href={`/workspace/${situationId}/${step.slug}`}
                  className={cn(
                    "relative flex items-baseline gap-2 rounded-t-[var(--radius-sm)] px-3.5 py-2.5 text-[13px] transition-colors",
                    active
                      ? "font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <span className={cn("tabular-nums", active ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>
                    {index + 1}
                  </span>
                  {step.label}
                  {active ? (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {children}
    </div>
  );
}
