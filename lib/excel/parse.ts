/**
 * Workbook -> raw rows.
 *
 * This is the only file that touches `xlsx` directly. `xlsx` (SheetJS) is
 * browser-safe, so parsing can run entirely client-side — the workbook
 * contents never need to leave the browser (V2 §36).
 */

import * as XLSX from "xlsx";
import { canonicalHeader } from "@/lib/dataset/coerce";
import { SHEET_NAMES, type SheetName } from "@/lib/dataset/issues";
import type { RawRow } from "@/types/dataset";

/** Tabs the generated template carries that are never treated as data. */
const IGNORED_TABS = new Set(["readme", "exampledata"]);

/** Sheet name -> array of raw rows keyed by the workbook's own headers. */
export interface ParsedWorkbook {
  sheets: Map<SheetName, RawRow[]>;
  /** Tabs found in the file that we don't recognise. */
  unknownSheets: string[];
  /** Per recognised sheet, the header strings actually present. */
  headers: Map<SheetName, string[]>;
}

const CANONICAL_TO_SHEET: Map<string, SheetName> = new Map(
  SHEET_NAMES.map((name) => [canonicalHeader(name), name])
);

export function parseWorkbook(data: ArrayBuffer): ParsedWorkbook {
  const workbook = XLSX.read(data, { type: "array", cellDates: true, raw: true });

  const sheets = new Map<SheetName, RawRow[]>();
  const headers = new Map<SheetName, string[]>();
  const unknownSheets: string[] = [];

  for (const tabName of workbook.SheetNames) {
    const canonical = canonicalHeader(tabName);
    if (IGNORED_TABS.has(canonical)) continue;

    const sheetName = CANONICAL_TO_SHEET.get(canonical);
    const worksheet = workbook.Sheets[tabName];
    if (!worksheet) continue;

    if (!sheetName) {
      unknownSheets.push(tabName);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
      defval: null,
      raw: true,
      blankrows: false,
    });

    // sheet_to_json with blankrows:false already drops fully-blank rows, but
    // a row of only-whitespace strings/defval nulls can still slip through
    // when at least one cell has a formula artifact — belt and suspenders.
    const nonBlank = rows.filter((row) => Object.values(row).some((v) => !isEffectivelyBlank(v)));

    sheets.set(sheetName, nonBlank);

    const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
    const headerRow: string[] = [];
    if (range) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = worksheet[cellRef];
        const value = cell?.v;
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          headerRow.push(String(value).trim());
        }
      }
    }
    headers.set(sheetName, headerRow);
  }

  return { sheets, unknownSheets, headers };
}

function isEffectivelyBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}
