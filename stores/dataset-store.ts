/**
 * Which dataset the product is looking at, and what the planner has decided
 * about it.
 *
 * Deliberately holds no derived planning numbers — situations are recomputed
 * from (dataset + overrides) on read, the same rule the scenario store follows.
 * Demo mode persists only its seed; an uploaded dataset lives in IndexedDB
 * (see `lib/dataset/storage.ts`) because it is far too large for web storage.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ContributorDisposition, MatchConfig, SituationOverrides } from "@/types/situation";
import type { DatasetMode } from "@/types/dataset";
import { webStorage } from "./persist-storage";
import { DEFAULT_DEMO_SEED } from "@/lib/dataset/demo/generate";

export const DATASET_STORAGE_KEY = "heizen.dataset";

export interface DatasetStoreState {
  /** Null until the planner has chosen a mode — drives the first-run screen. */
  mode: DatasetMode | null;
  datasetId: string;
  datasetName: string;
  /** Demo only. */
  seed: string;
  /** Uploaded only. */
  uploadedFileName: string | null;
  uploadedAt: string | null;
  /** True once an uploaded dataset is known to be in IndexedDB. */
  hasStoredUpload: boolean;

  activeSituationId: string | null;
  /** Planner dispositions, keyed by situation id. */
  overridesBySituation: Record<string, SituationOverrides>;

  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  chooseDemo: (seed?: string) => void;
  regenerateDemo: (seed: string) => void;
  chooseUpload: (input: { fileName: string; uploadedAt: string; datasetName: string }) => void;
  clearDataset: () => void;

  setActiveSituation: (id: string | null) => void;
  setDisposition: (situationId: string, candidateId: string, disposition: ContributorDisposition) => void;
  setDispositions: (situationId: string, dispositions: Record<string, ContributorDisposition>) => void;
  resetDispositions: (situationId: string) => void;
  setMatchConfig: (situationId: string, config: MatchConfig | undefined) => void;
  /** Which historical periods form the planning basis for one situation. */
  setSeasonBasis: (situationId: string, periods: string[] | undefined) => void;
}

const emptyOverrides = (): SituationOverrides => ({ dispositions: {} });

export const useDatasetStore = create<DatasetStoreState>()(
  persist(
    (set) => ({
      mode: null,
      datasetId: "demo",
      datasetName: "Demo planning data",
      seed: DEFAULT_DEMO_SEED,
      uploadedFileName: null,
      uploadedAt: null,
      hasStoredUpload: false,

      activeSituationId: null,
      overridesBySituation: {},

      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      chooseDemo: (seed) =>
        set((state) => ({
          mode: "DEMO",
          seed: seed ?? state.seed,
          datasetId: `demo:${seed ?? state.seed}`,
          datasetName: "Demo planning data",
          uploadedFileName: null,
          uploadedAt: null,
          // Switching source invalidates every decision made against the old one.
          overridesBySituation: {},
          activeSituationId: null,
        })),

      regenerateDemo: (seed) =>
        set({
          mode: "DEMO",
          seed,
          datasetId: `demo:${seed}`,
          datasetName: "Demo planning data",
          overridesBySituation: {},
          activeSituationId: null,
        }),

      chooseUpload: ({ fileName, uploadedAt, datasetName }) =>
        set({
          mode: "UPLOADED",
          datasetId: `upload:${uploadedAt}`,
          datasetName,
          uploadedFileName: fileName,
          uploadedAt,
          hasStoredUpload: true,
          overridesBySituation: {},
          activeSituationId: null,
        }),

      clearDataset: () =>
        set({
          mode: null,
          uploadedFileName: null,
          uploadedAt: null,
          hasStoredUpload: false,
          overridesBySituation: {},
          activeSituationId: null,
        }),

      setActiveSituation: (id) => set({ activeSituationId: id }),

      setDisposition: (situationId, candidateId, disposition) =>
        set((state) => {
          const current = state.overridesBySituation[situationId] ?? emptyOverrides();
          return {
            overridesBySituation: {
              ...state.overridesBySituation,
              [situationId]: {
                ...current,
                dispositions: { ...current.dispositions, [candidateId]: disposition },
              },
            },
          };
        }),

      setDispositions: (situationId, dispositions) =>
        set((state) => {
          const current = state.overridesBySituation[situationId] ?? emptyOverrides();
          return {
            overridesBySituation: {
              ...state.overridesBySituation,
              [situationId]: {
                ...current,
                dispositions: { ...current.dispositions, ...dispositions },
              },
            },
          };
        }),

      resetDispositions: (situationId) =>
        set((state) => {
          const current = state.overridesBySituation[situationId] ?? emptyOverrides();
          return {
            overridesBySituation: {
              ...state.overridesBySituation,
              [situationId]: { ...current, dispositions: {} },
            },
          };
        }),

      setMatchConfig: (situationId, config) =>
        set((state) => {
          const current = state.overridesBySituation[situationId] ?? emptyOverrides();
          return {
            overridesBySituation: {
              ...state.overridesBySituation,
              [situationId]: { ...current, matchConfig: config },
            },
          };
        }),

      setSeasonBasis: (situationId, periods) =>
        set((state) => {
          const current = state.overridesBySituation[situationId] ?? emptyOverrides();
          return {
            overridesBySituation: {
              ...state.overridesBySituation,
              // An empty selection is stored as "no override" rather than as an
              // empty basis: the engine falls back to the latest season, so the
              // planner cannot accidentally leave the plan with no history.
              [situationId]: { ...current, seasonBasis: periods?.length ? periods : undefined },
            },
          };
        }),
    }),
    {
      name: DATASET_STORAGE_KEY,
      version: 1,
      // localStorage, not session: the chosen mode should survive a refresh so
      // the planner is not sent back to the first-run screen.
      storage: createJSONStorage(() => webStorage("local")),
      skipHydration: true,
      partialize: (state) => ({
        mode: state.mode,
        datasetId: state.datasetId,
        datasetName: state.datasetName,
        seed: state.seed,
        uploadedFileName: state.uploadedFileName,
        uploadedAt: state.uploadedAt,
        hasStoredUpload: state.hasStoredUpload,
        activeSituationId: state.activeSituationId,
        overridesBySituation: state.overridesBySituation,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    }
  )
);
