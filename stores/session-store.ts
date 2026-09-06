/**
 * Local, non-identity session preferences.
 *
 * Identity itself lives in Auth.js — see `auth.ts` and `useCurrentUser`. This
 * store deliberately holds nothing that says who anyone is: it used to carry a
 * demo user, and having two sources of identity meant a failed Google sign-in
 * could silently fall through to a fake one and look like success.
 *
 * What is left is a preference that belongs to the browser rather than the
 * account — whether the planner has seen the orientation panel on Overview.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { webStorage } from "./persist-storage";

export const SESSION_STORAGE_KEY = "heizen.session";

interface SessionState {
  hasHydrated: boolean;
  /** Whether the planner has dismissed the orientation panel on Overview. */
  welcomeDismissed: boolean;

  setHasHydrated: (value: boolean) => void;
  dismissWelcome: () => void;
  resetWelcome: () => void;
}

/** "Ada Whitfield" -> "AW"; falls back to the first character of the email. */
export function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0] ?? "");
  const joined = letters.join("").toUpperCase();
  return joined || (email[0] ?? "?").toUpperCase();
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      welcomeDismissed: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),
      dismissWelcome: () => set({ welcomeDismissed: true }),
      resetWelcome: () => set({ welcomeDismissed: false }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => webStorage("local")),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
