import { describe, expect, it } from "vitest";
import type { WorkshopPriceHistoryPoint } from "../../shared/types";
import { buildWeekdayAverages, resolvePriceTrendAssessment } from "./pricing-analytics";

describe("workshop/pricing-analytics resolvePriceTrendAssessment", () => {
  it("returns watch when sample count is insufficient", () => {
    const result = resolvePriceTrendAssessment(2, -0.2, -0.2, 0.15, 5);
    expect(result.trendTag).toBe("watch");
    expect(result.reasons[0]).toContain("样本不足");
  });

  it("returns buy-zone when both weekday and ma7 meet buy thresholds", () => {
    const result = resolvePriceTrendAssessment(12, -0.2, -0.09, 0.15, 5);
    expect(result.trendTag).toBe("buy-zone");
    expect(result.confidenceScore).toBeGreaterThan(20);
  });

  it("returns sell-zone when both weekday and ma7 meet sell thresholds", () => {
    const result = resolvePriceTrendAssessment(12, 0.2, 0.09, 0.15, 5);
    expect(result.trendTag).toBe("sell-zone");
    expect(result.confidenceScore).toBeGreaterThan(20);
  });
});

describe("workshop/pricing-analytics buildWeekdayAverages", () => {
  it("aggregates by weekday correctly", () => {
    const points: WorkshopPriceHistoryPoint[] = [
      {
        id: "a",
        itemId: "item-1",
        unitPrice: 100,
        capturedAt: new Date("2026-02-23T10:00:00.000Z").toISOString(),
        weekday: 1,
        ma7: null,
        isSuspect: false,
      },
      {
        id: "b",
        itemId: "item-1",
        unitPrice: 140,
        capturedAt: new Date("2026-02-16T10:00:00.000Z").toISOString(),
        weekday: 1,
        ma7: null,
        isSuspect: false,
      },
      {
        id: "c",
        itemId: "item-1",
        unitPrice: 90,
        capturedAt: new Date("2026-02-24T10:00:00.000Z").toISOString(),
        weekday: 2,
        ma7: null,
        isSuspect: false,
      },
    ];

    const averages = buildWeekdayAverages(points);
    const monday = averages[1];
    const tuesday = averages[2];

    expect(monday.sampleCount).toBe(2);
    expect(monday.averagePrice).toBe(120);
    expect(tuesday.sampleCount).toBe(1);
    expect(tuesday.averagePrice).toBe(90);
  });
});
