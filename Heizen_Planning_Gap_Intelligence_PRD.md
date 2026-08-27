# Heizen Planning Gap Intelligence Platform
## Product Requirements Document (PRD)

**Version:** 1.0  
**Prepared:** August 2026  
**Primary demo audience:** Keith Unton and professional supply-chain planners  
**Current product mode:** High-fidelity demo backed by coherent synthetic data  
**Current demo persona:** S&OP / Planning Lead Super Admin  
**Future direction:** Enterprise-grade RBAC, governed integrations, production data, and planner-specific permissions

---

# 1. Executive Summary

Heizen is a planning intelligence layer for the period in which a business already knows that something important is likely to happen, but the formal planning stack does not yet represent that future accurately enough for normal ERP, MRP, demand, capacity, or decision systems to reason about it.

The platform must help a professional planner answer five questions earlier than existing planning systems typically can:

1. **What important demand, business intent, product, material, or operational load is missing, incomplete, late, or potentially misrepresented in the formal plan?**
2. **Why does Heizen believe there is a gap, and what planning methodology and evidence were used?**
3. **Where will that gap create operational consequences across demand, line capacity, materials, timing, and decision runway?**
4. **What can the planner safely plan now despite incomplete information?**
5. **What changes if the planner alters assumptions, analogues, historical windows, BOM components, lead times, production allocations, or confidence levels?**

The product is deliberately not another ERP, MRP engine, APS, or Aera-like decision platform. Heizen should specialize in the gap between real-world business knowledge and the formal planning representation. Once the business situation is sufficiently represented and governed, downstream systems remain responsible for formal planning, optimization, transactions, and execution.

The demo must feel like a professional planning product, not a chatbot. AI is the universal interaction layer, but rich, information-dense, planner-familiar views remain primary. A planner should be able to type or speak a request from almost anywhere, and the system should navigate, filter, manipulate a scenario, change the analytical basis, or explain a result. The result of an AI request should usually be an updated visual planning workspace, not only a text answer.

The signature workflow is:

**AI Briefing -> Planning Gap -> Evidence & Basis -> Scenario Lab -> Capacity + Material Consequences -> Decision -> Monitor & Reconcile**

---

# 2. Product Thesis

## 2.1 Core product statement

> Heizen detects what the formal planning stack is missing, underrepresenting, or potentially misrepresenting; quantifies the operational consequence early; exposes the planning methodology and assumptions; lets planners manipulate those assumptions; and converts incomplete information into progressively actionable planning intelligence.

## 2.2 Core planning problem

A future requirement can be operationally real before it is digitally complete.

Examples:

- Halloween demand is expected, but not all seasonal SKUs exist yet.
- A festival spike is historically predictable, but the current formal demand plan is materially below the historical event pattern.
- A new product launch is likely, but final assortment, artwork, packaging, BOM, or customer split is unresolved.
- The item exists, but a planning attribute such as lead time, line assignment, run rate, or scrap factor appears inconsistent with historical execution.
- The formal capacity view appears unconstrained because unresolved future load is not represented.
- MRP cannot explode a finished-good requirement because the finished good or BOM is incomplete, even though stable raw materials can already be inferred with useful confidence.

## 2.3 Product boundary

### Existing ERP / planning stack
Answers:
- What is formally represented?
- What does the current represented demand imply?
- What material requirements follow from formal BOMs and demand?
- What capacity constraints exist against modeled demand and resources?
- What transactions should be created or executed?

### Heizen
Answers:
- What should reasonably be represented but is not?
- What business intent has not yet translated into operational planning objects?
- Which planning assumptions may be stale, incomplete, or inconsistent with actual history?
- What likely future load is hidden from current demand, material, or capacity views?
- What can be provisionally planned before all details are known?
- What changes when the planner changes assumptions?

### Aera / decision-intelligence layer
Conceptual downstream role:
- Given a sufficiently represented situation, what action should be recommended, coordinated, or executed?

**Important:** The exact production boundary with Aera must be validated against Hershey's actual Aera configuration and available Aera objects/APIs. The demo may simulate a downstream handoff but must label it as simulated.

---

# 3. What Is Validated vs. What Is a Product Hypothesis

## 3.1 High-confidence customer/problem validation

The following themes are strongly supported by Keith conversations and planner feedback:

- Seasonal/future items can be absent from the plan while MRP remains silent.
- A higher-level planning completeness/risk signal is valuable.
- Historical comparison and deadline/runway signals are useful.
- Analogous forecasting using prior-season items/BOMs is directionally valuable.
- Raw-material visibility before final SKU setup is valuable, especially to Keith.
- Manufacturing-line capacity is a major and broadly applicable consequence.
- Multi-line, before/after capacity visuals are especially compelling.
- Production timing can require earlier action than the sales timing suggests.
- Placeholder/provisional planning must reconcile when the formal item appears to avoid double counting or duplicate commitments.

## 3.2 Product hypotheses to validate

These are intentional product choices but not yet fully validated by Keith:

- One S&OP / Planning Lead Super Admin experience for the demo.
- ChatGPT-like universal AI control.
- Voice input.
- A single "Planning Gap" object as the product's primary conceptual unit.
- A generalized Scenario Lab spanning demand, capacity, materials, BOM, master assumptions, and analogues.
- Editable methodology/basis for every material AI inference.
- Generic Data Trust / historical-performance analysis as a platform capability.
- Exact Aera handoff semantics.
- Future RBAC model and role-specific controls.

## 3.3 Guardrail against scope drift

For every proposed feature, ask:

> If all required planning information were already formally represented and trusted, would SAP/Kinaxis/o9/Aera/another existing planning system already solve this well?

- If **yes**, Heizen should usually not rebuild that capability.
- If the value comes specifically from **missing, unresolved, late, uncertain, or questionable information**, it is in Heizen's core territory.

---

# 4. Demo User Model

## 4.1 Current demo persona: S&OP / Planning Lead Super Admin

For the demo, there is one user with full access.

The user can:

- View all Planning Gaps.
- Search and filter across all planning dimensions.
- Inspect demand, seasonal/event, new-product, BOM, material, capacity, and master-data implications.
- Inspect every AI inference and its basis.
- Change analytical windows, analogues, assumptions, and methodology parameters.
- Open any gap in Scenario Lab.
- Modify demand, production, material, and master assumptions.
- Save, clone, compare, discard, validate, and approve scenarios.
- Accept, reject, dismiss, snooze, or mark gaps intentional.
- Create a provisional planning assumption.
- Simulate a downstream handoff.
- See data provenance and trust.
- See reconciliation when formal data later appears.

## 4.2 Future RBAC vision

The product architecture must allow future role/action segmentation without requiring a data-model rewrite.

Potential future roles:
- Demand Planner
- Production / Capacity Planner
- Material Planner
- S&OP / IBP Lead
- Planning Systems / Admin

Potential future action permissions:
- View
- Comment
- Edit assumption
- Edit domain-owned input
- Validate
- Approve
- Publish
- Configure methodology
- Configure data source

**Demo requirement:** Do not expose this complexity in the main experience. The demo may mention that RBAC is planned, but all actions should work under the Super Admin persona.

---

# 5. Product Principles

## 5.1 AI-first, not chat-only

- AI must be available from almost every page.
- The planner can type or speak natural-language requests.
- AI can navigate, filter, manipulate, explain, compare, create scenarios, and alter analytical assumptions.
- The AI response should update the visual workspace whenever the task has a visual/planning representation.
- Chat text is supporting context, not the primary product surface.

## 5.2 Visual-first understanding

Keith and professional planners must be able to understand the situation visually before trusting an AI narrative.

Visuals should answer multiple related questions simultaneously and avoid generic SaaS card overload.

## 5.3 Planner familiarity

Use familiar supply-chain concepts and conventions:
- planning horizon
- formal plan
- forecast
- production window
- material lead time
- BOM
- line/resource utilization
- rough-cut capacity
- safety stock
- open supply
- scenario
- exception
- confidence
- deadline/runway

The product should feel modern but not alien.

## 5.4 Methodology transparency

Every material AI planning inference must be traceable to:
- the planning methodology used,
- the data basis,
- assumptions,
- historical window,
- analogues where applicable,
- confidence treatment,
- editable parameters.

## 5.5 AI recommends; planner controls

AI can choose a default analytical frame. The planner must be able to inspect and modify it.

Examples:
- AI recommends last 50 comparable POs; planner changes to 100.
- AI recommends last 3 Halloween seasons; planner changes to 5 and excludes a disruption year.
- AI recommends two analogues; planner replaces one.
- AI recommends P80 lead time; planner selects median or custom.

## 5.6 Progressive action under uncertainty

Do not require the entire product/BOM/supplier/packaging state to be known before supporting planning.

The platform should answer:

> Which parts of the future requirement are stable enough to plan now, which should be monitored, and which should wait?

## 5.7 Scenario safety

- Scenario manipulation never silently changes the formal plan.
- Scenario state and formal-plan state must always be visibly distinct.
- Publishing must be a separate governed action.
- Demo publishing is simulated.

## 5.8 Reconciliation is first-class

When formal items/demand/BOMs arrive, provisional assumptions must be matched, reduced, replaced, or closed to prevent double counting.

---

# 6. Planning Gap Taxonomy

The primary product object is a **Planning Gap**.

A Planning Gap is a meaningful mismatch between what the business/planner should reasonably account for and what the formal planning model currently represents or assumes.

## 6.1 Gap Type A: Demand / Event Gap

Examples:
- Halloween demand underrepresented.
- Diwali uplift materially below historical festival behavior.
- Promotion not reflected in formal forecast.
- Business growth target not reflected in plan.
- Customer seasonal expectation not represented.

Typical methods:
- seasonal/event forecasting
- historical pattern analysis
- business-to-plan reconciliation
- rolling horizon comparison

## 6.2 Gap Type B: Representation / Future-Item Gap

Examples:
- seasonal SKU expected but not created.
- future customer assortment not finalized.
- NPI exists at concept level but not formal SKU level.
- aggregate revenue target exists without detailed operational representation.

Typical methods:
- analogous forecasting
- historical predecessor/successor mapping
- family-level planning
- provisional representation

## 6.3 Gap Type C: BOM / Material-Readiness Gap

Examples:
- full BOM incomplete but stable ingredients predictable.
- packaging uncertain while raw ingredients are stable.
- exact material spec unknown but material family exposure is actionable.

Typical methods:
- analogue BOM decomposition
- partial BOM explosion
- confidence-based component filtering
- lead-time prioritization

## 6.4 Gap Type D: Planning Assumption / Master-Data Mismatch

Examples:
- ERP lead time 42 days while relevant receipts show 67-day median.
- standard run rate 10,000 units/hour while historical median is 7,950.
- routing says Line 03 while 84% of actual runs occurred on Line 04.
- master scrap factor materially below observed consumption loss.

Typical methods:
- historical performance analysis
- master-vs-observed comparison
- outlier-controlled distributions
- planner-selected planning basis

## 6.5 Gap Type E: Derived Operational Consequence

Usually produced by one or more upstream gaps:
- line capacity appears safe formally but becomes constrained after unresolved load.
- material decision deadline is earlier after observed lead time is used.
- production must be prebuilt to avoid peak-period capacity overflow.
- material planning can start for stable components even while packaging remains unresolved.

Typical methods:
- RCCP
- MRP-style material explosion
- scenario planning
- constraint analysis
- production leveling

---

# 7. Planning Methodologies Used by the Platform

The platform should use recognized planning methods behind the scenes and make them visible when useful.

## 7.1 Business-to-Plan Reconciliation

Purpose:
Compare aggregate business expectation with what is operationally represented.

Inputs:
- business target / growth assumption
- seasonal/event expectation
- current formal demand
- current item coverage

Outputs:
- represented amount
- unresolved amount
- unexplained variance
- completeness ratio

## 7.2 Seasonal / Event-Based Forecasting

Purpose:
Estimate expected event-level demand using comparable historical events and current business drivers.

Editable parameters:
- number of seasons
- included/excluded years
- event alignment
- customer/channel filters
- recent-period weighting
- growth factor
- promotion factor
- confidence range

## 7.3 Analogous Forecasting

Purpose:
Estimate future demand/production/BOM behavior for a not-yet-created product using comparable prior items.

Editable parameters:
- analogue selection
- similarity dimensions
- analogue weights
- event filter
- channel/customer filter
- production-line similarity
- pack-format similarity
- formulation similarity

## 7.4 Rough-Cut Capacity Planning (RCCP)

Purpose:
Translate formal plus unresolved demand into major line/resource load before detailed scheduling is possible.

Editable parameters:
- product-to-line mapping
- line allocation
- run rate
- available hours
- planned downtime
- target headroom
- utilization threshold
- production window
- scenario confidence percentile

## 7.5 Partial / Pre-MRP BOM Explosion

Purpose:
Estimate which material requirements are actionable before the full finished-good BOM is formal.

Logic:
- take provisional/analogue demand
- apply analogue or known BOM structure
- calculate gross component demand
- classify component confidence/readiness
- optionally subtract inventory/open supply
- offset by lead time
- show provisional exposure

This is not a replacement for formal MRP.

## 7.6 Historical Performance Analysis

Purpose:
Compare planning master assumptions with relevant execution history.

Editable parameters:
- observation count
- date range
- supplier/material/product filters
- contract period
- plant/line
- outlier handling
- statistic: median / mean / P80 / P95 / custom

## 7.7 Scenario Planning

Purpose:
Evaluate multiple plausible futures rather than asserting one deterministic forecast.

Supported forms:
- baseline / low / base / high
- P50 / P80 / P95
- custom scenario branches
- AI-generated alternative scenarios

## 7.8 Rolling-Horizon Reconciliation

Purpose:
Continuously replace provisional assumptions with formal information as uncertainty resolves.

Expected lifecycle:
- inferred
- partially validated
- operationally validated
- approved provisional
- formalized
- reconciled
- closed

## 7.9 Production Leveling / Pull-Forward

Purpose:
Reduce peak line overload by moving feasible production earlier.

Editable constraints:
- maximum pull-forward weeks
- frozen horizon
- minimum headroom
- maximum inventory build
- eligible product families
- storage limits if modeled

## 7.10 Exception-Based Planning

Purpose:
Prioritize planner attention on material deviations, not everything in the plan.

Examples:
- completeness below expected
- effective capacity above threshold
- deadline within X weeks
- master-vs-history deviation above threshold
- unresolved business value above threshold
- low BOM readiness on long-lead components

---

# 8. Methodology Transparency Pattern

Every major inference should support a **View Method / View Basis** interaction.

Example:

**Finding:** Line 03 may reach 97% utilization in September.

**Method:** RCCP

**Why this method:** Exact SKU-level production orders are incomplete, but sufficient product-family and line history exists to estimate major resource load.

**Basis:**
- current formal line load
- expected unresolved Halloween demand
- product-family-to-line historical mapping
- planner-selected run rate
- available line hours
- 10% target headroom
- P80 demand assumption

Actions:
- View methodology
- Edit basis
- Open in Scenario Lab
- Ask AI to explain

**Rule:** Methodology labels must not dominate the page. They are credibility and transparency controls, not academic decoration.

---

# 9. Information Architecture

## 9.1 Primary navigation for the demo

1. **AI Briefing**
2. **Planning Gaps**
3. **Plan Horizon**
4. **Capacity**
5. **Materials**
6. **Scenario Lab**
7. **Decisions**
8. **Data & Integrations**

## 9.2 Global controls

Always available:
- global search
- Ask Heizen text input
- voice/microphone trigger in supported browser/demo environment
- planning horizon selector
- event/season selector
- plant/line selector
- business unit/product family selector
- scenario state indicator
- saved scenario access
- notifications / changes since last visit

## 9.3 Primary dimensions

The same data should be pivotable across:
- event / season
- time period
- customer/channel if modeled
- product family
- SKU when known
- plant
- line/resource
- material family
- component
- supplier when included
- gap type
- confidence
- status

---

# 10. End-to-End Super Admin Flow

## 10.1 Login

Entry:
- SSO-style demo login or direct authenticated demo session.

System resolves:
- demo user = Planning Lead / Super Admin
- all permissions granted
- default planning horizon
- most recent briefing timestamp

Exit criteria:
- AI Briefing loads with synthetic current-state data.

## 10.2 AI Briefing

Purpose:
Tell the planner what changed, what is missing, and what needs attention.

The briefing must include:
- count of new/changed gaps
- number requiring action soon
- highest-risk capacity issue
- highest-risk material issue
- largest business-to-plan gap
- significant methodology/basis changes
- scenario changes saved since last visit

Actions:
- open gap
- ask AI
- filter briefing
- snooze
- dismiss
- mark intentional
- open related Capacity/Materials view
- open directly in Scenario Lab

## 10.3 Planning Gap Workspace

On open, the user must immediately see:

### What did Heizen find?
Plain-language gap statement.

### Why does Heizen think this?
Evidence summary and planning method.

### What does it affect?
Demand, capacity, materials, timing, business exposure.

### When does it matter?
Decision runway, production deadline, material deadline.

Primary actions:
- View evidence
- View methodology
- Edit basis
- Ask AI
- Open in Scenario Lab
- Dismiss
- Mark intentional
- Monitor
- Validate
- Save/share

## 10.4 Evidence & Basis

The planner can inspect:
- source systems/datasets
- historical periods used
- exact sample count
- filters
- excluded periods
- analogues
- analogue weighting
- business assumptions
- formulas/logic summary
- confidence treatment
- master vs historical value
- data freshness

The planner can change:
- history window
- sample count
- event years
- customer/channel/product filters
- analogue selection
- analogue weights
- statistic (median/P80/etc.)
- scenario value

All downstream inference must recalculate.

## 10.5 Scenario Lab

Any gap can be opened directly in Scenario Lab.

The lab must load context automatically rather than begin blank.

It contains:
- baseline
- Heizen recommended scenario/basis
- editable assumptions
- visual impact
- AI copilot
- scenario history
- scenario comparison

## 10.6 Decision

After experimentation, the user can:
- discard scenario
- save private scenario
- clone scenario
- name scenario
- compare scenarios
- mark preferred
- validate a planning assumption
- keep monitoring
- simulate approval/publish
- simulate send-to-downstream-system

## 10.7 Monitoring and Reconciliation

The agent monitors synthetic source changes.

When formal data appears:
- identify corresponding provisional assumption
- show formal vs provisional
- calculate overlap
- reconcile net load
- avoid double count
- mark difference
- update confidence/learning
- close or reopen gap

---

# 11. AI Briefing Detailed Requirements

## 11.1 Layout

Top zone:
- concise morning/returning-user narrative
- critical count
- "action within X weeks" count
- Ask Heizen input

Main zone:
- ranked gap feed
- each gap visually shows type, status, impact, runway, confidence, change since prior review

Secondary zone:
- horizon summary
- multi-line risk sparkline/heatmap
- material decision deadlines

## 11.2 Example briefing cards

### Seasonal Demand Gap
**Halloween assortment appears underrepresented**
- formal demand: 3.8M
- expected: 4.5-4.9M
- unresolved: 0.7-1.1M
- Line 03 effective load: 94-101%
- earliest decision: 6 weeks

### Master Assumption Gap
**Printed film lead time may be optimistic**
- system assumption: 42 days
- historical median: 67 days
- P80: 81 days
- affected planning signals: 18

### New Product / BOM Readiness Gap
**Valentine Premium Tin can be partially planned**
- exact SKU: unresolved
- stable material value: 71%
- 3 components: Plan now
- 2: Review
- 2: Wait

## 11.3 Ranking logic

Default ranking should consider:
- decision runway
- business magnitude
- capacity severity
- material severity
- confidence
- change since previous state
- irreversibility

The exact scoring model may be synthetic in the demo but must be deterministic and explainable.

---

# 12. Planning Gap Workspace Detailed Requirements

## 12.1 Header

Must show:
- gap name
- gap type
- event/season
- time window
- risk/status
- confidence
- last recalculated timestamp
- source freshness indicator

Primary CTAs:
- Open in Scenario Lab
- Ask Heizen
- Validate
- Monitor
- More actions

## 12.2 Executive conclusion band

Four compact statements:
1. What Heizen found
2. Why it matters
3. When it becomes a problem
4. What the planner should consider next

## 12.3 Planning-gap visual

Must be able to show:
- historical actual
- current formal plan
- expected/inferred range
- unresolved gap
- intentional exits if applicable
- confidence band
- planning completeness
- production vs sales window where relevant

Interactions:
- click month to cross-filter entire page
- toggle units/value
- toggle formal/inferred/validated
- hover/tap reveals exact numbers
- select historical season

## 12.4 Evidence panel

Evidence examples:
- past season item counts
- historical production/shipment
- business growth assumption
- known NPI count
- event calendar
- product-family mapping
- analogue set

Each evidence row must show:
- source
- date/freshness
- whether system or planner supplied
- confidence/quality state

## 12.5 Methodology panel

Must show:
- active method(s)
- why selected
- input basis
- editable assumptions
- direct action: Change method/basis

---

# 13. Scenario Lab: Core Product Surface

## 13.1 Purpose

The Scenario Lab gives a professional planner Excel-like freedom to manipulate assumptions while preserving the connected planning dependency model and high-quality visual feedback.

It is not a static what-if form. It is the main decision-development environment.

## 13.2 Entry points

- Open any Planning Gap in Scenario Lab
- Start from Capacity view
- Start from Materials view
- Clone a saved scenario
- Ask AI to create a scenario
- Create blank scenario from baseline

## 13.3 Workspace structure

### Left: Assumptions / Controls
Editable planning variables grouped by category.

### Center: Visual impact
High-density charts that update live.

### Right: AI Scenario Copilot
Natural language, explanation, recommended next action, methodology explanation.

### Top: Scenario state
- baseline / scenario name
- unsaved changes
- clone
- compare
- reset
- save
- validate

## 13.4 Live recalculation rule

Changes should recalculate immediately whenever feasible.

Avoid a generic "Run Model" button for common parameter changes.

If a heavier demo calculation requires a short delay:
- show explicit recalculating state
- preserve current view
- update affected visuals together

## 13.5 Demand controls

Editable:
- baseline demand
- seasonal uplift
- growth rate
- customer/business probability
- event probability
- expected volume
- expected value
- production window
- sales window
- demand distribution across months
- low/base/high or percentile selection

## 13.6 Historical-basis controls

Editable:
- last N seasons
- last N years
- custom period
- exclude year
- include only comparable period
- channel/customer filter
- product-family filter
- recent-season weighting
- equal weighting
- custom weighting

AI behavior:
- recommend a default
- explain why
- allow natural-language modification

## 13.7 Analogue controls

Editable:
- add analogue
- remove analogue
- change weight
- choose similarity basis
- choose predecessor
- filter by event
- filter by product format
- filter by manufacturing line
- filter by formulation
- filter by customer/channel

Display for each analogue:
- similarity score
- same/different attributes
- history quality
- BOM availability
- line history

## 13.8 BOM controls

Editable:
- include component
- exclude component
- quantity per unit
- yield
- scrap
- substitute
- stable/unstable designation
- planning readiness
- confidence override with reason

## 13.9 Master-assumption controls

For every important planning field support:
- System Value
- Historical/Observed Value
- Scenario Value

Examples:
- lead time
- run rate
- routing/line
- scrap
- yield
- capacity calendar

## 13.10 Capacity controls

Editable:
- line allocation
- available hours
- target utilization
- headroom
- run rate
- changeover/downtime if modeled
- production window
- maximum pull-forward
- prebuild amount
- additional shift/overtime capacity

## 13.11 Material controls

Editable:
- material lead time
- safety stock
- on-hand inventory
- open supply
- component inclusion
- material-family confidence
- provisional requirement treatment

## 13.12 Scenario comparison

Support at least four columns:
- Baseline
- Scenario A
- Scenario B
- Scenario C

Metrics:
- expected demand
- unresolved demand
- line utilization
- peak month
- material exposure
- earliest deadline
- service risk
- inventory build if modeled
- confidence

## 13.13 Scenario actions

- Reset change
- Reset category
- Reset all
- Undo/redo within demo session
- Save
- Save As
- Clone
- Rename
- Delete scenario
- Compare
- Mark preferred
- Add note
- Validate
- Simulate publish

## 13.14 AI commands in Scenario Lab

Examples:
- "Use the past five Halloween seasons, but exclude 2023."
- "Use P80 lead time instead of median."
- "Keep Line 03 below 90%."
- "Shift whatever can be prebuilt into August."
- "Don't plan packaging yet; keep only raw ingredients."
- "Replace Mother's Day Tin with Christmas Premium Tin as an analogue."
- "Show me the lowest-capacity-risk scenario."
- "What assumption is driving the largest change?"
- "Why did the material deadline move earlier?"

AI must perform the change where allowed, summarize it, and highlight what visually changed.

---

# 14. Capacity Intelligence

## 14.1 Capacity page purpose

Give the planner a portfolio view of formal and unresolved load across multiple lines and months.

## 14.2 Multi-line heatmap

Rows:
- production lines/resources

Columns:
- weeks or months

Cell encoding:
- formal utilization
- effective utilization including unresolved load
- risk band

Click cell:
- open detail
- show contributing gaps
- open Scenario Lab

## 14.3 Signature effective-capacity visual

Must show in one visual:
- formal load
- validated unresolved load
- AI-inferred load
- scenario adjustment
- capacity ceiling
- target headroom
- P50/P80 uncertainty band

## 14.4 Before/after scenario view

Example:
- Before: September 106% effective utilization
- After: 88% after prebuild and line shift

Must also show:
- hours moved
- months moved to/from
- new material-deadline effect
- affected lines

## 14.5 Constraint explanation

AI should explain:
- which product/event caused the overflow
- whether the overflow is driven by demand, run rate, line mapping, or availability
- which alternative variable is most effective to change

---

# 15. Materials and Partial BOM Planning

## 15.1 Materials page purpose

Show what materials can be planned early despite incomplete finished-good information.

## 15.2 Material-readiness states

At minimum:
- **Plan now**
- **Review**
- **Monitor**
- **Wait**
- **Unknown**

## 15.3 Material-readiness visual

For each component show:
- component/material family
- expected requirement range
- confidence
- lead time
- current inventory/open supply if modeled
- earliest decision date
- readiness state
- reason

## 15.4 BOM decomposition tree

Root:
- unresolved/new/seasonal product family

Branches:
- raw materials
- packaging materials
- conversion components

Each node can show:
- known vs inferred
- confidence
- analogue source
- unit requirement
- lead time
- readiness

## 15.5 Planner actions

- include/exclude from provisional plan
- change analogue
- change consumption rate
- change scrap/yield
- switch statistic/percentile
- change lead time basis
- open related capacity implication
- open in Scenario Lab

## 15.6 Important material-planning rule

A full BOM is not required for the platform to surface partial actionability.

Example:
- cocoa: plan now
- sugar: plan now
- milk solids: plan now
- foil: review
- tin: review
- printed wrapper: wait
- artwork: unknown

The platform should never imply that uncertain packaging can be ordered simply because stable raw materials are predictable.

---

# 16. Seasonal, Festival, and Event Intelligence

## 16.1 Event object

Fields:
- event name
- market/region
- sales window
- production window
- historical comparable events
- current business growth
- customer/channel relevance
- current formal plan
- expected demand range
- confidence

## 16.2 Supported event examples for demo

- Halloween
- Christmas/Holiday
- Valentine's
- Retailer Fall Reset

Optional international demo event:
- Diwali

## 16.3 Event comparison controls

- compare past 2/3/5 seasons
- custom season set
- exclude atypical year
- weighted recent history
- compare same calendar period
- compare same event-relative week

## 16.4 Production-vs-sales timing

Must explicitly model that the production curve may lead the sales curve.

Views should distinguish:
- sell/ship window
- production window
- material order-by window
- setup/formalization deadline

---

# 17. New Product / NPI Analogue Planning

## 17.1 Trigger

Use when:
- exact product history does not exist
- product is not fully formalized
- final assortment/spec is incomplete

## 17.2 Analogue recommendation

AI proposes a ranked set using available similarity dimensions.

Example display:
- analogue name
- similarity score
- same dimensions
- different dimensions
- data quality

## 17.3 Planner controls

- accept analogue
- reject analogue
- add manual analogue
- change weights
- blend analogues
- ask AI for alternatives

## 17.4 Analogue-derived outputs

May include:
- demand envelope
- production timing
- likely line
- BOM component families
- material consumption
- lead-time exposure

Exact SKU-level claims must remain clearly distinguished from family-level/provisional estimates.

---

# 18. Master Data / Historical Performance Intelligence

## 18.1 Terminology

Prefer UI language:
- **System Assumption**
- **Historical Performance**
- **Scenario Value**

Avoid presenting "observed actual" as a self-evident truth.

## 18.2 Examples

### Lead time
System assumption: 42d  
Historical median: 67d  
Historical P80: 81d  
Scenario: 70d

### Run rate
System assumption: 10,000/hr  
Historical median: 7,950/hr  
Scenario: 8,200/hr

## 18.3 Evidence drilldown

For lead time:
- PO date
- goods-receipt date
- elapsed days
- supplier
- material family
- excluded/flagged orders

For run rate:
- production order
- line
- quantity
- runtime
- computed units/hour

## 18.4 Editable analytical basis

Planner can change:
- last 50 -> last 100 orders
- past 12 -> 24 months
- supplier only
- supplier+material family
- post-contract-only data
- exclude abnormal disruption
- median -> P80

AI recommends default and explains why.

## 18.5 Important trust rule

Heizen must not claim the ERP value is wrong merely because history differs.

It should say:

> Historical performance materially differs from the current planning assumption. Review recommended.

Possible reasons:
- contractual lead time differs from actual elapsed process time
- abnormal disruption
- internal approval delay
- intentional production delay
- data-quality issue

---

# 19. Decision Runway

## 19.1 Purpose

Make time-to-irreversibility visible.

## 19.2 Timeline layers

Show:
- today
- business confirmation point
- SKU/item setup target
- material order-by date
- supplier capacity decision
- production start
- prebuild window
- sales/ship window
- frozen horizon if modeled

## 19.3 Dynamic deadline logic

A deadline may move earlier when:
- lead time increases
- capacity is constrained
- production must be pulled forward
- a material becomes the active constraint

## 19.4 Visual output

The planner should be able to see:
- weeks remaining
- which deadline is earliest
- what changed the deadline
- how scenario changes affect runway

---

# 20. Decisions

## 20.1 Decision states

- Open
- Monitoring
- Scenario saved
- Validated
- Preferred
- Approved provisional
- Simulated published
- Reconciled
- Closed

## 20.2 Planner choices from a gap

- Dismiss
- Mark intentional
- Snooze
- Monitor
- Save scenario
- Validate inference
- Approve provisional assumption
- Simulate downstream handoff

## 20.3 Planning Assumption object

Suggested fields:
- assumption ID
- linked gap(s)
- event/season
- product family
- time period
- expected volume/value
- P50/P80 or range
- likely resource/line
- material families
- component readiness
- methodology
- basis summary
- confidence by dimension
- planner-selected scenario
- status
- created/updated date
- reconciliation trigger
- expiry date if applicable

---

# 21. Reconciliation and Double-Count Prevention

## 21.1 Trigger

Formal SKU/demand/BOM/planning object appears that likely corresponds to provisional load.

## 21.2 System behavior

- match provisional to formal
- show match confidence
- show overlap
- show net new amount
- allow planner confirmation
- subtract replaced provisional amount
- retain unmatched residual if appropriate

## 21.3 Example

Provisional seasonal load: 500k  
New formal demand: 420k  
Matched: 420k  
Residual unresolved: 80k

The platform must not count 920k.

## 21.4 Reconciliation visual

Show a waterfall:
- prior provisional
- newly formalized
- replaced amount
- residual unresolved

---

# 22. AI Interaction Model

## 22.1 Global AI capabilities

From any supported page, AI can:
- navigate
- filter
- explain
- modify basis
- create scenario
- change scenario
- compare scenarios
- summarize risk
- identify active constraint
- locate evidence
- surface methodology

## 22.2 AI response format

When action is taken:
1. state what changed
2. update visuals
3. show major downstream impact
4. preserve undo/reset

Example:

> I changed the Halloween history basis from 3 to 5 seasons and excluded 2023. Expected unresolved demand fell from 0.9M to 0.7M units. Line 03 P80 utilization moved from 98% to 94%. Printed film remains the earliest constraint.

## 22.3 AI explainability

Questions supported:
- Why did you choose this method?
- Why did you use these analogues?
- What data drove this result?
- What assumption matters most?
- Why did this deadline move?
- What would make confidence improve?

## 22.4 Voice

For demo/product vision:
- microphone entry point visible
- voice treated as input equivalent to text
- no separate voice-only workflow
- transcript should appear before/after action for transparency

---

# 23. Visualization System

## 23.1 General standards

- High information density without clutter.
- Planner-familiar axes, units, labels, legends.
- Baseline/formal state always distinguishable from provisional/inferred/scenario state.
- Uncertainty should be shown as ranges/bands, not hidden behind single numbers.
- Critical deadlines must be visible in context.
- Charts cross-filter related panels where possible.
- Important values should be accessible numerically as well as visually.

## 23.2 Signature Visual 1: Planning Gap Curve

Show:
- historical actual
- current formal plan
- expected envelope
- unresolved gap
- confidence band
- event/production/sales windows

Questions answered:
- How much appears missing?
- Is this normal for this point in the cycle?
- How does this year compare to prior seasons?

## 23.3 Signature Visual 2: Effective Capacity

Show:
- formal load
- validated unresolved
- AI inferred
- scenario change
- P50/P80
- capacity ceiling
- target headroom

Questions answered:
- Does the line only look safe because demand is absent?
- How much capacity is at risk?
- What happens under the selected scenario?

## 23.4 Signature Visual 3: Material Readiness / BOM Tree

Show:
- component hierarchy
- requirement range
- confidence
- lead time
- readiness
- known/inferred status

Questions answered:
- What can be planned now?
- What should wait?
- Which component sets the deadline?

## 23.5 Signature Visual 4: Decision Runway

Show:
- today
- order-by dates
- capacity deadline
- production window
- sales window
- remaining weeks

Questions answered:
- How long can I wait?
- What becomes irreversible first?

## 23.6 Signature Visual 5: Scenario Comparison

Show multiple scenarios and:
- line utilization
- demand
- material exposure
- deadline
- confidence
- inventory/service impact if modeled

---

# 24. Plan Horizon

## 24.1 Purpose

Show how planning completeness and certainty evolve across the future horizon.

## 24.2 Horizon visual

For each future month/period show:
- formal demand
- unresolved/inferred demand
- number of expected vs created items
- confidence
- gap count
- earliest decision risk

## 24.3 Rolling-horizon maturity

Example:
- 12 months out: business intent high, exact SKU low
- 9 months out: product family and line medium/high
- 6 months out: material family more certain
- 3 months out: formal SKU/BOM mostly present

The platform should visibly show inference retiring as formalization improves.

---

# 25. Data & Integrations

## 25.1 Demo representation

Show synthetic integrations as **DEMO / SYNTHETIC**.

Potential cards:
- SAP S/4HANA
- SAP IBP or Kinaxis
- Aera Decision Cloud
- MES
- PLM/NPI source
- Finance / business plan

## 25.2 Source categories

### Business intent
- growth plans
- financial plan
- seasonal outlook
- commercial/customer expectations

### Current plan
- demand plan
- item master
- MRP/supply plan
- capacity plan

### Product structure
- item/product master
- BOM
- routing/resource mapping
- NPI/PLM data

### Execution history
- production confirmations
- shipments
- purchase orders
- goods receipts
- actual material consumption

## 25.3 Data freshness

Each dataset should support:
- source name
- last sync
- record count
- freshness status
- quality/trust indicator

---

# 26. Data Model

## 26.1 Planning Gap

Core fields:
- id
- title
- type
- status
- severity
- event_id
- product_family_id
- customer/channel optional
- plant/resource optional
- material optional
- start/end period
- formal_value
- expected_value
- unresolved_value
- confidence
- earliest_deadline
- methodology_ids
- evidence_ids
- linked_scenarios
- linked_assumption

## 26.2 Evidence Signal

- source
- source object
- date range
- value
- quality
- freshness
- included/excluded
- filter definition
- analyst/AI rationale

## 26.3 Methodology Config

- method
- parameters
- historical window
- percentile/statistic
- analogue set
- weights
- filters
- planner overrides

## 26.4 Scenario

- id
- name
- parent scenario
- baseline reference
- linked gap(s)
- assumption overrides
- calculated outputs
- created timestamp
- updated timestamp
- status

## 26.5 Product / Item / Family

- product family
- SKU if known
- event tags
- customer/channel optional
- pack format
- formulation family
- historical analogues

## 26.6 BOM / Components

- parent
- component
- quantity
- UOM
- component family
- known/inferred
- confidence
- readiness
- source analogue

## 26.7 Resource / Capacity

- plant
- resource/line
- period
- available hours
- planned downtime
- target utilization
- formal load
- provisional load
- scenario load

## 26.8 Historical Performance

Examples:
- PO-to-GR elapsed days
- run rate
- scrap
- line usage
- actual consumption

Must retain the source record IDs for drilldown in the demo dataset.

---

# 27. Synthetic Demo Dataset

## 27.1 Events

- Halloween 2027
- Holiday / Christmas 2027
- Valentine's 2028
- Walmart Fall Reset

## 27.2 Product families

- Variety Bags
- Gift Tins
- Counter Displays
- Molded Novelty

## 27.3 Manufacturing lines

At least 4:
- Line 01
- Line 02
- Line 03
- Line 04

Ensure:
- one consistently constrained line
- one flexible alternate line
- different run rates
- at least one line-mapping anomaly

## 27.4 Materials

At least:
- Cocoa
- Sugar
- Milk solids
- Printed Film
- Foil
- Corrugate
- Tray
- Tin / Trim

## 27.5 Historical data

Include:
- 3-5 years event history
- formal plan snapshots by date
- actual production/shipments
- product-family line history
- BOMs
- purchase orders/goods receipts
- lead-time history
- run-rate history

## 27.6 Coherence requirement

Every demo number must reconcile across pages.

Example:
If unresolved Halloween demand rises by 200k units:
- line hours must increase consistently
- BOM requirements must increase consistently
- material exposure must update consistently
- deadline may change only according to lead-time/capacity logic

No hard-coded contradictory charts.

---

# 28. Golden Demo Scenarios

## 28.1 Golden Scenario A: Halloween Hidden Capacity

Story:
- current formal demand underrepresents likely seasonal demand
- historical event analysis identifies unresolved load
- unresolved load maps mainly to Line 03
- formal utilization appears ~70%; effective utilization exceeds target
- Scenario Lab tests demand range and line shift/prebuild
- planner selects feasible scenario

Must demonstrate:
- AI Briefing
- gap curve
- methodology basis
- editable history window
- capacity impact
- decision runway
- Scenario Lab
- before/after

## 28.2 Golden Scenario B: New Product Partial BOM

Story:
- new Valentine's product has no exact history
- AI proposes analogues
- planner changes analogue mix
- BOM decomposition identifies stable raw ingredients and uncertain packaging
- planner chooses to plan cocoa/sugar while waiting on wrapper

Must demonstrate:
- analogue transparency
- editable analogue basis
- component confidence/readiness
- partial planning
- material deadline

## 28.3 Golden Scenario C: Master Assumption Changes Risk

Story:
- ERP printed-film lead time = 42d
- historical performance suggests 67d median / 81d P80
- planner changes sample from 50 to 100 orders or switches statistic
- deadline moves
- capacity/demand stays same
- risk changes because time changed

Must demonstrate:
- system vs historical vs scenario value
- raw evidence drilldown
- editable analytical basis
- impact propagation

## 28.4 Reconciliation Epilogue

After scenario acceptance:
- new formal SKU appears
- platform matches it to provisional load
- provisional amount is reduced
- no double counting

---

# 29. Detailed Action Inventory

## 29.1 Gap actions
- Open
- Ask AI
- View evidence
- View methodology
- Edit basis
- Open in Scenario Lab
- Monitor
- Snooze
- Dismiss
- Mark intentional
- Validate
- Add note
- Save/share

## 29.2 Evidence actions
- include/exclude source row
- change period
- change sample size
- change filter
- inspect raw records
- mark atypical/outlier with reason
- reset to AI recommendation

## 29.3 Analogue actions
- accept
- reject
- add
- remove
- weight
- filter
- ask for alternative
- inspect similarities/differences

## 29.4 BOM actions
- include component
- exclude component
- substitute
- change consumption rate
- change scrap/yield
- set readiness
- inspect source analogue

## 29.5 Capacity actions
- change allocation
- change run rate
- change available hours
- change headroom
- pull forward
- add shift capacity
- change production window
- reset

## 29.6 Material actions
- change lead time
- switch system/historical/scenario value
- change safety stock
- change inventory/open supply in scenario
- include/exclude provisional requirement

## 29.7 Scenario actions
- create
- clone
- rename
- save
- compare
- reset
- undo/redo
- mark preferred
- validate
- delete
- simulate publish

---

# 30. Interaction and UX Requirements

## 30.1 Familiar professional-planner behavior

- dense tables allowed when appropriate
- sortable/filterable grids
- sticky headers where needed
- direct numeric editing in Scenario Lab
- keyboard-friendly controls where feasible
- quick reset to baseline
- visible units everywhere
- no hidden destructive changes

## 30.2 Progressive disclosure

Default view:
- conclusion
- major visuals
- decision urgency

Expandable:
- methodology
- evidence
- raw records
- formulas/assumptions

## 30.3 Cross-filtering

Selecting a month, line, product family, material, or gap should update related panels where feasible.

## 30.4 State clarity

Always visibly distinguish:
- formal
- validated provisional
- AI-inferred
- scenario
- historical actual

## 30.5 Empty states

If no gap:
- say the plan appears complete under current method/basis
- show methodology and scope used
- offer to broaden history/window or ask AI

If insufficient data:
- do not fabricate
- show what is missing
- show what can still be calculated
- allow planner to provide assumption manually

---

# 31. Confidence Model

## 31.1 Do not rely on one global confidence score

Support confidence by dimension:
- business intent
- demand magnitude
- event timing
- product family
- exact SKU
- line/resource
- material family
- exact material/spec
- analogue quality
- historical-data quality

## 31.2 Confidence and actionability

The product should not hard-code one universal threshold for action.

Instead show:
- confidence
- decision runway
- reversibility
- action type

Example:
- Cocoa 92% confidence + long lead time -> Plan now
- Foil 72% -> Review
- Printed wrapper 29% -> Wait

These rules can be demo-configured and should remain explainable.

---

# 32. Auditability and Provenance

Every important inference must retain:
- methodology
- input datasets
- source timestamps
- planner overrides
- previous value
- new value
- who/what changed it
- scenario ID
- reason if manual override

For the demo, show an Activity / Reason trail even if backed by synthetic data.

---

# 33. Integrations and Downstream Handoff

## 33.1 Demo only

Show integration cards as connected synthetic systems.

## 33.2 Handoff object

When planner approves a provisional assumption, create a structured object containing:
- situation/gap
- time window
- formal load
- approved provisional load
- expected resource/material impact
- confidence
- deadline
- permitted action type
- provenance

## 33.3 Aera simulation

Action:
**Send decision context to Aera**

UI must state:
- Simulated demo handoff
- No live Aera write occurred

Possible status:
- Prepared
- Sent (simulated)
- Awaiting recommendation (simulated)

---

# 34. Non-Goals for the Demo

Do not build:
- full production MRP
- real ERP writeback
- live purchase-order creation
- supplier portal
- detailed finite scheduling
- complete APS optimization
- full Aera replacement
- multi-user RBAC workflows
- enterprise-grade authentication complexity
- real microphone processing if environment does not support it; UI may simulate/represent voice entry

---

# 35. Acceptance Criteria for the High-Fidelity Demo

## 35.1 Product-level acceptance

A professional planner should be able to:
1. Understand why a gap exists within 30-60 seconds of opening it.
2. See the operational consequence without reading a long explanation.
3. Inspect the methodology and data basis.
4. Change the basis and see the inference update.
5. Open the gap in Scenario Lab.
6. Change at least demand, history window, analogue/BOM, lead time, and capacity assumptions.
7. See live updates across demand, capacity, materials, and runway.
8. Compare at least three scenarios.
9. Save/validate a preferred scenario.
10. See how the provisional assumption reconciles when formal data appears.

## 35.2 Visual acceptance

- No generic-dashboard feel.
- At least five information-dense signature visuals.
- Formal vs inferred vs scenario states immediately distinguishable.
- Capacity view supports many lines.
- BOM/material view communicates partial readiness.
- Decision runway is clear.
- AI can modify the visual workspace.

## 35.3 Trust acceptance

For every headline number, the user can reach:
- method
- basis
- data sample/window
- source
- planner override

---

# 36. Evaluation Questions for Keith / Planner Testing

Do not primarily ask "Do you like this?"

Ask:

## Problem/actionability
- What would you do after seeing this?
- Is this early enough to change the decision?
- Which signal would you trust enough to act on?
- What would you refuse to act on?

## Capacity
- Is line-level RCCP the right level?
- Which constraint is missing?
- What headroom threshold would you use?
- Would you prebuild, shift lines, or escalate first?

## Materials
- Which components would you plan before the final SKU exists?
- What confidence/evidence is needed before planning a raw material?
- Is component-family planning actionable enough?

## Methodology
- Would you expect to see the planning method?
- What historical window would you normally use?
- Would you change AI-selected analogues?

## Scenario Lab
- Which variable would you change first?
- Does the workspace feel as flexible as Excel?
- What do you need to compare side-by-side?
- What should never be editable by AI?

## Workflow
- Where should a validated assumption go next?
- At what point should Heizen stop and your existing system take over?
- What would cause double counting or workflow confusion?

---

# 37. Metrics for Future Production Validation

## Planning value
- days/weeks of earlier visibility
- number/value of gaps detected before formal system exception
- capacity constraints identified earlier
- material decisions surfaced earlier

## Accuracy / usefulness
- provisional demand vs eventual formal demand
- provisional line load vs eventual production plan
- stable component prediction accuracy
- analogue recommendation acceptance rate

## Planner behavior
- gaps opened
- basis changed
- scenarios created
- recommendations accepted/rejected
- time spent to reach decision

## Reconciliation quality
- percentage of provisional assumptions correctly matched to formal items
- double-count prevention rate
- residual unresolved load after formalization

---

# 38. Phased Product Evolution

## Phase 0: Current high-fidelity demo

- synthetic dataset
- Super Admin
- AI Briefing
- Planning Gaps
- Scenario Lab
- Capacity
- Materials
- methodology transparency
- master-vs-history example
- simulated integrations
- reconciliation demo

## Phase 1: Read-only real-data pilot

- CSV/Excel or controlled exports
- one event/season
- one plant / limited lines
- historical actuals
- current plan
- BOM and lead-time history
- read-only

## Phase 2: Planning Gap engine

- automated gap detection
- configurable methods
- analogue engine
- confidence model
- rolling reconciliation

## Phase 3: Enterprise integrations

- ERP/planning read connectors
- data freshness
- audit
- controlled write/handoff where validated

## Phase 4: RBAC and collaboration

- domain roles
- permissions
- validation requests
- cross-functional approval

## Phase 5: Advanced material and supplier intelligence

Only after core value is proven.

---

# 39. Technical/Product Architecture Guidance

This is product context, not an implementation mandate.

Suggested logical layers:

1. **Synthetic / Source Data Layer**
   - business intent
   - plan snapshots
   - item/BOM/resource data
   - historical execution

2. **Canonical Planning Model**
   - events
   - products/families
   - time
   - resources
   - materials
   - plan states

3. **Gap Detection Layer**
   - demand/event gaps
   - representation gaps
   - BOM/material gaps
   - master-assumption gaps

4. **Methodology Engine**
   - seasonal forecast
   - analogue forecast
   - RCCP
   - partial BOM explosion
   - historical analysis

5. **Scenario Engine**
   - override storage
   - dependency recalculation
   - scenario branching
   - comparison

6. **Agent Layer**
   - navigation
   - method selection
   - explanation
   - manipulation
   - recommendation

7. **Experience Layer**
   - AI Briefing
   - Gap Workspace
   - Scenario Lab
   - Capacity
   - Materials
   - Decisions

8. **Reconciliation Layer**
   - provisional-to-formal matching
   - residual calculation
   - close/reopen

---

# 40. Open Questions to Preserve

The PRD should not silently treat these as resolved:

1. Exact Hershey system ownership across SAP, Kinaxis, Aera, NPI/artwork workflow.
2. Exact point when SKU/item/BOM/routing become available.
3. Which planning lead/persona would own a Heizen planning assumption in production.
4. Exact confidence/action threshold for material planning.
5. Whether raw material or capacity is the best first commercial wedge across customers.
6. Exact downstream Aera object/workflow/API semantics.
7. Exact writeback destination for provisional assumptions.
8. How to distinguish contractual lead time from operational elapsed lead time.
9. How much historical data is "comparable" for each metric.
10. How line-level capacity and product mix interact with changeovers in real plants.
11. Which partial-BOM material categories are safe/actionable at family level.
12. What planner governance is required before a provisional material signal reaches procurement.

---

# 41. Glossary

**Aera** - Decision-intelligence platform used by Hershey; should be treated as complementary/downstream until exact integration is validated.

**Analogue** - Historical product/event used as a comparable basis for a not-yet-known future product.

**BOM** - Bill of Materials; components and quantities required to produce a parent item.

**Effective Capacity** - Capacity view including formal load plus validated/inferred unresolved load and scenario changes.

**Formal Plan** - Demand/supply/capacity represented in the official planning system.

**Historical Performance** - Metric derived from execution history, such as actual elapsed PO-to-receipt lead time or actual production run rate.

**MRP** - Material Requirements Planning; translates formal demand and BOM structures into time-phased material requirements.

**Planning Gap** - Meaningful mismatch between what should reasonably be planned for and what the formal model currently represents or assumes.

**Planning Assumption** - Governed provisional representation used before final formal planning objects are available.

**RCCP** - Rough-Cut Capacity Planning; high-level capacity check against major resources before detailed scheduling.

**Scenario Value** - Planner-selected value used for a what-if calculation, distinct from system assumption and historical performance.

**System Assumption** - Value currently held in ERP/planning master or formal model.

**Unresolved Load** - Expected future operational load that is not sufficiently represented in the formal plan.

---

# 42. Source Validation Notes

This PRD consolidates the product direction developed through Heizen's discovery and prototype work with Keith Unton and subsequent internal product reasoning.

Key validated points from the Keith discussions include:

- Planners on Keith's team gave favorable feedback to rough-cut-capacity visibility and said it could help identify what may be missing from a line and where future constraints may occur.
- Keith described the multi-line capacity view as easy to see/use and strongly valuable.
- Keith considered the planning-risk signal exceptionally valuable and also saw significant personal value in missing-material planning, while acknowledging the material use case is harder.
- Keith supported analogous forecasting from prior seasonal products/BOMs.
- Keith cautioned that provisional/generic material planning can create duplicate ordering if not reconciled when final demand/items appear.
- Keith's earliest framing included verifying whether MRP reflects business needs and connecting requirements to what is already ordered/contracted.

Reference materials used in consolidating the PRD:
- Hershey / Heizen call transcripts, May-July 2026.
- Absence Detection POC for Hershey, July 2026.
- Heizen Absence Orchestrator prototype.
- Heizen planning-research diagram covering current planning flow and planning gaps.

---

# 43. Final Product Definition

The simplest durable definition is:

> **Heizen is an AI-first planning intelligence platform for professional planners working under incomplete information. It detects planning gaps before normal systems can, explains the planning methodology and evidence behind each inference, lets planners manipulate assumptions in a connected Scenario Lab, translates unresolved business demand into provisional capacity and material consequences, and reconciles those assumptions as the formal plan catches up.**

The demo should make one promise obvious:

> **You do not need to wait for every SKU, BOM, specification, or planning attribute to be finalized before you can understand what is likely coming, what it will affect, and what you can responsibly plan today.**
