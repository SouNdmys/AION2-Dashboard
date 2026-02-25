import { useMemo } from "react";
import type { WorkshopCraftOption, WorkshopItemCategory, WorkshopState } from "../../../../../shared/types";
import {
  type ClassifiedItemOption,
  type LatestPriceMetaByMarket,
  type ReverseCraftSuggestionRow,
  type ReverseScoreMode,
} from "../workshop-view-helpers";
import { createWorkshopEconomySelectors } from "../selectors/workshopEconomySelectors";

interface ItemMetaLite {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

interface UseWorkshopEconomyModelsParams {
  state: WorkshopState | null;
  craftOptions: WorkshopCraftOption[];
  itemById: Map<string, ItemMetaLite>;
  classifiedItemOptions: ClassifiedItemOption[];
  reverseCraftBudgetInput: string;
  reverseMaterialKeyword: string;
  reverseFocusMaterialId: string;
  reverseScoreMode: ReverseScoreMode;
}

interface WorkshopEconomyModels {
  latestPriceMetaByItemId: Map<string, LatestPriceMetaByMarket>;
  inventoryByItemId: Map<string, number>;
  reverseCraftBudget: number;
  reverseMaterialOptions: ClassifiedItemOption[];
  reverseFocusMaterialName: string | null;
  reverseScoreModeLabel: string;
  reverseCraftSuggestions: ReverseCraftSuggestionRow[];
}

export function useWorkshopEconomyModels(params: UseWorkshopEconomyModelsParams): WorkshopEconomyModels {
  const {
    state,
    craftOptions,
    itemById,
    classifiedItemOptions,
    reverseCraftBudgetInput,
    reverseMaterialKeyword,
    reverseFocusMaterialId,
    reverseScoreMode,
  } = params;
  const selectors = useMemo(() => createWorkshopEconomySelectors(), []);
  const latestPriceMetaByItemId = selectors.selectLatestPriceMetaByItemId(state);
  const inventoryByItemId = selectors.selectInventoryByItemId(state);
  const reverseCraftBudget = selectors.selectReverseCraftBudget(reverseCraftBudgetInput);
  const reverseMaterialOptions = selectors.selectReverseMaterialOptions(
    classifiedItemOptions,
    inventoryByItemId,
    reverseMaterialKeyword,
    reverseFocusMaterialId,
  );
  const reverseFocusMaterialName = selectors.selectReverseFocusMaterialName(reverseFocusMaterialId, itemById);
  const reverseScoreModeLabel = selectors.selectReverseScoreModeLabel(reverseScoreMode);
  const reverseCraftSuggestions = selectors.selectReverseCraftSuggestions(
    craftOptions,
    reverseFocusMaterialId,
    reverseCraftBudget,
    reverseScoreMode,
  );

  return {
    latestPriceMetaByItemId,
    inventoryByItemId,
    reverseCraftBudget,
    reverseMaterialOptions,
    reverseFocusMaterialName,
    reverseScoreModeLabel,
    reverseCraftSuggestions,
  };
}
