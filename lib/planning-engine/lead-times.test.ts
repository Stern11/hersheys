import { describe, it, expect } from "vitest";
import { decisionDeadlineFromLeadTime, resolveLeadTimeDays } from "./lead-times";
import { materialById } from "@/data/synthetic/materials";

describe("resolveLeadTimeDays — System / Historical / Scenario basis resolution", () => {
  const printedFilm = materialById("mat_printed_film");

  it("defaults to the system assumption with no override", () => {
    expect(resolveLeadTimeDays(printedFilm, 81)).toBe(42);
  });

  it("uses the historical median when basis is historical without a statistic override", () => {
    expect(resolveLeadTimeDays(printedFilm, 81, { selectedBasis: "historical" })).toBe(67);
  });

  it("uses the observed P80 when basis is historical with statistic=p80", () => {
    expect(resolveLeadTimeDays(printedFilm, 81, { selectedBasis: "historical", leadTimeStatistic: "p80" })).toBe(81);
  });

  it("uses the explicit scenario value when basis is scenario", () => {
    expect(resolveLeadTimeDays(printedFilm, 81, { selectedBasis: "scenario", scenarioValue: 70 })).toBe(70);
  });
});

describe("decisionDeadlineFromLeadTime — deadline shift", () => {
  it("subtracts lead time in days from the production requirement date", () => {
    expect(decisionDeadlineFromLeadTime("2027-10-15", 42)).toBe("2027-09-03");
  });

  it("moves the deadline earlier as lead time increases (System -> Historical P80)", () => {
    const withSystem = decisionDeadlineFromLeadTime("2027-10-15", 42);
    const withP80 = decisionDeadlineFromLeadTime("2027-10-15", 81);
    expect(withP80 < withSystem).toBe(true);
  });
});
