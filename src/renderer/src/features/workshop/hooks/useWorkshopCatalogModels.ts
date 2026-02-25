import { useMemo } from "react";
import type { WorkshopItemCategory, WorkshopState } from "../../../../../shared/types";
import {
  type ClassifiedItemOption,
} from "../workshop-view-helpers";
import { createWorkshopCatalogSelectors } from "../selectors/workshopCatalogSelectors";

interface ItemMetaLite {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

interface UseWorkshopCatalogModelsParams {
  state: WorkshopState | null;
  starItemIds: string[];
  itemMainCategory: string;
  itemSubCategory: "all" | string;
  itemKeyword: string;
  historyMainCategory: string;
  historySubCategory: "all" | string;
  historyKeyword: string;
  focusStarOnly: boolean;
}

interface WorkshopCatalogModels {
  starItemIdSet: Set<string>;
  itemById: Map<string, ItemMetaLite>;
  classifiedItemOptions: ClassifiedItemOption[];
  starredHistoryItems: ClassifiedItemOption[];
  itemMainCategoryOptions: string[];
  filteredItems: ClassifiedItemOption[];
  itemSubCategoryOptions: string[];
  historyMainCategoryOptions: string[];
  filteredHistoryItems: ClassifiedItemOption[];
  historySubCategoryOptions: string[];
}

export function useWorkshopCatalogModels(params: UseWorkshopCatalogModelsParams): WorkshopCatalogModels {
  const {
    state,
    starItemIds,
    itemMainCategory,
    itemSubCategory,
    itemKeyword,
    historyMainCategory,
    historySubCategory,
    historyKeyword,
    focusStarOnly,
  } = params;
  const selectors = useMemo(() => createWorkshopCatalogSelectors(), []);

  const starItemIdSet = selectors.selectStarItemIdSet(starItemIds);
  const itemById = selectors.selectItemById(state);
  const classifiedItemOptions = selectors.selectClassifiedItemOptions(state);
  const starredHistoryItems = selectors.selectStarredHistoryItems(classifiedItemOptions, starItemIdSet);

  const itemMainCategoryOptions = selectors.selectMainCategoryOptions(classifiedItemOptions);
  const itemsByMainCategory = selectors.selectItemsByMainCategory(classifiedItemOptions, itemMainCategory);
  const filteredItems = selectors.selectFilteredItems(classifiedItemOptions, itemsByMainCategory, itemSubCategory, itemKeyword);
  const itemSubCategoryOptions = selectors.selectSubCategoryOptions(itemsByMainCategory);

  const historyMainCategoryOptions = selectors.selectMainCategoryOptions(classifiedItemOptions);
  const historyItemsByMainCategory = selectors.selectItemsByMainCategory(classifiedItemOptions, historyMainCategory);
  const historySubCategoryOptions = selectors.selectSubCategoryOptions(historyItemsByMainCategory);
  const filteredHistoryItems = selectors.selectFilteredHistoryItems(
    classifiedItemOptions,
    historyItemsByMainCategory,
    historySubCategory,
    historyKeyword,
    focusStarOnly,
    starItemIdSet,
  );

  return {
    starItemIdSet,
    itemById,
    classifiedItemOptions,
    starredHistoryItems,
    itemMainCategoryOptions,
    filteredItems,
    itemSubCategoryOptions,
    historyMainCategoryOptions,
    filteredHistoryItems,
    historySubCategoryOptions,
  };
}
