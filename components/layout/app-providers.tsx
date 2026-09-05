"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore, THEME_STORAGE_KEY } from "@/stores/app-store";
import { useScenarioStore } from "@/stores/scenario-store";
import { useDatasetStore } from "@/stores/dataset-store";
import { useSituationScenarioStore } from "@/stores/situation-scenario-store";
import { DatasetProvider } from "@/components/dataset/dataset-provider";

/**
 * Applied by the browser BEFORE first paint, so a dark-theme planner never
 * sees a light flash on a full document load. It only touches a class React
 * does not manage (`<html>` already carries `suppressHydrationWarning`), so it
 * cannot cause a hydration mismatch. The string is a constant, therefore
 * byte-identical in the server-rendered HTML and on the client.
 */
const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!t){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const initTheme = useAppStore((s) => s.initTheme);

  useEffect(() => {
    // Rehydrate AFTER React has hydrated. Both stores are configured with
    // `skipHydration: true`, so the first client render used exactly the
    // defaults the server rendered; restored scenario overrides and triage
    // decisions arrive on the next commit rather than diverging mid-hydration.
    //
    // This is what makes Scenario Lab work survive navigation: the stores are
    // module singletons, so a client-side route change already kept them, but
    // any full document load started from seed data every time — and Save,
    // which only flipped an in-memory status, was thrown away with it.
    void useAppStore.persist.rehydrate();
    void useScenarioStore.persist.rehydrate();
    // The dataset store persists to localStorage rather than the session, so
    // the planner's chosen mode survives a refresh instead of sending them
    // back to the first-run screen.
    void useDatasetStore.persist.rehydrate();
    void useSituationScenarioStore.persist.rehydrate();
    // Theme lives in localStorage rather than the session slice (it is a
    // durable preference), so it is restored separately and re-applied to the
    // store so the toggle's icon matches what is actually on screen.
    initTheme();
  }, [initTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      <TooltipProvider>
        <DatasetProvider>{children}</DatasetProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
