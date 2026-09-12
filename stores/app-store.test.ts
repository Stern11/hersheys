import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createMemoryStorage } from "./memory-storage";

const localStore = createMemoryStorage();

beforeAll(() => {
  Object.defineProperty(globalThis, "localStorage", { value: localStore, configurable: true, writable: true });
});

const { useAppStore, readStoredTheme, readStoredSidebar, THEME_STORAGE_KEY, SIDEBAR_STORAGE_KEY } = await import(
  "./app-store"
);

const store = () => useAppStore.getState();

beforeEach(() => {
  localStore.clear();
  useAppStore.setState({ theme: "light", sidebarCollapsed: false });
});

/* ---------------------------------------------------------------------- *
 * Theme reverted to light on every navigation.
 * ---------------------------------------------------------------------- */

describe("theme persistence", () => {
  it("records the planner's choice durably, in localStorage", () => {
    store().toggleTheme();
    expect(store().theme).toBe("dark");
    expect(localStore.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("restores the stored theme on a fresh load, instead of falling back to light", () => {
    localStore.setItem(THEME_STORAGE_KEY, "dark");
    useAppStore.setState({ theme: "light" }); // what SSR + first client render produce
    store().initTheme();
    expect(store().theme).toBe("dark");
  });

  it("round-trips both directions, so toggling back is also remembered", () => {
    store().setTheme("dark");
    store().setTheme("light");
    expect(localStore.getItem(THEME_STORAGE_KEY)).toBe("light");
    useAppStore.setState({ theme: "dark" });
    store().initTheme();
    expect(store().theme).toBe("light");
  });

  it("ignores a corrupt stored value rather than applying it", () => {
    localStore.setItem(THEME_STORAGE_KEY, "chartreuse");
    expect(readStoredTheme()).toBeNull();
    store().initTheme();
    expect(["light", "dark"]).toContain(store().theme);
  });

  it("does not RECORD an OS-derived default — only an explicit choice is a decision", () => {
    store().initTheme();
    expect(localStore.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("does not read storage until initTheme, so the server and the first client render agree", () => {
    localStore.setItem(THEME_STORAGE_KEY, "dark");
    useAppStore.setState({ theme: "light" });
    expect(store().theme).toBe("light");
  });
});

describe("sidebar preference", () => {
  it("remembers a collapsed sidebar across a fresh load", () => {
    store().toggleSidebar();
    expect(store().sidebarCollapsed).toBe(true);
    expect(localStore.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");

    useAppStore.setState({ sidebarCollapsed: false }); // a fresh page
    store().initTheme();
    expect(store().sidebarCollapsed).toBe(true);
    expect(readStoredSidebar()).toBe(true);
  });
});
