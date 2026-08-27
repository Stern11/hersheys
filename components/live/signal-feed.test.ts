import { describe, expect, it } from "vitest";
import {
  formatAge,
  latestSignalTimestamp,
  recentSignals,
  signalsForGap,
  signalsFromTheFuture,
  sortSignalsByRecency,
  sourceFreshness,
  unknownGapLinks,
} from "./signal-feed";
import {
  INGESTION_SIGNALS,
  SIGNAL_CLOCK_NOW,
  SIGNAL_SOURCE_SYSTEMS,
  type IngestionSignal,
  type SignalSourceSystem,
} from "@/data/synthetic/signals";
import { detectPlanningGaps } from "@/lib/planning-engine/gaps";
import { DEMO_NOW } from "@/data/synthetic/master-data";

function signal(id: string, receivedAt: string, over: Partial<IngestionSignal> = {}): IngestionSignal {
  return {
    id,
    receivedAt,
    sourceSystem: "SAP S/4HANA",
    sourceRef: `ref_${id}`,
    kind: "item_master_change",
    headline: id,
    detail: id,
    entities: {},
    disposition: "ingested",
    ...over,
  };
}

describe("sortSignalsByRecency", () => {
  it("orders newest first", () => {
    const out = sortSignalsByRecency([
      signal("a", "2027-03-01T00:00:00.000Z"),
      signal("c", "2027-03-06T00:00:00.000Z"),
      signal("b", "2027-03-03T00:00:00.000Z"),
    ]);
    expect(out.map((s) => s.id)).toEqual(["c", "b", "a"]);
  });

  it("breaks exact timestamp ties by id, not by input order", () => {
    const t = "2027-03-04T12:00:00.000Z";
    const forward = sortSignalsByRecency([signal("z", t), signal("m", t), signal("a", t)]);
    const reversed = sortSignalsByRecency([signal("a", t), signal("m", t), signal("z", t)]);
    expect(forward.map((s) => s.id)).toEqual(["a", "m", "z"]);
    expect(reversed.map((s) => s.id)).toEqual(forward.map((s) => s.id));
  });

  it("does not mutate its input", () => {
    const input = [signal("a", "2027-03-01T00:00:00.000Z"), signal("b", "2027-03-05T00:00:00.000Z")];
    sortSignalsByRecency(input);
    expect(input.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("is stable across repeated calls on the real log", () => {
    const once = sortSignalsByRecency(INGESTION_SIGNALS).map((s) => s.id);
    const twice = sortSignalsByRecency(INGESTION_SIGNALS).map((s) => s.id);
    expect(twice).toEqual(once);
  });
});

describe("recentSignals", () => {
  it("returns the newest n, newest first", () => {
    expect(recentSignals(INGESTION_SIGNALS, 3).map((s) => s.id)).toEqual(
      sortSignalsByRecency(INGESTION_SIGNALS).slice(0, 3).map((s) => s.id)
    );
  });

  it("returns nothing for a non-positive limit and clamps to the log size", () => {
    expect(recentSignals(INGESTION_SIGNALS, 0)).toHaveLength(0);
    expect(recentSignals(INGESTION_SIGNALS, -1)).toHaveLength(0);
    expect(recentSignals(INGESTION_SIGNALS, 999)).toHaveLength(INGESTION_SIGNALS.length);
  });
});

describe("latestSignalTimestamp", () => {
  it("is the arrival time of the newest signal, not a wall clock", () => {
    const latest = latestSignalTimestamp(INGESTION_SIGNALS);
    expect(latest).toBe("2027-03-08T06:42:00.000Z");
    expect(latest).toBe(sortSignalsByRecency(INGESTION_SIGNALS)[0]!.receivedAt);
  });

  it("returns null rather than substituting now when nothing has arrived", () => {
    expect(latestSignalTimestamp([])).toBeNull();
  });
});

describe("sourceFreshness", () => {
  it("gives every roster system a row, including one that never reported", () => {
    const quiet = "Kinaxis RapidResponse" as SignalSourceSystem;
    const rows = sourceFreshness(
      INGESTION_SIGNALS.filter((s) => s.sourceSystem !== quiet),
      SIGNAL_SOURCE_SYSTEMS,
      SIGNAL_CLOCK_NOW
    );
    expect(rows).toHaveLength(SIGNAL_SOURCE_SYSTEMS.length);
    const row = rows.find((r) => r.sourceSystem === quiet)!;
    expect(row.lastReceivedAt).toBeNull();
    expect(row.ageMinutes).toBeNull();
    expect(row.signalCount).toBe(0);
  });

  it("derives age from the source's own newest signal", () => {
    const rows = sourceFreshness(INGESTION_SIGNALS, SIGNAL_SOURCE_SYSTEMS, SIGNAL_CLOCK_NOW);
    const edi850 = rows.find((r) => r.sourceSystem === "EDI 850")!;
    expect(edi850.lastReceivedAt).toBe("2027-03-08T06:42:00.000Z");
    // 06:42Z -> 09:00Z on the same day = 138 minutes.
    expect(edi850.ageMinutes).toBe(138);
  });

  it("preserves the roster order it was given", () => {
    const rows = sourceFreshness(INGESTION_SIGNALS, SIGNAL_SOURCE_SYSTEMS, SIGNAL_CLOCK_NOW);
    expect(rows.map((r) => r.sourceSystem)).toEqual([...SIGNAL_SOURCE_SYSTEMS]);
  });

  it("never reports a negative age", () => {
    const rows = sourceFreshness([signal("future", "2027-03-09T00:00:00.000Z")], ["SAP S/4HANA"], SIGNAL_CLOCK_NOW);
    expect(rows[0]!.ageMinutes).toBe(0);
  });
});

describe("formatAge", () => {
  it("reads both endpoints and never a clock", () => {
    expect(formatAge("2027-03-08T09:00:00.000Z", "2027-03-08T09:00:00.000Z")).toBe("just now");
    expect(formatAge("2027-03-08T08:15:00.000Z", "2027-03-08T09:00:00.000Z")).toBe("45m ago");
    expect(formatAge("2027-03-08T06:42:00.000Z", "2027-03-08T09:00:00.000Z")).toBe("2h ago");
    expect(formatAge("2027-03-06T15:12:00.000Z", "2027-03-08T09:00:00.000Z")).toBe("1d ago");
    expect(formatAge("2027-03-01T04:15:00.000Z", "2027-03-08T09:00:00.000Z")).toBe("7d ago");
  });
});

describe("the real ingestion log", () => {
  const gapIds = detectPlanningGaps().map((r) => r.gap.id);

  it("has unique signal ids", () => {
    expect(new Set(INGESTION_SIGNALS.map((s) => s.id)).size).toBe(INGESTION_SIGNALS.length);
  });

  it("links only to gap ids the engine actually detects", () => {
    // Guards the dead-link failure mode: a gap slug renamed in gaps.ts leaves
    // a signal pointing at /gaps/<nothing>, which renders fine and 404s on click.
    expect(unknownGapLinks(INGESTION_SIGNALS, gapIds)).toEqual([]);
  });

  it("links at least one signal to each of the gaps the Overview surfaces", () => {
    for (const id of ["halloween-2027", "printed-film-lead-time", "counter-display-line-mapping", "holiday-gift-tins-representation", "line-03-september-capacity"]) {
      expect(signalsForGap(INGESTION_SIGNALS, id).length, id).toBeGreaterThan(0);
    }
  });

  it("contains no signal that arrived after the demo clock", () => {
    expect(signalsFromTheFuture(INGESTION_SIGNALS, SIGNAL_CLOCK_NOW).map((s) => s.id)).toEqual([]);
  });

  it("anchors its clock to DEMO_NOW", () => {
    expect(SIGNAL_CLOCK_NOW).toBe(DEMO_NOW);
  });

  it("covers each source system the sync strip lists", () => {
    const present = new Set(INGESTION_SIGNALS.map((s) => s.sourceSystem));
    for (const sys of SIGNAL_SOURCE_SYSTEMS) {
      if (sys === "POS / Syndicated") continue; // deliberately quiet in this log
      expect([...present], sys).toContain(sys);
    }
  });

  it("covers the six required ingestion kinds", () => {
    const kinds = new Set(INGESTION_SIGNALS.map((s) => s.kind));
    for (const k of ["customer_po", "supplier_confirmation", "pos_sell_through", "item_master_change", "bom_change", "norm_alert"] as const) {
      expect([...kinds], k).toContain(k);
    }
  });

  it("never treats a Halloween sell-through window as a production window", () => {
    // The POS signal must be a PRIOR-season restatement: Halloween 2027
    // sells Sep-Oct 2027, which has not happened as of the demo clock.
    const pos = INGESTION_SIGNALS.filter((s) => s.kind === "pos_sell_through");
    expect(pos.length).toBeGreaterThan(0);
    for (const s of pos) {
      expect(new Date(s.receivedAt).getTime()).toBeLessThan(new Date("2027-09-01").getTime());
      expect(s.detail).toMatch(/2026/);
    }
  });
});
