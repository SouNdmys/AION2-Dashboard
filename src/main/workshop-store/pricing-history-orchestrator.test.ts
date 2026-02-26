import { describe, expect, it } from "vitest";
import type { WorkshopState } from "../../shared/types";
import { WORKSHOP_PRICE_NOTE_TAG_SUSPECT } from "./pricing-anomaly";
import { buildWorkshopPriceHistoryResult } from "./pricing-history-orchestrator";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [
    {
      id: "item-1",
      name: "item-1",
      category: "material",
      createdAt: "2026-02-20T00:00:00.000Z",
      updatedAt: "2026-02-20T00:00:00.000Z",
    },
  ],
  recipes: [],
  prices: [
    {
      id: "p1",
      itemId: "item-1",
      unitPrice: 100,
      capturedAt: "2026-02-24T00:00:00.000Z",
      source: "manual",
      market: "server",
    },
    {
      id: "p2",
      itemId: "item-1",
      unitPrice: 120,
      capturedAt: "2026-02-25T00:00:00.000Z",
      source: "manual",
      market: "server",
    },
    {
      id: "p3",
      itemId: "item-1",
      unitPrice: 90,
      capturedAt: "2026-02-26T00:00:00.000Z",
      source: "import",
      market: "server",
      note: WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
    },
    {
      id: "p4",
      itemId: "item-1",
      unitPrice: 300,
      capturedAt: "2026-02-25T00:00:00.000Z",
      source: "manual",
      market: "world",
    },
  ],
  inventory: [],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

describe("workshop/pricing-history-orchestrator", () => {
  it("builds history result with market filter and suspect exclusion by default", () => {
    const result = buildWorkshopPriceHistoryResult(BASE_STATE, {
      itemId: "item-1",
      days: 30,
      market: "server",
    });

    expect(result.itemId).toBe("item-1");
    expect(result.market).toBe("server");
    expect(result.sampleCount).toBe(2);
    expect(result.suspectCount).toBe(1);
    expect(result.latestPrice).toBe(120);
    expect(result.points.map((entry) => entry.id)).toEqual(["p1", "p2"]);
    expect(result.suspectPoints.map((entry) => entry.id)).toEqual(["p3"]);
  });
});
