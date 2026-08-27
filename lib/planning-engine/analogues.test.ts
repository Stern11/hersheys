import { describe, it, expect } from "vitest";
import { resolveActiveAnalogues, blendAnalogueBom, analogueSetStrength } from "./analogues";
import { summarizeReadinessCounts, bomReadinessScore } from "./confidence";
import { calculateScenario } from "./scenarios";
import { buildValentinesScenarioInput } from "./gaps";
import { ANALOGUES } from "@/data/synthetic/products";
import type { Analogue, BomComponent } from "@/types/planning";

const MD = "prod_mothers_day_tin_2027"; // similarity 0.86 — the strong analogue
const HOLIDAY = "prod_holiday_premium_tin"; // similarity 0.64 — the weaker one
const MD_ID = "analogue_mothers_day_tin";
const HOLIDAY_ID = "analogue_holiday_premium_tin";

const run = (analogues: NonNullable<Parameters<typeof buildValentinesScenarioInput>[1]>["analogues"]) =>
  calculateScenario(buildValentinesScenarioInput("scn_analogue_test", { analogues }));

const weights = (md: number, holiday: number) => ({ weights: { [MD]: md, [HOLIDAY]: holiday } });

describe("resolveActiveAnalogues — weights normalize", () => {
  it("normalizes to 1 across the active set, whatever scale the planner types in", () => {
    const asFractions = resolveActiveAnalogues(ANALOGUES, weights(0.86, 0.64));
    const asPercents = resolveActiveAnalogues(ANALOGUES, weights(86, 64));
    expect(asFractions.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1, 10);
    // Only the RELATIVE size matters: 86/64 and 0.86/0.64 are the same basis.
    // (Raw weights are clamped to 0-1, so the percent form saturates — what
    // matters is that neither form produces weights outside 0-1.)
    asPercents.forEach((w) => expect(w.weight).toBeGreaterThanOrEqual(0));
    expect(asPercents.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1, 10);
  });

  it("defaults to similarity-proportional weights when the planner has set none", () => {
    const resolved = resolveActiveAnalogues(ANALOGUES, undefined);
    expect(resolved.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1, 10);
    const md = resolved.find((w) => w.analogue.candidateProductId === MD)!;
    expect(md.weight).toBeCloseTo(0.86 / (0.86 + 0.64), 6);
  });

  it("clamps a negative weight to zero rather than letting an analogue count against the blend", () => {
    const resolved = resolveActiveAnalogues(ANALOGUES, weights(-1, 0.64));
    expect(resolved.find((w) => w.analogue.candidateProductId === MD)!.weight).toBe(0);
    expect(resolved.find((w) => w.analogue.candidateProductId === HOLIDAY)!.weight).toBeCloseTo(1, 10);
  });

  it("yields an all-zero (not NaN, not stale) basis when every weight is zero", () => {
    const resolved = resolveActiveAnalogues(ANALOGUES, weights(0, 0));
    expect(resolved.map((w) => w.weight)).toEqual([0, 0]);
    expect(analogueSetStrength(resolved)).toBe(0);
  });

  it("returns nothing when every analogue is removed", () => {
    expect(resolveActiveAnalogues(ANALOGUES, { removedAnalogueIds: [MD_ID, HOLIDAY_ID] })).toEqual([]);
    expect(analogueSetStrength([])).toBe(0);
  });
});

describe("blendAnalogueBom — confidence is continuous and support-weighted", () => {
  const strong: Analogue = { id: "a_strong", candidateProductId: "p_strong", similarityScore: 0.9, sameDimensions: [], differentDimensions: [], dataQuality: "high", bomAvailable: true, lineHistoryAvailable: true };
  const weak: Analogue = { id: "a_weak", candidateProductId: "p_weak", similarityScore: 0.5, sameDimensions: [], differentDimensions: [], dataQuality: "low", bomAvailable: true, lineHistoryAvailable: true };
  const row = (parent: string, materialId: string, qty: number): BomComponent => ({
    id: `${parent}_${materialId}`,
    parentProductId: parent,
    materialId,
    quantityPerUnit: qty,
    uom: "kg",
    provenance: "formal",
    confidence: 1,
    readiness: "plan_now",
  });
  const boms = new Map([
    ["p_strong", [row("p_strong", "shared", 2), row("p_strong", "strong_only", 5)]],
    ["p_weak", [row("p_weak", "shared", 4), row("p_weak", "weak_only", 7)]],
  ]);

  it("scores a unanimously-supported component at the weighted mean similarity", () => {
    const blended = blendAnalogueBom(resolveActiveAnalogues([strong, weak], { weights: { p_strong: 0.5, p_weak: 0.5 } }), boms);
    expect(blended.get("shared")!.confidence).toBeCloseTo(0.5 * 0.9 + 0.5 * 0.5, 6);
    expect(blended.get("shared")!.supportWeight).toBeCloseTo(1, 6);
    // Quantity stays coverage-normalized: it answers "how much IF present".
    expect(blended.get("shared")!.quantityPerUnit).toBeCloseTo(3, 6);
  });

  it("discounts a component only one analogue evidences by that analogue's share of the basis", () => {
    const blended = blendAnalogueBom(resolveActiveAnalogues([strong, weak], { weights: { p_strong: 0.5, p_weak: 0.5 } }), boms);
    expect(blended.get("strong_only")!.confidence).toBeCloseTo(0.5 * 0.9, 6);
    expect(blended.get("weak_only")!.confidence).toBeCloseTo(0.5 * 0.5, 6);
  });

  it("moves confidence CONTINUOUSLY as a weight approaches zero — no cliff at exactly 0", () => {
    const at = (w: number) => blendAnalogueBom(resolveActiveAnalogues([strong, weak], { weights: { p_strong: w, p_weak: 0.5 } }), boms).get("strong_only")!.confidence;
    const nearZero = at(0.001);
    const zero = at(0);
    expect(zero).toBe(0);
    expect(nearZero).toBeGreaterThan(0);
    expect(nearZero).toBeLessThan(0.01); // approaches 0 smoothly rather than jumping from 0.9
  });

  it("keeps a zero-support row instead of deleting it, so aggregates keep a stable denominator", () => {
    const blended = blendAnalogueBom(resolveActiveAnalogues([strong, weak], { weights: { p_strong: 0, p_weak: 1 } }), boms);
    expect(blended.size).toBe(3);
    expect(blended.get("strong_only")).toMatchObject({ confidence: 0, supportWeight: 0, quantityPerUnit: 0 });
  });
});

/* ---------------------------------------------------------------------- *
 * Punch item 17, end-to-end through calculateScenario.
 * ---------------------------------------------------------------------- */

describe("Valentine's analogue mix — item 17", () => {
  it("readiness is monotonic in weight: lowering the STRONG analogue's weight never raises it", () => {
    const full = run(weights(0.86, 0.64));
    const lowered = run(weights(0.4, 0.64));
    const zeroed = run(weights(0, 0.64));

    expect(lowered.bomReadinessScore).toBeLessThan(full.bomReadinessScore);
    expect(zeroed.bomReadinessScore).toBeLessThan(lowered.bomReadinessScore);
  });

  it("raising the strong analogue's weight raises readiness — the relationship runs both ways", () => {
    const base = run(weights(0.86, 0.64));
    const stronger = run(weights(1, 0.3));
    expect(stronger.bomReadinessScore).toBeGreaterThan(base.bomReadinessScore);
  });

  it("component counts always sum to the component total, at every weight", () => {
    [weights(0.86, 0.64), weights(0.4, 0.64), weights(0, 0.64), weights(0, 0), weights(1, 0)].forEach((override) => {
      const r = run(override);
      const c = r.readinessCounts;
      expect(c.planNow + c.review + c.wait + c.unknown).toBe(c.total);
      expect(c.total).toBe(r.materialReadiness.length);
    });
  });

  it("a zero-weight analogue's exclusive component is COUNTED as unknown, not silently dropped", () => {
    // The "6 of 7 components" bug: Roasted Peanut Paste is only in the
    // Mother's Day BOM, so zeroing that analogue left it unclassified and it
    // vanished from a plan/review/wait tally that still claimed to be the BOM.
    const zeroed = run(weights(0, 0.64));
    const peanut = zeroed.materialReadiness.find((m) => m.materialId === "mat_peanut_paste");
    expect(peanut).toBeDefined();
    expect(peanut!.confidence).toBe(0);
    expect(peanut!.readiness).toBe("unknown");
    expect(zeroed.readinessCounts.unknown).toBeGreaterThanOrEqual(1);
  });

  it("excluding every analogue collapses confidence toward zero instead of freezing it", () => {
    const full = run(weights(0.86, 0.64));
    const none = run({ removedAnalogueIds: [MD_ID, HOLIDAY_ID] });

    expect(none.materialReadiness).toHaveLength(0);
    expect(none.bomReadinessScore).toBe(0);
    expect(none.confidence.overall).toBeLessThan(full.confidence.overall);
    // The analogue basis must still be REPRESENTED in the breakdown — scoring
    // 0 — rather than dropping out and leaving the average to the forecast
    // dimensions alone (which is how 65% survived an empty analogue set).
    const analogueDim = none.confidence.dimensions.find((d) => d.dimension === "analogue_quality");
    expect(analogueDim).toBeDefined();
    expect(analogueDim!.score).toBe(0);
  });

  it("zeroing every weight is as weak a basis as removing every analogue", () => {
    const zeroWeights = run(weights(0, 0));
    const analogueDim = zeroWeights.confidence.dimensions.find((d) => d.dimension === "analogue_quality" && d.note?.startsWith("Analogue basis strength"));
    expect(analogueDim!.score).toBe(0);
    expect(zeroWeights.bomReadinessScore).toBe(0);
  });
});

describe("summarizeReadinessCounts / bomReadinessScore invariants", () => {
  it("counts every row exactly once, including 'unknown' and 'monitor'", () => {
    const counts = summarizeReadinessCounts([
      { readiness: "plan_now" },
      { readiness: "review" },
      { readiness: "review" },
      { readiness: "wait" },
      { readiness: "unknown" },
      { readiness: "monitor" },
    ]);
    expect(counts).toEqual({ planNow: 1, review: 2, wait: 1, unknown: 2, total: 6 });
    expect(counts.planNow + counts.review + counts.wait + counts.unknown).toBe(counts.total);
  });

  it("scores an empty BOM at 0 rather than dividing by zero", () => {
    expect(bomReadinessScore([])).toBe(0);
  });
});
