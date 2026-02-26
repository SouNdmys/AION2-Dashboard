import type {
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopRecipe,
  WorkshopState,
} from "../../shared/types";
import { clamp, readWorkshopState } from "../workshop-store-core";
import { buildWorkshopSimulationContext } from "./simulation-context";
import { buildWorkshopCraftSimulationFromState } from "./simulation-craft-entry";
import { buildWorkshopCraftOptionsFromState } from "./simulation-craft-options";
import { buildWorkshopSimulationCraftSteps } from "./simulation-craft-steps";
import { buildWorkshopSimulationMaterialPlan } from "./simulation-material-plan";
import { buildWorkshopSimulationMaterialSummary } from "./simulation-material-summary";
import { buildWorkshopSimulationOutputMetrics } from "./simulation-output-metrics";

function toPositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.floor(raw));
}

function buildSimulation(
  state: WorkshopState,
  recipe: WorkshopRecipe,
  runs: number,
  taxRate: number,
  materialMode: "expanded" | "direct",
): WorkshopCraftSimulationResult {
  const { recipeByOutput, itemById, inventoryByItemId, latestPriceByItemId, latestPriceByItemAndMarket } =
    buildWorkshopSimulationContext(state);
  const { requiredMaterials, craftRuns } = buildWorkshopSimulationMaterialPlan({
    recipeByOutput,
    itemById,
    recipe,
    runs,
    materialMode,
  });

  const { materialRows, unknownPriceItemIds, requiredMaterialCost, missingPurchaseCost } =
    buildWorkshopSimulationMaterialSummary({
      requiredMaterials,
      itemById,
      inventoryByItemId,
      latestPriceByItemAndMarket,
    });

  const { totalOutputQuantity, outputUnitPrice, grossRevenue, netRevenueAfterTax, estimatedProfit, estimatedProfitRate } =
    buildWorkshopSimulationOutputMetrics({
      latestPriceByItemId,
      outputItemId: recipe.outputItemId,
      outputQuantity: recipe.outputQuantity,
      runs,
      taxRate,
      requiredMaterialCost,
    });

  const craftSteps = buildWorkshopSimulationCraftSteps(craftRuns, itemById);

  return {
    recipeId: recipe.id,
    outputItemId: recipe.outputItemId,
    outputItemName: itemById.get(recipe.outputItemId)?.name ?? recipe.outputItemId,
    outputQuantity: recipe.outputQuantity,
    runs,
    totalOutputQuantity,
    taxRate,
    materialMode,
    materialRows,
    craftSteps,
    craftableNow: materialRows.every((row) => row.missing <= 0),
    unknownPriceItemIds,
    requiredMaterialCost,
    missingPurchaseCost,
    outputUnitPrice,
    grossRevenue,
    netRevenueAfterTax,
    estimatedProfit,
    estimatedProfitRate,
  };
}

function sanitizeTaxRate(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0.1;
  }
  return clamp(raw, 0, 0.95);
}

export function simulateWorkshopCraft(payload: WorkshopCraftSimulationInput): WorkshopCraftSimulationResult {
  const state = readWorkshopState();
  return buildWorkshopCraftSimulationFromState(state, payload, {
    toPositiveInt,
    sanitizeTaxRate,
    buildSimulation,
  });
}

export function getWorkshopCraftOptions(payload?: { taxRate?: number }): WorkshopCraftOption[] {
  const state = readWorkshopState();
  const taxRate = sanitizeTaxRate(payload?.taxRate);
  return buildWorkshopCraftOptionsFromState(state, taxRate, {
    buildSimulation,
  });
}
