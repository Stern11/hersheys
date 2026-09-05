import { describe, expect, it } from "vitest";
import { DEMO_PLANNING_NOW, generateDemoDataset } from "@/lib/dataset/demo/generate";
import { buildSituations } from "@/lib/situations/build";
import {
  applyScenarioToDataset,
  capacityKey,
  clamp,
  countAdjustments,
  diffAdjustments,
  mappingKey,
} from "./scenario";
import { EMPTY_ADJUSTMENTS, type ScenarioAdjustments } from "@/types/situation";

// Pinned to the demo's native anchor: the app defaults `planningNow` to
// the real current date, so a test that did not pin it would drift.
const dataset = generateDemoDataset({ planningNow: DEMO_PLANNING_NOW });

function adjustments(partial: Partial<ScenarioAdjustments>): ScenarioAdjustments {
  return { ...EMPTY_ADJUSTMENTS, ...partial };
}

describe("applyScenarioToDataset", () => {
  it("returns the same object when there is nothing to apply", () => {
    expect(applyScenarioToDataset(dataset, EMPTY_ADJUSTMENTS)).toBe(dataset);
  });

  it("never mutates the baseline", () => {
    const row = dataset.lineCapacity[0]!;
    const before = row.availableHours;
    applyScenarioToDataset(
      dataset,
      adjustments({ availableHours: { [capacityKey(row.lineId, row.period)]: 123 } })
    );
    expect(dataset.lineCapacity[0]!.availableHours).toBe(before);
  });

  it("substitutes available hours for exactly the addressed line and month", () => {
    const row = dataset.lineCapacity[0]!;
    const key = capacityKey(row.lineId, row.period);
    const applied = applyScenarioToDataset(dataset, adjustments({ availableHours: { [key]: 400 } }));

    const changed = applied.lineCapacity.find((r) => capacityKey(r.lineId, r.period) === key);
    expect(changed?.availableHours).toBe(400);

    // Every other row is passed through untouched, by reference.
    const others = applied.lineCapacity.filter((r) => capacityKey(r.lineId, r.period) !== key);
    for (const other of others) {
      const original = dataset.lineCapacity.find(
        (r) => capacityKey(r.lineId, r.period) === capacityKey(other.lineId, other.period)
      );
      expect(other).toBe(original);
    }
  });

  it("clamps an implausible value rather than accepting it", () => {
    const row = dataset.lineCapacity[0]!;
    const key = capacityKey(row.lineId, row.period);
    const applied = applyScenarioToDataset(
      dataset,
      adjustments({ availableHours: { [key]: 999_999 } })
    );
    expect(applied.lineCapacity.find((r) => capacityKey(r.lineId, r.period) === key)?.availableHours).toBe(2000);

    const negative = applyScenarioToDataset(dataset, adjustments({ availableHours: { [key]: -50 } }));
    expect(negative.lineCapacity.find((r) => capacityKey(r.lineId, r.period) === key)?.availableHours).toBe(0);
  });

  it("substitutes run rate and allocation on a mapping", () => {
    const mapping = dataset.itemLineMappings[0]!;
    const key = mappingKey(mapping.itemOrFamilyId, mapping.lineId);
    const applied = applyScenarioToDataset(
      dataset,
      adjustments({ runRate: { [key]: 5000 }, allocation: { [key]: 0.25 } })
    );
    const changed = applied.itemLineMappings.find(
      (r) => mappingKey(r.itemOrFamilyId, r.lineId) === key
    );
    expect(changed?.runRateUnitsPerHour).toBe(5000);
    expect(changed?.allocationPct).toBe(0.25);
  });
});

describe("scenario results flow through the planning engine", () => {
  it("cutting a line's available hours raises its effective utilisation", () => {
    const baseline = buildSituations(dataset)[0]!;
    const cell = baseline.capacityExposure.cells.find((c) => c.unresolvedHours > 0);
    expect(cell).toBeDefined();
    if (!cell) return;

    const halved = Math.round(cell.availableHours / 2);
    const applied = applyScenarioToDataset(
      dataset,
      adjustments({ availableHours: { [capacityKey(cell.lineId, cell.period)]: halved } })
    );
    const scenario = buildSituations(applied).find((s) => s.id === baseline.id)!;
    const after = scenario.capacityExposure.cells.find(
      (c) => c.lineId === cell.lineId && c.period === cell.period
    )!;

    expect(after.availableHours).toBe(halved);
    // Required hours are unchanged; only the denominator moved.
    expect(after.effectiveHours).toBeCloseTo(cell.effectiveHours, 5);
    expect(after.effectiveUtilization).toBeGreaterThan(cell.effectiveUtilization);
  });

  it("a lead-time override moves the material decision date and is labelled as scenario", () => {
    const baseline = buildSituations(dataset).find((s) => s.materialExposure.rows.length > 0)!;
    const material = baseline.materialExposure.rows[0]!;

    const scenario = buildSituations(dataset, {
      leadTimeOverrideDays: { [material.materialId]: material.leadTimeDays + 30 },
    }).find((s) => s.id === baseline.id)!;
    const after = scenario.materialExposure.rows.find((r) => r.materialId === material.materialId)!;

    expect(after.leadTimeDays).toBe(material.leadTimeDays + 30);
    expect(after.leadTimeBasis).toBe("scenario");
    // A longer lead time means the order must be placed earlier.
    expect(after.decisionDate < material.decisionDate).toBe(true);
  });
});

describe("diffAdjustments", () => {
  it("lists a real change with its baseline, scenario and delta", () => {
    const row = dataset.lineCapacity[0]!;
    const key = capacityKey(row.lineId, row.period);
    const target = row.availableHours - 100;

    const diffs = diffAdjustments(dataset, adjustments({ availableHours: { [key]: target } }));
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.baseline).toBe(row.availableHours);
    expect(diffs[0]?.scenario).toBe(target);
    expect(diffs[0]?.delta).toBe(-100);
    expect(diffs[0]?.unit).toBe("h");
    expect(diffs[0]?.label).toContain(row.lineName);
  });

  it("omits a value the planner set back to the baseline", () => {
    const row = dataset.lineCapacity[0]!;
    const key = capacityKey(row.lineId, row.period);
    expect(diffAdjustments(dataset, adjustments({ availableHours: { [key]: row.availableHours } }))).toEqual([]);
  });

  it("ignores a key that addresses nothing in the dataset", () => {
    expect(
      diffAdjustments(dataset, adjustments({ availableHours: { "LINE-99::2027-06": 500 } }))
    ).toEqual([]);
  });
});

describe("helpers", () => {
  it("counts adjustments across every category", () => {
    expect(countAdjustments(EMPTY_ADJUSTMENTS)).toBe(0);
    expect(
      countAdjustments(
        adjustments({ availableHours: { a: 1, b: 2 }, leadTimeDays: { c: 3 }, runRate: { d: 4 } })
      )
    ).toBe(4);
  });

  it("clamps to the given range", () => {
    expect(clamp(5, { min: 0, max: 10 })).toBe(5);
    expect(clamp(-1, { min: 0, max: 10 })).toBe(0);
    expect(clamp(11, { min: 0, max: 10 })).toBe(10);
  });
});
