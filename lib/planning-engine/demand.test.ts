import { describe, it, expect } from "vitest";
import { businessToPlanReconciliation } from "./demand";

describe("businessToPlanReconciliation — unresolved demand calculation", () => {
  it("computes unresolved demand as expected minus formal when formal is behind", () => {
    const result = businessToPlanReconciliation(3_800_000, 4_752_000);
    expect(result.unresolvedAmount).toBe(952_000);
    expect(result.representedAmount).toBe(3_800_000);
    expect(result.completenessRatio).toBeCloseTo(3_800_000 / 4_752_000, 6);
  });

  it("floors unresolved demand at zero when the formal plan already meets or exceeds expected", () => {
    const result = businessToPlanReconciliation(5_000_000, 4_752_000);
    expect(result.unresolvedAmount).toBe(0);
    // unexplainedVarianceAmount is allowed to go negative — it is not clamped —
    // to preserve the fact that the plan is over-represented, not just "resolved".
    expect(result.unexplainedVarianceAmount).toBeLessThan(0);
    expect(result.completenessRatio).toBe(1);
  });

  it("treats zero expected demand as fully complete rather than dividing by zero", () => {
    const result = businessToPlanReconciliation(0, 0);
    expect(result.completenessRatio).toBe(1);
    expect(result.unresolvedAmount).toBe(0);
  });
});
