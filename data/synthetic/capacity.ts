import type { CapacityBucket } from "@/types/planning";

/**
 * Hand-authored (not RNG-generated) so the Golden Scenario A story reconciles
 * exactly: Line 03 formal utilization sits near 70% in September, and adding
 * the unresolved Halloween load (computed by the RCCP engine step, not
 * stored here) pushes its effective utilization into the 94-101% band the
 * PRD describes. Line 04 is deliberately left with headroom as the natural
 * prebuild/shift target.
 */
export const CAPACITY_BUCKETS: CapacityBucket[] = [
  // --- August 2027 (ramp-up; Fall Reset still finishing on Line 02) ---
  { id: "cap_line01_2027-08", lineId: "line_01", period: "2027-08", availableHours: 400, plannedDowntimeHours: 12, targetUtilization: 0.9, formalLoadHours: 190, validatedUnresolvedLoadHours: 8 },
  { id: "cap_line02_2027-08", lineId: "line_02", period: "2027-08", availableHours: 350, plannedDowntimeHours: 20, targetUtilization: 0.9, formalLoadHours: 230, validatedUnresolvedLoadHours: 4 },
  { id: "cap_line03_2027-08", lineId: "line_03", period: "2027-08", availableHours: 390, plannedDowntimeHours: 18, targetUtilization: 0.9, formalLoadHours: 205, validatedUnresolvedLoadHours: 12 },
  { id: "cap_line04_2027-08", lineId: "line_04", period: "2027-08", availableHours: 370, plannedDowntimeHours: 8, targetUtilization: 0.9, formalLoadHours: 110, validatedUnresolvedLoadHours: 0 },

  // --- September 2027 (peak Halloween production month) ---
  { id: "cap_line01_2027-09", lineId: "line_01", period: "2027-09", availableHours: 420, plannedDowntimeHours: 15, targetUtilization: 0.9, formalLoadHours: 230, validatedUnresolvedLoadHours: 10 },
  { id: "cap_line02_2027-09", lineId: "line_02", period: "2027-09", availableHours: 360, plannedDowntimeHours: 25, targetUtilization: 0.9, formalLoadHours: 190, validatedUnresolvedLoadHours: 5 },
  { id: "cap_line03_2027-09", lineId: "line_03", period: "2027-09", availableHours: 400, plannedDowntimeHours: 20, targetUtilization: 0.9, formalLoadHours: 266, validatedUnresolvedLoadHours: 22 },
  { id: "cap_line04_2027-09", lineId: "line_04", period: "2027-09", availableHours: 380, plannedDowntimeHours: 10, targetUtilization: 0.9, formalLoadHours: 150, validatedUnresolvedLoadHours: 0 },

  // --- October 2027 (Halloween tail-out; Holiday ramp beginning) ---
  { id: "cap_line01_2027-10", lineId: "line_01", period: "2027-10", availableHours: 410, plannedDowntimeHours: 14, targetUtilization: 0.9, formalLoadHours: 175, validatedUnresolvedLoadHours: 6 },
  { id: "cap_line02_2027-10", lineId: "line_02", period: "2027-10", availableHours: 355, plannedDowntimeHours: 22, targetUtilization: 0.9, formalLoadHours: 150, validatedUnresolvedLoadHours: 3 },
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
