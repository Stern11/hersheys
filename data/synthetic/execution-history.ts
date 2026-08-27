import { Rng } from "@/lib/utils/rng";
import { MATERIALS } from "./materials";
import { PRODUCTION_LINES } from "./master-data";
import { supplierForMaterial } from "./suppliers";
import type { ObservedPerformance } from "@/types/planning";

/**
 * Raw execution records that back every ObservedPerformance metric and every
 * evidence drilldown (PRD §18.3, §26.8). Generated once, deterministically,
 * from a fixed seed — never Math.random(). Printed Film's sample is shaped
 * to reproduce the exact golden gap (system 42d / historical median 67d /
 * P80 81d); other materials get smaller, realistic samples.
 */

export interface PurchaseOrderRecord {
  id: string;
  materialId: string;
  supplierName: string;
  poDate: string;
  goodsReceiptDate: string;
  elapsedDays: number;
  quantity: number;
  excluded: boolean;
  excludedReason?: string;
}

export interface ProductionConfirmationRecord {
  id: string;
  lineId: string;
  actualLineId?: string; // set only when execution deviated from the routed line (routing anomaly)
  productFamilyId: string;
  date: string;
  quantityUnits: number;
  runtimeHours: number;
  computedUnitsPerHour: number;
}

const rng = new Rng("heizen-execution-history-v1");

function isoDaysAgo(anchor: Date, days: number): string {
  const d = new Date(anchor.getTime() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function generatePOs(materialId: string, medianDays: number, p80Days: number, count: number, systemDays: number): PurchaseOrderRecord[] {
  const supplier = supplierForMaterial(materialId);
  const anchor = new Date("2027-08-24T00:00:00.000Z");
  // Log-normal-ish spread around the median, tuned so the 80th percentile of
  // the generated sample lands near p80Days.
  const sigma = Math.log(p80Days / medianDays) / 0.8416; // z-score for p80
  const records: PurchaseOrderRecord[] = [];
  for (let i = 0; i < count; i++) {
    const z = (rng.float() + rng.float() + rng.float() + rng.float() - 2) / 1.3; // approx normal
    const elapsed = Math.max(systemDays - 12, Math.round(medianDays * Math.exp(sigma * z)));
    const orderedDaysAgo = rng.int(10, 420);
    const poDate = isoDaysAgo(anchor, orderedDaysAgo + elapsed);
    const grDate = isoDaysAgo(anchor, orderedDaysAgo);
    const isOutlier = elapsed > medianDays * 2.6;
    records.push({
      id: `po_${materialId}_${i + 1}`,
      materialId,
      supplierName: supplier.name,
      poDate,
      goodsReceiptDate: grDate,
      elapsedDays: elapsed,
      quantity: Math.round(rng.range(800, 6000)),
      excluded: isOutlier,
      excludedReason: isOutlier ? "Elapsed time >2.6x median — flagged as a disruption outlier, excluded from the default statistic." : undefined,
    });
  }
  return records.sort((a, b) => (a.poDate < b.poDate ? 1 : -1));
}

export const PURCHASE_ORDER_RECORDS: PurchaseOrderRecord[] = [
  ...generatePOs("mat_printed_film", 67, 81, 130, 42),
  ...generatePOs("mat_foil", 34, 40, 22, 30),
  ...generatePOs("mat_tin_trim", 52, 63, 20, 45),
  ...generatePOs("mat_tray", 29, 35, 18, 25),
  ...generatePOs("mat_cocoa", 33, 38, 24, 35),
  ...generatePOs("mat_sugar", 20, 24, 20, 21),
  ...generatePOs("mat_milk_solids", 27, 31, 18, 28),
  ...generatePOs("mat_corrugate", 19, 22, 16, 18),
];

export const purchaseOrdersForMaterial = (materialId: string): PurchaseOrderRecord[] =>
  PURCHASE_ORDER_RECORDS.filter((p) => p.materialId === materialId);

function generateRunConfirmations(lineId: string, familyId: string, historicalMedianRate: number, count: number): ProductionConfirmationRecord[] {
  const anchor = new Date("2027-08-24T00:00:00.000Z");
  const sigma = 0.055; // tight-ish spread around the historical median
  const records: ProductionConfirmationRecord[] = [];
  for (let i = 0; i < count; i++) {
    const z = (rng.float() + rng.float() + rng.float() - 1.5) / 0.87;
    const rate = Math.max(historicalMedianRate * 0.7, Math.round(historicalMedianRate * (1 + sigma * z)));
    const runtimeHours = rng.range(4, 11);
    records.push({
      id: `prod_conf_${lineId}_${i + 1}`,
      lineId,
      productFamilyId: familyId,
      date: isoDaysAgo(anchor, rng.int(5, 365)),
      quantityUnits: Math.round(rate * runtimeHours),
      runtimeHours: Math.round(runtimeHours * 10) / 10,
      computedUnitsPerHour: rate,
    });
  }
  return records.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const PRODUCTION_CONFIRMATION_RECORDS: ProductionConfirmationRecord[] = [
  ...generateRunConfirmations("line_01", "fam_variety_bags", 8850, 22),
  ...generateRunConfirmations("line_02", "fam_counter_displays", 6980, 18),
  ...generateRunConfirmations("line_03", "fam_variety_bags", 7950, 28),
  ...generateRunConfirmations("line_04", "fam_gift_tins", 6400, 16),
];

/**
 * Line-mapping anomaly (PRD §6.4): system routing says Line 02 for Counter
 * Displays, but 84% of actual historical runs happened on Line 01. Kept
 * separate from Line 03's Halloween capacity story so the two gaps don't
 * interfere with each other's numbers.
 */
function generateLineMappingAnomaly(): ProductionConfirmationRecord[] {
  const anchor = new Date("2027-08-24T00:00:00.000Z");
  const total = 50;
  const onActualLine1 = Math.round(total * 0.84);
  const records: ProductionConfirmationRecord[] = [];
  for (let i = 0; i < total; i++) {
    const actualLineId = i < onActualLine1 ? "line_01" : "line_02";
    const rate = actualLineId === "line_01" ? rng.range(8500, 9100) : rng.range(6800, 7150);
    const runtimeHours = rng.range(3, 8);
    records.push({
      id: `prod_conf_cd_${i + 1}`,
      lineId: "line_02", // system routing
      actualLineId,
      productFamilyId: "fam_counter_displays",
      date: isoDaysAgo(anchor, rng.int(5, 365)),
      quantityUnits: Math.round(rate * runtimeHours),
      runtimeHours: Math.round(runtimeHours * 10) / 10,
      computedUnitsPerHour: Math.round(rate),
    });
  }
  return records;
}

export const LINE_MAPPING_RECORDS: ProductionConfirmationRecord[] = generateLineMappingAnomaly();

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Aggregated ObservedPerformance rows — one per material (lead time) / line (run rate). */
export const OBSERVED_PERFORMANCE: ObservedPerformance[] = [
  ...MATERIALS.map((m): ObservedPerformance => {
    const included = purchaseOrdersForMaterial(m.id).filter((p) => !p.excluded);
    const sorted = included.map((p) => p.elapsedDays).sort((a, b) => a - b);
    return {
      id: `obs_leadtime_${m.id}`,
      metric: "lead_time_days",
      scopeType: "material",
      scopeId: m.id,
      sampleCount: included.length,
      dateRange: { start: "2026-08-24", end: "2027-08-24" },
      statistic: "median",
      value: median(sorted),
      sourceRecordIds: included.map((p) => p.id),
    };
  }),
  ...PRODUCTION_LINES.map((l): ObservedPerformance => {
    const records = PRODUCTION_CONFIRMATION_RECORDS.filter((r) => r.lineId === l.id);
    const sorted = records.map((r) => r.computedUnitsPerHour).sort((a, b) => a - b);
    return {
      id: `obs_runrate_${l.id}`,
      metric: "run_rate_units_per_hour",
      scopeType: "line",
      scopeId: l.id,
      sampleCount: records.length,
      dateRange: { start: "2026-08-24", end: "2027-08-24" },
      statistic: "median",
      value: median(sorted),
      sourceRecordIds: records.map((r) => r.id),
    };
  }),
  {
    id: "obs_line_usage_fam_counter_displays",
    metric: "line_usage_share",
    scopeType: "product_family",
    scopeId: "fam_counter_displays",
    sampleCount: LINE_MAPPING_RECORDS.length,
    dateRange: { start: "2026-08-24", end: "2027-08-24" },
    statistic: "custom",
    value: LINE_MAPPING_RECORDS.filter((r) => r.actualLineId === "line_01").length / LINE_MAPPING_RECORDS.length,
    sourceRecordIds: LINE_MAPPING_RECORDS.map((r) => r.id),
  },
];

export const observedPerformanceFor = (metric: ObservedPerformance["metric"], scopeId: string): ObservedPerformance | undefined =>
  OBSERVED_PERFORMANCE.find((o) => o.metric === metric && o.scopeId === scopeId);

export function leadTimeP80(materialId: string): number {
  const included = purchaseOrdersForMaterial(materialId)
    .filter((p) => !p.excluded)
    .map((p) => p.elapsedDays)
    .sort((a, b) => a - b);
  return percentile(included, 80);
}

export interface LeadTimeSampleResult {
  median: number;
  p80: number;
  sampleCount: number;
  dateRange: { start: string; end: string };
}

/**
 * The editable-sample-size path (PRD-phase-2 §18.4/§37: "last 50 -> last
 * 100 orders"). Takes the N most-recent non-excluded receipts (by PO date)
 * and recomputes both statistics over just that subset — a genuinely
 * different basis, not a UI-only relabeling of the same fixed number.
 */
export function leadTimeStatisticForSample(materialId: string, sampleSize: number): LeadTimeSampleResult {
  const included = purchaseOrdersForMaterial(materialId)
    .filter((p) => !p.excluded)
    .sort((a, b) => (a.poDate < b.poDate ? 1 : -1)) // most recent first
    .slice(0, sampleSize);
  const elapsed = included.map((p) => p.elapsedDays).sort((a, b) => a - b);
  const dates = included.map((p) => p.goodsReceiptDate).sort();
  return {
    median: median(elapsed),
    p80: percentile(elapsed, 80),
    sampleCount: included.length,
    dateRange: { start: dates[0] ?? "", end: dates[dates.length - 1] ?? "" },
  };
}
