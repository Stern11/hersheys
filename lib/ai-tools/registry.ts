import type { AIToolCallResult, AIToolDefinition } from "@/types/ai";
import { createScenarioTools } from "./scenario-actions";
import { createNavigationTools } from "./navigation-actions";
import { createEvidenceTools } from "./evidence-actions";
import type { AIToolContext } from "./types";

/**
 * Builds the full AI tool surface. This is the seam CopilotKit (or any other
 * LLM tool-calling runtime) plugs into: each AIToolDefinition already carries
 * a zod schema + a pure execute function, which is exactly the shape
 * CopilotKit actions / the Claude API's tool-use format expect. Nothing
 * here is CopilotKit-specific, so swapping the adapter later touches only
 * the file that calls buildToolRegistry(), never these definitions.
 */
export function buildToolRegistry(ctx: AIToolContext): Map<string, AIToolDefinition<any, any>> {
  const all = [...createScenarioTools(), ...createNavigationTools(ctx), ...createEvidenceTools()];
  return new Map(all.map((tool) => [tool.name, tool]));
}

export function listToolDefinitions(ctx: AIToolContext): AIToolDefinition<any, any>[] {
  return Array.from(buildToolRegistry(ctx).values());
}

export async function invokeTool(registry: Map<string, AIToolDefinition<any, any>>, toolName: string, rawParams: unknown): Promise<AIToolCallResult> {
  const callId = `call_${Date.now().toString(36)}_${Math.round(Math.random() * 1e6).toString(36)}`;
  const tool = registry.get(toolName);
  if (!tool) {
    return { callId, toolName, status: "error", error: `Unknown tool: ${toolName}`, completedAt: new Date().toISOString() };
  }
  const parsed = tool.parametersSchema.safeParse(rawParams);
  if (!parsed.success) {
    return { callId, toolName, status: "error", error: parsed.error.message, completedAt: new Date().toISOString() };
  }
  try {
    const result = await tool.execute(parsed.data);
    return { callId, toolName, status: "success", result, completedAt: new Date().toISOString() };
  } catch (err) {
    return { callId, toolName, status: "error", error: err instanceof Error ? err.message : String(err), completedAt: new Date().toISOString() };
  }
}
