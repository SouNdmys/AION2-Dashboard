import { describe, expect, it } from "vitest";
import type { WorkshopPriceMarket } from "../../shared/types";
import { buildPriceHistorySeries, type ClassifiedPriceHistorySnapshot } from "./pricing-history-series";

function row(
  id: string,
  unitPrice: number,
  market: WorkshopPriceMarket,
  isSuspect = false,
): ClassifiedPriceHistorySnapshot {
  return {
    id,
    itemId: "item-1",
    unitPrice,
    capturedAt: `2026-02-${id.padStart(2, "0")}T00:00:00.000Z`,
    weekday: 1,
    market,
    note: undefined,
    isSuspect,
    suspectReason: isSuspect ? "suspect" : null,
  };
}

describe("workshop/pricing-history-series", () => {
  it("builds non-suspect series and keeps suspect points separately", () => {
    const input = [row("1", 100, "server"), row("2", 120, "server", true), row("3", 140, "server")];
    const result = buildPriceHistorySeries(input, false);
    expect(result.points.map((entry) => entry.id)).toEqual(["1", "3"]);
    expect(result.suspectPoints.map((entry) => entry.id)).toEqual(["2"]);
    expect(result.sampleCount).toBe(2);
    expect(result.suspectCount).toBe(1);
    expect(result.averagePrice).toBe(120);
  });

  it("includes suspect entries in points when requested", () => {
    const input = [row("1", 100, "server"), row("2", 120, "server", true), row("3", 140, "server")];
    const result = buildPriceHistorySeries(input, true);
    expect(result.points.map((entry) => entry.id)).toEqual(["1", "2", "3"]);
    expect(result.suspectPoints.map((entry) => entry.id)).toEqual(["2"]);
    expect(result.latestPrice).toBe(140);
    expect(result.latestCapturedAt).toBe("2026-02-03T00:00:00.000Z");
  });

  it("computes MA7 on rolling window", () => {
    const input = [
      row("1", 10, "server"),
      row("2", 20, "server"),
      row("3", 30, "server"),
      row("4", 40, "server"),
      row("5", 50, "server"),
      row("6", 60, "server"),
      row("7", 70, "server"),
      row("8", 80, "server"),
    ];
    const result = buildPriceHistorySeries(input, true);
    expect(result.points[5]?.ma7).toBeNull();
    expect(result.points[6]?.ma7).toBe(40);
    expect(result.points[7]?.ma7).toBe(50);
    expect(result.ma7Latest).toBe(50);
  });
});
