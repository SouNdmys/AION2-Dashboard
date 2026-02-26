import { describe, expect, it } from "vitest";
import type { WorkshopPriceSignalRule } from "../../shared/types";
import { normalizeWorkshopPriceSignalQuery } from "./pricing-signal-query";
import { WORKSHOP_SIGNAL_THRESHOLD_MAX } from "./pricing-signal-rule";

const RULE: WorkshopPriceSignalRule = {
  enabled: true,
  lookbackDays: 30,
  dropBelowWeekdayAverageRatio: 0.15,
};

describe("workshop/pricing-signal-query", () => {
  it("uses rule defaults when payload is empty", () => {
    const normalized = normalizeWorkshopPriceSignalQuery(RULE);
    expect(normalized).toEqual({
      lookbackDays: 30,
      thresholdRatio: 0.15,
      effectiveThresholdRatio: 0.15,
      targetMarket: undefined,
    });
  });

  it("sanitizes payload lookback/threshold/market", () => {
    const normalized = normalizeWorkshopPriceSignalQuery(RULE, {
      lookbackDays: 0,
      thresholdRatio: 1,
      market: "bad-market" as never,
    });
    expect(normalized).toEqual({
      lookbackDays: 1,
      thresholdRatio: WORKSHOP_SIGNAL_THRESHOLD_MAX,
      effectiveThresholdRatio: WORKSHOP_SIGNAL_THRESHOLD_MAX,
      targetMarket: "single",
    });
  });
});
