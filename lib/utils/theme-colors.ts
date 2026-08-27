/**
 * Resolves a CSS custom property (design token) to its current computed
 * value so canvas-based chart libraries (AG Charts) can use it directly —
 * canvas fillStyle/strokeStyle need a concrete color, not `var(--x)`.
 * Client-only; call inside a useEffect/useMemo after mount, never at module
 * scope (there is no `document` during SSR).
 */
export function resolveThemeColor(varName: string): string {
  if (typeof document === "undefined") return "#888888";
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || "#888888";
}

export const PLANNING_STATE_VAR: Record<string, string> = {
  formal: "--state-formal",
  validated: "--state-validated",
  inferred: "--state-inferred",
  scenario: "--state-scenario",
  historical: "--state-historical",
  unknown: "--state-unknown",
};

export const RISK_VAR: Record<string, string> = {
  positive: "--risk-positive",
  warning: "--risk-warning",
  critical: "--risk-critical",
};
