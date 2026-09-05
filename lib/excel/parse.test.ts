import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "./parse";
import { buildTestWorkbook, validSheets } from "./fixtures";

describe("parseWorkbook", () => {
  it("parses every sheet of a valid workbook into raw rows keyed by header", () => {
    const buffer = buildTestWorkbook(validSheets());
    const parsed = parseWorkbook(buffer);

    expect(parsed.unknownSheets).toEqual([]);
    expect(parsed.sheets.get("Business_Plan")).toHaveLength(1);
    expect(parsed.sheets.get("Current_Plan")).toHaveLength(1);
    expect(parsed.sheets.get("BOM")).toHaveLength(2);

    const bpRow = parsed.sheets.get("Business_Plan")![0]!;
    expect(bpRow["planning_period"]).toBe("2027-Halloween");
    expect(bpRow["target_value"]).toBe(41500000);
  });

  it("records the workbook's own headers per sheet", () => {
    const buffer = buildTestWorkbook(validSheets());
    const parsed = parseWorkbook(buffer);
    const headers = parsed.headers.get("Business_Plan")!;
    expect(headers).toContain("planning_period");
    expect(headers).toContain("target_value");
  });

  it("returns Date objects for date-typed cells, not serials or strings", () => {
    const buffer = buildTestWorkbook({
      Current_Plan: [
        {
          planning_period: "2027-Halloween",
          item_id: "SKU-1",
          item_name: "Test item",
          brand: "Ridgeline",
          product_family: "Variety Bags",
          planned_units: 1000,
          production_start_date: new Date(Date.UTC(2027, 4, 3)),
        },
      ],
    });
    const parsed = parseWorkbook(buffer);
    const row = parsed.sheets.get("Current_Plan")![0]!;
    expect(row["production_start_date"]).toBeInstanceOf(Date);
  });

  it("returns real numbers for numeric cells, not strings", () => {
    const buffer = buildTestWorkbook(validSheets());
    const parsed = parseWorkbook(buffer);
    const row = parsed.sheets.get("Current_Plan")![0]!;
    expect(typeof row["planned_units"]).toBe("number");
  });

  it("ignores README and Example_Data tabs silently", () => {
    const buffer = buildTestWorkbook({
      ...validSheets(),
      // @ts-expect-error -- deliberately not a SheetName, simulating our own generated tabs
      README: [{ note: "read this" }],
    });
    const parsed = parseWorkbook(buffer);
    expect(parsed.unknownSheets).toEqual([]);
  });

  it("collects tabs it does not recognise as unknownSheets", () => {
    const buffer = buildTestWorkbook(validSheets());
    // buildTestWorkbook only accepts SheetName keys, so an extra unknown tab
    // is added directly with the raw xlsx API to exercise the same code path.
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = XLSX.utils.json_to_sheet([{ foo: "bar" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Vendor_Scorecard");
    const withExtra = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = parseWorkbook(withExtra);
    expect(parsed.unknownSheets).toContain("Vendor_Scorecard");
  });

  it("skips rows that are entirely blank", () => {
    const buffer = buildTestWorkbook({
      Business_Plan: [
        {
          planning_period: "2027-Halloween",
          event_or_program: "Halloween 2027",
          business_unit: "Confectionery",
          brand: "Ridgeline",
          target_value: 41500000,
        },
        { planning_period: null, event_or_program: null, business_unit: null, brand: null, target_value: null },
      ],
    });
    const parsed = parseWorkbook(buffer);
    expect(parsed.sheets.get("Business_Plan")).toHaveLength(1);
  });

  it("matches sheet names case/spacing-insensitively", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        planning_period: "2027-Halloween",
        event_or_program: "Halloween 2027",
        business_unit: "Confectionery",
        brand: "Ridgeline",
        target_value: 41500000,
      },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "business plan");
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = parseWorkbook(buffer);
    expect(parsed.sheets.get("Business_Plan")).toHaveLength(1);
    expect(parsed.unknownSheets).toEqual([]);
  });
});
