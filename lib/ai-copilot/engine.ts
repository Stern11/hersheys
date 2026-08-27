import type { AppliedChange } from "@/stores/scenario-store";
import type { CopilotAnswer, CopilotSnapshot, MutationCommand, ResolvedMutation, TurnOutcome, TurnPlan } from "./types";
import { NAV_PATHS, parseIntent } from "./intents";
import { answerBasis, answerCapabilities, answerDeadline, answerEvidence, answerLineRisk, answerRecommend, answerWhatChanged, bindingDeadline, describeDerivedDeltas, mostLoadedLine, resolveLine } from "./answers";
import { fmtNum, fmtPct } from "@/lib/utils/format";

/* ---------------------------------------------------------------------- *
 * The copilot's turn planner.
 *
 * `planTurn` is pure: text in, a plan out. It never touches the store. The
 * component executes the plan through `lib/ai-tools/registry.ts` — the same
 * typed tools every button in the product calls — and then hands the before
 * and after snapshots back to `composeMutationOutcome`, which is what makes
 * "nothing moved" a statement the copilot can make truthfully rather than a
 * success it assumes.
 * ---------------------------------------------------------------------- */

export function planTurn(text: string, snapshot: CopilotSnapshot | null): TurnPlan {
  const intent = parseIntent(text);

  switch (intent.kind) {
    case "navigate":
      return {
        kind: "navigate",
        intent,
        path: NAV_PATHS[intent.target],
        answer: {
          intentKind: "navigate",
          headline: `Opening ${NAV_PATHS[intent.target]}.`,
          lines: [],
          derivedFrom: [],
          isFallback: false,
        },
      };

    case "greeting":
      return { kind: "answer", intent, answer: answerCapabilities(snapshot, { greeting: true }) };

    case "unrecognized":
      return { kind: "answer", intent, answer: answerCapabilities(snapshot, { greeting: false, unrecognizedText: text.trim() }) };

    default:
      break;
  }

  if (!snapshot) {
    return { kind: "answer", intent, answer: noScenarioAnswer(intent.kind) };
  }

  switch (intent.kind) {
    case "explain_line":
      return { kind: "answer", intent, answer: answerLineRisk(snapshot, intent.lineQuery) };
    case "explain_deadline":
      return { kind: "answer", intent, answer: answerDeadline(snapshot) };
    case "explain_evidence":
      return { kind: "answer", intent, answer: answerEvidence(snapshot) };
    case "explain_basis":
      return { kind: "answer", intent, answer: answerBasis(snapshot) };
    case "recommend":
      return { kind: "answer", intent, answer: answerRecommend(snapshot) };
    case "what_changed":
      return { kind: "answer", intent, answer: answerWhatChanged(snapshot) };
    case "mutate": {
      const resolved = resolveMutation(intent.command, snapshot);
      if ("error" in resolved) return { kind: "answer", intent, answer: resolved.error };
      return { kind: "mutation", intent, command: intent.command, mutation: resolved };
    }
    default:
      return { kind: "answer", intent, answer: answerCapabilities(snapshot, { greeting: false, unrecognizedText: text.trim() }) };
  }
}

function noScenarioAnswer(intentKind: CopilotAnswer["intentKind"]): CopilotAnswer {
  return {
    intentKind,
    headline: `No scenario is loaded, so there is no engine output for me to read.`,
    lines: [`Open a scenario from Scenario Lab (or from any Planning Gap) and ask again — I answer from that scenario's calculateScenario() output, not from a stored summary.`],
    derivedFrom: [],
    isFallback: true,
  };
}

/* ---------------------------------------------------------------------- *
 * Mutation resolution — text -> a call into lib/ai-tools.
 * ---------------------------------------------------------------------- */

/**
 * Picks the material a lead-time command is about: an explicit name match
 * first, otherwise the material actually driving the binding deadline. Never
 * a hard-coded id — the previous command bar always wrote
 * `mat_printed_film`, which silently became wrong the moment another gap was
 * open.
 */
export function resolveMaterialId(query: string, snapshot: CopilotSnapshot): string | null {
  const q = query.toLowerCase();
  const named = Object.entries(snapshot.materialNames).find(([id, name]) => {
    if (q.includes(id)) return true;
    const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    return words.length > 0 && words.every((w) => q.includes(w));
  });
  if (named) return named[0];
  return bindingDeadline(snapshot.result)?.driver?.materialId ?? snapshot.result.materialReadiness[0]?.materialId ?? null;
}

export function resolveMutation(command: MutationCommand, snapshot: CopilotSnapshot): ResolvedMutation | { error: CopilotAnswer } {
  const scenarioId = snapshot.scenarioId;

  switch (command.op) {
    case "setLookback":
      return { tool: "setHistoricalLookback", params: { scenarioId, seasonsOrYears: command.seasons }, label: "Historical lookback", unit: "seasons" };

    case "excludeSeason":
    case "includeSeason": {
      const period = snapshot.historicalPeriods.find((p) => p.year === command.year);
      if (!period) {
        return {
          error: {
            intentKind: "mutate",
            headline: `There is no ${command.year} season in this basis, so there is nothing to ${command.op === "excludeSeason" ? "exclude" : "include"}.`,
            lines: [`Comparable seasons available: ${snapshot.historicalPeriods.map((p) => `${p.label}${p.isAtypical ? " (atypical)" : ""}`).join(", ") || "none"}.`],
            derivedFrom: [],
            isFallback: false,
          },
        };
      }
      return {
        tool: command.op === "excludeSeason" ? "excludeHistoricalPeriod" : "includeHistoricalPeriod",
        params: { scenarioId, periodId: period.id },
        label: `${period.label} in the forecast basis`,
        unit: "",
      };
    }

    case "setLeadTimeBasis": {
      const materialId = resolveMaterialId(command.materialQuery, snapshot);
      if (!materialId) return { error: noMaterialAnswer(snapshot) };
      return {
        tool: "setLeadTimeBasis",
        params: { scenarioId, materialId, basis: command.basis, statistic: command.statistic },
        label: `${snapshot.materialNames[materialId] ?? materialId} lead-time basis`,
        unit: "",
      };
    }

    case "setLeadTimeDays": {
      const materialId = resolveMaterialId(command.materialQuery, snapshot);
      if (!materialId) return { error: noMaterialAnswer(snapshot) };
      return { tool: "setLeadTime", params: { scenarioId, materialId, days: command.days }, label: `${snapshot.materialNames[materialId] ?? materialId} lead time`, unit: "d" };
    }

    case "setRunRate": {
      const line = resolveLine(command.lineQuery, snapshot.lines) ?? snapshot.lines.find((l) => l.id === mostLoadedLine(snapshot.result)?.lineId);
      if (!line) return { error: noLineAnswer(snapshot) };
      return { tool: "setRunRate", params: { scenarioId, lineId: line.id, period: snapshot.period, unitsPerHour: command.unitsPerHour }, label: `${line.name} run rate`, unit: "/hr" };
    }

    case "setTargetUtilization": {
      const line = resolveLine(command.lineQuery, snapshot.lines) ?? snapshot.lines.find((l) => l.id === mostLoadedLine(snapshot.result)?.lineId);
      if (!line) return { error: noLineAnswer(snapshot) };
      return { tool: "setTargetUtilization", params: { scenarioId, lineId: line.id, period: snapshot.period, pct: command.pct }, label: `${line.name} utilization alert threshold`, unit: "%" };
    }

    case "setGrowth":
      return { tool: "setGrowthAssumption", params: { scenarioId, pct: command.pct }, label: "Growth assumption", unit: "%" };

    case "setAnalogueWeight": {
      const productId = snapshot.analogueProductIds.find((id) => command.analogueQuery.includes(id.toLowerCase()));
      if (!productId) {
        return {
          error: {
            intentKind: "mutate",
            headline: snapshot.analogueProductIds.length === 0 ? `This scenario is not analogue-based, so there are no analogue weights to set.` : `I couldn't tell which analogue you meant.`,
            lines: snapshot.analogueProductIds.length === 0 ? [`${snapshot.gapTitle} resolves its BOM directly rather than by blending analogues.`] : [`Analogues in scope: ${snapshot.analogueProductIds.join(", ")}. Name one of those ids with a percentage, e.g. "set ${snapshot.analogueProductIds[0]} weight to 40%".`],
            derivedFrom: [],
            isFallback: false,
          },
        };
      }
      return { tool: "setAnalogueWeight", params: { scenarioId, analogueProductId: productId, weight: command.weight }, label: `${productId} analogue weight`, unit: "%" };
    }

    case "reset":
      return { tool: "resetScenario", params: { scenarioId }, label: `${snapshot.scenarioName} overrides`, unit: "" };

    case "save":
      return { tool: "saveScenario", params: { scenarioId }, label: `${snapshot.scenarioName} status`, unit: "" };
  }
}

function noMaterialAnswer(snapshot: CopilotSnapshot): CopilotAnswer {
  return {
    intentKind: "mutate",
    headline: `${snapshot.gapTitle} has no resolved material rows, so there is no lead time to change.`,
    lines: [],
    derivedFrom: [],
    isFallback: false,
  };
}

function noLineAnswer(snapshot: CopilotSnapshot): CopilotAnswer {
  return {
    intentKind: "mutate",
    headline: `I couldn't tell which line you meant.`,
    lines: [`Lines loaded by this scenario in ${snapshot.period}: ${snapshot.result.capacityImpact.map((c) => snapshot.lines.find((l) => l.id === c.lineId)?.name ?? c.lineId).join(", ") || "none"}.`],
    derivedFrom: [],
    isFallback: false,
  };
}

/* ---------------------------------------------------------------------- *
 * Outcome composition — the no-op honesty layer.
 * ---------------------------------------------------------------------- */

function formatValue(unit: string, value: number): string {
  if (unit === "%") return fmtPct(value);
  if (unit === "/hr") return `${fmtNum(value)}/hr`;
  if (unit === "d") return `${fmtNum(value)}d`;
  if (unit === "seasons") return `${fmtNum(value)} season${value === 1 ? "" : "s"}`;
  return fmtNum(value);
}

/**
 * What ACTUALLY happened, composed from the snapshot taken before the tool
 * ran and the one taken after.
 *
 * The rule: `changed` is true only if a stored value moved (`AppliedChange`)
 * or a derived number moved (`describeDerivedDeltas`). A command that
 * restates a value the model already holds, or that the store clamped back to
 * where it was, reports `changed: false` and says why. This is the failure
 * the audit caught three separate ways — "use 5 seasons" reporting success
 * for a slice(0,5) over three seasons, "use the P80 lead time" reporting
 * success when P80 was already the accepted basis, and a redundant run-rate
 * set incrementing the override count — and it cannot recur without this
 * function returning true, which the tests assert it does not.
 */
export function composeMutationOutcome(args: {
  command: MutationCommand;
  mutation: ResolvedMutation;
  applied: AppliedChange | null;
  before: CopilotSnapshot;
  after: CopilotSnapshot;
}): TurnOutcome {
  const { command, mutation, applied, before, after } = args;
  const deltas = describeDerivedDeltas(before.result, after.result, after.lines);
  const overrideLine = `Overrides vs. baseline: ${before.overrideCount} → ${after.overrideCount}.`;
  const derivedFrom = ["lib/planning-engine/scenarios.ts::calculateScenario — re-run before and after the change", "lib/planning-engine/overrides.ts::diffOverrides — the meaningful-override count, not a key count"];

  if (applied && !applied.applied) {
    return { headline: `Nothing changed — ${applied.reason ?? "that scenario is not loaded"}.`, lines: [], changed: false, derivedFrom };
  }

  const clampLine = applied?.clamped ? `Requested ${formatValue(mutation.unit, applied.requested)}, applied ${formatValue(mutation.unit, applied.value)}. ${applied.reason ?? ""}`.trim() : null;

  // Explicit no-op reported by the store: the field already held this value.
  if (applied?.noop) {
    return {
      headline: `No change. ${mutation.label} is already ${formatValue(mutation.unit, applied.value)}${applied.clamped ? ` (the ${formatValue(mutation.unit, applied.requested)} you asked for is outside the legal range)` : ""}.`,
      lines: [clampLine, `Nothing was recomputed and no override was added.`, overrideLine].filter((l): l is string => Boolean(l)),
      changed: false,
      derivedFrom,
    };
  }

  const overrideMoved = before.overrideCount !== after.overrideCount;
  const statusMoved = before.status !== after.status;

  // Lifecycle commands aren't numeric, so they get their own honest no-ops.
  if (command.op === "reset" && before.overrideCount === 0 && deltas.length === 0) {
    return {
      headline: `Nothing to reset — ${before.scenarioName} already resolves to the baseline (0 overrides).`,
      lines: [overrideLine],
      changed: false,
      derivedFrom,
    };
  }
  if (command.op === "save" && !statusMoved) {
    return {
      headline: `Already ${before.status.replace("_", " ")} — saving keeps that standing rather than demoting it.`,
      lines: [`No override or derived number was touched by the save.`, overrideLine],
      changed: false,
      derivedFrom,
    };
  }

  if (deltas.length === 0 && !overrideMoved && !statusMoved) {
    return {
      headline: `Applied, but nothing moved — ${mutation.label} now resolves to the same value the model was already using.`,
      lines: [
        clampLine,
        command.op === "setLeadTimeBasis"
          ? `That basis is already what the baseline resolves to, so it is not an override and no order-by date shifted.`
          : `No derived number differs from before the change, and the override count is unchanged, so this is a no-op rather than a scenario.`,
        overrideLine,
      ].filter((l): l is string => Boolean(l)),
      changed: false,
      derivedFrom,
    };
  }

  const headline =
    command.op === "reset"
      ? `Reset ${before.scenarioName} to baseline — ${before.overrideCount} override${before.overrideCount === 1 ? "" : "s"} cleared.`
      : command.op === "save"
        ? `Saved ${after.scenarioName}: status ${before.status.replace("_", " ")} → ${after.status.replace("_", " ")}.`
        : applied
          ? `${mutation.label} set to ${formatValue(mutation.unit, applied.value)}.`
          : `${mutation.label} updated.`;

  return {
    headline,
    lines: [clampLine, deltas.length > 0 ? `Downstream: ${deltas.join("; ")}.` : `No derived number moved.`, overrideLine].filter((l): l is string => Boolean(l)),
    changed: true,
    derivedFrom,
  };
}

/** Flattens an outcome into the single string a transcript entry stores. */
export function outcomeToText(outcome: TurnOutcome): string {
  return [outcome.headline, ...outcome.lines].join("\n");
}
