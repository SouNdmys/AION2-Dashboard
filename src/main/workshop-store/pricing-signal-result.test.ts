import { describe, expect, it } from "vitest";
import { composeWorkshopPriceSignalResult } from "./pricing-signal-result";

describe("workshop/pricing-signal-result", () => {
  it("composes signal result payload", () => {
    const result = composeWorkshopPriceSignalResult({
      generatedAt: "2026-02-26T00:00:00.000Z",
      market: "server",
      lookbackDays: 30,
      thresholdRatio: 0.15,
      effectiveThresholdRatio: 0.15,
      ruleEnabled: true,
      triggeredCount: 2,
      buyZoneCount: 3,
      sellZoneCount: 1,
      rows: [],
    });

    expect(result).toEqual({
      generatedAt: "2026-02-26T00:00:00.000Z",
      market: "server",
      lookbackDays: 30,
      thresholdRatio: 0.15,
      effectiveThresholdRatio: 0.15,
      ruleEnabled: true,
      triggeredCount: 2,
      buyZoneCount: 3,
      sellZoneCount: 1,
      rows: [],
    });
  });
});
