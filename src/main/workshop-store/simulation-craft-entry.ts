import type {
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopRecipe,
  WorkshopState,
} from "../../shared/types";

export interface BuildWorkshopCraftSimulationFromStateDeps {
  toPositiveInt: (raw: unknown, fallback: number) => number;
  sanitizeTaxRate: (raw: unknown) => number;
  buildSimulation: (
    state: WorkshopState,
    recipe: WorkshopRecipe,
    runs: number,
    taxRate: number,
    materialMode: "expanded" | "direct",
  ) => WorkshopCraftSimulationResult;
}

export function buildWorkshopCraftSimulationFromState(
  state: WorkshopState,
  payload: WorkshopCraftSimulationInput,
  deps: BuildWorkshopCraftSimulationFromStateDeps,
): WorkshopCraftSimulationResult {
  const recipe = state.recipes.find((entry) => entry.id === payload.recipeId);
  if (!recipe) {
    throw new Error("未找到目标配方。");
  }
  const runs = deps.toPositiveInt(payload.runs, 0);
  if (runs <= 0) {
    throw new Error("制作次数必须是正整数。");
  }
  const taxRate = deps.sanitizeTaxRate(payload.taxRate);
  const materialMode = payload.materialMode === "expanded" ? "expanded" : "direct";
  return deps.buildSimulation(state, recipe, runs, taxRate, materialMode);
}
