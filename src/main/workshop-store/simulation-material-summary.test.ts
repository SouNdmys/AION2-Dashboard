import { describe, expect, it } from "vitest";
import type { WorkshopItem } from "../../shared/types";
import { buildLatestWorkshopPriceByItemAndMarketMap } from "./price-market-selection";
import { buildWorkshopSimulationMaterialSummary } from "./simulation-material-summary";

function item(id: string, name: string): WorkshopItem {
  return {
    id,
    name,
    category: "material",
    createdAt: "2026-02-26T00:00:00.000Z",
    updatedAt: "2026-02-26T00:00:00.000Z",
  };
}

describe("workshop/simulation-material-summary", () => {
  it("builds material rows with cheapest price and sorted missing desc", () => {
    const requiredMaterials = new Map<string, number>([
      ["item-a", 10],
      ["item-b", 3],
    ]);
    const itemById = new Map<string, WorkshopItem>([
      ["item-a", item("item-a", "材料A")],
      ["item-b", item("item-b", "材料B")],
    ]);
    const inventoryByItemId = new Map<string, number>([
      ["item-a", 4],
      ["item-b", 3],
    ]);
    const latestPriceByItemAndMarket = buildLatestWorkshopPriceByItemAndMarketMap([
      {
        id: "s1",
        itemId: "item-a",
        unitPrice: 120,
        capturedAt: "2026-02-26T00:00:00.000Z",
        source: "manual",
        market: "server",
      },
      {
        id: "w1",
        itemId: "item-a",
        unitPrice: 100,
        capturedAt: "2026-02-26T00:00:00.000Z",
        source: "manual",
        market: "world",
      },
      {
        id: "sb",
        itemId: "item-b",
        unitPrice: 50,
        capturedAt: "2026-02-26T00:00:00.000Z",
        source: "manual",
        market: "single",
      },
    ]);

    const summary = buildWorkshopSimulationMaterialSummary({
      requiredMaterials,
      itemById,
      inventoryByItemId,
      latestPriceByItemAndMarket,
    });

    expect(summary.materialRows.map((row) => row.itemId)).toEqual(["item-a", "item-b"]);
    expect(summary.materialRows[0].latestUnitPrice).toBe(100);
    expect(summary.materialRows[0].latestPriceMarket).toBe("world");
    expect(summary.materialRows[0].missing).toBe(6);
    expect(summary.requiredMaterialCost).toBe(1_150);
    expect(summary.missingPurchaseCost).toBe(600);
    expect(summary.unknownPriceItemIds).toEqual([]);
  });

  it("returns null cost summary when unknown price exists", () => {
    const summary = buildWorkshopSimulationMaterialSummary({
      requiredMaterials: new Map<string, number>([
        ["item-a", 2],
        ["item-missing", 1],
      ]),
      itemById: new Map<string, WorkshopItem>([["item-a", item("item-a", "材料A")]]),
      inventoryByItemId: new Map<string, number>(),
      latestPriceByItemAndMarket: buildLatestWorkshopPriceByItemAndMarketMap([
        {
          id: "s1",
          itemId: "item-a",
          unitPrice: 120,
          capturedAt: "2026-02-26T00:00:00.000Z",
          source: "manual",
          market: "server",
        },
      ]),
    });

    expect(summary.unknownPriceItemIds).toEqual(["item-missing"]);
    expect(summary.requiredMaterialCost).toBeNull();
    expect(summary.missingPurchaseCost).toBeNull();
  });
});
