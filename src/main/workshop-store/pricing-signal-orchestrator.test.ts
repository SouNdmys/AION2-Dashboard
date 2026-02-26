import { describe, expect, it, vi } from "vitest";
import type { WorkshopItem, WorkshopPriceHistoryResult } from "../../shared/types";
import { buildWorkshopPriceSignalRows } from "./pricing-signal-orchestrator";

const ITEMS: WorkshopItem[] = [
  {
    id: "item-1",
    name: "物品1",
    category: "material",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "item-2",
    name: "物品2",
    category: "material",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "item-3",
    name: "物品3",
    category: "material",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function historyFor(itemId: string, latestPrice: number): WorkshopPriceHistoryResult {
  return {
    itemId,
    fromAt: "2026-02-01T00:00:00.000Z",
    toAt: "2026-02-10T00:00:00.000Z",
    sampleCount: 10,
    suspectCount: 0,
    latestPrice,
    latestCapturedAt: "2026-02-10T00:00:00.000Z",
    averagePrice: 100,
    ma7Latest: 90,
    points: [
      {
        id: `${itemId}-p1`,
        itemId,
        unitPrice: latestPrice,
        capturedAt: "2026-02-10T00:00:00.000Z",
        weekday: 2,
        ma7: 90,
        market: "server",
        isSuspect: false,
      },
    ],
    suspectPoints: [],
    weekdayAverages: [{ weekday: 2, averagePrice: 100, sampleCount: 4 }],
  };
}

describe("workshop/pricing-signal-orchestrator", () => {
  it("builds one signal row per item with normalized history payload", async () => {
    const buildHistory = vi.fn((payload) => historyFor(payload.itemId, 80));
    const yieldToEventLoop = vi.fn(async () => undefined);

    const rows = await buildWorkshopPriceSignalRows(
      {
        items: ITEMS,
        lookbackDays: 30,
        targetMarket: "server",
        effectiveThresholdRatio: 0.15,
        ruleEnabled: true,
        minSampleCount: 5,
        yieldEvery: 99,
      },
      { buildHistory, yieldToEventLoop },
    );

    expect(rows).toHaveLength(3);
    expect(buildHistory).toHaveBeenCalledTimes(3);
    expect(buildHistory).toHaveBeenNthCalledWith(1, { itemId: "item-1", days: 30, market: "server" });
    expect(buildHistory).toHaveBeenNthCalledWith(2, { itemId: "item-2", days: 30, market: "server" });
    expect(buildHistory).toHaveBeenNthCalledWith(3, { itemId: "item-3", days: 30, market: "server" });
  });

  it("yields to event loop by configured cadence", async () => {
    const buildHistory = vi.fn((payload) => historyFor(payload.itemId, 80));
    const yieldToEventLoop = vi.fn(async () => undefined);

    await buildWorkshopPriceSignalRows(
      {
        items: ITEMS,
        lookbackDays: 30,
        targetMarket: "server",
        effectiveThresholdRatio: 0.15,
        ruleEnabled: true,
        minSampleCount: 5,
        yieldEvery: 2,
      },
      { buildHistory, yieldToEventLoop },
    );

    expect(yieldToEventLoop).toHaveBeenCalledTimes(1);
  });
});
