import { describe, expect, it } from "vitest";
import type { WorkshopPriceSnapshot } from "../../shared/types";
import {
  buildLatestWorkshopPriceByItemAndMarketMap,
  normalizeWorkshopPriceMarketForCompare,
  resolveCheapestWorkshopMaterialPrice,
} from "./price-market-selection";

function row(partial: Partial<WorkshopPriceSnapshot> & Pick<WorkshopPriceSnapshot, "id" | "itemId">): WorkshopPriceSnapshot {
  return {
    id: partial.id,
    itemId: partial.itemId,
    unitPrice: partial.unitPrice ?? 100,
    capturedAt: partial.capturedAt ?? "2026-02-26T00:00:00.000Z",
    source: partial.source ?? "manual",
    market: partial.market,
    note: partial.note,
  };
}

describe("workshop/price-market-selection", () => {
  it("normalizes compare market and keeps latest snapshot by item+market", () => {
    expect(normalizeWorkshopPriceMarketForCompare("server")).toBe("server");
    expect(normalizeWorkshopPriceMarketForCompare("world")).toBe("world");
    expect(normalizeWorkshopPriceMarketForCompare("single")).toBe("single");
    expect(normalizeWorkshopPriceMarketForCompare(undefined)).toBe("single");

    const map = buildLatestWorkshopPriceByItemAndMarketMap([
      row({ id: "a1", itemId: "item-a", market: "server", capturedAt: "2026-02-25T00:00:00.000Z", unitPrice: 120 }),
      row({ id: "a2", itemId: "item-a", market: "server", capturedAt: "2026-02-26T00:00:00.000Z", unitPrice: 130 }),
      row({ id: "a3", itemId: "item-a", market: undefined, capturedAt: "2026-02-24T00:00:00.000Z", unitPrice: 90 }),
      row({ id: "a4", itemId: "item-a", market: undefined, capturedAt: "2026-02-24T00:00:00.000Z", unitPrice: 95 }),
    ]);

    const latest = map.get("item-a");
    expect(latest?.server?.id).toBe("a2");
    expect(latest?.single?.id).toBe("a4");
    expect(latest?.world).toBeNull();
  });

  it("resolves cheapest material price in server/world/single order", () => {
    const noRow = resolveCheapestWorkshopMaterialPrice(undefined);
    expect(noRow.unitPrice).toBeNull();
    expect(noRow.market).toBeUndefined();

    const serverCheaper = resolveCheapestWorkshopMaterialPrice({
      server: row({ id: "s", itemId: "item-a", unitPrice: 100, market: "server" }),
      world: row({ id: "w", itemId: "item-a", unitPrice: 120, market: "world" }),
      single: row({ id: "x", itemId: "item-a", unitPrice: 80, market: "single" }),
    });
    expect(serverCheaper).toEqual({ unitPrice: 100, market: "server" });

    const worldOnly = resolveCheapestWorkshopMaterialPrice({
      server: null,
      world: row({ id: "w", itemId: "item-a", unitPrice: 130, market: "world" }),
      single: row({ id: "x", itemId: "item-a", unitPrice: 110, market: "single" }),
    });
    expect(worldOnly).toEqual({ unitPrice: 130, market: "world" });

    const singleFallback = resolveCheapestWorkshopMaterialPrice({
      server: null,
      world: null,
      single: row({ id: "x", itemId: "item-a", unitPrice: 110, market: "single" }),
    });
    expect(singleFallback).toEqual({ unitPrice: 110, market: "single" });
  });
});
