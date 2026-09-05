@Heizen_Planning_Gap_Intelligence_PRD.md

# Heizen — engineering guide (V2)

The PRD above is the original product context and is still the reference for
planning methodology, the confidence model, and the domain vocabulary.

**The V2 direction below supersedes the PRD's information architecture and
product framing where they conflict.** V1 became too broad; V2 narrows to one
job. Don't reintroduce the V1 IA because the PRD describes it.

See `docs/v2-architecture.md` for the layer-by-layer map.

## What this product is

Heizen helps a planner manage **future business that is not yet represented at
item / SKU level in the formal planning stack** — seasonal assortments, annual
graphic refreshes, retailer packs, renovations, launches, pack-size changes,
business targets known above SKU level.

> Plan what your formal plan cannot see yet.
>
> Reconcile unresolved future business, understand what can already be planned,
> and see the material and capacity impact before the finished item exists.

The value is **reconciliation + structured visibility + downstream planning
impact + scenario analysis**. Heizen is not a better forecasting engine, not an
autonomous SKU predictor, and not a replacement for SAP, Kinaxis or Aera.

Primary persona: one Supply / Material Planning Lead (or S&OP Lead) with full
access. No RBAC yet, but keep the data model RBAC-compatible.

## Information architecture

Four destinations, nothing more:

**Overview · Planning Workspace · Scenario Lab · Decisions**

Capacity, materials, methodology, planning assumptions and integrations are
steps *inside* the workflow, not modules of their own. A planner navigates a
situation, not a taxonomy.

The workflow inside a situation is **Reconcile → Plan Supply → Check Capacity →
Decide**.

## Two data modes

`DEMO` (seeded synthetic) and `UPLOADED` (a planner's `.xlsx`). Both normalize
into the same `PlanningDataset` and get the identical product experience — only
the input adapter differs. Never build a demo-only or upload-only screen.

Demo data is CPG/confectionery-flavoured but **synthetic**. Never present it as
any real company's data, and never use a real brand name.

## Non-negotiable principles

- **One screen, one question.** Overview: what needs attention? Reconcile: what
  isn't represented? Plan Supply: what can I plan now? Capacity: where does it
  hit? Scenario: what changes if I change assumptions? Decide: what should I do?
- **Everything reconciles to one number.** `bridge.validatedUnits` — the units
  the planner accepted as carrying forward — drives capacity hours, material
  requirements and decision dates. If a page shows a figure that cannot be
  traced back to it, that page is wrong.
- **Only `carry_forward` bears load.** `already_represented` is in the formal
  plan, `intentional_exit` is gone, `under_review` is undecided. Counting any of
  them overstates the plan.
- **Matching explains itself.** Show which attributes matched and which
  differed, never a bare similarity percentage. Representation is assigned
  one-to-one: a plan item can only stand for one prior item.
- **Scenario overrides never touch the baseline.** They apply to a copy of the
  dataset; the derived result is recomputed, never persisted. An uploaded
  workbook is never rewritten. AI changes go to scenario or decision state.
- **Preserve uncertainty and never fabricate precision.** A missing sheet
  degrades one analysis and says so ("Add BOM data to calculate material
  exposure."); it never yields a plausible-looking placeholder.
- **Never imply uncertain packaging can be ordered** because stable raw
  ingredients are predictable.
- **Uploaded data stays in the browser.** Parse client-side; never send workbook
  contents to a server, an LLM, or analytics.

## Visual rules

V1 was too text-heavy, too busy, too much like a dashboard. Every screen must be
understandable in 5–10 seconds.

- **Do not solve UI confusion by adding explanation.** If the interface needs
  paragraphs, redesign the interface.
- Page subtitle: one short line. Primary insight: one sentence. Card
  description: one line. Detail belongs in a drawer, tooltip or "why?".
- One hero number per screen; supporting figures sized well below it.
- Prefer open analytical layout, section rules and metric bands. Cards are for
  actual semantic objects, not for every block.
- Four planner-facing states only: **Action needed · Monitor · Forming ·
  Reconciled**. Don't show severity, type, methodology, confidence and status at
  once.
- Colour comes from CSS custom properties only. Risk tokens
  (positive/warning/critical) and planning-state tokens
  (formal/validated/inferred/scenario/historical/unknown) are structurally
  separate — never reuse one for the other. See the header of `app/globals.css`.
- Signature visuals: business-to-plan bridge, item reconciliation, material
  readiness, effective-capacity matrix, decision runway, scenario comparison.

## What NOT to do

- Don't put planning calculations in a React component. Derived numbers come
  from `lib/situations/*` and `lib/planning-engine/*` (pure, no React imports).
- Don't import `data/synthetic/*` into new code. It is V1's input adapter, kept
  for the preserved V1 engine. New work reads a `PlanningDataset`.
- Don't use `Math.random()` or `Date.now()` in data generation. Everything
  derives from a seed and from `dataset.metadata.planningNow`.
- Don't import `lib/excel/template.ts` (ExcelJS, Node-only) into a client
  component. It is served by `app/api/planning-template`.
- Don't let a provisional assumption double-count once formal demand arrives.
  Reconciliation goes through
  `lib/planning-engine/reconciliation.ts::reconcileProvisional()`.
- Don't conflate production timing and sales timing. They are separate windows
  and must stay separate wherever both are shown.
- Don't require a placeholder finished SKU to use the product. Unresolved load
  is modelled outside the item master.
- Don't build ERP writebacks, real auth, RBAC UI, an APS/finite scheduler, or
  any live integration.

## Build discipline

Before implementing a feature, work through these, then code:

1. **Planning question** — what is the planner trying to answer?
2. **Required inputs** — which `PlanningDataset` rows, which overrides?
3. **Matching / methodology** — what makes this defensible, and how is it shown?
4. **Planner actions** — what can they change, dismiss, validate, approve?
5. **Derived outputs** — which `lib/situations/*` function computes it?
6. **Visual** — which existing primitive in `components/v2/*` fits?
7. **Scenario variables** — which `ScenarioAdjustments` category, which store
   action?

## Stack

Next.js (App Router) + TypeScript (strict, `noUncheckedIndexedAccess`) +
Tailwind v4 + hand-written shadcn-style components in `components/ui` + Zustand
+ Zod + AG Grid/Charts (V1 surfaces) + `motion` + TanStack Query.
ExcelJS (server, template generation) + SheetJS (browser, parsing).
No database, no real auth, no production integrations.
