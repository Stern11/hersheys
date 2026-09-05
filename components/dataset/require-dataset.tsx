"use client";

/**
 * Keeps the product out of a half-initialised state.
 *
 * Mode lives in localStorage, so the decision can only be made on the client.
 * Rather than flashing an empty workspace, this holds a neutral frame until
 * the store has rehydrated and then sends a planner with no chosen mode to the
 * first-run screen.
 */

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDatasetStore } from "@/stores/dataset-store";
import { useDataset } from "./dataset-provider";
import { Page, NotAvailable } from "@/components/v2/page";

export function RequireDataset({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasHydrated = useDatasetStore((s) => s.hasHydrated);
  const mode = useDatasetStore((s) => s.mode);
  const { dataset, loading, error } = useDataset();

  useEffect(() => {
    if (hasHydrated && mode === null) router.replace("/start");
  }, [hasHydrated, mode, router]);

  if (!hasHydrated || loading || (mode !== null && !dataset && !error)) {
    return (
      <Page>
        <div className="h-1 w-24 animate-pulse rounded-full bg-[var(--border-strong)]" />
      </Page>
    );
  }

  if (mode === null) return <Page>{null}</Page>;

  if (!dataset) {
    return (
      <Page>
        <NotAvailable
          title="No planning data loaded"
          detail={error ?? "Choose a dataset to start planning."}
          action={
            <a
              href="/start"
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-on-accent)]"
            >
              Choose data
            </a>
          }
        />
      </Page>
    );
  }

  return <>{children}</>;
}
