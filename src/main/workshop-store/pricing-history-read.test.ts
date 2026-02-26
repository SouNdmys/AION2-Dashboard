import { describe, expect, it, vi } from "vitest";
import type { WorkshopPriceHistoryResult, WorkshopState } from "../../shared/types";
import { getWorkshopPriceHistoryByQuery } from "./pricing-history-read";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [],
  recipes: [],
  prices: [],
  inventory: [],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

const BASE_RESULT: WorkshopPriceHistoryResult = {
  itemId: "item-1",
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
};

describe("workshop/pricing-history-read", () => {
  it("orchestrates read, ensure and build in order", () => {
    const payload = { itemId: "item-1", days: 7 };
    const readState = vi.fn(() => BASE_STATE);
    const ensureItemExists = vi.fn();
    const buildHistoryResult = vi.fn(() => BASE_RESULT);

    const result = getWorkshopPriceHistoryByQuery(payload, {
      readState,
      ensureItemExists,
      buildHistoryResult,
    });

    expect(readState).toHaveBeenCalledTimes(1);
    expect(ensureItemExists).toHaveBeenCalledWith(BASE_STATE, "item-1");
    expect(buildHistoryResult).toHaveBeenCalledWith(BASE_STATE, payload);
    expect(result).toBe(BASE_RESULT);
  });

  it("rethrows ensure validation error", () => {
    expect(() =>
      getWorkshopPriceHistoryByQuery(
        { itemId: "missing-item" },
        {
          readState: () => BASE_STATE,
          ensureItemExists: () => {
            throw new Error("物品不存在。");
          },
          buildHistoryResult: () => BASE_RESULT,
        },
      ),
    ).toThrow("物品不存在。");
  });
});
