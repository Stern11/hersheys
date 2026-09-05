/**
 * Header mapping — matching a workbook's own column headers to the template's
 * expected columns (V2 §29). This is basic auto-mapping, not an ETL product:
 * exact match, then a declared alias, then give up and surface the header as
 * a mapping candidate for the planner (or an explicit manual override) to
 * resolve.
 */

import { canonicalHeader } from "@/lib/dataset/coerce";
import type { SheetName } from "@/lib/dataset/issues";
import { sheetSpec, WORKBOOK_SCHEMA } from "@/lib/excel/schema";
import type { ParsedWorkbook } from "@/lib/excel/parse";
import type { RawRow } from "@/types/dataset";

export interface ColumnResolution {
  sheet: SheetName;
  /** Template column name. */
  expected: string;
  /** Header in the workbook it resolved to. */
  found: string | null;
  status: "exact" | "aliased" | "unresolved";
  /** Headers in this sheet not used by any expected column — mapping candidates. */
  candidates: string[];
}

export interface MappingPlan {
  resolutions: ColumnResolution[];
  /** sheet -> (workbook header -> template column) applied before normalize. */
  overrides: Map<SheetName, Map<string, string>>;
  /** True when every REQUIRED column of every present sheet resolved. */
  complete: boolean;
}

export function planColumnMapping(
  parsed: ParsedWorkbook,
  manual?: Map<SheetName, Map<string, string>>
): MappingPlan {
  const resolutions: ColumnResolution[] = [];
  const overrides = new Map<SheetName, Map<string, string>>();
  let complete = true;

  for (const [sheetName, headerList] of parsed.headers) {
    const spec = sheetSpec(sheetName);
    const manualForSheet = manual?.get(sheetName);

    // Index workbook headers by canonical form (a workbook should not have
    // two headers that canonicalize the same, but guard against it by
    // keeping the first occurrence).
    const byCanonical = new Map<string, string>();
    for (const header of headerList) {
      const key = canonicalHeader(header);
      if (!byCanonical.has(key)) byCanonical.set(key, header);
    }

    const usedHeaders = new Set<string>();
    const sheetOverrides = new Map<string, string>();

    for (const col of spec.columns) {
      let found: string | null = null;
      let status: ColumnResolution["status"] = "unresolved";

      const manualHeader = manualForSheet?.get(col.name);
      if (manualHeader !== undefined && headerList.includes(manualHeader)) {
        found = manualHeader;
        status = manualHeader === col.name ? "exact" : "aliased";
      } else {
        const exact = byCanonical.get(canonicalHeader(col.name));
        if (exact !== undefined) {
          found = exact;
          status = "exact";
        } else {
          for (const alias of col.aliases ?? []) {
            const aliased = byCanonical.get(canonicalHeader(alias));
            if (aliased !== undefined) {
              found = aliased;
              status = "aliased";
              break;
            }
          }
        }
      }

      if (found !== null) {
        usedHeaders.add(found);
        if (found !== col.name) sheetOverrides.set(found, col.name);
      } else if (col.required) {
        complete = false;
      }

      resolutions.push({ sheet: sheetName, expected: col.name, found, status, candidates: [] });
    }

    const candidates = headerList.filter((h) => !usedHeaders.has(h));
    for (const res of resolutions) {
      if (res.sheet === sheetName) res.candidates = candidates;
    }

    if (sheetOverrides.size > 0) overrides.set(sheetName, sheetOverrides);
  }

  // Sheets required by the schema but entirely absent from the workbook are
  // handled by validate.ts (a "missing sheet" issue) — not this mapping
  // pass, which only maps columns of sheets that are actually present.
  for (const spec of WORKBOOK_SCHEMA) {
    if (spec.required && !parsed.headers.has(spec.name)) {
      complete = false;
    }
  }

  return { resolutions, overrides, complete };
}

/** Applies a mapping plan, renaming workbook headers to template column names. */
export function applyMapping(parsed: ParsedWorkbook, plan: MappingPlan): Map<SheetName, RawRow[]> {
  const out = new Map<SheetName, RawRow[]>();

  for (const [sheetName, rows] of parsed.sheets) {
    const sheetOverrides = plan.overrides.get(sheetName);
    if (!sheetOverrides || sheetOverrides.size === 0) {
      out.set(sheetName, rows);
      continue;
    }

    const mapped = rows.map((row) => {
      const newRow: RawRow = {};
      for (const [header, value] of Object.entries(row)) {
        const templateName = sheetOverrides.get(header);
        newRow[templateName ?? header] = value;
      }
      return newRow;
    });
    out.set(sheetName, mapped);
  }

  return out;
}
