# UI principles

## Professional planner density, not a SaaS dashboard

Base type sizes in `app/dev/design-system` run 11–13px for body/labels, 15px for section titles, 20–22px only for genuine page/headline numbers. Tables default to a 36px row height (`--row-height-default` in `app/globals.css`), with a 30px compact option already tokenized for when a view needs more rows on screen. No card in the product should be justified by decoration alone — every bordered container in `components/ui/card.tsx` exists to group genuinely related controls or data, not to add visual rhythm.

Avoid on sight: giant KPI tiles with a single number and acres of whitespace, drop shadows deeper than `shadow-sm`-equivalent, gradients on anything but the active-nav accent bar, glow/pulse effects on "AI" surfaces, decorative icons that don't map to a real state.

## AI-first, but visual-first

`components/ai/ai-command-bar.tsx` is deliberately compact (a single input row, not a chat panel) and appears three places: the global `TopBar`, and it's designed to drop into a Gap Workspace or Scenario Lab's copilot pane unchanged (see `components/scenario/scenario-lab-view.tsx`'s right panel). Its job when wired to a real LLM is to call `lib/ai-tools/registry.ts` tools that mutate `stores/scenario-store.ts` — the visual workspace updates because real state changed, not because a chat bubble described a change.

## Semantic visual consistency — the two-token-set rule

`app/globals.css` defines two structurally separate color vocabularies, and the whole component library is built to never let them collide:

- **Risk / severity** (`--risk-positive` / `--risk-warning` / `--risk-critical`): status only. Used by `Badge`'s `positive|warning|critical` variants, `EffectiveCapacityChart`'s per-line percentage label, `ConfidenceBand`'s bar color. **Never used to color a data series.**
- **Planning state** (`--state-formal` / `-validated` / `-inferred` / `-scenario` / `-historical` / `-unknown`): the categorical palette for provenance layers in charts and tables — which segment of a stacked bar is committed load vs. AI-inferred vs. a planner's scenario adjustment. Used by `EffectiveCapacityChart`'s stacked segments, `PlanningGapChart`'s historical/expected series, `Badge`'s matching variants. **Never used as a status/severity signal.**

If a future component needs to show both a data series AND a status on the same mark (e.g., "this AI-inferred segment is also over threshold"), do it with a second visual channel — a border, an icon, a pattern — not by swapping the fill color between the two token sets.

## Methodology transparency without academic decoration

`components/methodology/methodology-badge.tsx` is a small pill (icon + short name) — it never grows to dominate a card. The actual detail (why this method, required inputs, editable parameters, limitations) lives behind a click, in `MethodologyDetails`. This matches the PRD's explicit rule (§8): "Methodology labels must not dominate the page. They are credibility and transparency controls, not academic decoration."

`components/planning/planning-basis-card.tsx` is the canonical "WHAT / BASIS / METHODOLOGY / CONFIDENCE / CONTROL" pattern (PRD §21) — reuse it rather than inventing a new layout per page. It intentionally does not show every possible field; it shows the headline result, the methodology badge, the confidence breakdown, and one action (Open in Scenario Lab). More detail belongs behind progressive disclosure, not packed into the card.

## Confidence — dimensions, not one number

`components/planning/confidence-band.tsx` always renders a per-dimension breakdown (`Confidence.dimensions`), with the overall score shown small, at the top, as a sort aid only. See `lib/planning-engine/scenarios.ts`'s confidence-assembly comment for why this matters concretely: a naive "average every BOM row's confidence" calculation looked fine in isolation but produced a meaningless wall of 100% bars for a demand gap built on an entirely formal BOM — the real uncertainty was in the forecast basis, not the material rows, and a single global score would have hidden that.

## Editable analytical basis, not a black box

Every Scenario Lab control (`components/scenario/scenario-lab-view.tsx`'s left panel) shows what basis is currently active (System / Historical / Scenario) before it shows an editable field, following PRD §18's language rule: never imply the system value is simply "wrong" — show System Assumption vs. Historical Performance vs. Scenario Value side by side and let the planner choose.

## Accessibility

- All interactive primitives in `components/ui/*` are built on Radix primitives (`@radix-ui/react-*`), which carry correct ARIA roles and keyboard behavior (tab order, `Escape` to close, arrow-key navigation in `Select`) for free.
- Focus is always visible: `app/globals.css`'s `:focus-visible` rule applies a 2px outline in the accent color to every focusable element, not just form inputs.
- Tooltips (`components/ui/tooltip.tsx`) are reserved for secondary detail, never for a control's only label.
- Chart text in `PlanningGapChart`/`EffectiveCapacityChart` stays at 11px minimum with real color contrast against both themes (verified visually in light and dark during this pass) — never a decorative 8–9px axis label.
