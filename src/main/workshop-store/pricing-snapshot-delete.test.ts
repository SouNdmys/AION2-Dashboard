import { describe, expect, it } from "vitest";
import type { WorkshopPriceSnapshot } from "../../shared/types";
import { buildWorkshopPricesWithClearedSnapshots, buildWorkshopPricesWithDeletedSnapshot } from "./pricing-snapshot-delete";

const BASE_PRICES: WorkshopPriceSnapshot[] = [
  {
    id: "p1",
    itemId: "item-1",
    unitPrice: 100,
    capturedAt: "2026-02-26T00:00:00.000Z",
    source: "manual",
    market: "single",
  },
  {
    id: "p2",
    itemId: "item-2",
    unitPrice: 200,
    capturedAt: "2026-02-26T00:10:00.000Z",
    source: "import",
    market: "server",
  },
];

describe("workshop/pricing-snapshot-delete", () => {
  it("filters out matched snapshot id", () => {
    const nextPrices = buildWorkshopPricesWithDeletedSnapshot(BASE_PRICES, "p1");
    expect(nextPrices).toEqual([BASE_PRICES[1]]);
  });

  it("returns null when snapshot id is missing", () => {
    const nextPrices = buildWorkshopPricesWithDeletedSnapshot(BASE_PRICES, "missing");
    expect(nextPrices).toBeNull();
  });

  it("clears all snapshots when list is non-empty", () => {
    const nextPrices = buildWorkshopPricesWithClearedSnapshots(BASE_PRICES);
    expect(nextPrices).toEqual([]);
  });

  it("returns null when clearing empty list", () => {
    const nextPrices = buildWorkshopPricesWithClearedSnapshots([]);
    expect(nextPrices).toBeNull();
  });
});
