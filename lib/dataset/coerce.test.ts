import { describe, it, expect } from "vitest";
import { canonicalHeader, coerceDate, coerceNumber, coercePercent, readCell } from "./coerce";

describe("coerceNumber", () => {
  it("passes plain numbers through unchanged", () => {
    expect(coerceNumber(42)).toBe(42);
    expect(coerceNumber(3.14)).toBe(3.14);
    expect(coerceNumber(0)).toBe(0);
    expect(coerceNumber(-7)).toBe(-7);
  });

  it("strips thousands separators", () => {
    expect(coerceNumber("1,234,567")).toBe(1234567);
  });

  it("strips a currency prefix and thousands separators together", () => {
    expect(coerceNumber("$1,234.50")).toBe(1234.5);
  });

  it("reads accounting-style parentheses as negative", () => {
    expect(coerceNumber("(1,234)")).toBe(-1234);
  });

  it("divides a trailing percent sign by 100", () => {
    expect(coerceNumber("12%")).toBe(0.12);
  });

  it("returns undefined for blank input", () => {
    expect(coerceNumber("")).toBeUndefined();
    expect(coerceNumber(null)).toBeUndefined();
    expect(coerceNumber(undefined)).toBeUndefined();
  });

  it("returns undefined for unparseable text", () => {
    expect(coerceNumber("abc")).toBeUndefined();
  });

  it("reads booleans as 1 and 0", () => {
    expect(coerceNumber(true)).toBe(1);
    expect(coerceNumber(false)).toBe(0);
  });
});

describe("coercePercent", () => {
  it("reads a whole number above 1 as percentage points", () => {
    expect(coercePercent(90)).toBe(0.9);
  });

  it("passes an explicit percent-sign string through as already-fractional", () => {
    expect(coercePercent("90%")).toBe(0.9);
  });

  it("passes a value already in 0-1 range through unchanged", () => {
    expect(coercePercent(0.9)).toBe(0.9);
  });

  it("reads an exact 1 as 100%, not 1%", () => {
    expect(coercePercent(1)).toBe(1);
  });

  it("reads a small percent string correctly", () => {
    expect(coercePercent("6%")).toBe(0.06);
  });

  it("reads a small whole number as percentage points", () => {
    expect(coercePercent(6)).toBe(0.06);
  });
});

describe("coerceDate", () => {
  it("accepts a Date object", () => {
    expect(coerceDate(new Date(Date.UTC(2027, 5, 15)))).toBe("2027-06-15");
  });

  it("accepts an Excel serial number, computed from the 1899-12-30 epoch", () => {
    const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
    const expected = new Date(EXCEL_EPOCH_MS + 45000 * 86_400_000).toISOString().slice(0, 10);
    expect(coerceDate(45000)).toBe(expected);
    expect(coerceDate(45000)).toBe("2023-03-15");
  });

  it("accepts an ISO date string", () => {
    expect(coerceDate("2027-06-15")).toBe("2027-06-15");
  });

  it("accepts a US-style M/D/YYYY string", () => {
    expect(coerceDate("6/15/2027")).toBe("2027-06-15");
  });

  it("rejects a string with an out-of-range month position (day>12 mistaken for month)", () => {
    // "15/06/2027" is read as M=15, D=06, Y=2027 by the US pattern — month 15
    // is impossible, so this must NOT be silently reinterpreted as day-first.
    expect(coerceDate("15/06/2027")).toBeUndefined();
  });

  it("rejects unparseable text", () => {
    expect(coerceDate("not a date")).toBeUndefined();
  });

  it("rejects an impossible calendar date", () => {
    expect(coerceDate("2027-02-30")).toBeUndefined();
  });

  it("rejects blank input", () => {
    expect(coerceDate("")).toBeUndefined();
    expect(coerceDate(null)).toBeUndefined();
    expect(coerceDate(undefined)).toBeUndefined();
  });
});

describe("readCell / canonicalHeader", () => {
  it("resolves an exact header match first", () => {
    expect(readCell({ planned_units: 5 }, "planned_units")).toBe(5);
  });

  it("resolves casing and spacing drift between an export header and the template", () => {
    expect(readCell({ "Planned Units": 5 }, "planned_units")).toBe(5);
    expect(readCell({ "PLANNED-UNITS": 7 }, "planned_units")).toBe(7);
  });

  it("returns undefined when no header matches", () => {
    expect(readCell({ foo: 1 }, "planned_units")).toBeUndefined();
  });

  it("canonicalizes by lowercasing and stripping non-alphanumerics", () => {
    expect(canonicalHeader("Planned Units")).toBe("plannedunits");
    expect(canonicalHeader("planned_units")).toBe("plannedunits");
    expect(canonicalHeader("Planned-Units!")).toBe("plannedunits");
  });
});
