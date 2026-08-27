import { describe, it, expect } from "vitest";
import { buildHistogramModel, histogramBuckets, histogramDomain } from "./histogram";
import { labelAnchor } from "./axis";
import { purchaseOrdersForMaterial, leadTimeStatisticForSample } from "@/data/synthetic/execution-history";
import { materialById } from "@/data/synthetic/materials";

const FILM = "mat_printed_film";

describe("histogramDomain", () => {
  it("spans the sample AND every reference marker", () => {
    const d = histogramDomain([50, 60, 70], [{ value: 42 }, { value: 96 }]);
    expect(d.min).toBe(42);
    expect(d.max).toBe(96);
  });

  it("never returns a zero-width domain (would divide by zero downstream)", () => {
    expect(histogramDomain([5, 5, 5], []).max).toBeGreaterThan(histogramDomain([5, 5, 5], []).min);
    expect(histogramDomain([], []).max).toBeGreaterThan(histogramDomain([], []).min);
  });
});

describe("histogramBuckets", () => {
  it("keeps every observation — including the maximum, which sits on a boundary", () => {
    const values = [10, 20, 30, 40, 50];
    const buckets = histogramBuckets(values, 4, 10, 50);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(values.length);
    // 50 must land in the LAST bucket, not off the end
    expect(buckets[buckets.length - 1]!.count).toBeGreaterThan(0);
  });

  it("tiles the domain with equal, contiguous buckets", () => {
    const buckets = histogramBuckets([1, 2, 3], 5, 0, 10);
    expect(buckets).toHaveLength(5);
    expect(buckets[0]!.from).toBe(0);
    expect(buckets[4]!.to).toBeCloseTo(10, 9);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i]!.from).toBeCloseTo(buckets[i - 1]!.to, 9);
    }
  });
});

describe("lead-time histogram model — the axes the old chart did not have", () => {
  const values = purchaseOrdersForMaterial(FILM).filter((p) => !p.excluded).map((p) => p.elapsedDays);
  const material = materialById(FILM);
  const sample = leadTimeStatisticForSample(FILM, 130);
  const markers = [
    { label: "System", value: material.systemLeadTimeDays, token: "--state-formal" },
    { label: "Historical median", value: sample.median, token: "--state-historical" },
    { label: "Historical P80", value: sample.p80, token: "--state-inferred" },
  ];

  it("has a count (y) axis with integer ticks that covers the tallest bucket", () => {
    const model = buildHistogramModel(values, markers);
    const tallest = Math.max(...model.buckets.map((b) => b.count));
    expect(model.countAxis.ticks.length).toBeGreaterThanOrEqual(2);
    expect(model.countAxis.ticks.every(Number.isInteger)).toBe(true);
    expect(model.countAxis.max).toBeGreaterThanOrEqual(tallest);
  });

  it("has value (x) ticks inside the day domain", () => {
    const model = buildHistogramModel(values, markers);
    expect(model.valueTicks.length).toBeGreaterThanOrEqual(2);
    expect(Math.min(...model.valueTicks)).toBeGreaterThanOrEqual(model.min);
    expect(Math.max(...model.valueTicks)).toBeLessThanOrEqual(model.max);
  });

  it("loses no receipts to bucketing", () => {
    const model = buildHistogramModel(values, markers);
    expect(model.buckets.reduce((s, b) => s + b.count, 0)).toBe(values.length);
    expect(model.sampleCount).toBe(values.length);
  });

  it("places every marker inside the plot box with a label anchor that cannot clip", () => {
    const model = buildHistogramModel(values, markers);
    expect(model.markers).toHaveLength(markers.length);
    for (const m of model.markers) {
      expect(m.pct).toBeGreaterThanOrEqual(0);
      expect(m.pct).toBeLessThanOrEqual(100);
      expect(["start", "middle", "end"]).toContain(labelAnchor(m.pct));
    }
  });

  it("anchors a marker sitting on a domain edge so its label cannot be clipped", () => {
    const model = buildHistogramModel(
      [40, 45, 50, 55, 60],
      [
        { label: "System", value: 40, token: "--state-formal" },
        { label: "Historical P80", value: 60, token: "--state-inferred" },
      ]
    );
    expect(model.markers[0]!.pct).toBe(0);
    expect(model.markers[1]!.pct).toBe(100);
    expect(labelAnchor(model.markers[0]!.pct)).toBe("start");
    expect(labelAnchor(model.markers[1]!.pct)).toBe("end");
  });

  it("draws exactly the markers it is handed — a scenario overlay appears only when supplied", () => {
    const withoutScenario = buildHistogramModel(values, markers);
    expect(withoutScenario.markers.some((m) => m.token === "--state-scenario")).toBe(false);
    const withScenario = buildHistogramModel(values, [...markers, { label: "Scenario", value: 68, token: "--state-scenario" }]);
    expect(withScenario.markers.some((m) => m.token === "--state-scenario")).toBe(true);
    expect(withScenario.markers.every((m) => m.token.startsWith("--state-"))).toBe(true);
  });
});
