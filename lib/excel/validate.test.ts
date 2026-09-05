import { describe, expect, it } from "vitest";
import { validateWorkbook } from "./validate";
import { buildTestWorkbook, validSheets } from "./fixtures";
import type { SheetName } from "@/lib/dataset/issues";

const OPTS = {
  fileName: "planning-upload.xlsx",
  planningNow: "2026-09-04",
  datasetId: "ds_test",
  datasetName: "Test Upload",
};

/** A fresh, mutable copy of the baseline valid sheets. */
function baseline(): Partial<Record<SheetName, Record<string, unknown>[]>> {
  return validSheets();
}

function row0(
  sheets: Partial<Record<SheetName, Record<string, unknown>[]>>,
  sheet: SheetName
): Record<string, unknown> {
  return { ...sheets[sheet]![0]! };
}

describe("validateWorkbook — clean input", () => {
  it("parses and validates a valid workbook clean", () => {
    const buffer = buildTestWorkbook(baseline());
    const result = validateWorkbook(buffer, OPTS);

    expect(result.dataset).not.toBeNull();
    expect(result.summary.errors).toBe(0);
    expect(result.summary.ready).toBe(true);
    expect(result.scope).not.toBeNull();
    expect(result.scope!.currentItemCount).toBe(1);
    expect(result.scope!.historicalItemCount).toBe(1);
    expect(result.scope!.lineCount).toBe(1);
    expect(result.scope!.bomComponentCount).toBe(2);
  });
});

describe("validateWorkbook — structural problems", () => {
  it("reports an error for a missing required sheet", () => {
    const sheets = baseline();
    delete sheets.Historical_Items;
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    expect(result.summary.ready).toBe(false);
    expect(result.issues.some((i) => i.code === "missing_sheet_Historical_Items")).toBe(true);
    // Still not structurally unusable — the workbook itself was readable.
    expect(result.dataset).not.toBeNull();
  });

  it("reports an error for a missing required column", () => {
    const sheets = baseline();
    const row = row0(sheets, "Current_Plan");
    delete row.item_id;
    sheets.Current_Plan = [row];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    expect(result.issues.some((i) => i.code === "missing_column_item_id" && i.sheet === "Current_Plan")).toBe(
      true
    );
    expect(result.summary.ready).toBe(false);
  });

  it("returns dataset: null only when the file cannot be read as a workbook at all", () => {
    // SheetJS is permissive about plain text (it happily reads it as a
    // one-sheet CSV-like workbook), so a genuinely unreadable file is
    // simulated the way it actually occurs: a corrupted/truncated .xlsx
    // (a broken zip), which XLSX.read throws on.
    const fullBuffer = buildTestWorkbook(baseline());
    const truncated = fullBuffer.slice(0, Math.floor(fullBuffer.byteLength / 3));
    const result = validateWorkbook(truncated, OPTS);

    expect(result.dataset).toBeNull();
    expect(result.scope).toBeNull();
    expect(result.issues.some((i) => i.code === "unreadable_workbook")).toBe(true);
  });
});

describe("validateWorkbook — row-level problems surfaced from normalize", () => {
  it("flags an invalid numeric value as an error", () => {
    const sheets = baseline();
    sheets.Business_Plan = [{ ...row0(sheets, "Business_Plan"), target_value: "not-a-number" }];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const issue = result.issues.find((i) => i.code === "invalid_target_value");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("error");
  });

  it("flags an invalid date as a warning, not a blocking error", () => {
    const sheets = baseline();
    sheets.Current_Plan = [{ ...row0(sheets, "Current_Plan"), production_start_date: "not-a-date" }];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const issue = result.issues.find((i) => i.code === "invalid_production_start_date");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
    expect(result.summary.ready).toBe(true);
  });

  it("flags an Item_Line_Mapping row referencing an unknown line as a warning", () => {
    const sheets = baseline();
    sheets.Item_Line_Mapping = [{ ...row0(sheets, "Item_Line_Mapping"), line_id: "LINE-99" }];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const issue = result.issues.find((i) => i.code === "unknown_line" && i.sheet === "Item_Line_Mapping");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
    expect(result.summary.ready).toBe(true);
  });

  it("flags a BOM row whose parent item does not exist as a warning", () => {
    const sheets = baseline();
    sheets.BOM = [{ ...row0(sheets, "BOM"), parent_item_id: "SKU-DOES-NOT-EXIST" }, sheets.BOM![1]!];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const issue = result.issues.find((i) => i.code === "unknown_parent" && i.sheet === "BOM");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("warning");
  });

  it("flags a duplicate item within one planning period as an error", () => {
    const sheets = baseline();
    const row = row0(sheets, "Current_Plan");
    sheets.Current_Plan = [row, { ...row }];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const issue = result.issues.find((i) => i.code === "duplicate_item_period");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("error");
    expect(result.summary.ready).toBe(false);
    // Only the first occurrence survives normalization.
    expect(result.dataset!.currentPlanItems).toHaveLength(1);
  });

  it("flags negative available hours after deductions as an error", () => {
    const sheets = baseline();
    sheets.Line_Capacity = [
      { ...row0(sheets, "Line_Capacity"), base_calendar_hours: 100, planned_maintenance_hours: 200 },
    ];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const issue = result.issues.find((i) => i.code === "negative_available_hours");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("error");
    expect(result.summary.ready).toBe(false);
  });

  it("computes available hours as base - maintenance - project - labor - other + custom", () => {
    const sheets = baseline();
    sheets.Line_Capacity = [
      {
        period: "2027-05",
        plant: "PLT-01",
        line_id: "LINE-03",
        line_name: "Line 03 — Bagging",
        base_calendar_hours: 1000,
        planned_maintenance_hours: 50,
        project_downtime_hours: 30,
        labor_constraint_hours: 20,
        other_constraint_hours: 10,
        custom_adjustment_hours: 15,
      },
    ];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    expect(result.dataset!.lineCapacity[0]!.availableHours).toBe(1000 - 50 - 30 - 20 - 10 + 15);
  });

  it("flags allocation_pct above 100% on one row as an error", () => {
    const sheets = baseline();
    sheets.Item_Line_Mapping = [{ ...row0(sheets, "Item_Line_Mapping"), allocation_pct: "150%" }];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const issue = result.issues.find((i) => i.code === "allocation_over_100");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("error");
    expect(result.summary.ready).toBe(false);
  });
});

describe("validateWorkbook — optional sheets absent", () => {
  it("degrades capabilities without blocking readiness, and explains what is unavailable", () => {
    const sheets = baseline();
    delete sheets.BOM;
    delete sheets.Line_Capacity;
    delete sheets.Item_Line_Mapping;
    delete sheets.Lead_Time_History;
    delete sheets.Inventory_Supply;
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    expect(result.summary.errors).toBe(0);
    expect(result.summary.ready).toBe(true);
    expect(result.scope!.capabilities.materials).toBe(false);
    expect(result.scope!.capabilities.capacity).toBe(false);
    expect(result.scope!.capabilities.leadTimeAnalysis).toBe(false);
    expect(result.scope!.capabilities.netRequirements).toBe(false);
    expect(result.scope!.unavailable.length).toBeGreaterThan(0);
    expect(result.scope!.unavailable.some((m) => m.toLowerCase().includes("bom"))).toBe(true);
    expect(result.summary.infos).toBeGreaterThan(0);
  });
});

describe("validateWorkbook — column mapping end to end", () => {
  it("auto-maps an alias header so the value reaches the dataset with no missing-column error", () => {
    const sheets = baseline();
    const row = row0(sheets, "Current_Plan");
    delete row.planned_units;
    row.forecast_qty = 1180000;
    sheets.Current_Plan = [row];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    expect(result.issues.some((i) => i.code === "missing_column_planned_units")).toBe(false);
    expect(result.dataset!.currentPlanItems[0]!.plannedUnits).toBe(1180000);
    const res = result.mapping.resolutions.find(
      (r) => r.sheet === "Current_Plan" && r.expected === "planned_units"
    );
    expect(res?.status).toBe("aliased");
  });

  it("keeps a genuinely unknown header as a mapping candidate", () => {
    const sheets = baseline();
    const row = row0(sheets, "Current_Plan");
    row.warehouse_zone = "Z4";
    sheets.Current_Plan = [row];
    const buffer = buildTestWorkbook(sheets);
    const result = validateWorkbook(buffer, OPTS);

    const res = result.mapping.resolutions.find(
      (r) => r.sheet === "Current_Plan" && r.expected === "planned_units"
    )!;
    expect(res.candidates).toContain("warehouse_zone");
  });
});
