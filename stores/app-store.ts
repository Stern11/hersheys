import { create } from "zustand";
import type { AITranscriptEntry } from "@/types/ai";

interface AppStoreState {
  theme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;

  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;

  transcript: AITranscriptEntry[];
  appendTranscriptEntry: (entry: AITranscriptEntry) => void;
  clearTranscript: () => void;

  /** Session-only planner triage state for gap actions, surfaced on the Decisions page. */
  dismissedGapIds: string[];
  monitoredGapIds: string[];
  intentionalGapIds: string[];
  validatedGapIds: string[];
  toggleDismissed: (gapId: string) => void;
  toggleMonitored: (gapId: string) => void;
  toggleIntentional: (gapId: string) => void;
  toggleValidated: (gapId: string) => void;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  theme: "light",
  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    set({ theme: next });
    if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", next === "dark");
  },
  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", theme === "dark");
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
}));
