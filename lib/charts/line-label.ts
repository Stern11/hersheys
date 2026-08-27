import { PRODUCTION_LINES } from "@/data/synthetic/master-data";

/**
 * Display identity for a production line, read from the data layer.
 *
 * Charts previously derived a label with `lineId.replace("line_", "Line ")`,
 * which silently produced "Line 03" long after the data layer had been
 * renamed to the real Hershey plant lines ("Stuarts Draft L03"). Any chart
 * that needs to print a line must go through here so a future rename in
 * `data/synthetic/master-data.ts` propagates instead of drifting.
 *
 * An unknown id returns the raw id — never a fabricated "Line 0N".
 */
export function lineDisplay(lineId: string): { name: string; plant: string | null } {
  const line = PRODUCTION_LINES.find((l) => l.id === lineId);
  if (!line) return { name: lineId, plant: null };
  return { name: line.name, plant: line.plant };
}

export function lineDisplayName(lineId: string): string {
  return lineDisplay(lineId).name;
}
