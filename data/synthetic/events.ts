import type { BusinessEvent } from "@/types/planning";

export const EVENTS: BusinessEvent[] = [
  {
    id: "evt_halloween_2027",
    name: "Halloween 2027",
    family: "halloween",
    market: "US",
    salesWindow: { start: "2027-09-15", end: "2027-10-31" },
    productionWindow: { start: "2027-06-15", end: "2027-10-15" },
    comparableEventIds: ["hist_halloween_2026", "hist_halloween_2025", "hist_halloween_2024"],
    businessGrowthAssumption: 0.08,
  },
  {
    id: "evt_holiday_2027",
    name: "Holiday / Christmas 2027",
    family: "holiday",
    market: "US",
    salesWindow: { start: "2027-11-01", end: "2027-12-24" },
    productionWindow: { start: "2027-08-01", end: "2027-12-10" },
    comparableEventIds: ["hist_holiday_2026", "hist_holiday_2025", "hist_holiday_2024"],
    businessGrowthAssumption: 0.05,
  },
  {
    id: "evt_valentines_2028",
    name: "Valentine's 2028",
    family: "valentines",
    market: "US",
    salesWindow: { start: "2028-01-15", end: "2028-02-14" },
    productionWindow: { start: "2027-10-01", end: "2028-02-01" },
    comparableEventIds: ["hist_valentines_2027", "hist_valentines_2026", "hist_valentines_2025"],
    businessGrowthAssumption: 0.06,
  },
  {
    id: "evt_walmart_fall_reset",
    name: "Walmart Fall Reset",
    family: "retailer_reset",
    market: "US",
    salesWindow: { start: "2027-08-15", end: "2027-09-05" },
    productionWindow: { start: "2027-06-01", end: "2027-08-10" },
    comparableEventIds: ["hist_walmart_fall_reset_2026", "hist_walmart_fall_reset_2025"],
    businessGrowthAssumption: 0.03,
  },
  {
    id: "evt_diwali_2027",
    name: "Diwali 2027",
    family: "diwali",
    market: "US",
    salesWindow: { start: "2027-10-05", end: "2027-10-24" },
    productionWindow: { start: "2027-07-15", end: "2027-10-01" },
    comparableEventIds: ["hist_diwali_2026", "hist_diwali_2025"],
    businessGrowthAssumption: 0.1,
  },
];

export const eventById = (id: string): BusinessEvent => {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown event id: ${id}`);
  return e;
};
