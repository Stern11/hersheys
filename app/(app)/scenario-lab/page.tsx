"use client";

/**
 * Scenario Lab (V2 §13).
 *
 * `?situation=<id>` decides everything below this line: with it, the full
 * analytical workspace opens directly on that situation (V2 §10.5 — the lab
 * loads context automatically rather than beginning blank); without it, a
 * picker asks which situation to open. Next's `useSearchParams` requires a
 * Suspense boundary around whatever reads it, so that reader is split into
 * its own child component.
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScenarioLabShell } from "@/components/scenario-lab-v2/lab-shell";
import { SituationPicker } from "@/components/scenario-lab-v2/situation-picker";
import { Page } from "@/components/v2/page";

function ScenarioLabRoute() {
  const searchParams = useSearchParams();
  const situationId = searchParams.get("situation");
  // `?item=` is how the SKU drawer hands off: the lab opens with that item's
  // volume row focused, so "adjust this" lands on the control rather than on a
  // list the planner then has to search.
  const focusItemId = searchParams.get("item") ?? undefined;

  if (!situationId) return <SituationPicker />;
  return <ScenarioLabShell situationId={situationId} focusItemId={focusItemId} />;
}

export default function ScenarioLabPage() {
  return (
    <Suspense fallback={<Page>{null}</Page>}>
      <ScenarioLabRoute />
    </Suspense>
  );
}
