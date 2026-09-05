import { describe, expect, it } from "vitest";
import { parseWorkbook } from "./parse";
import { applyMapping, planColumnMapping } from "./column-mapping";
import { buildTestWorkbook, validSheets } from "./fixtures";
import type { SheetName } from "@/lib/dataset/issues";

describe("planColumnMapping", () => {
  it("resolves every column exactly when headers match the template", () => {
    const buffer = buildTestWorkbook(validSheets());
    const parsed = parseWorkbook(buffer);
    const plan = planColumnMapping(parsed);

    expect(plan.complete).toBe(true);
    const businessPlanCols = plan.resolutions.filter((r) => r.sheet === "Business_Plan");
    for (const res of businessPlanCols) {
      if (res.found !== null) expect(res.status).toBe("exact");
    }
  });

  it("auto-maps an alias header to its template column", () => {
    const buffer = buildTestWorkbook({
      Current_Plan: [
        {
          planning_period: "2027-Halloween",
          item_id: "SKU-1",
          item_name: "Test item",
          brand: "Ridgeline",
          product_family: "Variety Bags",
          // alias for planned_units
          forecast_qty: 1000,
        },
      ],
    });
    const parsed = parseWorkbook(buffer);
    const plan = planColumnMapping(parsed);

    const res = plan.resolutions.find((r) => r.sheet === "Current_Plan" && r.expected === "planned_units");
    expect(res?.status).toBe("aliased");
    expect(res?.found).toBe("forecast_qty");
    // Business_Plan and Historical_Items are still entirely absent from this
    // workbook, so the plan as a whole is not complete.
    expect(plan.complete).toBe(false);
  });

  it("keeps a genuinely unknown header as a mapping candidate", () => {
    const buffer = buildTestWorkbook({
      Current_Plan: [
        {
          planning_period: "2027-Halloween",
          item_id: "SKU-1",
          item_name: "Test item",
          brand: "Ridgeline",
          product_family: "Variety Bags",
          planned_units: 1000,
          warehouse_zone: "Z4", // not a template column, not an alias of one
        },
      ],
    });
    const parsed = parseWorkbook(buffer);
    const plan = planColumnMapping(parsed);

    const res = plan.resolutions.find((r) => r.sheet === "Current_Plan" && r.expected === "planned_units")!;
    expect(res.candidates).toContain("warehouse_zone");

    const unresolved = plan.resolutions.filter((r) => r.sheet === "Current_Plan" && r.status === "unresolved");
    expect(unresolved.every((r) => r.expected !== "warehouse_zone")).toBe(true);
  });

  it("marks a required column unresolved when neither the exact name nor an alias is present", () => {
    const buffer = buildTestWorkbook({
      Current_Plan: [
        {
          planning_period: "2027-Halloween",
          item_name: "Test item",
          brand: "Ridgeline",
          product_family: "Variety Bags",
          planned_units: 1000,
          // item_id / sku / material_number / etc missing entirely
        },
      ],
    });
    const parsed = parseWorkbook(buffer);
    const plan = planColumnMapping(parsed);

    const res = plan.resolutions.find((r) => r.sheet === "Current_Plan" && r.expected === "item_id");
    expect(res?.status).toBe("unresolved");
    expect(res?.found).toBeNull();
    expect(plan.complete).toBe(false);
  });

  it("lets a manual override win even when an alias would resolve differently", () => {
    const buffer = buildTestWorkbook({
      Current_Plan: [
        {
          planning_period: "2027-Halloween",
          item_id: "SKU-1",
          item_name: "Test item",
          brand: "Ridgeline",
          product_family: "Variety Bags",
          quantity: 1000, // an alias of planned_units — would normally win
          qty_input: 1200, // what we'll manually point planned_units at instead
        },
      ],
    });
    const parsed = parseWorkbook(buffer);
    const manual = new Map<SheetName, Map<string, string>>([
      ["Current_Plan", new Map([["planned_units", "qty_input"]])],
    ]);
    const plan = planColumnMapping(parsed, manual);

    const res = plan.resolutions.find((r) => r.sheet === "Current_Plan" && r.expected === "planned_units");
    expect(res?.found).toBe("qty_input");
  });
});

describe("applyMapping", () => {
  it("renames workbook headers to template column names", () => {
    const buffer = buildTestWorkbook({
      Current_Plan: [
        {
          planning_period: "2027-Halloween",
          item_id: "SKU-1",
          item_name: "Test item",
          brand: "Ridgeline",
          product_family: "Variety Bags",
          forecast_qty: 1000,
        },
      ],
    });
    const parsed = parseWorkbook(buffer);
    const plan = planColumnMapping(parsed);
    const mapped = applyMapping(parsed, plan);

    const row = mapped.get("Current_Plan")![0]!;
    expect(row["planned_units"]).toBe(1000);
    expect(row["forecast_qty"]).toBeUndefined();
  });

  it("leaves rows untouched when a sheet has no overrides to apply", () => {
    const buffer = buildTestWorkbook(validSheets());
    const parsed = parseWorkbook(buffer);
    const plan = planColumnMapping(parsed);
    const mapped = applyMapping(parsed, plan);

    expect(mapped.get("Business_Plan")).toEqual(parsed.sheets.get("Business_Plan"));
  });
});
