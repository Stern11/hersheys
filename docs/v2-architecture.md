# V2 architecture — unresolved planning

V2 narrows the product from "planning gap intelligence across every supply-chain
problem" to one job: **help a planner manage future business that is not yet
represented at item level in the formal planning stack.**

> Plan what your formal plan cannot see yet.

## The two input adapters

Everything the product shows is derived from a single normalized model. There is
exactly one planning engine, and it does not know where its data came from.

```
generateDemoRawInput(seed)          parseWorkbook(.xlsx)
        │                                   │
        │                           planColumnMapping / applyMapping
        │                                   │
        └──────────► normalizePlanningInput() ◄──────┘
                              │
                       PlanningDataset            (types/dataset.ts)
                              │
                    buildSituations(dataset, overrides)
                              │
                      PlanningSituation[]         (types/situation.ts)
                              │
                          components/*
```

`lib/dataset/adapter-parity.test.ts` writes the demo dataset out as a real
`.xlsx`, reads it back through the upload path, and asserts the resulting
`PlanningDataset` and every derived situation are identical. That test is what
keeps the two adapters honest.

## Layers

| Path | Responsibility |
| --- | --- |
| `types/dataset.ts` | The normalized input model. Rows shaped like a planner's export. |
| `lib/excel/schema.ts` | The canonical workbook contract. Drives template generation, the README, parsing, validation and column mapping — one source of truth so what we hand out and what we accept cannot drift. |
| `lib/excel/template.ts` | Builds the `.xlsx` template (ExcelJS, **Node only** — served by `app/api/planning-template`). Never import into a client component. |
| `lib/excel/parse.ts` `validate.ts` `column-mapping.ts` | Reads an uploaded workbook (SheetJS, browser-safe). Parsing happens client-side; workbook contents never leave the browser. |
| `lib/dataset/coerce.ts` | Cell coercion: Excel serials, `Date`s, ISO/US strings, `1,234`, `(1,234)`, `90` / `90%` / `0.9`. |
| `lib/dataset/normalize.ts` | The one funnel. Derives `availableHours` and `actualLeadTimeDays`; drops and reports rows it cannot make valid. |
| `lib/dataset/issues.ts` | Planner-facing problems. Raw parser errors never reach the UI. |
| `lib/dataset/demo/generate.ts` | The seeded demo adapter. Deterministic — same seed, same dataset. |
| `lib/situations/matching.ts` | Configurable attribute matching, one-to-one assignment, and the explanation of *why* something matched. |
| `lib/situations/build.ts` | Assembles situations: bridge, capacity, materials, runway, state. |
| `lib/situations/scenario.ts` | Applies scenario overrides to a **copy** of the dataset. |
| `stores/dataset-store.ts` | Mode, active dataset, planner dispositions. |
| `stores/situation-scenario-store.ts` | Scenario overrides only — never a derived number. |

## The coherence rule

Every downstream number derives from one figure: **the units the planner has
validated as carrying forward** (`bridge.validatedUnits`). Capacity hours,
material requirements and decision dates all read from it. Change one
disposition on Reconcile and the capacity matrix, the material list and the
runway all move together — that is what makes the pages reconcile.

Only `carry_forward` bears load. `already_represented` is already in the formal
plan, `intentional_exit` is deliberately gone, and `under_review` has not been
decided — counting any of them would overstate the plan.

## What remains from V1

One module: `lib/planning-engine/reconciliation.ts`, whose
`reconcileProvisional()` the Decisions page calls directly to prove that
matched provisional load is replaced rather than added.

Everything else from V1 — the `/gaps` routes, the V1 Scenario Lab, the
`data/synthetic/*` input adapter, the rest of `lib/planning-engine/*`, and the
AI tool/copilot layer built on them — was removed once nothing in the running
app could reach it. The "Ask Heizen" bar answers through `lib/copilot-v2/*`,
grounded in the same `PlanningSituation`s the page on screen renders.

## Rules that still hold

- No planning calculation inside a React component.
- No `Math.random()` and no `Date.now()` in data generation — everything derives
  from a seed and from `dataset.metadata.planningNow`.
- A scenario override never mutates the baseline, and a derived result is never
  persisted.
- Risk tokens (positive/warning/critical) and planning-state tokens
  (formal/validated/inferred/scenario/historical/unknown) stay structurally
  separate. See the header of `app/globals.css`.
- Never fabricate precision. A missing sheet degrades one analysis and says so;
  it never produces a plausible-looking placeholder.
