export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function fmtNum1(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);
}

export function fmtPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/* ---- V2 planning formatters -------------------------------------- */

/**
 * Money at a glance: `$174M`. Planning conversations happen in millions, and a
 * fully written-out figure costs more attention than it returns.
 */
export function fmtMoney(n: number, currency = "USD"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}${symbol}${Math.round(abs / 1_000)}K`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "$",
  AUD: "$",
  MXN: "$",
  INR: "₹",
};

/** Units at a glance: `38.7M units`, `912K`, `4,180`. */
export function fmtUnits(n: number, withSuffix = false): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const suffix = withSuffix ? " units" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M${suffix}`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1_000)}K${suffix}`;
  return `${sign}${fmtNum(abs)}${suffix}`;
}

export function fmtHours(n: number): string {
  return `${fmtNum(Math.round(n))}h`;
}

/**
 * Runway in the words a planner uses. Past deadlines read as overdue rather
 * than as a negative number.
 */
export function fmtWeeks(weeks: number): string {
  if (weeks < 0) return `${Math.abs(weeks)}w overdue`;
  if (weeks === 0) return "this week";
  return `${weeks}w`;
}

/** Short date for dense rows: `15 Jun 27`. */
export function fmtDateShort(iso: string): string {
  const date = new Date(iso.length > 10 ? iso : `${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
