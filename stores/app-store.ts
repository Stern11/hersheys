import { create } from "zustand";
import { readRaw, writeRaw } from "./persist-storage";

export type Theme = "light" | "dark";

/** localStorage key. Also read by the pre-paint script in app-providers.tsx — keep them in sync. */
export const THEME_STORAGE_KEY = "heizen.theme";
/**
 * localStorage key for the sidebar width preference.
 *
 * localStorage, not the session slice: a planner who collapses the navigation
 * to get more table on screen means it, and having it spring back open in the
 * next tab is the kind of small betrayal that makes a tool feel unowned.
 */
export const SIDEBAR_STORAGE_KEY = "heizen.sidebar";

/**
 * App chrome preferences — theme and sidebar width.
 *
 * Both are durable per-browser choices read straight from localStorage after
 * hydration (see `initTheme`), so this store needs no persist middleware of
 * its own. The session slice it used to persist — AI panel state and V1 gap
 * triage — went with the V1 surfaces that were its only readers.
 */
interface AppStoreState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  /**
   * Applies the stored theme (or the OS preference when nothing is stored) and
   * the stored sidebar width. Called once, after hydration.
   */
  initTheme: () => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Theme is stored in localStorage, readable by a synchronous pre-paint script
 * before any JavaScript module has evaluated — otherwise every navigation
 * flashes light before the class is re-applied. The dark class was once only
 * ever set by an imperative `classList.toggle` inside `toggleTheme`, so nothing
 * re-applied it after a full document load and the theme appeared to "revert
 * on every navigation".
 */
function persistTheme(theme: Theme) {
  writeRaw("local", THEME_STORAGE_KEY, theme);
}

export function readStoredTheme(): Theme | null {
  const raw = readRaw("local", THEME_STORAGE_KEY);
  return raw === "dark" || raw === "light" ? raw : null;
}

export function readStoredSidebar(): boolean {
  return readRaw("local", SIDEBAR_STORAGE_KEY) === "collapsed";
}

export const useAppStore = create<AppStoreState>()((set, get) => ({
  // NOTE: the initial value must be identical on the server and on the
  // client's first render. It is deliberately NOT read from storage here.
  theme: "light",

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
    // Layout preferences ride along with the theme's post-hydration pass,
    // which is the one place it is safe to read storage without breaking the
    // server/client render match.
    set({ sidebarCollapsed: readStoredSidebar() });

    const stored = readStoredTheme();
    if (stored) {
      set({ theme: stored });
      applyThemeClass(stored);
      return;
    }
    // No explicit choice recorded yet: follow the OS, but do NOT write it to
    // storage — an OS-derived default is not a planner's decision, and
    // recording it would freeze the app against later OS changes.
    const prefersDark =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
    const theme: Theme = prefersDark ? "dark" : "light";
    set({ theme });
    applyThemeClass(theme);
  },

  // Identical on the server and the client's first render; the stored
  // preference is applied after hydration, like the theme.
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      writeRaw("local", SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      return { sidebarCollapsed: next };
    }),
}));
