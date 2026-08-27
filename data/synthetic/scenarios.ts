import type { Scenario } from "@/types/scenario";
import { DEMO_NOW } from "./master-data";

export const BASELINE_ID = "baseline";

/**
 * Two pre-saved scenarios so Scenario Lab / Decisions don't open empty on
 * first load. They encode the PRD's own worked examples verbatim: Line 03's
 * achievable scenario run rate (§18.2: "Scenario 8,200/hr") and the
 * historical-P80 lead-time basis for Printed Seasonal Film (§28.3).
 *
 * The film override deliberately mirrors the accepted lead-time basis that
 * gaps.ts::ACCEPTED_MASTER_ASSUMPTIONS also feeds into the Halloween
 * baseline. Both surfaces therefore resolve Printed Seasonal Film to the
 * same number of days and the same order-by date; the Halloween workspace
 * can no longer show 42 days while the lead-time workspace shows the
 * accepted basis.
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
    note: "Tests whether the historical P80 lead time for Printed Seasonal Film, combined with Line 03's achievable scenario run rate at Stuarts Draft, keeps the film order-by date and the June production peak aligned.",
    createdAt: "2027-02-19T14:00:00.000Z",
    updatedAt: DEMO_NOW,
  },
  {
    id: "scn_valentines_tin_analogues",
    name: "Valentine's Tin — analogue mix exploration",
    baselineId: BASELINE_ID,
    linkedGapIds: ["valentines-premium-tin"],
    overrides: {},
    status: "draft",
    note: "Default AI-recommended analogue weighting (Reese's Mother's Day Tin 86%, Kisses Holiday Tin 64% similarity-weighted) — open to reweight or swap analogues.",
    createdAt: "2027-02-11T11:00:00.000Z",
    updatedAt: DEMO_NOW,
  },
];
