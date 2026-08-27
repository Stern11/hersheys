import type { CapacityBucket } from "@/types/planning";

/**
 * RCCP buckets are PRODUCTION months, never sell-through months.
 *
 * The Halloween 2027 build runs Mar-Jul 2027 and peaks in June; the
 * Holiday/Christmas build picks up in Jul and runs through Oct. September
 * and October are Halloween's SELL-THROUGH months — no Halloween unit is
 * made in them — so the Halloween capacity constraint lives in
 * `HALLOWEEN_PEAK_PRODUCTION_PERIOD` below, not in "2027-09".
 *
 * Hand-authored (not RNG-generated) so the Golden Scenario A story
 * reconciles exactly: Line 03's formal utilization sits at 70.0% in the
 * June production peak (266h of 380h ceiling), and adding the unresolved
 * Halloween load — computed by the RCCP engine step, never stored here —
 * pushes its effective utilization into the 92-96% band the PRD describes.
 * Line 04 is deliberately left with headroom as the natural prebuild /
 * shift target.
 */

/**
 * The month the Halloween 2027 RCCP constraint is evaluated in. Import this
 * rather than hard-coding a period string — the Halloween peak is a
 * production fact that moves with the seasonal calendar.
 */
export const HALLOWEEN_PEAK_PRODUCTION_PERIOD = "2027-06";

/** The month the Holiday/Christmas 2027 build peaks. */
export const HOLIDAY_PEAK_PRODUCTION_PERIOD = "2027-09";

export const CAPACITY_BUCKETS: CapacityBucket[] = [
  // --- March 2027 — Halloween build opens; first seasonal film call-offs land ---
  { id: "cap_line01_2027-03", lineId: "line_01", period: "2027-03", availableHours: 420, plannedDowntimeHours: 16, targetUtilization: 0.9, formalLoadHours: 230, validatedUnresolvedLoadHours: 6 },
  { id: "cap_line02_2027-03", lineId: "line_02", period: "2027-03", availableHours: 350, plannedDowntimeHours: 18, targetUtilization: 0.9, formalLoadHours: 150, validatedUnresolvedLoadHours: 3 },
  { id: "cap_line03_2027-03", lineId: "line_03", period: "2027-03", availableHours: 400, plannedDowntimeHours: 22, targetUtilization: 0.9, formalLoadHours: 218, validatedUnresolvedLoadHours: 9 },
  { id: "cap_line04_2027-03", lineId: "line_04", period: "2027-03", availableHours: 370, plannedDowntimeHours: 10, targetUtilization: 0.9, formalLoadHours: 108, validatedUnresolvedLoadHours: 0 },

  // --- April 2027 — Halloween build ramping ---
  { id: "cap_line01_2027-04", lineId: "line_01", period: "2027-04", availableHours: 420, plannedDowntimeHours: 14, targetUtilization: 0.9, formalLoadHours: 245, validatedUnresolvedLoadHours: 8 },
  { id: "cap_line02_2027-04", lineId: "line_02", period: "2027-04", availableHours: 350, plannedDowntimeHours: 16, targetUtilization: 0.9, formalLoadHours: 172, validatedUnresolvedLoadHours: 4 },
  { id: "cap_line03_2027-04", lineId: "line_03", period: "2027-04", availableHours: 400, plannedDowntimeHours: 18, targetUtilization: 0.9, formalLoadHours: 240, validatedUnresolvedLoadHours: 14 },
  { id: "cap_line04_2027-04", lineId: "line_04", period: "2027-04", availableHours: 370, plannedDowntimeHours: 9, targetUtilization: 0.9, formalLoadHours: 122, validatedUnresolvedLoadHours: 0 },

  // --- May 2027 — Halloween build plus Fall Reset display pack-out ---
  { id: "cap_line01_2027-05", lineId: "line_01", period: "2027-05", availableHours: 420, plannedDowntimeHours: 12, targetUtilization: 0.9, formalLoadHours: 258, validatedUnresolvedLoadHours: 9 },
  { id: "cap_line02_2027-05", lineId: "line_02", period: "2027-05", availableHours: 360, plannedDowntimeHours: 20, targetUtilization: 0.9, formalLoadHours: 205, validatedUnresolvedLoadHours: 5 },
  { id: "cap_line03_2027-05", lineId: "line_03", period: "2027-05", availableHours: 400, plannedDowntimeHours: 16, targetUtilization: 0.9, formalLoadHours: 255, validatedUnresolvedLoadHours: 18 },
  { id: "cap_line04_2027-05", lineId: "line_04", period: "2027-05", availableHours: 375, plannedDowntimeHours: 8, targetUtilization: 0.9, formalLoadHours: 136, validatedUnresolvedLoadHours: 0 },

  // --- June 2027 — PEAK HALLOWEEN PRODUCTION MONTH (the Golden Scenario A constraint) ---
  { id: "cap_line01_2027-06", lineId: "line_01", period: "2027-06", availableHours: 420, plannedDowntimeHours: 15, targetUtilization: 0.9, formalLoadHours: 230, validatedUnresolvedLoadHours: 10 },
  { id: "cap_line02_2027-06", lineId: "line_02", period: "2027-06", availableHours: 360, plannedDowntimeHours: 22, targetUtilization: 0.9, formalLoadHours: 218, validatedUnresolvedLoadHours: 5 },
  { id: "cap_line03_2027-06", lineId: "line_03", period: "2027-06", availableHours: 400, plannedDowntimeHours: 20, targetUtilization: 0.9, formalLoadHours: 266, validatedUnresolvedLoadHours: 22 },
  { id: "cap_line04_2027-06", lineId: "line_04", period: "2027-06", availableHours: 380, plannedDowntimeHours: 10, targetUtilization: 0.9, formalLoadHours: 150, validatedUnresolvedLoadHours: 0 },

  // --- July 2027 — Halloween tail-out; first Holiday runs; shipment window opens ---
  { id: "cap_line01_2027-07", lineId: "line_01", period: "2027-07", availableHours: 420, plannedDowntimeHours: 18, targetUtilization: 0.9, formalLoadHours: 215, validatedUnresolvedLoadHours: 7 },
  { id: "cap_line02_2027-07", lineId: "line_02", period: "2027-07", availableHours: 355, plannedDowntimeHours: 20, targetUtilization: 0.9, formalLoadHours: 230, validatedUnresolvedLoadHours: 6 },
  { id: "cap_line03_2027-07", lineId: "line_03", period: "2027-07", availableHours: 400, plannedDowntimeHours: 24, targetUtilization: 0.9, formalLoadHours: 248, validatedUnresolvedLoadHours: 16 },
  { id: "cap_line04_2027-07", lineId: "line_04", period: "2027-07", availableHours: 375, plannedDowntimeHours: 12, targetUtilization: 0.9, formalLoadHours: 158, validatedUnresolvedLoadHours: 0 },

  // --- August 2027 — Holiday/Christmas build ramping (Halloween is shipping, not producing) ---
  { id: "cap_line01_2027-08", lineId: "line_01", period: "2027-08", availableHours: 400, plannedDowntimeHours: 12, targetUtilization: 0.9, formalLoadHours: 190, validatedUnresolvedLoadHours: 8 },
  { id: "cap_line02_2027-08", lineId: "line_02", period: "2027-08", availableHours: 350, plannedDowntimeHours: 20, targetUtilization: 0.9, formalLoadHours: 196, validatedUnresolvedLoadHours: 4 },
  { id: "cap_line03_2027-08", lineId: "line_03", period: "2027-08", availableHours: 390, plannedDowntimeHours: 18, targetUtilization: 0.9, formalLoadHours: 205, validatedUnresolvedLoadHours: 12 },
  { id: "cap_line04_2027-08", lineId: "line_04", period: "2027-08", availableHours: 370, plannedDowntimeHours: 8, targetUtilization: 0.9, formalLoadHours: 140, validatedUnresolvedLoadHours: 0 },

  // --- September 2027 — Holiday production peak (Halloween is on shelf, selling through) ---
  { id: "cap_line01_2027-09", lineId: "line_01", period: "2027-09", availableHours: 420, plannedDowntimeHours: 15, targetUtilization: 0.9, formalLoadHours: 236, validatedUnresolvedLoadHours: 10 },
  { id: "cap_line02_2027-09", lineId: "line_02", period: "2027-09", availableHours: 360, plannedDowntimeHours: 25, targetUtilization: 0.9, formalLoadHours: 188, validatedUnresolvedLoadHours: 5 },
  { id: "cap_line03_2027-09", lineId: "line_03", period: "2027-09", availableHours: 400, plannedDowntimeHours: 20, targetUtilization: 0.9, formalLoadHours: 252, validatedUnresolvedLoadHours: 14 },
  { id: "cap_line04_2027-09", lineId: "line_04", period: "2027-09", availableHours: 380, plannedDowntimeHours: 10, targetUtilization: 0.9, formalLoadHours: 166, validatedUnresolvedLoadHours: 0 },

  // --- October 2027 — Holiday tail-out; Valentine's build opens on Line 03 ---
  { id: "cap_line01_2027-10", lineId: "line_01", period: "2027-10", availableHours: 410, plannedDowntimeHours: 14, targetUtilization: 0.9, formalLoadHours: 222, validatedUnresolvedLoadHours: 6 },
  { id: "cap_line02_2027-10", lineId: "line_02", period: "2027-10", availableHours: 355, plannedDowntimeHours: 22, targetUtilization: 0.9, formalLoadHours: 162, validatedUnresolvedLoadHours: 3 },
  { id: "cap_line03_2027-10", lineId: "line_03", period: "2027-10", availableHours: 395, plannedDowntimeHours: 19, targetUtilization: 0.9, formalLoadHours: 240, validatedUnresolvedLoadHours: 14 },
  { id: "cap_line04_2027-10", lineId: "line_04", period: "2027-10", availableHours: 375, plannedDowntimeHours: 9, targetUtilization: 0.9, formalLoadHours: 170, validatedUnresolvedLoadHours: 0 },
];

export const capacityBucketsForLine = (lineId: string): CapacityBucket[] =>
  CAPACITY_BUCKETS.filter((c) => c.lineId === lineId).sort((a, b) => (a.period < b.period ? -1 : 1));

export const capacityBucket = (lineId: string, period: string): CapacityBucket => {
  const b = CAPACITY_BUCKETS.find((c) => c.lineId === lineId && c.period === period);
  if (!b) throw new Error(`No capacity bucket for ${lineId}/${period}`);
  return b;
};
