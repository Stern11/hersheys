import type { CapacityImpactByLine, ScenarioResult } from "@/types/scenario";
import type { DecisionDeadline, MaterialReadiness, ProductionLine } from "@/types/planning";
import type { CopilotAnswer, CopilotSnapshot } from "./types";
import { fmtNum, fmtNum1, fmtPct } from "@/lib/utils/format";

/* ---------------------------------------------------------------------- *
 * Answer composition.
 *
 * Every function here takes a CopilotSnapshot and returns sentences built
 * from its numbers. There is not one hard-coded figure in this file, and the
 * tests assert that: change the synthetic data and the answers change with
 * it, because they are read from `calculateScenario()` output at answer time.
 * ---------------------------------------------------------------------- */

const ENGINE_SOURCES = {
  rccp: "lib/planning-engine/capacity.ts::rccp — RCCP load conversion for this scenario's production bucket",
  forecast: "lib/planning-engine/seasonality.ts::seasonalForecast — recent-weighted comparable seasons",
  b2p: "lib/planning-engine/demand.ts::businessToPlanReconciliation — formal plan vs expected demand",
  bom: "lib/planning-engine/materials.ts::partialBomExplosion — order-by dates from resolved lead times",
  overrides: "lib/planning-engine/overrides.ts::diffOverrides — the same list the override badge counts",
  gaps: "lib/planning-engine/gaps.ts::detectPlanningGaps — evidence signals as attached to the gap",
} as const;

/* ---------------------------------------------------------------------- *
 * Line resolution
 * ---------------------------------------------------------------------- */

/**
 * Finds the line a planner meant. Matches on id ("line_03"), the spoken form
 * ("line 03", "l03"), and the real line name from master data ("Stuarts
 * Draft L03") — so a rename in `data/synthetic/master-data.ts` keeps working
 * without touching this file.
 */
export function resolveLine(query: string, lines: ProductionLine[]): ProductionLine | null {
  const q = query.toLowerCase();
  const numeric = /\bline[ _-]?0?(\d+)\b|\bl0?(\d)\b/.exec(q);
  const num = numeric?.[1] ?? numeric?.[2];
  if (num) {
    const padded = `line_${num.padStart(2, "0")}`;
    const byId = lines.find((l) => l.id === padded);
    if (byId) return byId;
  }
  const byName = lines.find((l) => q.includes(l.name.toLowerCase()));
  if (byName) return byName;
  const byId = lines.find((l) => q.includes(l.id));
  if (byId) return byId;
  // Last resort: a distinctive word from the line name (e.g. "stuarts").
  return (
    lines.find((l) =>
      l.name
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.length > 4 && q.includes(w))
    ) ?? null
  );
}

function lineName(lineId: string, lines: ProductionLine[]): string {
  return lines.find((l) => l.id === lineId)?.name ?? lineId;
}

function totalLoadHours(c: CapacityImpactByLine): number {
  return c.formalLoadHours + c.validatedUnresolvedLoadHours + c.aiInferredLoadHours + c.scenarioAdjustmentHours;
}

function thresholdHours(c: CapacityImpactByLine): number {
  return c.ceilingHours * c.targetUtilization;
}

function shareOfCeiling(hours: number, c: CapacityImpactByLine): string {
  return c.ceilingHours > 0 ? fmtPct(hours / c.ceilingHours) : "—";
}

const RISK_WORD: Record<CapacityImpactByLine["riskLevel"], string> = {
  positive: "within target",
  warning: "over its alert threshold",
  critical: "over its ceiling",
};

/** The line this scenario is most exposed on — highest effective utilization. */
export function mostLoadedLine(result: ScenarioResult): CapacityImpactByLine | undefined {
  return [...result.capacityImpact].sort((a, b) => b.effectiveUtilization - a.effectiveUtilization)[0];
}

/**
 * The earliest decision deadline and the material row that produces it —
 * resolved once, here, so "what's driving the deadline", "what should I do"
 * and the lead-time command all talk about the same material.
 */
export function bindingDeadline(result: ScenarioResult): { deadline: DecisionDeadline; driver?: MaterialReadiness } | null {
  const sorted = [...result.decisionDeadlines].sort((a, b) => (a.date < b.date ? -1 : 1));
  const deadline = sorted.find((d) => d.isEarliestConstraint) ?? sorted[0];
  if (!deadline) return null;
  return { deadline, driver: result.materialReadiness.find((m) => `deadline_${m.id}` === deadline.id) };
}

/* ---------------------------------------------------------------------- *
 * "why is line 03 red"
 * ---------------------------------------------------------------------- */

export function answerLineRisk(snapshot: CopilotSnapshot, lineQuery: string): CopilotAnswer {
  const { result, lines } = snapshot;
  const requested = resolveLine(lineQuery, lines);
  // "why is it red" with no line named: answer about the line actually driving
  // the risk rather than asking the planner to be more specific.
  const row = requested ? result.capacityImpact.find((c) => c.lineId === requested.id) : mostLoadedLine(result);

  if (!row) {
    const inScope = result.capacityImpact.map((c) => `${lineName(c.lineId, lines)} ${fmtPct(c.effectiveUtilization)}`).join(", ");
    return {
      intentKind: "explain_line",
      headline: requested
        ? `${requested.name} is not loaded by this scenario, so it has no utilization to explain.`
        : `This scenario loads no production line, so there is no utilization to explain.`,
      lines: [
        requested ? `${requested.name} (${requested.plant}) is eligible for ${requested.eligibleFamilyIds.length} product family/families, but "${snapshot.gapTitle}" does not allocate volume to it.` : "",
        inScope ? `Lines in scope for ${snapshot.period}: ${inScope}.` : `This scenario evaluates no capacity bucket at all — it is a material/readiness gap, so its levers are the BOM and analogue basis, not line load.`,
      ].filter(Boolean),
      derivedFrom: [ENGINE_SOURCES.rccp],
      isFallback: false,
    };
  }

  const name = lineName(row.lineId, lines);
  const line = lines.find((l) => l.id === row.lineId);
  const total = totalLoadHours(row);
  const threshold = thresholdHours(row);
  const overThreshold = total - threshold;
  const rate = row.runRateUnitsPerHour ?? line?.standardRunRateUnitsPerHour ?? 0;
  const inferredUnits = rate > 0 ? row.aiInferredLoadHours * rate : 0;
  const allocationShare = result.unresolvedDemandUnits > 0 ? inferredUnits / result.unresolvedDemandUnits : 0;

  const basisWord =
    row.runRateBasis === "scenario" ? "a scenario run rate" : row.runRateBasis === "historical" ? "the observed historical median" : "the line's system standard rate";

  const detail: string[] = [
    `Ceiling ${fmtNum1(row.ceilingHours)}h for ${snapshot.period} (available hours less planned downtime). The ${fmtPct(row.targetUtilization)} alert threshold sits at ${fmtNum1(threshold)}h.`,
    `Formal plan ${fmtNum1(row.formalLoadHours)}h — ${shareOfCeiling(row.formalLoadHours, row)} of the ceiling. This is the load the formal system already carries.`,
    `Validated unresolved ${fmtNum1(row.validatedUnresolvedLoadHours)}h — ${shareOfCeiling(row.validatedUnresolvedLoadHours, row)}. Demand a planner has already validated but the formal plan has not absorbed.`,
    `Inferred unresolved ${fmtNum1(row.aiInferredLoadHours)}h — ${shareOfCeiling(row.aiInferredLoadHours, row)}. That is ≈${fmtNum(Math.round(inferredUnits / 1000) * 1000)} units of the ${fmtNum(Math.round(result.unresolvedDemandUnits))} units "${snapshot.gapTitle}" leaves unresolved (${fmtPct(allocationShare)} allocated here), converted at ${fmtNum(rate)} units/hr — ${basisWord}.`,
  ];
  if (row.scenarioAdjustmentHours !== 0) {
    detail.push(`Scenario adjustment ${fmtNum1(row.scenarioAdjustmentHours)}h — ${shareOfCeiling(row.scenarioAdjustmentHours, row)} from a prebuild set on this scenario.`);
  } else {
    detail.push(`Scenario adjustment 0.0h — no prebuild or added load has been set on this line.`);
  }
  detail.push(
    row.riskLevel === "positive"
      ? `Total ${fmtNum1(total)}h of ${fmtNum1(row.ceilingHours)}h, ${fmtNum1(threshold - total)}h of headroom under the ${fmtPct(row.targetUtilization)} threshold.`
      : `Total ${fmtNum1(total)}h of ${fmtNum1(row.ceilingHours)}h — ${fmtNum1(overThreshold)}h ABOVE the ${fmtNum1(threshold)}h threshold, which is what sets the status. ${
          row.riskLevel === "critical" ? `It is also past the ceiling itself, which is why it reads critical rather than warning.` : `It is still ${fmtNum1(row.ceilingHours - total)}h under the ceiling, so it reads warning rather than critical.`
        }`
  );
  detail.push(`At the P80 load the same stack reaches ${fmtPct(row.p80Utilization)}; the P50 case is ${fmtPct(row.p50Utilization)}.`);

  return {
    intentKind: "explain_line",
    headline: `${name} is ${RISK_WORD[row.riskLevel]} in ${snapshot.period}: ${fmtPct(row.effectiveUtilization)} effective against a ${fmtPct(row.targetUtilization)} alert threshold. Formal-only utilization is ${fmtPct(row.formalUtilization)}.`,
    lines: detail,
    derivedFrom: [ENGINE_SOURCES.rccp, ENGINE_SOURCES.b2p],
    isFallback: false,
  };
}

/* ---------------------------------------------------------------------- *
 * "what's driving the deadline"
 * ---------------------------------------------------------------------- */

const LEAD_TIME_BASIS_LABEL: Record<string, string> = {
  system: "the system/ERP norm",
  historical_median: "the historical median of executed orders",
  historical_p80: "the historical P80 of executed orders",
  scenario: "a scenario-entered value",
};

export function answerDeadline(snapshot: CopilotSnapshot): CopilotAnswer {
  const { result } = snapshot;
  const sorted = [...result.decisionDeadlines].sort((a, b) => (a.date < b.date ? -1 : 1));
  const binding = bindingDeadline(result);
  const earliest = binding?.deadline;
  const materialName = (id: string) => snapshot.materialNames[id] ?? id;

  if (!earliest) {
    return {
      intentKind: "explain_deadline",
      headline: `No decision deadline is in scope for ${snapshot.scenarioName}.`,
      lines: [`${snapshot.gapTitle} resolved ${result.materialReadiness.length} material row(s), none of which produced an order-by date.`],
      derivedFrom: [ENGINE_SOURCES.bom],
      isFallback: false,
    };
  }

  const driver = binding?.driver;
  const daysOut = daysBetween(snapshot.asOf, earliest.date);

  const detail: string[] = [];
  if (driver) {
    detail.push(
      `Driven by ${materialName(driver.materialId)} at ${driver.leadTimeDaysUsed}d lead time on ${LEAD_TIME_BASIS_LABEL[driver.leadTimeBasis] ?? driver.leadTimeBasis}, counted back from the ${snapshot.productionRequirementDate} production requirement date.`
    );
    detail.push(`Its expected requirement is ${fmtNum(Math.round(driver.expectedRequirementLow))}–${fmtNum(Math.round(driver.expectedRequirementHigh))} ${driver.unit} at ${fmtPct(driver.confidence)} confidence — status "${driver.readiness.replace("_", " ")}".`);
  }
  detail.push(daysOut >= 0 ? `That is ${daysOut} days from ${snapshot.asOf.slice(0, 10)}, the as-of date of this plan.` : `That date is ${Math.abs(daysOut)} days in the PAST relative to ${snapshot.asOf.slice(0, 10)} — it is already overdue.`);

  const next = sorted.filter((d) => d.id !== earliest.id).slice(0, 3);
  if (next.length > 0) {
    detail.push(`Next after it: ${next.map((d) => `${d.date} (${materialName(result.materialReadiness.find((m) => `deadline_${m.id}` === d.id)?.materialId ?? d.kind)})`).join(", ")}.`);
  }
  detail.push(`This date moves only with the lead-time basis or the production requirement date. It is anchored to the PRODUCTION window, never the sell-through window.`);

  return {
    intentKind: "explain_deadline",
    headline: `The binding deadline is ${earliest.date} — the ${earliest.kind.replace(/_/g, " ")} date for ${driver ? materialName(driver.materialId) : "a material in scope"}.`,
    lines: detail,
    derivedFrom: [ENGINE_SOURCES.bom],
    isFallback: false,
  };
}

/* ---------------------------------------------------------------------- *
 * "show me the evidence"
 * ---------------------------------------------------------------------- */

export function answerEvidence(snapshot: CopilotSnapshot): CopilotAnswer {
  const { evidence } = snapshot;
  if (evidence.length === 0) {
    return {
      intentKind: "explain_evidence",
      headline: `No evidence rows are attached to ${snapshot.gapTitle}.`,
      lines: [`This scenario is linked to ${snapshot.linkedGapIds.join(", ")}; none of them carries an evidence signal, so there is nothing here I can show you rather than a plausible-looking placeholder.`],
      derivedFrom: [ENGINE_SOURCES.gaps],
      isFallback: false,
    };
  }
  const included = evidence.filter((e) => e.included);
  const excluded = evidence.filter((e) => !e.included);
  const rows = evidence
    .slice(0, 8)
    .map((e) => `${e.source} · ${e.sourceObjectType} · ${typeof e.value === "number" ? fmtNum(e.value) : e.value}${e.unit ? ` ${e.unit}` : ""} · ${e.quality} quality · supplied by ${e.suppliedBy} · ${e.included ? "included" : `excluded${e.excludedReason ? ` (${e.excludedReason})` : ""}`}`);

  return {
    intentKind: "explain_evidence",
    headline: `${evidence.length} evidence signal${evidence.length === 1 ? "" : "s"} back this scenario's gaps — ${included.length} included in the basis, ${excluded.length} excluded.`,
    lines: [...rows, evidence.length > 8 ? `…and ${evidence.length - 8} more on the gap workspace's evidence rail.` : ""].filter(Boolean),
    derivedFrom: [ENGINE_SOURCES.gaps],
    isFallback: false,
  };
}

/* ---------------------------------------------------------------------- *
 * "what basis is this" / methodology trace
 * ---------------------------------------------------------------------- */

export function answerBasis(snapshot: CopilotSnapshot): CopilotAnswer {
  const { result } = snapshot;
  const lines = result.methodologyTrace.map((t) => `${t.step} — in: ${t.inputSummary}; out: ${t.outputSummary}.`);
  lines.push(
    result.basis.sufficient
      ? `Basis health: ${result.basis.seasonsUsed} of ${result.basis.seasonsAvailable} comparable season(s) read${result.basis.seasonsRequested != null ? `, ${result.basis.seasonsRequested} requested` : ""}.`
      : `Basis is INSUFFICIENT: ${result.basis.issues.join("; ") || "no comparable season survives the current exclusions"}. The demand figures on screen carry no basis.`
  );
  return {
    intentKind: "explain_basis",
    headline: `${snapshot.scenarioName} runs ${result.methodologyTrace.length} methodology step(s) at ${fmtPct(result.confidence.overall)} overall confidence.`,
    lines,
    derivedFrom: [ENGINE_SOURCES.forecast, ENGINE_SOURCES.rccp, ENGINE_SOURCES.bom],
    isFallback: false,
  };
}

/* ---------------------------------------------------------------------- *
 * "what should I do"
 * ---------------------------------------------------------------------- */

export function answerRecommend(snapshot: CopilotSnapshot): CopilotAnswer {
  const { result, lines: allLines, limits } = snapshot;
  const atRisk = result.capacityImpact.filter((c) => c.riskLevel !== "positive").sort((a, b) => b.effectiveUtilization - a.effectiveUtilization);
  const headroom = result.capacityImpact
    .filter((c) => c.riskLevel === "positive")
    .map((c) => ({ c, hours: thresholdHours(c) - totalLoadHours(c) }))
    .sort((a, b) => b.hours - a.hours);

  const detail: string[] = [];

  const worst = atRisk[0];
  if (worst) {
    const line = allLines.find((l) => l.id === worst.lineId);
    const over = totalLoadHours(worst) - thresholdHours(worst);
    detail.push(`${lineName(worst.lineId, allLines)} is ${fmtNum1(over)}h over its ${fmtPct(worst.targetUtilization)} threshold in ${snapshot.period} (${fmtPct(worst.effectiveUtilization)} effective). That is the constraint worth acting on first.`);
    if (line) {
      detail.push(
        `Run rate — now ${fmtNum(worst.runRateUnitsPerHour ?? line.standardRunRateUnitsPerHour)}/hr on the ${worst.runRateBasis ?? "system"} basis. System standard is ${fmtNum(line.standardRunRateUnitsPerHour)}/hr, observed historical median is ${fmtNum(
          snapshot.observedRunRateByLine[line.id] ?? line.historicalMedianRunRateUnitsPerHour
        )}/hr. Legal range ${fmtNum(limits.runRateUnitsPerHour.min)}–${fmtNum(limits.runRateUnitsPerHour.max)}/hr. Say: "set ${line.name} run rate to 9000".`
      );
    }
    detail.push(`Alert threshold — now ${fmtPct(worst.targetUtilization)}. This changes the risk classification and the chart's ceiling marker only; it does NOT move the ${fmtPct(worst.effectiveUtilization)} load, so raising it hides the flag rather than solving it.`);
  } else {
    detail.push(`No line in ${snapshot.period} is over its alert threshold; the highest is ${mostLoadedLine(result) ? `${lineName(mostLoadedLine(result)!.lineId, allLines)} at ${fmtPct(mostLoadedLine(result)!.effectiveUtilization)}` : "—"}.`);
  }

  const best = headroom[0];
  if (best && worst) {
    detail.push(`Reallocate — ${lineName(best.c.lineId, allLines)} has ${fmtNum1(best.hours)}h of headroom under its own ${fmtPct(best.c.targetUtilization)} threshold at ${fmtPct(best.c.effectiveUtilization)} effective. Moving allocation share there is the lever that reduces load rather than re-labelling it.`);
  }

  const binding = bindingDeadline(result);
  if (binding) {
    const days = daysBetween(snapshot.asOf, binding.deadline.date);
    const driverName = binding.driver ? snapshot.materialNames[binding.driver.materialId] ?? binding.driver.materialId : "a material in scope";
    detail.push(
      `Timing — the binding order-by date is ${binding.deadline.date} for ${driverName}, ${days >= 0 ? `${days} days out` : `${Math.abs(days)} days overdue`}. ${result.readinessCounts.planNow} of ${result.readinessCounts.total} component rows are plan-now, ${result.readinessCounts.review} need review, ${result.readinessCounts.wait} are not yet actionable.`
    );
  }

  detail.push(
    result.basis.sufficient
      ? `Basis — the forecast reads ${result.basis.seasonsUsed} of ${snapshot.availableSeasons} comparable season(s). Widening the lookback is capped at ${limits.historicalLookback.max}; ${limits.historicalLookback.rationale}`
      : `Basis — INSUFFICIENT (${result.basis.issues.join("; ")}). Fix the basis before acting on any number above.`
  );

  detail.push(
    snapshot.overrideCount === 0
      ? `This scenario currently changes nothing vs. baseline, so every number above is the baseline's.`
      : `This scenario already carries ${snapshot.overrideCount} override${snapshot.overrideCount === 1 ? "" : "s"} vs. baseline — ask "what changed" for the list.`
  );

  return {
    intentKind: "recommend",
    headline: worst
      ? `${result.risks.length} open risk${result.risks.length === 1 ? "" : "s"} on ${snapshot.scenarioName}; ${lineName(worst.lineId, allLines)} at ${fmtPct(worst.effectiveUtilization)} is the binding one.`
      : `No capacity line is flagged on ${snapshot.scenarioName}; ${result.risks.length} risk${result.risks.length === 1 ? "" : "s"} open overall.`,
    lines: detail,
    derivedFrom: [ENGINE_SOURCES.rccp, ENGINE_SOURCES.bom, ENGINE_SOURCES.overrides],
    isFallback: false,
  };
}

/* ---------------------------------------------------------------------- *
 * "what changed"
 * ---------------------------------------------------------------------- */

export function answerWhatChanged(snapshot: CopilotSnapshot): CopilotAnswer {
  const { overrideDiffs, result, baseline } = snapshot;
  const derived = describeDerivedDeltas(baseline, result, snapshot.lines);

  if (overrideDiffs.length === 0) {
    return {
      intentKind: "what_changed",
      headline: `Nothing. ${snapshot.scenarioName} resolves identically to the baseline — 0 overrides.`,
      lines: [
        `A stored assumption only counts as an override when it RESOLVES to something different from the baseline. Restating a value the baseline already holds is not a change, which is why the count can be 0 while the scenario still stores settings.`,
        derived.length === 0 ? `No derived number differs from the baseline either.` : `Derived differences found anyway (this would be a bug): ${derived.join("; ")}.`,
      ],
      derivedFrom: [ENGINE_SOURCES.overrides],
      isFallback: false,
    };
  }

  return {
    intentKind: "what_changed",
    headline: `${overrideDiffs.length} override${overrideDiffs.length === 1 ? "" : "s"} vs. baseline on ${snapshot.scenarioName}.`,
    lines: [...overrideDiffs.map((d) => `${d.label}: ${d.baseline} → ${d.scenario}.`), derived.length > 0 ? `Downstream: ${derived.join("; ")}.` : `Downstream: no derived number moved — these overrides restate values the model already resolves to.`],
    derivedFrom: [ENGINE_SOURCES.overrides, ENGINE_SOURCES.rccp],
    isFallback: false,
  };
}

/* ---------------------------------------------------------------------- *
 * Capability list — the honest fallback.
 * ---------------------------------------------------------------------- */

/**
 * The response to "hello", "what can you do", and anything unrecognized.
 *
 * It is NOT an apology and NOT a claim of general intelligence: it lists the
 * questions this build can answer and the assumptions it can change, each
 * with the CURRENT value and the legal range read out of live scenario state,
 * so the planner can see exactly what surface they are talking to.
 */
export function answerCapabilities(snapshot: CopilotSnapshot | null, opts: { greeting: boolean; unrecognizedText?: string }): CopilotAnswer {
  const detail: string[] = [];

  if (!snapshot) {
    detail.push(`Questions I answer anywhere: "why is <line> red", "what's driving the deadline", "what should I do", "show me the evidence", "what changed", "what's the basis".`);
    detail.push(`Navigation: "open overview", "open the gaps list", "open decisions", "open scenario lab".`);
    detail.push(`Scenario changes need a scenario loaded — open one from Scenario Lab and ask again.`);
    return {
      intentKind: opts.greeting ? "greeting" : "unrecognized",
      headline: opts.greeting ? `Heizen copilot. I read this plan's live engine output and can change its assumptions.` : `I couldn't place "${opts.unrecognizedText ?? ""}". Here is exactly what I do support.`,
      lines: detail,
      derivedFrom: [],
      isFallback: !opts.greeting,
    };
  }

  const { result, lines: allLines, limits } = snapshot;
  const worst = mostLoadedLine(result);
  const lineList = result.capacityImpact.map((c) => `${lineName(c.lineId, allLines)} ${fmtPct(c.effectiveUtilization)}`).join(", ");

  detail.push(`Explain: "why is ${worst ? lineName(worst.lineId, allLines) : "<line>"} red" (load stack for ${snapshot.period}: ${lineList}), "what's driving the deadline", "show me the evidence" (${snapshot.evidence.length} signals), "what's the basis" (${result.methodologyTrace.length} methodology steps), "what changed" (${snapshot.overrideCount} override${snapshot.overrideCount === 1 ? "" : "s"} now), "what should I do".`);

  const lookback = limits.historicalLookback;
  detail.push(`Change the demand basis: "use N seasons" (${lookback.min}–${lookback.max}; ${snapshot.availableSeasons} comparable season(s) survive the current exclusions), "exclude 2025", "include 2024", "set growth to 8%" (${fmtPct(limits.growthRatePct.min)}…${fmtPct(limits.growthRatePct.max)}).`);

  if (worst) {
    const line = allLines.find((l) => l.id === worst.lineId);
    detail.push(
      `Change capacity assumptions: "set ${line?.name ?? worst.lineId} run rate to 9000" (now ${fmtNum(worst.runRateUnitsPerHour ?? line?.standardRunRateUnitsPerHour ?? 0)}/hr, legal ${fmtNum(limits.runRateUnitsPerHour.min)}–${fmtNum(limits.runRateUnitsPerHour.max)}/hr), "set the alert threshold to 85%" (now ${fmtPct(worst.targetUtilization)}, legal ${fmtPct(limits.targetUtilization.min)}–${fmtPct(limits.targetUtilization.max)}).`
    );
  }

  // The lead-time commands target the material actually driving the binding
  // deadline (see engine.ts::resolveMaterialId) — so name THAT one here, not
  // whichever BOM row happens to sort first.
  const driver = bindingDeadline(result)?.driver;
  if (driver) {
    detail.push(
      `Change master assumptions: "use the P80 lead time", "use the median lead time", "use the system lead time" — these target ${snapshot.materialNames[driver.materialId] ?? driver.materialId}, currently ${driver.leadTimeDaysUsed}d on ${LEAD_TIME_BASIS_LABEL[driver.leadTimeBasis] ?? driver.leadTimeBasis}.`
    );
  }

  detail.push(`Lifecycle: "reset the scenario", "save the scenario". Navigation: "open overview", "open the gaps list", "open decisions".`);
  detail.push(`I do not have a language model behind me. Everything above is computed from calculateScenario() when you ask, and anything outside this list I will say I can't do rather than improvise.`);

  return {
    intentKind: opts.greeting ? "greeting" : "unrecognized",
    headline: opts.greeting
      ? `Heizen copilot on ${snapshot.scenarioName} — ${snapshot.overrideCount} override${snapshot.overrideCount === 1 ? "" : "s"} vs. baseline, ${result.risks.length} open risk${result.risks.length === 1 ? "" : "s"}.`
      : `I couldn't place "${opts.unrecognizedText ?? ""}". Here is exactly what I do support on ${snapshot.scenarioName}.`,
    lines: detail,
    derivedFrom: [ENGINE_SOURCES.rccp, ENGINE_SOURCES.overrides],
    isFallback: !opts.greeting,
  };
}

/* ---------------------------------------------------------------------- *
 * Derived-delta comparison — the backbone of no-op honesty.
 * ---------------------------------------------------------------------- */

/**
 * Every derived number that differs between two scenario results, phrased as
 * "before → after". An EMPTY array is the proof that a command was a no-op,
 * and the copilot reports it as one instead of claiming success.
 */
export function describeDerivedDeltas(before: ScenarioResult, after: ScenarioResult, lines: ProductionLine[]): string[] {
  const out: string[] = [];

  if (before.expectedDemandUnits.base !== after.expectedDemandUnits.base) {
    out.push(`expected demand ${fmtNum(before.expectedDemandUnits.base)} → ${fmtNum(after.expectedDemandUnits.base)} units`);
  }
  if (before.unresolvedDemandUnits !== after.unresolvedDemandUnits) {
    out.push(`unresolved demand ${fmtNum(Math.round(before.unresolvedDemandUnits))} → ${fmtNum(Math.round(after.unresolvedDemandUnits))} units`);
  }
  if (before.planningCompletenessPct !== after.planningCompletenessPct) {
    out.push(`planning completeness ${before.planningCompletenessPct}% → ${after.planningCompletenessPct}%`);
  }

  after.capacityImpact.forEach((a) => {
    const b = before.capacityImpact.find((x) => x.lineId === a.lineId && x.period === a.period);
    if (!b) return;
    const name = lineName(a.lineId, lines);
    if (b.effectiveUtilization !== a.effectiveUtilization) out.push(`${name} effective utilization ${fmtPct(b.effectiveUtilization)} → ${fmtPct(a.effectiveUtilization)}`);
    if (b.riskLevel !== a.riskLevel) out.push(`${name} status ${b.riskLevel} → ${a.riskLevel}`);
    if (b.targetUtilization !== a.targetUtilization) out.push(`${name} alert threshold ${fmtPct(b.targetUtilization)} → ${fmtPct(a.targetUtilization)}`);
    if ((b.runRateUnitsPerHour ?? 0) !== (a.runRateUnitsPerHour ?? 0)) out.push(`${name} run rate ${fmtNum(b.runRateUnitsPerHour ?? 0)}/hr → ${fmtNum(a.runRateUnitsPerHour ?? 0)}/hr`);
  });

  const beforeDeadline = earliestDeadlineDate(before);
  const afterDeadline = earliestDeadlineDate(after);
  if (beforeDeadline !== afterDeadline) out.push(`earliest decision deadline ${beforeDeadline ?? "—"} → ${afterDeadline ?? "—"}`);

  if (before.readinessCounts.planNow !== after.readinessCounts.planNow || before.readinessCounts.review !== after.readinessCounts.review || before.readinessCounts.wait !== after.readinessCounts.wait) {
    out.push(`component readiness ${before.readinessCounts.planNow}/${before.readinessCounts.review}/${before.readinessCounts.wait} → ${after.readinessCounts.planNow}/${after.readinessCounts.review}/${after.readinessCounts.wait} (plan-now/review/wait)`);
  }
  if (before.confidence.overall !== after.confidence.overall) out.push(`overall confidence ${fmtPct(before.confidence.overall)} → ${fmtPct(after.confidence.overall)}`);
  if (before.basis.seasonsUsed !== after.basis.seasonsUsed) out.push(`seasons in basis ${before.basis.seasonsUsed} → ${after.basis.seasonsUsed}`);

  return out;
}

export function earliestDeadlineDate(result: ScenarioResult): string | null {
  const sorted = [...result.decisionDeadlines].sort((a, b) => (a.date < b.date ? -1 : 1));
  return (sorted.find((d) => d.isEarliestConstraint) ?? sorted[0])?.date ?? null;
}

const MS_PER_DAY = 86_400_000;
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10));
  const to = Date.parse(toIso.slice(0, 10));
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / MS_PER_DAY);
}

/** Flattens an answer into the single string a transcript entry stores. */
export function answerToText(answer: CopilotAnswer): string {
  return [answer.headline, ...answer.lines].join("\n");
}
