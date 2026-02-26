import type { WorkshopItem, WorkshopRecipe } from "../../shared/types";

export interface BuildWorkshopSimulationMaterialPlanInput {
  recipeByOutput: Map<string, WorkshopRecipe>;
  itemById: Map<string, WorkshopItem>;
  recipe: WorkshopRecipe;
  runs: number;
  materialMode: "expanded" | "direct";
}

export interface WorkshopSimulationMaterialPlan {
  requiredMaterials: Map<string, number>;
  craftRuns: Map<string, number>;
}

export function buildWorkshopSimulationMaterialPlan(
  input: BuildWorkshopSimulationMaterialPlanInput,
): WorkshopSimulationMaterialPlan {
  const requiredMaterials = new Map<string, number>();
  const craftRuns = new Map<string, number>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  const addMaterial = (itemId: string, quantity: number): void => {
    requiredMaterials.set(itemId, (requiredMaterials.get(itemId) ?? 0) + quantity);
  };

  const addCraftRuns = (itemId: string, stepRuns: number): void => {
    craftRuns.set(itemId, (craftRuns.get(itemId) ?? 0) + stepRuns);
  };

  const expandNeededItem = (itemId: string, neededQuantity: number): void => {
    if (neededQuantity <= 0) {
      return;
    }
    const nestedRecipe = input.recipeByOutput.get(itemId);
    if (!nestedRecipe) {
      addMaterial(itemId, neededQuantity);
      return;
    }
    if (visiting.has(itemId)) {
      const loopPath = [...stack, itemId]
        .map((loopItemId) => input.itemById.get(loopItemId)?.name ?? loopItemId)
        .join(" -> ");
      throw new Error(`检测到配方循环引用: ${loopPath}`);
    }
    visiting.add(itemId);
    stack.push(itemId);

    const nestedRuns = Math.ceil(neededQuantity / nestedRecipe.outputQuantity);
    addCraftRuns(itemId, nestedRuns);

    nestedRecipe.inputs.forEach((recipeInput) => {
      expandNeededItem(recipeInput.itemId, recipeInput.quantity * nestedRuns);
    });

    stack.pop();
    visiting.delete(itemId);
  };

  addCraftRuns(input.recipe.outputItemId, input.runs);
  if (input.materialMode === "direct") {
    input.recipe.inputs.forEach((recipeInput) => {
      addMaterial(recipeInput.itemId, recipeInput.quantity * input.runs);
    });
  } else {
    input.recipe.inputs.forEach((recipeInput) => {
      expandNeededItem(recipeInput.itemId, recipeInput.quantity * input.runs);
    });
  }

  return {
    requiredMaterials,
    craftRuns,
  };
}
