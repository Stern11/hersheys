/**
 * Test-only helpers that build workbooks in memory, so tests never depend on
 * a binary fixture file. Not imported by any production code path.
 */

import * as XLSX from "xlsx";
import type { SheetName } from "@/lib/dataset/issues";

export function buildTestWorkbook(sheets: Partial<Record<SheetName, Record<string, unknown>[]>>): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, rows] of Object.entries(sheets)) {
    if (!rows) continue;
    const worksheet = XLSX.utils.json_to_sheet(rows, { cellDates: true });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

/** A small, coherent, valid dataset spanning all 8 sheets. */
export function validSheets(): Partial<Record<SheetName, Record<string, unknown>[]>> {
  return {
    Business_Plan: [
      {
        planning_period: "2027-Halloween",
        event_or_program: "Halloween 2027",
        business_unit: "Confectionery",
        brand: "Ridgeline",
        target_value: 41500000,
        target_units: 9600000,
        customer: "Meridian Mass",
        channel: "mass",
        product_family: "Variety Bags",
        growth_pct: "6%",
        currency: "USD",
        notes: "Signed off in Aug S&OP",
      },
    ],
    Current_Plan: [
      {
        planning_period: "2027-Halloween",
        item_id: "SKU-4411",
        item_name: "Ridgeline Halloween Variety Bag 40ct",
        brand: "Ridgeline",
        product_family: "Variety Bags",
        planned_units: 1180000,
        event_or_program: "Halloween 2027",
        customer: "Meridian Mass",
        channel: "mass",
        planned_value: 5310000,
        currency: "USD",
        plant: "PLT-01",
        primary_line_id: "LINE-03",
        production_start_date: "2027-05-03",
        production_end_date: "2027-07-30",
        sales_start_date: "2027-08-16",
        sales_end_date: "2027-10-31",
        status: "firm",
      },
    ],
    Historical_Items: [
      {
        historical_period: "2026-Halloween",
        item_id: "SKU-3208",
        item_name: "Ridgeline Halloween Variety Bag 35ct",
        brand: "Ridgeline",
        product_family: "Variety Bags",
        actual_units: 1310000,
        event_or_program: "Halloween 2026",
        customer: "Meridian Mass",
        channel: "mass",
        pack_format: "laydown bag",
        pack_size: 35,
        size_uom: "ct",
        flavor_or_variant: "milk chocolate",
        formula_family: "milk-choc-std",
        packaging_type: "printed film",
        base_pack: "BP-VB-35",
        actual_value: 5760000,
        currency: "USD",
        plant: "PLT-01",
        primary_line_id: "LINE-03",
        production_start_date: "2026-05-04",
        production_end_date: "2026-07-31",
        sales_start_date: "2026-08-17",
        sales_end_date: "2026-10-31",
        status: "shipped",
      },
    ],
    BOM: [
      {
        parent_item_id: "SKU-3208",
        component_id: "MAT-COCOA",
        component_name: "Cocoa liquor",
        component_type: "RAW_MATERIAL",
        quantity_per_parent: 0.0182,
        uom: "kg",
        component_family: "Cocoa",
        valid_from: "2026-01-01",
        valid_to: "2027-12-31",
        scrap_pct: "2%",
        planning_status: "stable",
        supplier_id: "SUP-201",
        notes: "",
      },
      {
        parent_item_id: "SKU-3208",
        component_id: "MAT-FILM",
        component_name: "Printed film laminate",
        component_type: "PACKAGING",
        quantity_per_parent: 0.0094,
        uom: "kg",
        component_family: "Printed Film",
        valid_from: "2026-01-01",
        valid_to: "2027-12-31",
        scrap_pct: "3.5%",
        planning_status: "artwork pending",
        supplier_id: "SUP-118",
        notes: "Artwork drives lead time",
      },
    ],
    Line_Capacity: [
      {
        period: "2027-05",
        plant: "PLT-01",
        line_id: "LINE-03",
        line_name: "Line 03 — Bagging",
        base_calendar_hours: 940,
        planned_maintenance_hours: 60,
        project_downtime_hours: 0,
        labor_constraint_hours: 40,
        other_constraint_hours: 0,
        custom_adjustment_hours: 0,
        target_utilization_pct: "90%",
        notes: "",
      },
      {
        period: "2027-06",
        plant: "PLT-01",
        line_id: "LINE-03",
        line_name: "Line 03 — Bagging",
        base_calendar_hours: 940,
        planned_maintenance_hours: 120,
        project_downtime_hours: 60,
        labor_constraint_hours: 40,
        other_constraint_hours: 0,
        custom_adjustment_hours: 0,
        target_utilization_pct: "90%",
        notes: "Annual PM shutdown week",
      },
    ],
    Item_Line_Mapping: [
      {
        item_or_family_id: "Variety Bags",
        mapping_level: "PRODUCT_FAMILY",
        line_id: "LINE-03",
        run_rate_units_per_hour: 7950,
        priority: 1,
        allocation_pct: "70%",
        valid_from: "2027-01-01",
        valid_to: "2027-12-31",
        changeover_hours: 2.5,
        notes: "Primary bagging line",
      },
    ],
    Lead_Time_History: [
      {
        material_id: "MAT-FILM",
        material_name: "Printed film laminate",
        po_id: "PO-778201",
        po_date: "2026-02-11",
        receipt_date: "2026-04-19",
        quantity: 14000,
        uom: "kg",
        supplier_id: "SUP-118",
        supplier_name: "Northvale Flexibles",
        material_family: "Printed Film",
        specification_family: "laminate-7c",
        plant: "PLT-01",
        system_lead_time_days: 42,
      },
    ],
    Inventory_Supply: [
      {
        material_id: "MAT-COCOA",
        plant: "PLT-01",
        period: "2027-05",
        on_hand_qty: 82000,
        open_po_qty: 40000,
        planned_receipt_qty: 0,
        uom: "kg",
      },
    ],
  };
}
