import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AITranscriptEntry } from "@/types/ai";
import { webStorage, readRaw, writeRaw } from "./persist-storage";

export type Theme = "light" | "dark";

/** localStorage key. Also read by the pre-paint script in app-providers.tsx — keep them in sync. */
export const THEME_STORAGE_KEY = "heizen.theme";
/** sessionStorage key for planner triage + panel state. */
export const APP_STORAGE_KEY = "heizen.app";

interface AppStoreState {
  theme: Theme;
  /** True once persisted state has been read back on the client. SSR and the first client render both see false. */
  hasHydrated: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  /** Applies the stored theme (or the OS preference when nothing is stored). Called once, after hydration. */
  initTheme: () => void;
  setHasHydrated: (v: boolean) => void;

  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;

  transcript: AITranscriptEntry[];
  appendTranscriptEntry: (entry: AITranscriptEntry) => void;
  clearTranscript: () => void;

  /** Planner triage state for gap actions, surfaced on the Decisions page. Persisted for the browser session. */
  dismissedGapIds: string[];
  monitoredGapIds: string[];
  intentionalGapIds: string[];
  validatedGapIds: string[];
  toggleDismissed: (gapId: string) => void;
  toggleMonitored: (gapId: string) => void;
  toggleIntentional: (gapId: string) => void;
  toggleValidated: (gapId: string) => void;
  resetTriage: () => void;
}

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Theme is stored in localStorage rather than in this store's persisted
 * session slice, for two reasons: it is a durable preference (it should
 * survive closing the tab, unlike a half-finished triage pass), and it has to
 * be readable by a synchronous pre-paint script before any JavaScript module
 * has evaluated, otherwise every navigation flashes light before the class is
 * re-applied. The dark class was previously only ever set by an imperative
 * `classList.toggle` inside `toggleTheme`, so nothing re-applied it after a
 * full document load and the theme appeared to "revert on every navigation".
 */
function persistTheme(theme: Theme) {
  writeRaw("local", THEME_STORAGE_KEY, theme);
}

export function readStoredTheme(): Theme | null {
  const raw = readRaw("local", THEME_STORAGE_KEY);
  return raw === "dark" || raw === "light" ? raw : null;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      // NOTE: the initial value must be identical on the server and on the
      // client's first render. It is deliberately NOT read from storage here.
      theme: "light",
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      toggleTheme: () => {
        const next: Theme = get().theme === "light" ? "dark" : "light";
        set({ theme: next });
        persistTheme(next);
        applyThemeClass(next);
      },
      setTheme: (theme) => {
        set({ theme });
        persistTheme(theme);
        applyThemeClass(theme);
      },
      initTheme: () => {
        const stored = readStoredTheme();
        if (stored) {
          set({ theme: stored });
          applyThemeClass(stored);
          return;
        }
        // No explicit choice recorded yet: follow the OS, but do NOT write it
        // to storage — an OS-derived default is not a planner's decision, and
        // recording it would freeze the app against later OS changes.
        const prefersDark = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
        const theme: Theme = prefersDark ? "dark" : "light";
        set({ theme });
        applyThemeClass(theme);
      },

      aiPanelOpen: false,
      setAiPanelOpen: (open) => set({ aiPanelOpen: open }),

      transcript: [],
      appendTranscriptEntry: (entry) => set((state) => ({ transcript: [...state.transcript, entry] })),
      clearTranscript: () => set({ transcript: [] }),

      dismissedGapIds: [],
      monitoredGapIds: [],
      intentionalGapIds: [],
      validatedGapIds: [],
      toggleDismissed: (gapId) =>
        set((state) => ({
          dismissedGapIds: state.dismissedGapIds.includes(gapId) ? state.dismissedGapIds.filter((id) => id !== gapId) : [...state.dismissedGapIds, gapId],
        })),
      toggleMonitored: (gapId) =>
        set((state) => ({
          monitoredGapIds: state.monitoredGapIds.includes(gapId) ? state.monitoredGapIds.filter((id) => id !== gapId) : [...state.monitoredGapIds, gapId],
        })),
      toggleIntentional: (gapId) =>
        set((state) => ({
          intentionalGapIds: state.intentionalGapIds.includes(gapId) ? state.intentionalGapIds.filter((id) => id !== gapId) : [...state.intentionalGapIds, gapId],
        })),
      toggleValidated: (gapId) =>
        set((state) => ({
          validatedGapIds: state.validatedGapIds.includes(gapId) ? state.validatedGapIds.filter((id) => id !== gapId) : [...state.validatedGapIds, gapId],
        })),
      resetTriage: () => set({ dismissedGapIds: [], monitoredGapIds: [], intentionalGapIds: [], validatedGapIds: [] }),
    }),
    {
      name: APP_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => webStorage("session")),
      // Rehydration is triggered explicitly from AppProviders' useEffect, so
      // the first client render matches the server-rendered HTML exactly.
      skipHydration: true,
      // `theme` lives in localStorage (see persistTheme) and `transcript` is
      // conversational scratch — neither belongs in the session slice.
      partialize: (state) => ({
        aiPanelOpen: state.aiPanelOpen,
        dismissedGapIds: state.dismissedGapIds,
        monitoredGapIds: state.monitoredGapIds,
        intentionalGapIds: state.intentionalGapIds,
        validatedGapIds: state.validatedGapIds,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    }
  )
);
