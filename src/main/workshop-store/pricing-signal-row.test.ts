import { describe, expect, it } from "vitest";
import type { WorkshopItem, WorkshopPriceHistoryResult, WorkshopPriceSignalRow } from "../../shared/types";
import { buildWorkshopPriceSignalRow, sortWorkshopPriceSignalRows, summarizeWorkshopPriceSignalRows } from "./pricing-signal-row";

function buildHistory(partial?: Partial<WorkshopPriceHistoryResult>): WorkshopPriceHistoryResult {
  return {
    itemId: "item-1",
    fromAt: "2026-02-01T00:00:00.000Z",
    toAt: "2026-02-10T00:00:00.000Z",
    sampleCount: 10,
    suspectCount: 0,
    latestPrice: 80,
    latestCapturedAt: "2026-02-10T00:00:00.000Z",
    averagePrice: 100,
    ma7Latest: 90,
    points: [
      {
        id: "p1",
        itemId: "item-1",
        unitPrice: 80,
        capturedAt: "2026-02-10T00:00:00.000Z",
        weekday: 2,
        ma7: 90,
        market: "server",
        isSuspect: false,
      },
    ],
    suspectPoints: [],
    weekdayAverages: [{ weekday: 2, averagePrice: 100, sampleCount: 4 }],
    ...partial,
  };
}

const ITEM: WorkshopItem = {
  id: "item-1",
  name: "测试材料",
  category: "material",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("workshop/pricing-signal-row", () => {
  it("builds signal row from history metrics", () => {
    const row = buildWorkshopPriceSignalRow({
      item: ITEM,
      history: buildHistory(),
      targetMarket: "server",
      effectiveThresholdRatio: 0.15,
      ruleEnabled: true,
      minSampleCount: 5,
    });
    expect(row.itemId).toBe("item-1");
    expect(row.trendTag).toBe("buy-zone");
    expect(row.triggered).toBe(true);
    expect(row.deviationRatioFromWeekdayAverage).toBeCloseTo(-0.2);
    expect(row.deviationRatioFromMa7).toBeCloseTo(-0.111111, 5);
  });

  it("sorts rows by triggered/trend/confidence and summarizes counts", () => {
    const rows: WorkshopPriceSignalRow[] = [
      {
        itemId: "a",
        itemName: "A",
        latestPrice: 1,
        latestCapturedAt: null,
        latestWeekday: null,
        weekdayAveragePrice: null,
        deviationRatioFromWeekdayAverage: null,
        ma7Price: null,
        deviationRatioFromMa7: null,
        effectiveThresholdRatio: 0.15,
        trendTag: "watch",
        confidenceScore: 20,
        reasons: [],
        sampleCount: 1,
        triggered: false,
      },
      {
        itemId: "b",
        itemName: "B",
        latestPrice: 1,
        latestCapturedAt: null,
        latestWeekday: null,
        weekdayAveragePrice: null,
        deviationRatioFromWeekdayAverage: -0.2,
        ma7Price: null,
        deviationRatioFromMa7: null,
        effectiveThresholdRatio: 0.15,
        trendTag: "buy-zone",
        confidenceScore: 40,
        reasons: [],
        sampleCount: 10,
        triggered: true,
      },
      {
        itemId: "c",
        itemName: "C",
        latestPrice: 1,
        latestCapturedAt: null,
        latestWeekday: null,
        weekdayAveragePrice: null,
        deviationRatioFromWeekdayAverage: 0.3,
        ma7Price: null,
        deviationRatioFromMa7: null,
        effectiveThresholdRatio: 0.15,
        trendTag: "sell-zone",
        confidenceScore: 30,
        reasons: [],
        sampleCount: 10,
        triggered: false,
      },
    ];

    sortWorkshopPriceSignalRows(rows);
    expect(rows.map((row) => row.itemId)).toEqual(["b", "c", "a"]);

    const summary = summarizeWorkshopPriceSignalRows(rows);
    expect(summary).toEqual({
      triggeredCount: 1,
      buyZoneCount: 1,
      sellZoneCount: 1,
    });
  });
});
