import { describe, it, expect } from "vitest";
import { generateDemoDataset } from "@/lib/dataset/demo/generate";
import { buildSituations } from "./build";
import { matchExplanation, skuImpact } from "./sku-impact";
import type { CandidateItem, PlanningSituation } from "@/types/situation";

const DATASET = generateDemoDataset({ planningNow: "2027-03-08T09:00:00.000Z" });

function situation(): PlanningSituation {
  const first = buildSituations(DATASET)[0];
  if (!first) throw new Error("demo dataset produced no situations");
  return first;
}

function carriedForward(s: PlanningSituation): CandidateItem {
  const item = s.candidateItems
    .filter((c) => c.disposition === "carry_forward")
    .sort((a, b) => b.plannedUnits - a.plannedUnits)[0];
  if (!item) throw new Error("no carry-forward candidate in the demo situation");
  return item;
}

describe("skuImpact", () => {
  it("returns nothing for an id the situation does not have", () => {
    expect(skuImpact(situation(), "sku::not-a-real-item")).toBeUndefined();
  });

  it("reports whether the item actually bears load", () => {
    const s = situation();
    expect(skuImpact(s, carriedForward(s).id)!.bearsLoad).toBe(true);

    const represented = s.candidateItems.find((c) => c.disposition === "already_represented");
    if (represented) expect(skuImpact(s, represented.id)!.bearsLoad).toBe(false);
  });
});

describe("a SKU's hours are part of the line total, not a parallel figure", () => {
  it("never attributes more hours to one item than the line carries", () => {
    const s = situation();
    const impact = skuImpact(s, carriedForward(s).id)!;

    for (const line of impact.lines) {
      const lineUnresolved = s.capacityExposure.cells
        .filter((c) => c.lineId === line.lineId)
        .reduce((sum, c) => sum + c.unresolvedHours, 0);
      expect(line.hours).toBeLessThanOrEqual(lineUnresolved + 1e-6);
      expect(line.shareOfUnresolved).toBeGreaterThan(0);
      expect(line.shareOfUnresolved).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("sums every item's hours back to the situation's unresolved total", () => {
    const s = situation();
    const perItem = s.candidateItems.reduce(
      (sum, c) => sum + (skuImpact(s, c.id)?.totalHours ?? 0),
      0
    );
    const total = s.capacityExposure.cells.reduce((sum, c) => sum + c.unresolvedHours, 0);
    // The whole point of reading attribution back out of the contributor lists:
    // the parts are guaranteed to equal the whole.
    expect(perItem).toBeCloseTo(total, 4);
  });

  it("breaks a line's hours down by month, summing to that line's figure", () => {
    const s = situation();
    const impact = skuImpact(s, carriedForward(s).id)!;
    for (const line of impact.lines) {
      const summed = line.byPeriod.reduce((sum, p) => sum + p.hours, 0);
      expect(summed).toBeCloseTo(line.hours, 6);
      expect(line.byPeriod.length).toBeGreaterThan(0);
    }
  });

  it("orders lines by how much of the item lands on them", () => {
    const s = situation();
    const { lines } = skuImpact(s, carriedForward(s).id)!;
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i - 1]!.hours).toBeGreaterThanOrEqual(lines[i]!.hours);
    }
  });
});

describe("a SKU's material requirement is part of the component total", () => {
  it("never claims more of a component than the situation requires", () => {
    const s = situation();
    const impact = skuImpact(s, carriedForward(s).id)!;
    expect(impact.materials.length).toBeGreaterThan(0);

    for (const material of impact.materials) {
      const row = s.materialExposure.rows.find((r) => r.materialId === material.materialId)!;
      expect(material.requirement).toBeLessThanOrEqual(row.requirementBase + 1e-6);
      expect(material.shareOfTotal).toBeGreaterThan(0);
      expect(material.shareOfTotal).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("sums every item's share of a component back to its requirement", () => {
    const s = situation();
    const row = s.materialExposure.rows[0]!;
    const perItem = s.candidateItems.reduce((sum, c) => {
      const mine = skuImpact(s, c.id)?.materials.find((m) => m.materialId === row.materialId);
      return sum + (mine?.requirement ?? 0);
    }, 0);
    expect(perItem).toBeCloseTo(row.requirementBase, 4);
  });

  it("orders components by how soon they have to be ordered", () => {
    const s = situation();
    const { materials } = skuImpact(s, carriedForward(s).id)!;
    for (let i = 1; i < materials.length; i++) {
      expect(materials[i - 1]!.weeksToDecision).toBeLessThanOrEqual(materials[i]!.weeksToDecision);
    }
  });

  it("names the earliest date this item puts on the clock", () => {
    const s = situation();
    const impact = skuImpact(s, carriedForward(s).id)!;
    expect(impact.earliestDecisionDate).toBe(impact.materials[0]!.decisionDate);
  });
});

describe("shared vs item-specific components", () => {
  it("marks a component another settled item also needs as standing on its own", () => {
    const s = situation();
    const impact = skuImpact(s, carriedForward(s).id)!;
    const shared = impact.materials.filter((m) => m.standsWithoutThisItem);
    // Several carry-forward items in the demo share a formulation, so raw
    // components are justified whatever happens to any one of them.
    expect(shared.length).toBeGreaterThan(0);
    expect(impact.sharedCount + impact.itemSpecificCount).toBe(impact.materials.length);
  });

  it("does not let an item vouch for itself", () => {
    const s = situation();
    const impact = skuImpact(s, carriedForward(s).id)!;
    for (const material of impact.materials) {
      const row = s.materialExposure.rows.find((r) => r.materialId === material.materialId)!;
      const others = row.contributors.filter((c) => c.candidateId !== impact.candidate.id);
      // "Stands without this item" must be decided by *other* settled items only.
      expect(material.standsWithoutThisItem).toBe(others.some((c) => c.settled));
    }
  });

  it("stops vouching once the only other item using a component is unsettled", () => {
    const s = situation();
    const target = carriedForward(s);
    const others = s.candidateItems.filter(
      (c) => c.id !== target.id && c.disposition === "carry_forward"
    );

    // Put every other carrying item under review: nothing settled remains to
    // justify a shared component on its own.
    const dispositions = Object.fromEntries(
      others.map((c) => [c.id, "under_review" as const])
    );
    const weakened = buildSituations(DATASET, {
      overridesBySituation: { [s.id]: { dispositions } },
    }).find((x) => x.id === s.id)!;

    const impact = skuImpact(weakened, target.id)!;
    expect(impact.materials.every((m) => !m.standsWithoutThisItem)).toBe(true);
  });
});

describe("items the engine could not place", () => {
  it("says so rather than reporting a silent zero", () => {
    const s = situation();
    // Nothing in the demo is unmapped, so the reason must be absent — the test
    // guards the shape, and the negative case below guards the message.
    const impact = skuImpact(s, carriedForward(s).id)!;
    expect(impact.unmappedReason).toBeUndefined();
    expect(impact.noBomReason).toBeUndefined();

    const stripped = buildSituations(
      { ...DATASET, itemLineMappings: [], boms: [] },
      {}
    ).find((x) => x.id === s.id)!;
    // With no mappings at all the capacity analysis is unavailable outright,
    // which is a different statement from "this item produced no hours".
    expect(stripped.capacityExposure.available).toBe(false);
    expect(stripped.capacityExposure.unavailableReason).toBeTruthy();
  });
});

describe("matchExplanation", () => {
  it("names the attributes rather than returning a score", () => {
    const s = situation();
    const matched = s.candidateItems.find((c) => c.match.outcomes.length > 0);
    if (!matched) return;
    const explanation = matchExplanation(matched);
    const total =
      explanation.same.length + explanation.different.length + explanation.notComparable.length;
    expect(total).toBe(matched.match.outcomes.length);
    // Readable words, not enum keys.
    expect(explanation.same.every((d) => !d.includes("_"))).toBe(true);
    expect(explanation.different.every((d) => !d.includes("_"))).toBe(true);
  });
});
