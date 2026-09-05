"use client";

/**
 * Resolves the active planning dataset and derives situations from it.
 *
 * Both modes land here and nothing below this point knows which adapter
 * produced the data (V2 §67). Derived planning numbers are never persisted:
 * `buildSituations` runs against (dataset + planner overrides) on every read,
 * which is what keeps the pages from drifting apart.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PlanningDataset } from "@/types/dataset";
import type { PlanningSituation } from "@/types/situation";
import { buildSituations } from "@/lib/situations/build";
import { generateDemoDataset } from "@/lib/dataset/demo/generate";
import { loadUploadedDataset } from "@/lib/dataset/storage";
import { useDatasetStore } from "@/stores/dataset-store";

export interface DatasetContextValue {
  dataset: PlanningDataset | null;
  situations: PlanningSituation[];
  /** True while the store is rehydrating or an upload is being read back. */
  loading: boolean;
  /** Set when an uploaded dataset was expected but could not be read back. */
  error: string | null;
}

const DatasetContext = createContext<DatasetContextValue>({
  dataset: null,
  situations: [],
  loading: true,
  error: null,
});

export function DatasetProvider({ children }: { children: ReactNode }) {
  const hasHydrated = useDatasetStore((s) => s.hasHydrated);
  const mode = useDatasetStore((s) => s.mode);
  const seed = useDatasetStore((s) => s.seed);
  const datasetId = useDatasetStore((s) => s.datasetId);
  const overridesBySituation = useDatasetStore((s) => s.overridesBySituation);

  const [uploaded, setUploaded] = useState<PlanningDataset | null>(null);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A demo dataset is cheap and deterministic, so it is regenerated from the
  // seed rather than stored — the seed is the only thing worth persisting.
  const demo = useMemo(() => (mode === "DEMO" ? generateDemoDataset({ seed }) : null), [mode, seed]);

  useEffect(() => {
    if (mode !== "UPLOADED") {
      setUploaded(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoadingUpload(true);
    loadUploadedDataset()
      .then((stored) => {
        if (cancelled) return;
        setUploaded(stored);
        setError(
          stored
            ? null
            : "Your uploaded data is no longer available in this browser. Upload the workbook again to continue."
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingUpload(false);
      });
    return () => {
      cancelled = true;
    };
    // `datasetId` changes on every new upload, which is the signal to re-read.
  }, [mode, datasetId]);

  const dataset = mode === "DEMO" ? demo : uploaded;

  // A committed volume is part of the baseline plan from the moment it is
  // committed — that is what separates it from a scenario the planner is still
  // playing with. It is applied as an override rather than written into the
  // dataset, so the workbook it came from stays untouched.
  const committedVolumes = useMemo(() => {
    const out: Record<string, number> = {};
    for (const overrides of Object.values(overridesBySituation)) {
      for (const commitment of Object.values(overrides.commitments ?? {})) {
        out[commitment.candidateId] = commitment.units;
      }
    }
    return out;
  }, [overridesBySituation]);

  const situations = useMemo(
    () =>
      dataset
        ? buildSituations(dataset, { overridesBySituation, volumeOverrideUnits: committedVolumes })
        : [],
    [dataset, overridesBySituation, committedVolumes]
  );

  const value = useMemo<DatasetContextValue>(
    () => ({
      dataset,
      situations,
      loading: !hasHydrated || loadingUpload,
      error,
    }),
    [dataset, situations, hasHydrated, loadingUpload, error]
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): DatasetContextValue {
  return useContext(DatasetContext);
}

/** The situation the workspace is currently focused on, if any. */
export function useSituation(id: string | undefined): PlanningSituation | undefined {
  const { situations } = useDataset();
  return useMemo(() => situations.find((s) => s.id === id), [situations, id]);
}
