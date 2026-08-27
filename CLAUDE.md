@Heizen_Planning_Gap_Intelligence_PRD.md

# Heizen Planning Gap Intelligence — engineering guide

The PRD above is canonical. When this file and the PRD conflict, the PRD wins — update this file, don't route around the PRD.

## What this product is

Heizen finds, explains, quantifies, and helps a planner act on **planning gaps**: places where the formal planning stack (SAP, Kinaxis, Aera, etc.) is missing, underrepresenting, or misrepresenting a future requirement. Heizen does not replace those systems — it specializes in the gap between real-world business knowledge and the formal planning representation, then hands a sufficiently-represented situation back to them.

Current phase: **Phase 0, high-fidelity synthetic-data demo.** One S&OP / Planning Lead Super Admin persona with full access. RBAC does not exist yet, but every data model must stay RBAC-compatible (see PRD §4.2) — don't hard-code single-user assumptions into the schema itself, only into the UI.

## Non-negotiable product principles

- **AI-first, but visual-first.** AI can navigate, filter, explain, and change scenario assumptions from almost anywhere — but the result of an AI action is normally an updated visual workspace, not a wall of chat text. Chat is supporting context.
- **Professional planning density, not a SaaS dashboard.** Dense tables, precise numbers, restrained color, no glowing AI effects, no giant decorative cards. A planner coming from Excel/SAP/Kinaxis should feel at home.
- **Scenario Lab is first-class.** It is the main decision-development environment, not a what-if form bolted onto the side.
- **Every material AI inference exposes WHAT / BASIS / METHODOLOGY / CONFIDENCE / CONTROL.** Use `components/planning/planning-basis-card.tsx` and `components/methodology/*` for this — don't invent a one-off pattern per page.
- **Baseline vs. scenario must always be visually distinguishable and structurally separate.** Source data → baseline model → scenario overrides → derived scenario. A scenario override NEVER mutates baseline/source data, and the derived result is NEVER persisted — it's recomputed by `calculateScenario()` every time.
- **Preserve uncertainty.** Ranges and P50/P80, not single-point estimates. Confidence is always broken down by dimension (`types/shared.ts::ConfidenceDimension`) — never a single global score used alone.
- **Recognized planning methodologies, made visible, not academic decoration.** See `lib/methodology/registry.ts`. A methodology badge should never dominate a page.

## What NOT to do

- Do not put planning calculations inside a React component. All derived numbers come from `lib/planning-engine/*` (pure functions, no React imports) — components call them and render the result.
- Do not fabricate precision. If a value isn't computable from real synthetic data via a real methodology, it doesn't exist — show "not yet built" or an honest gap, never a plausible-looking placeholder number.
- Do not let a provisional/inferred assumption silently double-count against formal demand once it arrives. Every reconciliation goes through `lib/planning-engine/reconciliation.ts::reconcileProvisional()` — never sum `priorProvisionalAmount + formalizedAmount` directly.
- Do not conflate production timing and sales timing. They are separate windows on `BusinessEvent` (`productionWindow` vs `salesWindow`) and must stay separate in any UI that shows both.
- Do not build real ERP writebacks, real authentication, RBAC UI, or a full APS/finite scheduler. See PRD §26/§34 for the full non-goals list.
- Do not reuse a risk color (positive/warning/critical) to also label a data series, or vice versa. They are two structurally separate token sets — see the comment at the top of `app/globals.css`.

## Build discipline

Before implementing any major feature, work through these in order — then code:

1. **Planning question** — what is the planner actually trying to answer?
2. **Required inputs** — which synthetic data (`data/synthetic/*`) and which scenario overrides feed it?
3. **Methodology** — which entry in `lib/methodology/registry.ts` applies, and why?
4. **Planner actions** — what can they change, dismiss, validate, or approve?
5. **Derived outputs** — which `lib/planning-engine/*` function(s) compute the answer?
6. **Visual representation** — which existing primitive in `components/charts|planning|evidence|methodology` fits, or does a new one genuinely need to be built?
7. **Scenario variables** — which `ScenarioOverrides` category does this belong to, and which Zustand action in `stores/scenario-store.ts` sets it?

## Architecture map

```
data/synthetic/*        deterministic (seeded RNG) source data — never Math.random()
        ↓
lib/planning-engine/*    pure functions: seasonality, demand, capacity (RCCP), analogues,
                          materials (partial BOM explosion), lead-times, confidence,
                          reconciliation, and calculateScenario() — the single entry point
        ↓
lib/planning-engine/gaps.ts   assembles PlanningGap objects by calling calculateScenario()
                               with empty overrides (= baseline)
        ↓
stores/scenario-store.ts       ScenarioOverrides only — never derived numbers
        ↓
components/*                   render calculateScenario(baseline + current overrides)
        ↓
lib/ai-tools/*                 typed tools that call the SAME store actions the UI calls
```

See `docs/architecture.md`, `docs/planning-engine.md`, `docs/synthetic-data.md`, and `docs/ui-principles.md` for the full detail behind each layer.

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind v4 + shadcn/ui-style components (hand-written in `components/ui`, not a running CLI dependency) + Zustand + Zod + AG Grid Community + AG Charts Community + `react-resizable-panels` + `motion` + TanStack Query. No database, no real auth, no production integrations in this phase — see PRD §12 for the full target stack.

AI: the tool-calling contract in `lib/ai-tools/*` is the intended CopilotKit adapter surface (`@copilotkit/react-*` were not installed in this pass — see `docs/architecture.md` for why and what wiring them in later requires). Voice is a visible entry point in `components/ai/ai-command-bar.tsx`; transcription itself is out of scope for this demo.
