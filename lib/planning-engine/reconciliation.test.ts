import { describe, it, expect } from "vitest";
import { reconcileProvisional, totalRepresentedAfterReconciliation } from "./reconciliation";

describe("reconcileProvisional — double-count prevention", () => {
  it("matches the PRD's worked example exactly: 500k provisional, 420k formal -> 420k matched, 80k residual", () => {
    const record = reconcileProvisional({
      gapId: "gap_x",
      assumptionId: "assumption_x",
      formalObjectType: "sku",
      formalObjectId: "sku_1",
      matchConfidence: 0.9,
      priorProvisionalAmount: 500_000,
      formalizedAmount: 420_000,
    });
    expect(record.matchedAmount).toBe(420_000);
    expect(record.residualUnresolvedAmount).toBe(80_000);
  });

  it("never lets total representation equal formal + prior provisional (the double-count bug this exists to prevent)", () => {
    const record = reconcileProvisional({
      gapId: "gap_x",
      assumptionId: "assumption_x",
      formalObjectType: "sku",
      formalObjectId: "sku_1",
      matchConfidence: 0.9,
      priorProvisionalAmount: 500_000,
      formalizedAmount: 420_000,
    });
    const total = totalRepresentedAfterReconciliation(record);
    expect(total).toBe(500_000); // NOT 920_000
    expect(total).not.toBe(record.priorProvisionalAmount + record.formalizedAmount);
  });

  it("floors residual at zero when the formal amount meets or exceeds the prior provisional amount", () => {
    const record = reconcileProvisional({
      gapId: "gap_x",
      assumptionId: "assumption_x",
      formalObjectType: "demand_line",
      formalObjectId: "line_1",
      matchConfidence: 0.95,
      priorProvisionalAmount: 300_000,
      formalizedAmount: 350_000,
    });
    expect(record.matchedAmount).toBe(300_000);
    expect(record.residualUnresolvedAmount).toBe(0);
  });

  it("marks low-confidence matches as proposed rather than confirmed", () => {
    const record = reconcileProvisional({
      gapId: "gap_x",
      assumptionId: "assumption_x",
      formalObjectType: "bom",
      formalObjectId: "bom_1",
      matchConfidence: 0.4,
      priorProvisionalAmount: 100_000,
      formalizedAmount: 90_000,
    });
    expect(record.status).toBe("proposed_match");
    expect(record.reconciledAt).toBeUndefined();
  });
});
