import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createMemoryStorage } from "./memory-storage";

const sessionStore = createMemoryStorage();
const localStore = createMemoryStorage();

beforeAll(() => {
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionStore, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: localStore, configurable: true, writable: true });
});

const { useAppStore, readStoredTheme, THEME_STORAGE_KEY, APP_STORAGE_KEY } = await import("./app-store");
const { summarizeTriage, countActiveSituations } = await import("@/lib/planning-engine/gap-counting");
const { detectPlanningGaps } = await import("@/lib/planning-engine/gaps");

const store = () => useAppStore.getState();

beforeEach(() => {
  sessionStore.clear();
  localStore.clear();
  useAppStore.setState({ theme: "light", dismissedGapIds: [], monitoredGapIds: [], intentionalGapIds: [], validatedGapIds: [], aiPanelOpen: false });
});

/* ---------------------------------------------------------------------- *
 * Item 8 — theme reverted to light on every navigation.
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

  it("starts at 'light' before hydration, so the server and the first client render agree", () => {
    // The initial state must not read storage: doing so on the client only
    // would make the first client render differ from the server's HTML.
    localStore.setItem(THEME_STORAGE_KEY, "dark");
    useAppStore.setState({ theme: "light", hasHydrated: false });
    expect(store().theme).toBe("light");
    expect(store().hasHydrated).toBe(false);
  });
});

/* ---------------------------------------------------------------------- *
 * Item 5 — triage evaporated on navigation.
 * ---------------------------------------------------------------------- */

describe("decision triage persistence", () => {
  it("writes triage decisions to session storage", () => {
    store().toggleMonitored("halloween-2027");
    const raw = sessionStore.getItem(APP_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw!).toContain("halloween-2027");
  });

  it("restores triage after a rehydrate — returning to /decisions does not reset Open", async () => {
    store().toggleMonitored("halloween-2027");
    store().toggleDismissed("printed-film-lead-time");
    const persisted = sessionStore.getItem(APP_STORAGE_KEY)!;

    // A fresh page: in-memory state back to defaults, storage untouched.
    useAppStore.setState({ monitoredGapIds: [], dismissedGapIds: [] });
    sessionStore.setItem(APP_STORAGE_KEY, persisted);
    expect(store().monitoredGapIds).toEqual([]);

    await useAppStore.persist.rehydrate();

    expect(store().monitoredGapIds).toEqual(["halloween-2027"]);
    expect(store().dismissedGapIds).toEqual(["printed-film-lead-time"]);
    expect(store().hasHydrated).toBe(true);
  });

  it("keeps the Decisions totals reconciled with /gaps through a triage pass", () => {
    const results = detectPlanningGaps();
    const situations = countActiveSituations(results);

    const before = summarizeTriage(results, store());
    expect(before.open).toBe(situations);

    store().toggleMonitored("halloween-2027");
    const after = summarizeTriage(results, store());
    expect(after.open).toBe(situations - 1);
    expect(after.monitoring).toBe(1);
    // The headline number a planner reads on /gaps never moves because of triage.
    expect(after.total).toBe(situations);
  });

  it("toggling a decision off restores it to Open", () => {
    const results = detectPlanningGaps();
    store().toggleMonitored("halloween-2027");
    store().toggleMonitored("halloween-2027");
    expect(summarizeTriage(results, store()).open).toBe(countActiveSituations(results));
  });

  it("does not persist the AI transcript — conversational scratch is not planner state", () => {
    store().appendTranscriptEntry({ id: "t1", role: "ai", text: "hello", inputMode: "text", createdAt: new Date().toISOString() });
    const persisted = JSON.parse(sessionStore.getItem(APP_STORAGE_KEY) ?? '{"state":{}}') as { state: Record<string, unknown> };
    expect(persisted.state).not.toHaveProperty("transcript");
    expect(persisted.state).not.toHaveProperty("theme");
  });
});
