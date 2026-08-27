import type { FormalPlanValue } from "@/types/planning";

/**
 * Dated snapshots of the formally represented plan. Halloween's current
 * (2027-08-24) snapshot is the PRD's golden 3.8M formal-demand figure
 * (§11.2, §28.1); the earlier snapshot lets a future Plan Horizon view show
 * how the formal plan has moved over time.
 */
export const FORMAL_PLAN_VALUES: FormalPlanValue[] = [
  { id: "fpv_halloween_early", scopeType: "event", scopeId: "evt_halloween_2027", period: "2027-Q3", asOfDate: "2027-05-01", value: 3_500_000, unit: "units" },
  { id: "fpv_halloween_current", scopeType: "event", scopeId: "evt_halloween_2027", period: "2027-Q3", asOfDate: "2027-08-24", value: 3_800_000, unit: "units" },

  { id: "fpv_holiday_early", scopeType: "event", scopeId: "evt_holiday_2027", period: "2027-Q4", asOfDate: "2027-06-01", value: 2_700_000, unit: "units" },
  { id: "fpv_holiday_current", scopeType: "event", scopeId: "evt_holiday_2027", period: "2027-Q4", asOfDate: "2027-08-24", value: 2_950_000, unit: "units" },

  { id: "fpv_valentines_current", scopeType: "event", scopeId: "evt_valentines_2028", period: "2028-Q1", asOfDate: "2027-08-24", value: 0, unit: "units" },

  { id: "fpv_fall_reset_current", scopeType: "event", scopeId: "evt_walmart_fall_reset", period: "2027-Q3", asOfDate: "2027-08-24", value: 680_000, unit: "units" },

  { id: "fpv_diwali_current", scopeType: "event", scopeId: "evt_diwali_2027", period: "2027-Q4", asOfDate: "2027-08-24", value: 430_000, unit: "units" },
];

export const currentFormalPlanValue = (scopeType: FormalPlanValue["scopeType"], scopeId: string): FormalPlanValue => {
  const matches = FORMAL_PLAN_VALUES.filter((f) => f.scopeType === scopeType && f.scopeId === scopeId);
  const latest = matches.sort((a, b) => (a.asOfDate < b.asOfDate ? 1 : -1))[0];
  if (!latest) throw new Error(`No formal plan value for ${scopeType}/${scopeId}`);
  return latest;
};
