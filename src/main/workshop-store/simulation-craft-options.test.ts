import { describe, expect, it, vi } from "vitest";
import type { WorkshopCraftSimulationResult, WorkshopRecipe, WorkshopState } from "../../shared/types";
import { buildWorkshopCraftOptionsFromState } from "./simulation-craft-options";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [
    {
      id: "item-a",
      name: "A",
      category: "material",
      createdAt: "2026-02-26T00:00:00.000Z",
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
    {
      id: "item-b",
      name: "B",
      category: "material",
      createdAt: "2026-02-26T00:00:00.000Z",
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
  ],
  recipes: [
    {
      id: "recipe-a",
      outputItemId: "item-a",
      outputQuantity: 1,
      inputs: [],
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
    {
      id: "recipe-b",
      outputItemId: "item-b",
      outputQuantity: 1,
      inputs: [],
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
  ],
  prices: [],
  inventory: [
    {
      itemId: "mat-1",
      quantity: 10,
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
    {
      itemId: "mat-2",
      quantity: 2,
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
  ],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

function createSimulationResult(
  recipe: WorkshopRecipe,
  outputItemName: string,
  materialRows: WorkshopCraftSimulationResult["materialRows"],
  estimatedProfit: number,
): WorkshopCraftSimulationResult {
  return {
    recipeId: recipe.id,
    outputItemId: recipe.outputItemId,
    outputItemName,
    outputQuantity: 1,
    runs: 1,
    totalOutputQuantity: 1,
    taxRate: 0.1,
    materialMode: "direct",
    materialRows,
    craftSteps: [],
    craftableNow: materialRows.every((row) => row.missing <= 0),
    unknownPriceItemIds: [],
    requiredMaterialCost: 100,
    missingPurchaseCost: 0,
    outputUnitPrice: 200,
    grossRevenue: 200,
    netRevenueAfterTax: 180,
    estimatedProfit,
    estimatedProfitRate: 0.8,
  };
}

describe("workshop/simulation-craft-options", () => {
  it("builds and sorts options by craftable count then estimated profit", () => {
    const buildSimulation = vi.fn((_state: WorkshopState, recipe: WorkshopRecipe) => {
      if (recipe.id === "recipe-a") {
        return createSimulationResult(
          recipe,
          "A",
          [
            {
              itemId: "mat-1",
              itemName: "mat-1",
              required: 2,
              owned: 10,
              missing: 0,
              latestUnitPrice: 10,
              latestPriceMarket: "server",
              requiredCost: 20,
              missingCost: 0,
            },
          ],
          20,
        );
      }
      return createSimulationResult(
        recipe,
        "B",
        [
          {
            itemId: "mat-2",
            itemName: "mat-2",
            required: 1,
            owned: 2,
            missing: 1,
            latestUnitPrice: 30,
            latestPriceMarket: "world",
            requiredCost: 30,
            missingCost: 30,
          },
        ],
        50,
      );
    });

    const options = buildWorkshopCraftOptionsFromState(BASE_STATE, 0.1, { buildSimulation });

    expect(buildSimulation).toHaveBeenCalledTimes(2);
    expect(options.map((entry) => entry.recipeId)).toEqual(["recipe-a", "recipe-b"]);
    expect(options[0].craftableCount).toBe(5);
    expect(options[1].craftableCount).toBe(2);
    expect(options[1].missingRowsForOneRun).toHaveLength(1);
  });
});
