export type { AIToolDefinition, AIToolCall, AIToolCallResult, AIActionSummary, AITranscriptEntry } from "@/types/ai";

/** Dependencies injected into the tool factories at registration time — kept
 * outside React so the registry stays testable and framework-agnostic. */
export interface AIToolContext {
  /** Imperative client-side navigation (bound to Next.js's router where the app is mounted). */
  navigate: (path: string) => void;
}
