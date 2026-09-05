# Architecture — the preserved V1 engine

> **This document describes the V1 planning engine, which is still present and
> still tested but is no longer the path the product renders.** The V2 workflow
> — the one behind Overview, Planning Workspace, Scenario Lab and Decisions —
> is documented in [`v2-architecture.md`](./v2-architecture.md), and its input
> model is `types/dataset.ts` rather than `data/synthetic/*`.
>
> V1 is kept because the reasoning below still holds for the code it describes,
> and because `reconcileProvisional()` from `lib/planning-engine/reconciliation.ts`
> is used directly by the V2 Decisions page. New work should read a
> `PlanningDataset`, not `data/synthetic/*`.


## Layers

```
data/synthetic/*        deterministic source data (seeded RNG, never Math.random())
        ↓
lib/planning-engine/*    pure functions — no React imports, no store imports
        ↓
lib/planning-engine/gaps.ts    assembles PlanningGap[] by calling calculateScenario()
                                with empty overrides (= the baseline)
        ↓
stores/scenario-store.ts       Zustand — ScenarioOverrides only, never derived numbers
        ↓
components/*                   render calculateScenario(baseline + current overrides)
        ↓
lib/ai-tools/*                 typed tools that call the SAME store actions the UI calls
```

This mirrors the PRD's own logical-layer guidance (§39): Synthetic/Source Data → Canonical Planning Model → Gap Detection → Methodology Engine → Scenario Engine → Agent Layer → Experience Layer → Reconciliation Layer. The mapping isn't literal 1:1 (`lib/planning-engine` bundles the methodology and scenario engines together, since in this phase they share every helper function), but the boundary that matters — **calculation logic never lives in a component** — holds throughout.

## Why calculateScenario() is the single entry point

Every derived number in the product — expected demand, capacity utilization, material exposure, decision deadlines, confidence, risks — comes from one function: `lib/planning-engine/scenarios.ts::calculateScenario()`. It's a pure function: `(baseline facts + ScenarioOverrides + PlanningBasis) -> ScenarioResult`.

This has one practical consequence that matters more than any other: **a scenario's derived state is never stored.** `stores/scenario-store.ts` holds only `ScenarioOverrides` (a planner's edits) — never `ScenarioResult`. Any component that needs the numbers calls `calculateScenario()` itself, typically inside a `useMemo` keyed on the current overrides (see `components/scenario/scenario-lab-view.tsx`). This makes "scenario state can drift from its own baseline" structurally impossible — there is no cached derived value to go stale.

`lib/planning-engine/gaps.ts` builds each `PlanningGap` the same way, just with `overrides: {}`. `buildHalloweenScenarioInput()` is exported specifically so both baseline gap detection and a live Scenario Lab session share one definition of "what facts feed this gap" instead of two definitions quietly drifting apart.

## Data flow for one concrete case (Golden Scenario A — Halloween)

1. `data/synthetic/events.ts` + `historical-demand.ts` + `capacity.ts` + `bom.ts` hold the raw facts: 3 non-atypical prior Halloween seasons, 4 lines' September capacity buckets, the Classic Variety Bag's formal BOM.
2. `lib/planning-engine/gaps.ts::buildHalloweenScenarioInput()` assembles those facts plus a `LineAllocation[]` (which lines get how much of the unresolved demand — an explicit, editable assumption, not a hidden heuristic) into a `CalculateScenarioInput`.
3. `calculateScenario()` runs the pipeline: `seasonalForecast()` → `applyDemandOverride()` → `businessToPlanReconciliation()` → `rccp()` per line/period → `partialBomExplosion()` → deadline derivation → confidence/risk summarization. Each step also pushes a `MethodologyTraceEntry`, so the "why" is captured as data, not written separately as prose that can drift from the actual computation.
4. `detectHalloweenGap()` packages the result into a `PlanningGap` + `PlanningBasis` + `EvidenceSignal[]`.
5. `app/(app)/briefing/page.tsx` and `app/dev/design-system/page.tsx` call `detectPlanningGaps()` directly (server components — this recomputes at request/build time, which is fine since it's deterministic and cheap).
6. `components/scenario/scenario-lab-view.tsx` calls `buildHalloweenScenarioInput(scenarioId, currentOverrides)` + `calculateScenario()` inside a `useMemo`, so editing a control re-renders with genuinely recalculated numbers — not a mocked "before/after" pair.

## State boundaries

- **Baseline / source data** (`data/synthetic/*`): immutable at runtime. Nothing in `lib/planning-engine` or `stores/*` ever mutates these arrays — verified by a test (`scenarios.test.ts::"never mutates the underlying synthetic capacity data it reads"`).
- **Scenario overrides** (`stores/scenario-store.ts`): the only thing a planner action changes. Structured as `ScenarioOverrides` — a handful of keyed categories (`demand`, `historicalBasis`, `analogues`, `bom`, `masterAssumptions`, `capacity`, `materials`) chosen so "reset one field" / "reset a whole category" / "reset everything" are all cheap, obvious operations (delete a key, delete a category, replace with `{}`).
- **Derived scenario state** (`ScenarioResult`): never persisted. Always `calculateScenario(...)` called fresh.
- **UI-only state** (`stores/app-store.ts`): theme, AI panel visibility, transcript, selected planning horizon. Nothing here feeds a calculation.

## AI tool architecture

`lib/ai-tools/*` defines a typed tool registry: each `AIToolDefinition` pairs a Zod schema with an `execute` function that calls the exact same Zustand action a button click would call (`lib/ai-tools/scenario-actions.ts` wraps `useScenarioStore.getState().<action>`). This is what makes "AI operates the application" literally true rather than a chat layer that describes a change without making it.

`lib/ai-tools/registry.ts::invokeTool()` is the dispatch seam: given a tool name and raw (untyped) params, it validates with the tool's own schema, then calls `execute`. This shape — name + Zod schema + pure execute — is intentionally the same shape CopilotKit actions and the Claude API's tool-use format expect, so wiring in an actual LLM-driven tool-selector later touches only whatever calls `invokeTool()`, never these definitions.

**Why CopilotKit isn't installed yet:** the brief allowed skipping it if it "would create unnecessary implementation overhead." Wiring `@copilotkit/react-core` correctly needs a runtime endpoint (typically a Next.js route handler proxying to an LLM with tool-calling), an API key, and a decision about which model to target — none of which are settled yet, and none of which should block getting the tool-contract layer right first. `components/ai/ai-command-bar.tsx` is deliberately built against `lib/ai-tools/registry.ts` directly (with simple keyword-based routing standing in for real intent detection) so the seam is provably real today, not just documented as a future plan.

**Voice**: `AiCommandBar` has a visible microphone entry point. Actual transcription is out of scope for this demo environment (PRD §34) — when it's added, it should feed the same text input this bar already uses, not a separate code path.

## Future integration boundary

Per PRD §38, the phases after this one are: Phase 1 (read-only real-data pilot — swap `data/synthetic/*` for real exports, one event/plant), Phase 2 (automated gap detection — `lib/planning-engine/gaps.ts` currently hand-lists which gaps to detect; a real engine would scan for them), Phase 3 (enterprise integrations), Phase 4 (RBAC), Phase 5 (advanced material/supplier intelligence).

The architecture is deliberately shaped so Phase 1 touches only `data/synthetic/*` (replace with a real data-loading layer behind the same types) — nothing in `lib/planning-engine`, `stores`, or `components` should need to change just because the data source changed.
