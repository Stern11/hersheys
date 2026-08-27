# Planning engine

`lib/planning-engine/*` — pure TypeScript, zero React/Zustand/Next.js imports. Every function is `(explicit inputs) -> explicit output`; nothing reads from a store or the DOM. This is enforced by convention (no lint rule currently forbids the import — worth adding an `eslint-plugin-boundaries` rule if this codebase grows past this phase).

## Modules

| Module | Responsibility |
|---|---|
| `confidence.ts` | `classifyReadiness()` (confidence → plan_now/review/wait/unknown, thresholds documented inline), `summarizeConfidence()` (never collapses to one number without keeping the per-dimension breakdown), `confidenceBand()`. |
| `seasonality.ts` | `seasonalForecast()` — recent-weighted (or equal-weighted) average of comparable historical periods, adjusted by a growth assumption, with a symmetric uncertainty band. Atypical periods excluded by default. |
| `demand.ts` | `businessToPlanReconciliation()` (formal vs. expected → represented/unresolved/completeness) and `applyDemandOverride()`/`selectedDemandPoint()` (scenario demand controls on top of a forecast). |
| `lead-times.ts` | `resolveLeadTimeDays()` (System/Historical-median/Historical-P80/Scenario basis resolution) and `decisionDeadlineFromLeadTime()` (production requirement date − lead time = order-by date). |
| `capacity.ts` | `rccp()` — volume ÷ run rate = required hours, compared against ceiling and target headroom. Distinguishes formal load, already-validated unresolved load, this scenario's AI-inferred load, and any planner-added prebuild — never folds them into one opaque number. |
| `analogues.ts` | `resolveActiveAnalogues()` (apply accept/reject/reweight overrides) and `blendAnalogueBom()` (weighted-average a target product's BOM across multiple analogues' real BOM rows — genuinely recomputes when weights change, not a lookup). |
| `materials.ts` | `partialBomExplosion()` — provisional demand × BOM consumption = gross requirement, netted against inventory/open supply, offset by lead time, classified into readiness states. |
| `reconciliation.ts` | `reconcileProvisional()` — the one place double-counting is prevented. See below. |
| `scenarios.ts` | `calculateScenario()` — the single entry point. Orchestrates every module above into one `ScenarioResult`, with a `methodologyTrace` recording what happened at each step. |
| `gaps.ts` | `detectPlanningGaps()` — assembles the demo's `PlanningGap[]` by calling `calculateScenario()` with empty overrides per gap context. Exports `buildHalloweenScenarioInput()` so Scenario Lab can reuse the exact same input assembly with live overrides. |

## The calculateScenario() contract

```ts
calculateScenario({
  // demand basis
  formalDemandUnits, historicalPeriods, growthAssumption, productionRequirementDate,
  // capacity basis
  lineAllocations, lines, capacityBuckets, observedRunRateByLine,
  // material basis
  bomRows, materialsById, leadTimeP80ByMaterial,
  analogueCandidates?, analogueBomByProductId?,
  planningBasis, overrides,
}) => {
  expectedDemandUnits, unresolvedDemandUnits, planningCompletenessPct,
  capacityImpact, materialExposure, decisionDeadlines,
  confidence, materialReadiness, risks, methodologyTrace, calculatedAt,
}
```

Deterministic and side-effect-free: same input, same output, every time (`scenarios.test.ts::"is deterministic"`). Never mutates the baseline arrays it's handed (`scenarios.test.ts::"never mutates the underlying synthetic capacity data it reads"`).

## Core formulas, as implemented

**A. Demand.** `seasonalForecast()`: a recent-weighted average of comparable historical periods × `(1 + growthAssumption)`, banded by `±uncertaintyBandPct`. `businessToPlanReconciliation()`: `unresolvedAmount = max(0, expectedBase - formalValue)` — floored at zero so an over-planned event doesn't report negative unresolved demand.

**B. Capacity (RCCP).** `rccp()`: `aiInferredLoadHours = unresolvedUnitsAllocatedToThisLine / runRate`. Effective utilization compares `(formalLoadHours + validatedUnresolvedLoadHours + aiInferredLoadHours + prebuildLoadHours) / ceilingHours` against `targetUtilization` to assign a risk band. `additionalShiftHours` widens the ceiling; `prebuildQuantityUnits` adds load in the period a planner chose to prebuild — the two are kept structurally separate rather than merged into one "capacity adjustment" number, because they represent different planner decisions (adding a shift vs. choosing to build inventory early).

**C. Materials.** `partialBomExplosion()`: `grossRequirement = expectedDemandUnits × quantityPerUnit × (1 + scrapFactor)`, netted against `onHandInventoryUnits + openSupplyUnits`, then `earliestDecisionDate = decisionDeadlineFromLeadTime(productionRequirementDate, leadTimeDays)`. Readiness state comes from `classifyReadiness(confidence)` unless a planner has explicitly overridden it (with a required reason, per `BomComponentOverride.confidenceOverrideReason`).

**D. Lead time.** `decisionDeadlineFromLeadTime(productionRequirementDate, leadTimeDays)` — plain date subtraction, but which `leadTimeDays` value is used depends on the resolved basis (System / Historical median / Historical P80 / Scenario), computed by `resolveLeadTimeDays()`.

**E. Reconciliation.** `reconcileProvisional()`:

```ts
matchedAmount = min(priorProvisionalAmount, formalizedAmount)
residualUnresolvedAmount = max(0, priorProvisionalAmount - matchedAmount)
// total representation after reconciliation:
totalRepresentedAfterReconciliation = formalizedAmount + residualUnresolvedAmount
// NEVER: formalizedAmount + priorProvisionalAmount
```

This is tested directly against the PRD's own worked example (§21.3): 500k provisional, 420k newly formal → 420k matched, 80k residual, total 500k — never 920k.

## Reconciliation requirement

Any code path that has both a provisional/inferred amount and a newly-formalized amount for the same underlying requirement **must** go through `reconcileProvisional()`. There is no other sanctioned way to combine those two numbers in this codebase — summing them directly is exactly the bug this module exists to prevent, and it's covered by a dedicated test (`reconciliation.test.ts::"never lets total representation equal formal + prior provisional"`).

## Scenario override model

`ScenarioOverrides` (defined in `types/scenario.ts`) is a small set of keyed categories — `demand`, `historicalBasis`, `analogues`, `bom`, `masterAssumptions`, `capacity`, `materials` — chosen specifically so the three reset granularities the PRD asks for (§13.13: Reset change / Reset category / Reset all) map directly onto cheap operations: delete one key, delete a whole category object, or replace the overrides object with `{}`. `stores/scenario-store.ts` never stores anything except these overrides; `calculateScenario()` is what turns `(baseline, overrides)` into numbers, every time it's called, from scratch.
