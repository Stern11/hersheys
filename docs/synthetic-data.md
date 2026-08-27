# Synthetic data

## Determinism

`lib/utils/rng.ts` implements a seeded PRNG (mulberry32, seeded from a string via a simple hash). Every generated dataset (`data/synthetic/execution-history.ts`'s PO/GR and production-confirmation records) is seeded once at module load with a fixed string (`"heizen-execution-history-v1"`), so the same code always produces the same numbers — no `Math.random()` anywhere in `data/synthetic/*`. This is what makes "every demo number reconciles across pages" (PRD §27.6) actually true rather than aspirational: reload the app, rebuild it, run it in CI — the numbers don't move.

Most of the dataset is **hand-authored, not generated** — see "Why hand-authored" below.

## The demo universe

One CPG (Hershey-style) manufacturer, `DEMO_NOW = 2027-08-24` (`data/synthetic/master-data.ts`).

- **Events** (`events.ts`): Halloween 2027, Holiday/Christmas 2027, Valentine's 2028, Walmart Fall Reset, Diwali 2027 (the optional international event, PRD §16.2). Each has separate `salesWindow` and `productionWindow` — production leads sales, per PRD §16.4.
- **Customers** (`customers.ts`): Walmart, Target, Kroger.
- **Product families** (`master-data.ts`): Variety Bags, Gift Tins, Counter Displays, Molded Novelty.
- **Production lines** (`master-data.ts`): 4 lines. Line 03 is the consistently constrained line and carries the exact System/Historical run-rate example used throughout the PRD (10,000/hr system vs. 7,950/hr historical median, §18.2). Line 04 is the flexible alternate with headroom — the natural target for a prebuild/shift scenario.
- **Materials** (`materials.ts`): Cocoa, Sugar, Milk Solids, Printed Film, Foil, Corrugate, Tray, Tin/Trim. Printed Film carries the exact golden lead-time gap (system 42d / historical median 67d / P80 81d).
- **Products** (`products.ts`): a mix of fully formal SKUs, one seasonal SKU that's expected but not yet created (representation gap), and the Valentine's Premium Tin — concept-level only, no formal SKU, BOM derived from two analogues.
- **BOM** (`bom.ts`): formal BOM rows (`provenance: "formal"`, confidence 1) for every formal product, plus the Valentine's Tin's analogue-derived rows (`provenance: "inferred"`), hand-tuned so 3 components read as plan-now (Cocoa, Sugar, Milk Solids), 2 as review (Foil, Tin/Trim), and 2 as wait (Printed Film wrapper, Corrugate) — matching the PRD's own worked example (§15.6, §28.2) exactly.
- **Capacity** (`capacity.ts`): August/September/October 2027 buckets for all 4 lines. September (peak) is tuned so Line 03's formal utilization sits near 70% and its effective utilization (once the RCCP engine step adds unresolved Halloween demand) lands in the PRD's stated 94–101% band.
- **Execution history** (`execution-history.ts`): generated PO→goods-receipt records (for lead-time evidence) and production-confirmation records (for run-rate evidence and the Line 02→Line 01 line-mapping anomaly, PRD §6.4), all deterministic.
- **Suppliers** (`suppliers.ts`), **planning snapshots** (`planning-snapshots.ts` — dated formal-plan values, including the golden 3.8M Halloween figure), **scenarios** (`scenarios.ts` — one pre-saved scenario encoding the PRD's own worked run-rate/lead-time examples).

## Why hand-authored, not generated, for the load-bearing numbers

Capacity buckets, BOM confidence values, and formal-plan snapshots are **hand-written**, not RNG-generated. The three Golden Demo Scenarios (PRD §28) depend on specific relationships holding — Line 03 crossing from ~70% formal to 94–101% effective, the Valentine's Tin splitting exactly 3/2/2 across readiness states, Printed Film's historical P80 pulling the material deadline meaningfully earlier — and letting a random generator produce those relationships "by chance" would be fragile and non-obvious to a future reader. Where the specific number doesn't matter to a demo narrative (raw PO/GR elapsed-time samples, individual production-confirmation run rates), generation is used, and it's seeded so it's still exactly reproducible.

## How a number is verified to be real, not fabricated

Every number surfaced in the UI traces back to one of:

1. A literal field in `data/synthetic/*` (e.g., `MATERIALS.find(m => m.id === "mat_printed_film").systemLeadTimeDays === 42`).
2. A deterministic aggregation over that data computed once (e.g., `OBSERVED_PERFORMANCE`'s median lead times, computed from `PURCHASE_ORDER_RECORDS` in `execution-history.ts`).
3. A `lib/planning-engine/*` pure function applied to (1) or (2) — e.g., `seasonalForecast()`'s output, or `rccp()`'s effective utilization.

Nothing in `components/*` invents a number. If a value genuinely isn't computable from this dataset (contracted rate, cost variance, SLA penalties — the kind of thing this PRD explicitly keeps out of scope for the demo), the honest answer is "not yet built" (see `components/layout/route-stub.tsx`) rather than a plausible-looking placeholder.
