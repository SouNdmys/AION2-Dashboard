import { describe, expect, it, vi } from "vitest";
import type { WorkshopCraftSimulationResult, WorkshopState } from "../../shared/types";
import { buildWorkshopCraftSimulationFromState } from "./simulation-craft-entry";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [
    {
      id: "item-1",
      name: "item-1",
      category: "material",
      createdAt: "2026-02-26T00:00:00.000Z",
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
  ],
  recipes: [
    {
      id: "recipe-1",
      outputItemId: "item-1",
      outputQuantity: 1,
      inputs: [],
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
  ],
  prices: [],
  inventory: [],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

const BASE_RESULT: WorkshopCraftSimulationResult = {
  recipeId: "recipe-1",
  outputItemId: "item-1",
  outputItemName: "item-1",
  outputQuantity: 1,
  runs: 2,
  totalOutputQuantity: 2,
  taxRate: 0.1,
  materialMode: "direct",
  materialRows: [],
  craftSteps: [],
  craftableNow: true,
  unknownPriceItemIds: [],
  requiredMaterialCost: null,
  missingPurchaseCost: null,
  outputUnitPrice: null,
  grossRevenue: null,
  netRevenueAfterTax: null,
  estimatedProfit: null,
  estimatedProfitRate: null,
};

describe("workshop/simulation-craft-entry", () => {
  it("orchestrates recipe lookup, input sanitize and simulation build", () => {
    const toPositiveInt = vi.fn(() => 2);
    const sanitizeTaxRate = vi.fn(() => 0.1);
    const buildSimulation = vi.fn(() => BASE_RESULT);

    const result = buildWorkshopCraftSimulationFromState(
      BASE_STATE,
      {
        recipeId: "recipe-1",
        runs: 2,
        taxRate: 0.1,
      },
      {
        toPositiveInt,
        sanitizeTaxRate,
        buildSimulation,
      },
    );

    expect(result).toBe(BASE_RESULT);
    expect(toPositiveInt).toHaveBeenCalledWith(2, 0);
    expect(sanitizeTaxRate).toHaveBeenCalledWith(0.1);
    expect(buildSimulation).toHaveBeenCalledWith(BASE_STATE, BASE_STATE.recipes[0], 2, 0.1, "direct");
  });

  it("throws when recipe is missing", () => {
    expect(() =>
      buildWorkshopCraftSimulationFromState(
        {
          ...BASE_STATE,
          recipes: [],
        },
        {
          recipeId: "missing",
          runs: 1,
        },
        {
          toPositiveInt: vi.fn(),
          sanitizeTaxRate: vi.fn(),
          buildSimulation: vi.fn(),
        },
      ),
    ).toThrow("未找到目标配方。");
  });
});
