import { useMemo } from "react";
import type { WorkshopItemCategory, WorkshopState } from "../../../../../shared/types";
import {
  type SimulationRecipeOption,
  inferMainCategoryByContext,
  inferRecipeSubCategory,
  parseItemMainCategory,
  parseItemRawCategory,
  parseItemSourceTag,
  sortCategoryText,
  sortMainCategoryText,
} from "../workshop-view-helpers";

interface ItemMetaLite {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

interface UseWorkshopSimulationModelsParams {
  state: WorkshopState | null;
  itemById: Map<string, ItemMetaLite>;
  simulateMainCategory: string;
  simulateSubCategory: "all" | string;
}

interface WorkshopSimulationModels {
  simulationRecipeOptions: SimulationRecipeOption[];
  simulationMainCategoryOptions: string[];
  filteredSimulationRecipes: SimulationRecipeOption[];
  simulationSubCategoryOptions: string[];
}

export function useWorkshopSimulationModels(params: UseWorkshopSimulationModelsParams): WorkshopSimulationModels {
  const { state, itemById, simulateMainCategory, simulateSubCategory } = params;

  const simulationRecipeOptions = useMemo<SimulationRecipeOption[]>(() => {
    if (!state) {
      return [];
    }
    return state.recipes.map((recipe) => {
      const outputItem = itemById.get(recipe.outputItemId);
      const outputName = outputItem?.name ?? recipe.outputItemId;
      const rawCategory = parseItemRawCategory(outputItem?.notes);
      const sourceTag = parseItemSourceTag(outputItem?.notes);
      const explicitMainCategory = parseItemMainCategory(outputItem?.notes);
      const subCategory = inferRecipeSubCategory(rawCategory, outputName, outputItem?.category ?? "other");
      return {
        id: recipe.id,
        outputName,
        mainCategory: inferMainCategoryByContext(explicitMainCategory, sourceTag, subCategory, rawCategory, outputName),
        subCategory,
      };
    });
  }, [state, itemById]);

  const simulationMainCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(simulationRecipeOptions.map((entry) => entry.mainCategory).filter(Boolean)));
    if (unique.length === 0) {
      return ["鐵匠"];
    }
    return unique.sort(sortMainCategoryText);
  }, [simulationRecipeOptions]);

  const simulationRecipesByMainCategory = useMemo(() => {
    return simulationRecipeOptions.filter((entry) => {
      if (simulateMainCategory && entry.mainCategory !== simulateMainCategory) {
        return false;
      }
      return true;
    });
  }, [simulationRecipeOptions, simulateMainCategory]);

  const filteredSimulationRecipes = useMemo(() => {
    return simulationRecipesByMainCategory.filter((entry) => {
      if (simulateSubCategory !== "all" && entry.subCategory !== simulateSubCategory) {
        return false;
      }
      return true;
    });
  }, [simulationRecipesByMainCategory, simulateSubCategory]);

  const simulationSubCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(simulationRecipesByMainCategory.map((entry) => entry.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  }, [simulationRecipesByMainCategory]);

  return {
    simulationRecipeOptions,
    simulationMainCategoryOptions,
    filteredSimulationRecipes,
    simulationSubCategoryOptions,
  };
}
