import type { Scenario } from "@/types/scenario";
import { DEMO_NOW } from "./master-data";

export const BASELINE_ID = "baseline";

/**
 * One pre-saved scenario so Scenario Lab / Decisions don't open empty on
 * first load. Encodes the PRD's own worked examples verbatim: Line 03's
 * scenario run rate (§18.2: "Scenario 8,200/hr") and switching Printed
 * Film's lead-time basis to the historical P80 (§28.3).
 */
export const SEED_SCENARIOS: Scenario[] = [
  {
    id: "scn_halloween_line03_relief",
    name: "Line 03 relief — P80 lead time + scenario run rate",
    baselineId: BASELINE_ID,
    linkedGapIds: ["halloween-2027", "printed-film-lead-time"],
    overrides: {
      historicalBasis: {
        seasonsOrYears: 3,
        excludedPeriodIds: [],
        weighting: "recent_weighted",
      },
      masterAssumptions: {
        "line:line_03:run_rate": { selectedBasis: "scenario", scenarioValue: 8200 },
        "material:mat_printed_film:lead_time": { selectedBasis: "historical", leadTimeStatistic: "p80" },
      },
    },
    status: "preferred",
    note: "Tests whether accepting the historical P80 lead time for Printed Film, combined with Line 03's achievable scenario run rate, keeps the material deadline and capacity plan aligned.",
    createdAt: "2027-08-20T14:00:00.000Z",
    updatedAt: DEMO_NOW,
  },
  {
    id: "scn_valentines_tin_analogues",
    name: "Valentine's Tin — analogue mix exploration",
    baselineId: BASELINE_ID,
    linkedGapIds: ["valentines-premium-tin"],
    overrides: {},
    status: "draft",
    note: "Default AI-recommended analogue weighting (Mother's Day Tin 86%, Holiday Premium Tin 64% similarity-weighted) — open to reweight or swap analogues.",
    createdAt: "2027-08-18T11:00:00.000Z",
    updatedAt: DEMO_NOW,
  },
];
