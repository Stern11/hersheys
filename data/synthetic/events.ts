import type { BusinessEvent } from "@/types/planning";

/**
 * PRODUCTION TIMING vs SALES TIMING — the correctness rule this file exists
 * to enforce (CLAUDE.md: "Do not conflate production timing and sales
 * timing"). For a US season the two windows are months apart and are never
 * the same bucket:
 *
 *   Halloween 2027
 *     printed film / packaging commit ... Jan - Mar 2027
 *     PRODUCTION (RCCP buckets) ........ Mar - Jul 2027   <- productionWindow
 *     shipment to DC / retailer ........ Jul - Sep 2027
 *     retailer POs land ................ ~60 days before in-store date
 *     shelf set ........................ around Labor Day
 *     SELL-THROUGH ..................... Sep - Oct 2027   <- salesWindow
 *
 * A Halloween SKU's demand month and its production month are different
 * months. `productionWindow` is what capacity/RCCP and material order-by
 * dates are computed against; `salesWindow` is what POS/sell-through and
 * the shelf-set date are computed against. Nothing may join them.
 *
 * The season is one shot: there is no reorder window once the build is
 * over, which is why the material decisions downstream of these windows are
 * hard deadlines rather than replenishment triggers.
 */
export const EVENTS: BusinessEvent[] = [
  {
    id: "evt_halloween_2027",
    name: "Halloween 2027",
    family: "halloween",
    market: "US",
    /** Shelf set around Labor Day; 6-8 week sell-through window through 31 Oct. */
    salesWindow: { start: "2027-09-01", end: "2027-10-31" },
    /** Seasonal build at Stuarts Draft / Reese plant, peaking in June. */
    productionWindow: { start: "2027-03-01", end: "2027-07-31" },
    comparableEventIds: ["hist_halloween_2026", "hist_halloween_2025", "hist_halloween_2024"],
    businessGrowthAssumption: 0.08,
  },
  {
    id: "evt_holiday_2027",
    name: "Holiday / Christmas 2027",
    family: "holiday",
    market: "US",
    salesWindow: { start: "2027-11-01", end: "2027-12-24" },
    /** Holiday build starts as the Halloween build tails out and runs Jul-Oct. */
    productionWindow: { start: "2027-07-15", end: "2027-10-31" },
    comparableEventIds: ["hist_holiday_2026", "hist_holiday_2025", "hist_holiday_2024"],
    businessGrowthAssumption: 0.05,
  },
  {
    id: "evt_valentines_2028",
    name: "Valentine's 2028",
    family: "valentines",
    market: "US",
    /** Sets straight after the Christmas take-down; sells out by 14 Feb. */
    salesWindow: { start: "2028-01-02", end: "2028-02-14" },
    /** Built Sep-Dec 2027, immediately behind the Holiday build. */
    productionWindow: { start: "2027-09-01", end: "2027-12-15" },
    comparableEventIds: ["hist_valentines_2027", "hist_valentines_2026", "hist_valentines_2025"],
    businessGrowthAssumption: 0.06,
  },
  {
    id: "evt_walmart_fall_reset",
    name: "Walmart Fall Reset 2027",
    family: "retailer_reset",
    market: "US",
    /** Reset execution window in store. */
    salesWindow: { start: "2027-08-15", end: "2027-09-05" },
    /** Displays are packed out ahead of the Halloween peak, not during it. */
    productionWindow: { start: "2027-05-01", end: "2027-07-15" },
    comparableEventIds: ["hist_walmart_fall_reset_2026", "hist_walmart_fall_reset_2025"],
    businessGrowthAssumption: 0.03,
  },
  {
    id: "evt_diwali_2027",
    name: "Diwali 2027",
    family: "diwali",
    market: "US",
    salesWindow: { start: "2027-10-05", end: "2027-10-31" },
    productionWindow: { start: "2027-06-15", end: "2027-08-31" },
    comparableEventIds: ["hist_diwali_2026", "hist_diwali_2025"],
    businessGrowthAssumption: 0.1,
  },
];

export const eventById = (id: string): BusinessEvent => {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown event id: ${id}`);
  return e;
};

/**
 * The seasonal phases that sit between `productionWindow` and `salesWindow`
 * but have nowhere to live on `BusinessEvent`. Kept as reference data so a
 * surface can show the full commit -> build -> ship -> sell chain without
 * having to infer (or invent) it, and so no phase gets silently folded into
 * either of the two windows on the event itself.
 */
export interface SeasonalPhase {
  eventId: string;
  phase: "packaging_commit" | "production" | "shipment" | "shelf_set" | "sell_through";
  label: string;
  start: string;
  end: string;
}

export const SEASONAL_PHASES: SeasonalPhase[] = [
  { eventId: "evt_halloween_2027", phase: "packaging_commit", label: "Printed film & packaging commit", start: "2027-01-04", end: "2027-03-31" },
  { eventId: "evt_halloween_2027", phase: "production", label: "Seasonal production", start: "2027-03-01", end: "2027-07-31" },
  { eventId: "evt_halloween_2027", phase: "shipment", label: "Shipment to DC / retailer", start: "2027-07-01", end: "2027-09-10" },
  { eventId: "evt_halloween_2027", phase: "shelf_set", label: "Shelf set (Labor Day)", start: "2027-08-30", end: "2027-09-06" },
  { eventId: "evt_halloween_2027", phase: "sell_through", label: "Sell-through", start: "2027-09-01", end: "2027-10-31" },

  { eventId: "evt_holiday_2027", phase: "packaging_commit", label: "Printed film & tin commit", start: "2027-03-01", end: "2027-06-30" },
  { eventId: "evt_holiday_2027", phase: "production", label: "Seasonal production", start: "2027-07-15", end: "2027-10-31" },
  { eventId: "evt_holiday_2027", phase: "shipment", label: "Shipment to DC / retailer", start: "2027-09-15", end: "2027-11-15" },
  { eventId: "evt_holiday_2027", phase: "sell_through", label: "Sell-through", start: "2027-11-01", end: "2027-12-24" },

  { eventId: "evt_valentines_2028", phase: "packaging_commit", label: "Offshore tin & film commit", start: "2027-04-01", end: "2027-08-31" },
  { eventId: "evt_valentines_2028", phase: "production", label: "Seasonal production", start: "2027-09-01", end: "2027-12-15" },
  { eventId: "evt_valentines_2028", phase: "shipment", label: "Shipment to DC / retailer", start: "2027-11-15", end: "2027-12-31" },
  { eventId: "evt_valentines_2028", phase: "sell_through", label: "Sell-through", start: "2028-01-02", end: "2028-02-14" },
];

export const seasonalPhasesForEvent = (eventId: string): SeasonalPhase[] => SEASONAL_PHASES.filter((p) => p.eventId === eventId);
