import { describe, it, expect } from "vitest";
import { decisionDeadlineFromLeadTime, resolveLeadTimeDays } from "./lead-times";
import { materialById } from "@/data/synthetic/materials";
import { leadTimeP80 } from "@/data/synthetic/execution-history";
import { EVENTS } from "@/data/synthetic/events";

describe("resolveLeadTimeDays — System / Historical / Scenario basis resolution", () => {
  const printedFilm = materialById("mat_printed_film");
  // The observed P80 is computed from the raw receipts rather than hard-coded;
  // the static field on the material is kept in sync with it.
  const observedP80 = leadTimeP80(printedFilm.id);

  it("defaults to the system assumption with no override", () => {
    expect(resolveLeadTimeDays(printedFilm, observedP80)).toBe(42);
  });

  it("uses the historical median when basis is historical without a statistic override", () => {
    expect(resolveLeadTimeDays(printedFilm, observedP80, { selectedBasis: "historical" })).toBe(67);
  });

  it("uses the observed P80 when basis is historical with statistic=p80", () => {
    expect(resolveLeadTimeDays(printedFilm, observedP80, { selectedBasis: "historical", leadTimeStatistic: "p80" })).toBe(observedP80);
    // The stored P80 must agree with the statistic computed from the receipts,
    // or the two lead-time surfaces would report different numbers.
    expect(printedFilm.historicalP80LeadTimeDays).toBe(observedP80);
  });

  it("uses the explicit scenario value when basis is scenario", () => {
    expect(resolveLeadTimeDays(printedFilm, observedP80, { selectedBasis: "scenario", scenarioValue: 70 })).toBe(70);
  });
});

describe("decisionDeadlineFromLeadTime — deadline shift", () => {
  // Anchored on the real Halloween 2027 PRODUCTION window end, never on the
  // Sep-Oct sell-through window.
  const productionEnd = EVENTS.find((e) => e.id === "evt_halloween_2027")!.productionWindow.end;

  it("subtracts lead time in days from the production requirement date", () => {
    expect(productionEnd).toBe("2027-07-31");
    expect(decisionDeadlineFromLeadTime(productionEnd, 42)).toBe("2027-06-19");
  });

  it("moves the deadline earlier as lead time increases (System -> Historical P80)", () => {
    const withSystem = decisionDeadlineFromLeadTime(productionEnd, 42);
    const withP80 = decisionDeadlineFromLeadTime(productionEnd, leadTimeP80("mat_printed_film"));
    expect(withP80 < withSystem).toBe(true);
  });
});
