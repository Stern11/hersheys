import type { z } from "zod";

/**
 * A typed tool the AI layer can call. `execute` calls the exact same
 * application/scenario-store actions the UI calls — there is no separate
 * "AI path" through the planning engine. See lib/ai-tools/registry.ts.
 */
export interface AIToolDefinition<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  category: "scenario" | "navigation" | "evidence" | "explanation";
  parametersSchema: z.ZodType<TParams>;
  execute: (params: TParams) => Promise<TResult> | TResult;
}

export interface AIToolCall {
  id: string;
  toolName: string;
  params: unknown;
  requestedAt: string;
}

export interface AIToolCallResult {
  callId: string;
  toolName: string;
  status: "success" | "error";
  result?: unknown;
  error?: string;
  completedAt: string;
}

/**
 * The shape of a completed AI action for rendering the standard
 * what-changed / visual-update / downstream-impact / undo response
 * (PRD §22.2).
 */
export interface AIActionSummary {
  whatChanged: string;
  visualsUpdated: string[]; // component/view ids that re-rendered
  downstreamImpact: string[];
  undoAvailable: boolean;
}

export interface AITranscriptEntry {
  id: string;
  role: "planner" | "ai";
  text: string;
  inputMode: "text" | "voice";
  toolCalls?: AIToolCall[];
  actionSummary?: AIActionSummary;
  createdAt: string;
}
