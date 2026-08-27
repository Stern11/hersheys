import type { EvidenceSignal } from "@/types/shared";
import type { ProductionLine } from "@/types/planning";
import type { OverrideDiff } from "@/lib/planning-engine/overrides";
import type { ScenarioControlLimits } from "@/lib/planning-engine/scenario-limits";
import type { ScenarioResult, ScenarioStatus } from "@/types/scenario";

/* ---------------------------------------------------------------------- *
 * The copilot's view of the world.
 *
 * EVERY sentence the copilot says is composed at answer time from a
 * CopilotSnapshot, and a CopilotSnapshot is nothing but the output of
 * `calculateScenario()` plus the same override diff the badge renders. There
 * is deliberately no place in this module to put a hard-coded number: if a
 * figure is not in here, the copilot cannot say it.
 * ---------------------------------------------------------------------- */

export interface CopilotSnapshot {
  scenarioId: string;
  scenarioName: string;
  status: ScenarioStatus;
  /** Which gap this scenario is developing — decides which levers exist. */
  gapId: string;
  gapTitle: string;
  linkedGapIds: string[];

  /** calculateScenario(baseline + this scenario's overrides). */
  result: ScenarioResult;
  /** calculateScenario(baseline + NO overrides) — what the scenario is compared against. */
  baseline: ScenarioResult;

  /**
   * The SAME list `stores/scenario-store.ts::overrideDiffs` renders chips
   * from. Consumed, never recomputed with a different definition — a copilot
   * that counted overrides its own way is how "3 badges, 2 overrides" and
   * "redundant set counted as a change" happened.
   */
  overrideDiffs: OverrideDiff[];
  overrideCount: number;

  /** Comparable seasons the basis can actually read after exclusions. */
  availableSeasons: number;
  /** The lookback this scenario asked for, or null when it takes everything. */
  requestedSeasons: number | null;

  lines: ProductionLine[];
  /** Observed median run rate per line, from execution history. */
  observedRunRateByLine: Record<string, number>;
  /** materialId -> real material name, so the copilot never hard-codes one. */
  materialNames: Record<string, string>;
  /** The comparable seasons this scenario's basis can address, most-recent-first. */
  historicalPeriods: Array<{ id: string; label: string; year: string; isAtypical: boolean; atypicalReason?: string }>;
  /** Analogue candidate product ids in scope (empty for non-analogue gaps). */
  analogueProductIds: string[];
  /** The RCCP bucket period this scenario evaluates (a PRODUCTION month). */
  period: string;
  /** The production requirement date material order-by dates are anchored to. */
  productionRequirementDate: string;
  /** "Today" in the demo timeline. */
  asOf: string;

  limits: ScenarioControlLimits;
  evidence: EvidenceSignal[];
  /** True when this scenario is the analogue-driven Valentine's workspace. */
  isAnalogueBased: boolean;
}

/* ---------------------------------------------------------------------- *
 * Intents
 * ---------------------------------------------------------------------- */

export type NavTarget = "overview" | "gaps" | "decisions" | "scenario-lab";

export type MutationCommand =
  | { op: "setLookback"; seasons: number }
  | { op: "excludeSeason"; year: string }
  | { op: "includeSeason"; year: string }
  | { op: "setLeadTimeBasis"; materialQuery: string; basis: "system" | "historical"; statistic?: "median" | "p80" }
  | { op: "setLeadTimeDays"; materialQuery: string; days: number }
  | { op: "setRunRate"; lineQuery: string; unitsPerHour: number }
  | { op: "setTargetUtilization"; lineQuery: string; pct: number }
  | { op: "setGrowth"; pct: number }
  | { op: "setAnalogueWeight"; analogueQuery: string; weight: number }
  | { op: "reset" }
  | { op: "save" };

export type CopilotIntent =
  | { kind: "navigate"; target: NavTarget }
  | { kind: "explain_line"; lineQuery: string }
  | { kind: "explain_deadline" }
  | { kind: "explain_evidence" }
  | { kind: "explain_basis" }
  | { kind: "recommend" }
  | { kind: "what_changed" }
  | { kind: "greeting" }
  | { kind: "unrecognized" }
  | { kind: "mutate"; command: MutationCommand };

export type CopilotIntentKind = CopilotIntent["kind"];

/* ---------------------------------------------------------------------- *
 * Answers
 * ---------------------------------------------------------------------- */

export interface CopilotAnswer {
  intentKind: CopilotIntentKind;
  /** One-line result. Always contains the finding, never a pleasantry. */
  headline: string;
  /** Supporting lines — the load stack, the lever list, the diff rows. */
  lines: string[];
  /** Which engine functions produced the numbers above. */
  derivedFrom: string[];
  /**
   * True when this answer had to fall back to "here is what I can do"
   * because the question was not understood. Tested explicitly so a
   * regression to canned fallbacks fails the suite.
   */
  isFallback: boolean;
}

export interface ResolvedMutation {
  /** Tool name in `lib/ai-tools/registry.ts`. The ONLY mutation path. */
  tool: string;
  params: Record<string, unknown>;
  /** Planner-readable name of what is being set, e.g. "Stuarts Draft L03 run rate". */
  label: string;
  /** How to format the requested/applied value, e.g. `(v) => "8,200/hr"`. */
  unit: string;
}

export type TurnPlan =
  | { kind: "answer"; intent: CopilotIntent; answer: CopilotAnswer }
  | { kind: "navigate"; intent: CopilotIntent; path: string; answer: CopilotAnswer }
  | { kind: "mutation"; intent: CopilotIntent; command: MutationCommand; mutation: ResolvedMutation };

/** What actually happened after a mutation ran — composed from before/after snapshots. */
export interface TurnOutcome {
  headline: string;
  lines: string[];
  /** False when NOTHING moved. The copilot must never claim success on this. */
  changed: boolean;
  derivedFrom: string[];
}

export interface CopilotMessage {
  id: string;
  role: "planner" | "ai";
  text: string;
  lines: string[];
  derivedFrom: string[];
  changed?: boolean;
  createdAt: string;
}
