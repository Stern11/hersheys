/**
 * Cell-value coercion for spreadsheet input.
 *
 * A planner pastes exports from several systems into one workbook, so a single
 * column can arrive as a number, a Date, an Excel serial, or a string with
 * thousands separators or a currency symbol. Everything that turns a cell into
 * a typed value lives here, and every failure is reported rather than silently
 * defaulted — fabricated precision is worse than an honest gap.
 */

/** Excel's day-zero is 1899-12-30 (the 1900 leap-year bug is baked in). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

/** Serials outside this range are far more likely to be a mis-typed number. */
const MIN_SERIAL = 1; // 1899-12-31
const MAX_SERIAL = 80_000; // ~2119

export function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof value === "number" && Number.isNaN(value))
  );
}

export function coerceString(value: unknown): string | undefined {
  if (isBlank(value)) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/**
 * Parses a numeric cell, tolerating the formatting a spreadsheet export
 * carries: thousands separators, a currency prefix, a trailing percent sign,
 * and accounting-style parentheses for negatives.
 */
export function coerceNumber(value: unknown): number | undefined {
  if (isBlank(value)) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value ? 1 : 0;

  let text = String(value).trim();
  if (text === "") return undefined;

  // Accounting negatives: (1,234) means -1234.
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  // Strip currency symbols, spaces (incl. non-breaking), and separators.
  text = text.replace(/[\s ]/g, "").replace(/[$£€¥₹]/g, "").replace(/,/g, "");

  const percent = text.endsWith("%");
  if (percent) text = text.slice(0, -1);

  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) return undefined;

  let n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  if (percent) n = n / 100;
  if (negative) n = -n;
  return n;
}

/**
 * Parses a percentage column that a planner may write either way: `90`,
 * `90%`, or `0.9` all mean 90%.
 *
 * The disambiguation rule is magnitude — a value above 1 is read as percentage
 * points. That makes an exact `1` mean 100%, not 1%, which is the reading a
 * planner intends for an allocation or utilisation column. Values that arrive
 * with an explicit `%` sign are already fractional from `coerceNumber` and are
 * passed through untouched.
 */
export function coercePercent(value: unknown): number | undefined {
  if (isBlank(value)) return undefined;
  const hadPercentSign = typeof value === "string" && value.trim().endsWith("%");
  const n = coerceNumber(value);
  if (n === undefined) return undefined;
  if (hadPercentSign) return n;
  return Math.abs(n) > 1 ? n / 100 : n;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const US_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;

/**
 * Parses a date cell to `YYYY-MM-DD`.
 *
 * Excel-native values (a real Date, or a serial number) are unambiguous and are
 * always accepted. Strings are accepted as ISO, and as `M/D/YYYY` because that
 * is what a US planning export produces. Anything else returns undefined and
 * the caller raises an issue asking for `YYYY-MM-DD` — guessing between
 * day-first and month-first would silently move a deadline.
 */
export function coerceDate(value: unknown): string | undefined {
  if (isBlank(value)) return undefined;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return toIsoDay(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < MIN_SERIAL || value > MAX_SERIAL) return undefined;
    return toIsoDay(new Date(EXCEL_EPOCH_MS + Math.round(value) * MS_PER_DAY));
  }

  const text = String(value).trim();
  if (text === "") return undefined;

  const iso = ISO_DATE.exec(text);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    return isRealDate(y, m, d) ? `${iso[1]}-${iso[2]}-${iso[3]}` : undefined;
  }

  const us = US_DATE.exec(text);
  if (us) {
    const m = Number(us[1]);
    const d = Number(us[2]);
    const y = Number(us[3]);
    return isRealDate(y, m, d)
      ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      : undefined;
  }

  return undefined;
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Reads a cell from a row by header name, tolerating the casing and spacing
 * drift between an export and the template (`Planned Units` -> `planned_units`).
 */
export function readCell(row: Record<string, unknown>, header: string): unknown {
  if (header in row) return row[header];
  const target = canonicalHeader(header);
  for (const key of Object.keys(row)) {
    if (canonicalHeader(key) === target) return row[key];
  }
  return undefined;
}

/** Lowercases and strips everything that is not a letter or digit. */
export function canonicalHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}
