import { describe, expect, it, vi } from "vitest";
import type { WorkshopPriceSignalResult, WorkshopState } from "../../shared/types";
import { getWorkshopPriceSignalsByQuery } from "./pricing-signal-read";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [
    {
      id: "item-1",
      name: "item-1",
      category: "material",
      createdAt: "2026-02-26T00:00:00.000Z",
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
  ],
  recipes: [],
  prices: [],
  inventory: [],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

describe("workshop/pricing-signal-read", () => {
  it("orchestrates read/normalize/build/sort/summarize/compose", async () => {
    const readState = vi.fn(() => BASE_STATE);
    const normalizeQuery = vi.fn(() => ({
      lookbackDays: 10,
      thresholdRatio: 0.2,
      targetMarket: "server" as const,
      effectiveThresholdRatio: 0.2,
    }));
    const rows = [
      {
        itemId: "item-1",
        itemName: "item-1",
        market: "server" as const,
        latestPrice: 100,
        latestCapturedAt: "2026-02-26T00:00:00.000Z",
        latestWeekday: 1,
        weekdayAveragePrice: 120,
        deviationRatioFromWeekdayAverage: -0.1,
        ma7Price: 125,
        deviationRatioFromMa7: -0.2,
        effectiveThresholdRatio: 0.2,
        trendTag: "buy-zone" as const,
        confidenceScore: 80,
        reasons: ["x"],
        sampleCount: 9,
        triggered: true,
      },
    ];
    const buildRows = vi.fn(async () => rows);
    const sortRows = vi.fn((signalRows) => signalRows);
    const summarizeRows = vi.fn(() => ({
      triggeredCount: 1,
      buyZoneCount: 1,
      sellZoneCount: 0,
    }));
    const result: WorkshopPriceSignalResult = {
      generatedAt: "2026-02-26T12:00:00.000Z",
      market: "server",
      lookbackDays: 10,
      thresholdRatio: 0.2,
      effectiveThresholdRatio: 0.2,
      ruleEnabled: true,
      triggeredCount: 1,
      buyZoneCount: 1,
      sellZoneCount: 0,
      rows,
    };
    const composeResult = vi.fn(() => result);
    const buildHistoryResult = vi.fn(() => ({
      itemId: "item-1",
      market: "server" as const,
      fromAt: "2026-02-01T00:00:00.000Z",
      toAt: "2026-02-26T00:00:00.000Z",
      sampleCount: 0,
      suspectCount: 0,
      latestPrice: null,
      latestCapturedAt: null,
      averagePrice: null,
      ma7Latest: null,
      points: [],
      suspectPoints: [],
      weekdayAverages: [],
    }));
    const yieldToEventLoop = vi.fn(async () => undefined);
    const nowIso = vi.fn(() => "2026-02-26T12:00:00.000Z");

    const actual = await getWorkshopPriceSignalsByQuery(
      { lookbackDays: 10 },
      {
        readState,
        normalizeQuery,
        buildRows,
        buildHistoryResult,
        yieldToEventLoop,
        sortRows,
        summarizeRows,
        composeResult,
        minSampleCount: 8,
        yieldEvery: 20,
        nowIso,
      },
    );

    expect(actual).toBe(result);
    expect(readState).toHaveBeenCalledTimes(1);
    expect(normalizeQuery).toHaveBeenCalledWith(BASE_STATE.signalRule, { lookbackDays: 10 });
    expect(buildRows).toHaveBeenCalledTimes(1);
    expect(sortRows).toHaveBeenCalledWith(rows);
    expect(summarizeRows).toHaveBeenCalledWith(rows);
    expect(composeResult).toHaveBeenCalledWith({
      generatedAt: "2026-02-26T12:00:00.000Z",
      market: "server",
      lookbackDays: 10,
      thresholdRatio: 0.2,
      effectiveThresholdRatio: 0.2,
      ruleEnabled: true,
      triggeredCount: 1,
      buyZoneCount: 1,
      sellZoneCount: 0,
      rows,
    });
  });
});
