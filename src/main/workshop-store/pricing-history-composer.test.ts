import { describe, expect, it } from "vitest";
import { composeWorkshopPriceHistoryResult } from "./pricing-history-composer";

describe("workshop/pricing-history-composer", () => {
  it("composes result payload with expected shape", () => {
    const result = composeWorkshopPriceHistoryResult({
      payload: { itemId: "item-1", market: "server" },
      targetMarket: "server",
      from: new Date("2026-02-01T00:00:00.000Z"),
      to: new Date("2026-02-10T00:00:00.000Z"),
      sampleCount: 2,
      suspectCount: 1,
      latestPrice: 200,
      latestCapturedAt: "2026-02-10T00:00:00.000Z",
      averagePrice: 150,
      ma7Latest: 140,
      points: [],
      suspectPoints: [],
      weekdayAverages: [],
    });

    expect(result.itemId).toBe("item-1");
    expect(result.market).toBe("server");
    expect(result.fromAt).toBe("2026-02-01T00:00:00.000Z");
    expect(result.toAt).toBe("2026-02-10T00:00:00.000Z");
    expect(result.sampleCount).toBe(2);
    expect(result.suspectCount).toBe(1);
    expect(result.latestPrice).toBe(200);
    expect(result.averagePrice).toBe(150);
    expect(result.ma7Latest).toBe(140);
  });
});
