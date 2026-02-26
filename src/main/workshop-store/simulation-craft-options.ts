import type { WorkshopCraftOption, WorkshopCraftSimulationResult, WorkshopRecipe, WorkshopState } from "../../shared/types";

export interface BuildWorkshopCraftOptionsFromStateDeps {
  buildSimulation: (
    state: WorkshopState,
    recipe: WorkshopRecipe,
    runs: number,
    taxRate: number,
    materialMode: "expanded" | "direct",
  ) => WorkshopCraftSimulationResult;
}

export function buildWorkshopCraftOptionsFromState(
  state: WorkshopState,
  taxRate: number,
  deps: BuildWorkshopCraftOptionsFromStateDeps,
): WorkshopCraftOption[] {
  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry.quantity]));
  const options = state.recipes.map((recipe) => {
    // Reverse suggestion should reflect direct recipe inputs (not expanded sub-recipes),
    // so missing/unknown material hints stay aligned with what players see in the recipe.
    const simulation = deps.buildSimulation(state, recipe, 1, taxRate, "direct");
    const craftableCountFromInventory =
      simulation.materialRows.length === 0
        ? 0
        : simulation.materialRows.reduce((acc, row) => {
            if (row.required <= 0) {
              return acc;
            }
            const owned = inventoryByItemId.get(row.itemId) ?? 0;
            return Math.min(acc, Math.floor(owned / row.required));
          }, Number.MAX_SAFE_INTEGER);

    const craftableCount = Number.isFinite(craftableCountFromInventory) ? Math.max(0, craftableCountFromInventory) : 0;
    return {
      recipeId: recipe.id,
      outputItemId: recipe.outputItemId,
      outputItemName: simulation.outputItemName,
      craftableCount,
      requiredMaterialCostPerRun: simulation.requiredMaterialCost,
      estimatedProfitPerRun: simulation.estimatedProfit,
      unknownPriceItemIds: simulation.unknownPriceItemIds,
      materialRowsForOneRun: simulation.materialRows,
      missingRowsForOneRun: simulation.materialRows.filter((row) => row.missing > 0),
    };
  });

  return options.sort((left, right) => {
    if (right.craftableCount !== left.craftableCount) {
      return right.craftableCount - left.craftableCount;
    }
    const rightProfit = right.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
    const leftProfit = left.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
    if (rightProfit !== leftProfit) {
      return rightProfit - leftProfit;
    }
    return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
  });
}
