import { z } from "zod";
import type { AIToolDefinition } from "@/types/ai";
import type { AIToolContext } from "./types";

export function createNavigationTools(ctx: AIToolContext): AIToolDefinition<any, any>[] {
  return [
    {
      name: "openGap",
      description: "Navigate to a Planning Gap's workspace.",
      category: "navigation",
      parametersSchema: z.object({ gapId: z.string() }),
      execute: ({ gapId }: { gapId: string }) => ctx.navigate(`/gaps/${gapId}`),
    },
    {
      name: "openScenarioLab",
      description: "Open Scenario Lab, optionally scoped to a specific scenario.",
      category: "navigation",
      parametersSchema: z.object({ scenarioId: z.string().optional() }),
      execute: ({ scenarioId }: { scenarioId?: string }) => ctx.navigate(scenarioId ? `/scenario-lab/${scenarioId}` : "/scenario-lab"),
    },
    {
      name: "openOverview",
      description: "Navigate to the Overview.",
      category: "navigation",
      parametersSchema: z.object({}),
      execute: () => ctx.navigate("/overview"),
    },
    {
      name: "openGapsList",
      description: "Navigate to the full Planning Gap inventory, optionally filtered.",
      category: "navigation",
      parametersSchema: z.object({ type: z.string().optional(), status: z.string().optional() }),
      execute: ({ type, status }: { type?: string; status?: string }) => {
        const params = new URLSearchParams();
        if (type) params.set("type", type);
        if (status) params.set("status", status);
        const qs = params.toString();
        ctx.navigate(qs ? `/gaps?${qs}` : "/gaps");
      },
    },
    {
      name: "openDecisions",
      description: "Navigate to the Decisions view.",
      category: "navigation",
      parametersSchema: z.object({}),
      execute: () => ctx.navigate("/decisions"),
    },
  ];
}
