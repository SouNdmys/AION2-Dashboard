import { describe, expect, it } from "vitest";
import type { WorkshopPriceSignalRule } from "../../shared/types";
import { mergeWorkshopSignalRule } from "./pricing-signal-rule-update";
import { WORKSHOP_SIGNAL_THRESHOLD_MAX, WORKSHOP_SIGNAL_THRESHOLD_MIN } from "./pricing-signal-rule";

const BASE_RULE: WorkshopPriceSignalRule = {
  enabled: true,
  lookbackDays: 30,
  dropBelowWeekdayAverageRatio: 0.15,
};

describe("workshop/pricing-signal-rule-update", () => {
  it("keeps current values when patch fields are omitted", () => {
    expect(mergeWorkshopSignalRule(BASE_RULE, {})).toEqual(BASE_RULE);
  });

  it("updates enabled and sanitizes lookback/threshold", () => {
    const merged = mergeWorkshopSignalRule(BASE_RULE, {
      enabled: false,
      lookbackDays: 0,
      dropBelowWeekdayAverageRatio: 1,
    });
    expect(merged).toEqual({
      enabled: false,
      lookbackDays: 1,
      dropBelowWeekdayAverageRatio: WORKSHOP_SIGNAL_THRESHOLD_MAX,
    });
  });

  it("clamps threshold lower bound", () => {
    const merged = mergeWorkshopSignalRule(BASE_RULE, {
      dropBelowWeekdayAverageRatio: 0.01,
    });
    expect(merged.dropBelowWeekdayAverageRatio).toBe(WORKSHOP_SIGNAL_THRESHOLD_MIN);
  });
});
