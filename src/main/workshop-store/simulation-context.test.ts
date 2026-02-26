import { describe, expect, it } from "vitest";
import type { WorkshopState } from "../../shared/types";
import { buildWorkshopSimulationContext } from "./simulation-context";

function createState(): WorkshopState {
  return {
    version: 6,
    items: [
      {
        id: "item-a",
        name: "材料A",
        category: "material",
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
      },
      {
        id: "item-b",
        name: "产物B",
        category: "equipment",
        createdAt: "2026-02-26T00:00:00.000Z",
        updatedAt: "2026-02-26T00:00:00.000Z",
      },
    ],
    recipes: [
      {
        id: "recipe-b",
        outputItemId: "item-b",
        outputQuantity: 1,
        inputs: [{ itemId: "item-a", quantity: 2 }],
        updatedAt: "2026-02-26T00:00:00.000Z",
      },
    ],
    prices: [
      {
        id: "price-world",
        itemId: "item-a",
        unitPrice: 100,
        capturedAt: "2026-02-26T10:00:00.000Z",
        source: "manual",
        market: "world",
      },
      {
        id: "price-server",
        itemId: "item-a",
        unitPrice: 110,
        capturedAt: "2026-02-26T10:00:00.000Z",
        source: "manual",
        market: "server",
      },
      {
        id: "price-output",
        itemId: "item-b",
        unitPrice: 500,
        capturedAt: "2026-02-26T09:00:00.000Z",
        source: "manual",
        market: "single",
      },
    ],
    inventory: [{ itemId: "item-a", quantity: 7, updatedAt: "2026-02-26T00:00:00.000Z" }],
    signalRule: { enabled: true, lookbackDays: 30, dropBelowWeekdayAverageRatio: 0.15 },
  };
}

describe("workshop/simulation-context", () => {
  it("builds simulation lookup maps and latest price snapshots", () => {
    const context = buildWorkshopSimulationContext(createState());

    expect(context.recipeByOutput.get("item-b")?.id).toBe("recipe-b");
    expect(context.itemById.get("item-a")?.name).toBe("材料A");
    expect(context.inventoryByItemId.get("item-a")).toBe(7);
    expect(context.latestPriceByItemId.get("item-a")?.id).toBe("price-server");
    expect(context.latestPriceByItemAndMarket.get("item-a")?.server?.id).toBe("price-server");
    expect(context.latestPriceByItemAndMarket.get("item-a")?.world?.id).toBe("price-world");
  });
});
