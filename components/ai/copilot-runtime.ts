"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { useScenarioStore, type AppliedChange } from "@/stores/scenario-store";
import { buildToolRegistry, invokeTool } from "@/lib/ai-tools/registry";
import { buildCopilotSnapshot } from "@/lib/ai-copilot/snapshot";
import { planTurn, composeMutationOutcome } from "@/lib/ai-copilot/engine";
import { answerToText } from "@/lib/ai-copilot/answers";
import type { CopilotSnapshot } from "@/lib/ai-copilot/types";
import type { AITranscriptEntry } from "@/types/ai";

/**
 * The ONLY glue between the pure copilot engine and the running app.
 *
 * Everything decidable — what the planner meant, what to say, whether
 * anything actually moved — lives in `lib/ai-copilot/*` and is unit tested.
 * This hook does three impure things and nothing else: read the current
 * scenario out of the store, invoke a tool through
 * `lib/ai-tools/registry.ts` (the same typed registry every button calls,
 * so there is no second mutation path), and append turns to the shared
 * transcript.
 *
 * Note the ordering: the snapshot is taken BEFORE the tool runs and again
 * AFTER it, and the outcome is composed from the pair. That is what lets the
 * copilot say "nothing moved" truthfully instead of narrating the change it
 * intended.
 */

let turnCounter = 0;
function nextId(prefix: string): string {
  turnCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${turnCounter}`;
}

export interface CopilotRuntime {
  thread: AITranscriptEntry[];
  busy: boolean;
  ask: (text: string, inputMode?: "text" | "voice") => Promise<void>;
  clear: () => void;
  /** Live snapshot for the current scenario, or null when none is active. Built on demand. */
  currentSnapshot: () => CopilotSnapshot | null;
}

function isAppliedChange(value: unknown): value is AppliedChange {
  return !!value && typeof value === "object" && "applied" in value && "noop" in value;
}

export function useCopilot(scenarioIdOverride?: string): CopilotRuntime {
  const router = useRouter();
  const thread = useAppStore((s) => s.transcript);
  const append = useAppStore((s) => s.appendTranscriptEntry);
  const clear = useAppStore((s) => s.clearTranscript);
  const setAiPanelOpen = useAppStore((s) => s.setAiPanelOpen);
  const [busy, setBusy] = useState(false);

  const currentSnapshot = useCallback((): CopilotSnapshot | null => {
    const state = useScenarioStore.getState();
    const id = scenarioIdOverride ?? state.activeScenarioId;
    const scenario = id ? state.scenarios[id] : undefined;
    return scenario ? buildCopilotSnapshot(scenario) : null;
  }, [scenarioIdOverride]);

  const ask = useCallback(
    async (raw: string, inputMode: "text" | "voice" = "text") => {
      const text = raw.trim();
      if (!text) return;

      setAiPanelOpen(true);
      append({ id: nextId("t"), role: "planner", text, inputMode, createdAt: new Date().toISOString() });
      setBusy(true);

      try {
        const before = currentSnapshot();
        const plan = planTurn(text, before);

        if (plan.kind === "answer") {
          append({ id: nextId("a"), role: "ai", text: answerToText(plan.answer), inputMode: "text", createdAt: new Date().toISOString() });
          return;
        }

        if (plan.kind === "navigate") {
          router.push(plan.path);
          append({ id: nextId("a"), role: "ai", text: answerToText(plan.answer), inputMode: "text", createdAt: new Date().toISOString() });
          return;
        }

        // Mutation: through the typed registry, then re-read the engine.
        const registry = buildToolRegistry({ navigate: (path) => router.push(path) });
        const toolResult = await invokeTool(registry, plan.mutation.tool, plan.mutation.params);

        if (toolResult.status === "error") {
          append({
            id: nextId("a"),
            role: "ai",
            text: `I could not apply that: ${toolResult.error ?? "the tool rejected the request"}.\nNothing was changed.`,
            inputMode: "text",
            createdAt: new Date().toISOString(),
          });
          return;
        }

        const after = currentSnapshot();
        if (!before || !after) {
          append({ id: nextId("a"), role: "ai", text: `The scenario is no longer loaded, so I cannot confirm what changed.`, inputMode: "text", createdAt: new Date().toISOString() });
          return;
        }

        const outcome = composeMutationOutcome({
          command: plan.command,
          mutation: plan.mutation,
          applied: isAppliedChange(toolResult.result) ? toolResult.result : null,
          before,
          after,
        });

        append({
          id: nextId("a"),
          role: "ai",
          text: [outcome.headline, ...outcome.lines].join("\n"),
          inputMode: "text",
          createdAt: new Date().toISOString(),
          actionSummary: {
            whatChanged: outcome.headline,
            // The workspace IS the result of an AI action (CLAUDE.md: "the
            // result of an AI action is normally an updated visual workspace,
            // not a wall of chat text"). These re-render from the store the
            // tool just wrote, so the confirmation below is a receipt, not
            // the deliverable.
            visualsUpdated: outcome.changed ? ["scenario-lab-assumptions", "effective-capacity-chart", "scenario-delta-stats"] : [],
            downstreamImpact: outcome.lines,
            undoAvailable: false,
          },
        });
      } finally {
        setBusy(false);
      }
    },
    [append, currentSnapshot, router, setAiPanelOpen]
  );

  return { thread, busy, ask, clear, currentSnapshot };
}
