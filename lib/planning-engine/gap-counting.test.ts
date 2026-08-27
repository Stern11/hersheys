import { describe, it, expect } from "vitest";
import { GAP_TYPE_SURFACE, countActiveSituations, countConsequenceLenses, partitionGapsBySurface, summarizeTriage, triageBucketFor } from "./gap-counting";
import { detectPlanningGaps } from "./gaps";
import { GAP_CATEGORIES, categoryForGapType } from "@/components/gaps/gap-category";
import type { PlanningGapType } from "@/types/gaps";

const results = detectPlanningGaps();
const ALL_TYPES: PlanningGapType[] = ["demand", "representation", "product_uncertainty", "bom_uncertainty", "master_data", "capacity", "material"];

describe("gap counting — item 5: /gaps said 5, /decisions said 6", () => {
  it("classifies every gap type — nothing falls through to a default", () => {
    ALL_TYPES.forEach((t) => expect(GAP_TYPE_SURFACE[t]).toBeDefined());
    expect(Object.keys(GAP_TYPE_SURFACE).sort()).toEqual([...ALL_TYPES].sort());
  });

  it("loses nothing: situations + consequence lenses always equals the detected total", () => {
    const p = partitionGapsBySurface(results);
    expect(p.situations.length + p.consequenceLenses.length).toBe(results.length);
    expect(p.total).toBe(results.length);
  });

  it("agrees exactly with the category map the /gaps landing page itemizes by", () => {
    // The landing page lists a gap iff `categoryForGapType` gives it a slug.
    // If those two rules ever diverge, the header count stops matching the
    // rows underneath it — which is the bug this test exists to catch.
    const byCategory = results.filter((r) => categoryForGapType(r.gap.type) != null);
    expect(countActiveSituations(results)).toBe(byCategory.length);
    ALL_TYPES.forEach((t) => {
      expect(GAP_TYPE_SURFACE[t] === "situation").toBe(categoryForGapType(t) != null);
    });
  });

  it("every situation type has a category page to live on", () => {
    const slugs = GAP_CATEGORIES.map((c) => c.slug);
    ALL_TYPES.filter((t) => GAP_TYPE_SURFACE[t] === "situation").forEach((t) => {
      expect(slugs).toContain(categoryForGapType(t));
    });
  });

  it("accounts for the Line 03 capacity gap EXPLICITLY as a consequence lens, not by dropping it", () => {
    const line03 = results.find((r) => r.gap.id === "line-03-september-capacity");
    expect(line03).toBeDefined();
    expect(GAP_TYPE_SURFACE[line03!.gap.type]).toBe("consequence_lens");
    expect(partitionGapsBySurface(results).consequenceLenses).toContain(line03);
    expect(countConsequenceLenses(results)).toBeGreaterThan(0);
  });

  it("gives /gaps and /decisions the same number to print", () => {
    const situations = countActiveSituations(results);
    const untouched = summarizeTriage(results, { monitoredGapIds: [], validatedGapIds: [], dismissedGapIds: [], intentionalGapIds: [] });
    expect(untouched.open).toBe(situations);
    expect(untouched.total).toBe(situations);
  });
});

describe("triage bucketing — a gap is in exactly one bucket", () => {
  const triage = {
    monitoredGapIds: ["halloween-2027"],
    validatedGapIds: ["halloween-2027", "printed-film-lead-time"],
    dismissedGapIds: ["halloween-2027"],
    intentionalGapIds: [],
  };

  it("resolves overlapping triage marks by a fixed precedence rather than double-counting", () => {
    expect(triageBucketFor("halloween-2027", triage)).toBe("closed");
    expect(triageBucketFor("printed-film-lead-time", triage)).toBe("validated");
    expect(triageBucketFor("not-a-gap", triage)).toBe("open");
  });

  it("keeps the four bucket counts summing to the situation total no matter what is marked", () => {
    const counts = summarizeTriage(results, triage);
    expect(counts.open + counts.monitoring + counts.validated + counts.closed).toBe(counts.total);
    expect(counts.total).toBe(countActiveSituations(results));
  });

  it("moving a gap out of Open reduces Open by exactly one and never changes the total", () => {
    const empty = { monitoredGapIds: [], validatedGapIds: [], dismissedGapIds: [], intentionalGapIds: [] };
    const before = summarizeTriage(results, empty);
    const situation = partitionGapsBySurface(results).situations[0]!;
    const after = summarizeTriage(results, { ...empty, monitoredGapIds: [situation.gap.id] });
    expect(after.open).toBe(before.open - 1);
    expect(after.monitoring).toBe(1);
    expect(after.total).toBe(before.total);
  });
});
