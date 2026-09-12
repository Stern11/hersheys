/**
 * Types for the V2 copilot (V2 §54).
 *
 * Grounded in `PlanningSituation`, the planning object built by
 * `lib/situations/build.ts::buildSituations()`. A reply here is composed only
 * from fields already on a `PlanningSituation`, so it can never contradict
 * what the screens show.
 *
 * Pure types only — see `respond.ts` for the engine.
 */

import type { ContributorDisposition, PlanningSituation } from "@/types/situation";

export interface CopilotContext {
  situations: PlanningSituation[];
  activeSituationId: string | null;
  /** Route the planner is on, so "open capacity" knows what to resolve. */
  pathname: string;
}

export type CopilotAction =
  | { kind: "navigate"; href: string }
  | { kind: "set_disposition"; situationId: string; candidateIds: string[]; disposition: ContributorDisposition }
  | { kind: "set_available_hours"; situationId: string; lineId: string; period: string; hours: number }
  | { kind: "set_lead_time"; situationId: string; materialId: string; days: number }
  | { kind: "none" };

export interface CopilotReply {
  /** What the AI says. At most three short sentences. */
  text: string;
  action: CopilotAction;
  /** Short labels for what changed on screen, e.g. ["Capacity matrix"]. */
  visualsUpdated: string[];
  /** Set when the request was understood but cannot be answered from the data. */
  unavailable?: string;
}
