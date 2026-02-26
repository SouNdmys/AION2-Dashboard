import { describe, expect, it } from "vitest";
import type { WorkshopPriceSnapshot } from "../../shared/types";
import { appendWorkshopPriceSnapshot, trimWorkshopPriceHistory } from "./pricing-history-window";

function buildSnapshot(id: string, unitPrice: number): WorkshopPriceSnapshot {
  return {
    id,
    itemId: "item-1",
    unitPrice,
    capturedAt: new Date("2026-02-26T00:00:00.000Z").toISOString(),
    source: "import",
    market: "server",
  };
}

describe("workshop/pricing-history-window", () => {
  it("trims history to latest entries within max window", () => {
    const prices = [buildSnapshot("a", 10), buildSnapshot("b", 20), buildSnapshot("c", 30), buildSnapshot("d", 40)];
    const trimmed = trimWorkshopPriceHistory(prices, 2);
    expect(trimmed.map((row) => row.id)).toEqual(["c", "d"]);
  });

  it("returns empty history when max window is invalid", () => {
    const prices = [buildSnapshot("a", 10)];
    expect(trimWorkshopPriceHistory(prices, 0)).toEqual([]);
    expect(trimWorkshopPriceHistory(prices, -1)).toEqual([]);
  });

  it("appends snapshot and keeps max window", () => {
    const prices = [buildSnapshot("a", 10), buildSnapshot("b", 20)];
    const next = appendWorkshopPriceSnapshot(prices, buildSnapshot("c", 30), 2);
    expect(next.map((row) => row.id)).toEqual(["b", "c"]);
  });
});
