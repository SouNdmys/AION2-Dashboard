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
import { memoizeSelector } from "./memoizeSelector";

interface ItemMetaLite {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

export function createWorkshopCatalogSelectors(): {
  selectStarItemIdSet: (starItemIds: string[]) => Set<string>;
  selectItemById: (state: WorkshopState | null) => Map<string, ItemMetaLite>;
  selectClassifiedItemOptions: (state: WorkshopState | null) => ClassifiedItemOption[];
  selectStarredHistoryItems: (classifiedItemOptions: ClassifiedItemOption[], starItemIdSet: Set<string>) => ClassifiedItemOption[];
  selectMainCategoryOptions: (classifiedItemOptions: ClassifiedItemOption[]) => string[];
  selectItemsByMainCategory: (classifiedItemOptions: ClassifiedItemOption[], mainCategory: string) => ClassifiedItemOption[];
  selectFilteredItems: (
    classifiedItemOptions: ClassifiedItemOption[],
    itemsByMainCategory: ClassifiedItemOption[],
    subCategory: "all" | string,
    keyword: string,
  ) => ClassifiedItemOption[];
  selectSubCategoryOptions: (itemsByMainCategory: ClassifiedItemOption[]) => string[];
  selectFilteredHistoryItems: (
    classifiedItemOptions: ClassifiedItemOption[],
    historyItemsByMainCategory: ClassifiedItemOption[],
    historySubCategory: "all" | string,
    historyKeyword: string,
    focusStarOnly: boolean,
    starItemIdSet: Set<string>,
  ) => ClassifiedItemOption[];
} {
  const selectStarItemIdSet = memoizeSelector((starItemIds: string[]): Set<string> => new Set(starItemIds));

  const selectItemById = memoizeSelector((state: WorkshopState | null): Map<string, ItemMetaLite> => {
    if (!state) return new Map<string, ItemMetaLite>();
    return new Map(state.items.map((item) => [item.id, { name: item.name, category: item.category, notes: item.notes }]));
  });

  const selectClassifiedItemOptions = memoizeSelector((state: WorkshopState | null): ClassifiedItemOption[] => {
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
  });

  const selectStarredHistoryItems = memoizeSelector(
    (classifiedItemOptions: ClassifiedItemOption[], starItemIdSet: Set<string>): ClassifiedItemOption[] =>
      classifiedItemOptions
        .filter((entry) => starItemIdSet.has(entry.id))
        .sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
  );

  const selectMainCategoryOptions = memoizeSelector((classifiedItemOptions: ClassifiedItemOption[]): string[] => {
    const unique = Array.from(new Set(classifiedItemOptions.map((entry) => entry.mainCategory).filter(Boolean)));
    if (unique.length === 0) {
      return ["鐵匠"];
    }
    return unique.sort(sortMainCategoryText);
  });

  const selectItemsByMainCategory = memoizeSelector(
    (classifiedItemOptions: ClassifiedItemOption[], mainCategory: string): ClassifiedItemOption[] =>
      classifiedItemOptions.filter((entry) => {
        if (mainCategory && entry.mainCategory !== mainCategory) {
          return false;
        }
        return true;
      }),
  );

  const selectFilteredItems = memoizeSelector(
    (
      classifiedItemOptions: ClassifiedItemOption[],
      itemsByMainCategory: ClassifiedItemOption[],
      subCategory: "all" | string,
      keyword: string,
    ): ClassifiedItemOption[] => {
      const trimmedKeyword = keyword.trim();
      const base = trimmedKeyword ? classifiedItemOptions : itemsByMainCategory;
      return base.filter((entry) => {
        if (!trimmedKeyword && subCategory !== "all" && entry.subCategory !== subCategory) {
          return false;
        }
        if (trimmedKeyword && !entry.name.includes(trimmedKeyword)) {
          return false;
        }
        return true;
      });
    },
  );

  const selectSubCategoryOptions = memoizeSelector((itemsByMainCategory: ClassifiedItemOption[]): string[] => {
    const unique = Array.from(new Set(itemsByMainCategory.map((entry) => entry.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  });

  const selectFilteredHistoryItems = memoizeSelector(
    (
      classifiedItemOptions: ClassifiedItemOption[],
      historyItemsByMainCategory: ClassifiedItemOption[],
      historySubCategory: "all" | string,
      historyKeyword: string,
      focusStarOnly: boolean,
      starItemIdSet: Set<string>,
    ): ClassifiedItemOption[] => {
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
    },
  );

  return {
    selectStarItemIdSet,
    selectItemById,
    selectClassifiedItemOptions,
    selectStarredHistoryItems,
    selectMainCategoryOptions,
    selectItemsByMainCategory,
    selectFilteredItems,
    selectSubCategoryOptions,
    selectFilteredHistoryItems,
  };
}
