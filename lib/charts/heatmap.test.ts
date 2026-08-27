import { describe, it, expect } from "vitest";
import { bandBg, bandFg, heatmapLegend, utilizationBand } from "./heatmap";

describe("utilizationBand", () => {
  it("bands against the ceiling and the target headroom", () => {
    expect(utilizationBand(0.7)).toBe("positive");
    expect(utilizationBand(0.9)).toBe("positive");
    expect(utilizationBand(0.901)).toBe("warning");
    expect(utilizationBand(0.92)).toBe("warning");
    expect(utilizationBand(1)).toBe("warning");
    expect(utilizationBand(1.01)).toBe("critical");
  });

  it("honours a bucket's own target rather than a hard-coded 90%", () => {
    expect(utilizationBand(0.82, 0.8)).toBe("warning");
    expect(utilizationBand(0.82, 0.85)).toBe("positive");
  });

  it("does not colour NaN as a risk", () => {
    expect(utilizationBand(Number.NaN)).toBe("positive");
  });
});

describe("heatmap colour tokens", () => {
  it("utilization status uses --risk-* only, never a --state-* data-series token", () => {
    for (const band of ["positive", "warning", "critical"] as const) {
      expect(bandBg(band)).toBe(`var(--risk-${band}-soft)`);
      expect(bandFg(band)).toBe(`var(--risk-${band})`);
      expect(bandBg(band)).not.toContain("--state-");
      expect(bandFg(band)).not.toContain("--state-");
    }
  });
});

describe("heatmapLegend", () => {
  it("states the thresholds actually in use", () => {
    const legend = heatmapLegend(0.9);
    expect(legend.map((l) => l.band)).toEqual(["positive", "warning", "critical"]);
    expect(legend[0]!.label).toContain("90%");
    expect(legend[1]!.label).toContain("90");
    expect(legend[2]!.label).toContain("100%");
  });

  it("tracks a non-default target so the key can never lie about the colours", () => {
    expect(heatmapLegend(0.8)[0]!.label).toContain("80%");
  });
});
