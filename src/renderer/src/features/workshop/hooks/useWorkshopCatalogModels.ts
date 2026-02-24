import { useMemo } from "react";
import type { WorkshopItemCategory, WorkshopState } from "../../../../../shared/types";
import {
  type ClassifiedItemOption,
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

  const starItemIdSet = useMemo(() => new Set(starItemIds), [starItemIds]);

  const itemById = useMemo(() => {
    if (!state) return new Map<string, ItemMetaLite>();
    return new Map(state.items.map((item) => [item.id, { name: item.name, category: item.category, notes: item.notes }]));
  }, [state]);

  const classifiedItemOptions = useMemo<ClassifiedItemOption[]>(() => {
    if (!state) {
      return [];
    }
    return state.items.map((item) => {
      const rawCategory = parseItemRawCategory(item.notes);
      const sourceTag = parseItemSourceTag(item.notes);
      const explicitMainCategory = parseItemMainCategory(item.notes);
      const subCategory = inferRecipeSubCategory(rawCategory, item.name, item.category);
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        mainCategory: inferMainCategoryByContext(explicitMainCategory, sourceTag, subCategory, rawCategory, item.name),
        subCategory,
      };
    });
  }, [state]);

  const starredHistoryItems = useMemo(() => {
    return classifiedItemOptions
      .filter((entry) => starItemIdSet.has(entry.id))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }, [classifiedItemOptions, starItemIdSet]);

  const itemMainCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(classifiedItemOptions.map((entry) => entry.mainCategory).filter(Boolean)));
    if (unique.length === 0) {
      return ["鐵匠"];
    }
    return unique.sort(sortMainCategoryText);
  }, [classifiedItemOptions]);

  const itemsByMainCategory = useMemo(() => {
    return classifiedItemOptions.filter((entry) => {
      if (itemMainCategory && entry.mainCategory !== itemMainCategory) {
        return false;
      }
      return true;
    });
  }, [classifiedItemOptions, itemMainCategory]);

  const filteredItems = useMemo(() => {
    const keyword = itemKeyword.trim();
    const base = keyword ? classifiedItemOptions : itemsByMainCategory;
    return base.filter((entry) => {
      if (!keyword && itemSubCategory !== "all" && entry.subCategory !== itemSubCategory) {
        return false;
      }
      if (keyword && !entry.name.includes(keyword)) {
        return false;
      }
      return true;
    });
  }, [classifiedItemOptions, itemsByMainCategory, itemSubCategory, itemKeyword]);

  const itemSubCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(itemsByMainCategory.map((entry) => entry.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  }, [itemsByMainCategory]);

  const historyMainCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(classifiedItemOptions.map((entry) => entry.mainCategory).filter(Boolean)));
    if (unique.length === 0) {
      return ["鐵匠"];
    }
    return unique.sort(sortMainCategoryText);
  }, [classifiedItemOptions]);

  const historyItemsByMainCategory = useMemo(() => {
    return classifiedItemOptions.filter((entry) => {
      if (historyMainCategory && entry.mainCategory !== historyMainCategory) {
        return false;
      }
      return true;
    });
  }, [classifiedItemOptions, historyMainCategory]);

  const historySubCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(historyItemsByMainCategory.map((entry) => entry.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  }, [historyItemsByMainCategory]);

  const filteredHistoryItems = useMemo(() => {
    const keyword = historyKeyword.trim();
    const base = keyword ? classifiedItemOptions : historyItemsByMainCategory;
    return base
      .filter((entry) => {
        if (!keyword && historySubCategory !== "all" && entry.subCategory !== historySubCategory) {
          return false;
        }
        if (keyword && !entry.name.includes(keyword)) {
          return false;
        }
        if (focusStarOnly && !starItemIdSet.has(entry.id)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const leftStar = starItemIdSet.has(left.id) ? 1 : 0;
        const rightStar = starItemIdSet.has(right.id) ? 1 : 0;
        if (leftStar !== rightStar) {
          return rightStar - leftStar;
        }
        return left.name.localeCompare(right.name, "zh-CN");
      });
  }, [classifiedItemOptions, historyItemsByMainCategory, historySubCategory, historyKeyword, focusStarOnly, starItemIdSet]);

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
