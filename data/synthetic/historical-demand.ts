import type { HistoricalPeriod } from "@/types/planning";

/**
 * Prior-season actuals. `start`/`end` on a HistoricalPeriod are its
 * SELL-THROUGH window (POS / sell-out), not the window the volume was
 * produced in — a Halloween season shipped Jul-Sep sells Sep-Oct, and the
 * two must never be joined. Production windows live on BusinessEvent.
 *
 * Halloween is shaped so a recent-weighted seasonal forecast lands on the
 * PRD's stated expected range (4.56-4.94M) against the 3.8M formal plan
 * (§11.2, §28.1): recent-weighted mean of 4.55M / 4.35M / 4.05M is 4.40M,
 * +8% growth gives 4,752,000, and a +/-4% band gives 4,561,920-4,942,080.
 */
export const HISTORICAL_PERIODS: HistoricalPeriod[] = [
  {
    id: "hist_halloween_2024",
    eventId: "evt_halloween_2027",
    productFamilyId: "fam_variety_bags",
    periodLabel: "Halloween 2024",
    start: "2024-09-01",
    end: "2024-10-31",
    actualUnits: 4_050_000,
    actualValue: 14_580_000,
    isAtypical: false,
  },
  {
    id: "hist_halloween_2025",
    eventId: "evt_halloween_2027",
    productFamilyId: "fam_variety_bags",
    periodLabel: "Halloween 2025",
    start: "2025-09-01",
    end: "2025-10-31",
    actualUnits: 4_350_000,
    actualValue: 15_950_000,
    isAtypical: false,
  },
  {
    id: "hist_halloween_2026",
    eventId: "evt_halloween_2027",
    productFamilyId: "fam_variety_bags",
    periodLabel: "Halloween 2026",
    start: "2026-09-01",
    end: "2026-10-31",
    actualUnits: 4_550_000,
    actualValue: 17_030_000,
    isAtypical: false,
  },
  {
    id: "hist_halloween_2023",
    eventId: "evt_halloween_2027",
    productFamilyId: "fam_variety_bags",
    periodLabel: "Halloween 2023",
    start: "2023-09-01",
    end: "2023-10-31",
    actualUnits: 3_180_000,
    actualValue: 11_200_000,
    isAtypical: true,
    atypicalReason: "Peanut-paste supply interruption cut the Stuarts Draft seasonal build short; sell-out was supply-capped, not demand-capped, so the season does not represent normal demand.",
  },
  {
    id: "hist_holiday_2024",
    eventId: "evt_holiday_2027",
    productFamilyId: "fam_gift_tins",
    periodLabel: "Holiday 2024",
    start: "2024-11-01",
    end: "2024-12-24",
    actualUnits: 2_760_000,
    actualValue: 22_400_000,
    isAtypical: false,
  },
  {
    id: "hist_holiday_2025",
    eventId: "evt_holiday_2027",
    productFamilyId: "fam_gift_tins",
    periodLabel: "Holiday 2025",
    start: "2025-11-01",
    end: "2025-12-24",
    actualUnits: 2_910_000,
    actualValue: 23_850_000,
    isAtypical: false,
  },
  {
    id: "hist_holiday_2026",
    eventId: "evt_holiday_2027",
    productFamilyId: "fam_gift_tins",
    periodLabel: "Holiday 2026",
    start: "2026-11-01",
    end: "2026-12-24",
    actualUnits: 3_040_000,
    actualValue: 25_360_000,
    isAtypical: false,
  },
  {
    id: "hist_valentines_2025",
    eventId: "evt_valentines_2028",
    productFamilyId: "fam_gift_tins",
    periodLabel: "Valentine's 2025",
    start: "2025-01-02",
    end: "2025-02-14",
    actualUnits: 1_120_000,
    actualValue: 9_760_000,
    isAtypical: false,
  },
  {
    id: "hist_valentines_2026",
    eventId: "evt_valentines_2028",
    productFamilyId: "fam_gift_tins",
    periodLabel: "Valentine's 2026",
    start: "2026-01-02",
    end: "2026-02-14",
    actualUnits: 1_205_000,
    actualValue: 10_580_000,
    isAtypical: false,
  },
  {
    id: "hist_valentines_2027",
    eventId: "evt_valentines_2028",
    productFamilyId: "fam_gift_tins",
    periodLabel: "Valentine's 2027",
    start: "2027-01-02",
    end: "2027-02-14",
    actualUnits: 1_275_000,
    actualValue: 11_340_000,
    isAtypical: false,
  },
  {
    id: "hist_walmart_fall_reset_2025",
    eventId: "evt_walmart_fall_reset",
    productFamilyId: "fam_counter_displays",
    periodLabel: "Walmart Fall Reset 2025",
    start: "2025-08-15",
    end: "2025-09-05",
    actualUnits: 640_000,
    actualValue: 3_260_000,
    isAtypical: false,
  },
  {
    id: "hist_walmart_fall_reset_2026",
    eventId: "evt_walmart_fall_reset",
    productFamilyId: "fam_counter_displays",
    periodLabel: "Walmart Fall Reset 2026",
    start: "2026-08-15",
    end: "2026-09-05",
    actualUnits: 685_000,
    actualValue: 3_540_000,
    isAtypical: false,
  },
  {
    id: "hist_diwali_2025",
    eventId: "evt_diwali_2027",
    productFamilyId: "fam_molded_novelty",
    periodLabel: "Diwali 2025",
    start: "2025-10-15",
    end: "2025-10-31",
    actualUnits: 410_000,
    actualValue: 2_950_000,
    isAtypical: false,
  },
  {
    id: "hist_diwali_2026",
    eventId: "evt_diwali_2027",
    productFamilyId: "fam_molded_novelty",
    periodLabel: "Diwali 2026",
    start: "2026-10-15",
    end: "2026-10-31",
    actualUnits: 452_000,
    actualValue: 3_310_000,
    isAtypical: false,
  },
];

export const historicalPeriodsForEvent = (eventId: string): HistoricalPeriod[] =>
  HISTORICAL_PERIODS.filter((h) => h.eventId === eventId).sort((a, b) => (a.start < b.start ? 1 : -1));

export const historicalPeriodById = (id: string): HistoricalPeriod => {
  const h = HISTORICAL_PERIODS.find((x) => x.id === id);
  if (!h) throw new Error(`Unknown historical period id: ${id}`);
  return h;
};
