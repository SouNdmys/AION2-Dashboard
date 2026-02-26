import { describe, expect, it } from "vitest";
import {
  WORKSHOP_HISTORY_DEFAULT_DAYS,
  WORKSHOP_HISTORY_MAX_DAYS,
  WORKSHOP_SIGNAL_THRESHOLD_DEFAULT,
  WORKSHOP_SIGNAL_THRESHOLD_MAX,
  WORKSHOP_SIGNAL_THRESHOLD_MIN,
  normalizeSignalRule,
  sanitizeLookbackDays,
  sanitizeSignalThresholdRatio,
} from "./pricing-signal-rule";

describe("workshop/pricing-signal-rule", () => {
  it("sanitizes lookback days into allowed range", () => {
    expect(sanitizeLookbackDays(undefined)).toBe(WORKSHOP_HISTORY_DEFAULT_DAYS);
    expect(sanitizeLookbackDays(0)).toBe(1);
    expect(sanitizeLookbackDays(12.9)).toBe(12);
    expect(sanitizeLookbackDays(9999)).toBe(WORKSHOP_HISTORY_MAX_DAYS);
  });

  it("sanitizes threshold ratio into allowed range", () => {
    expect(sanitizeSignalThresholdRatio(undefined)).toBe(WORKSHOP_SIGNAL_THRESHOLD_DEFAULT);
    expect(sanitizeSignalThresholdRatio(0.01)).toBe(WORKSHOP_SIGNAL_THRESHOLD_MIN);
    expect(sanitizeSignalThresholdRatio(0.2)).toBe(0.2);
    expect(sanitizeSignalThresholdRatio(1)).toBe(WORKSHOP_SIGNAL_THRESHOLD_MAX);
  });

  it("normalizes signal rule payload with defaults", () => {
    const normalized = normalizeSignalRule({
      enabled: false,
      lookbackDays: 0,
      dropBelowWeekdayAverageRatio: 0.8,
    });
    expect(normalized).toEqual({
      enabled: false,
      lookbackDays: 1,
      dropBelowWeekdayAverageRatio: WORKSHOP_SIGNAL_THRESHOLD_MAX,
    });
  });
});
