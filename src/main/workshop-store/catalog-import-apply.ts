import { randomUUID } from "node:crypto";
import type { WorkshopCatalogImportResult, WorkshopItem, WorkshopItemCategory, WorkshopRecipeInput, WorkshopState } from "../../shared/types";
import {
  mapCatalogCategory,
  normalizeCatalogItemName,
  normalizeCatalogLookupName,
  normalizeCatalogMainCategory,
  type CatalogItemRow,
  type CatalogRecipeRow,
} from "./catalog-import-shared";

export interface CatalogApplyDependencies {
  stateVersion: number;
  loadIconCache: () => Map<string, string>;
  resolveItemIconWithCache: (
    iconCache: Map<string, string>,
    name: string,
    category: WorkshopItemCategory,
    preferredIcon?: string,
  ) => string | undefined;
  cacheIconByName: (iconCache: Map<string, string>, name: string, icon: string | undefined) => void;
  normalizeState: (state: WorkshopState) => WorkshopState;
}

export function applyCatalogData(
  baseState: WorkshopState,
  parsed: { items: CatalogItemRow[]; recipes: CatalogRecipeRow[]; warnings: string[] },
  sourceTag: string,
  deps: CatalogApplyDependencies,
): WorkshopCatalogImportResult {
  const nowIso = new Date().toISOString();
  const items = [...baseState.items];
  const iconCache = deps.loadIconCache();
  const itemByLookup = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookup.set(normalizeCatalogLookupName(item.name), item);
  });

  let importedItemCount = 0;
  let createdImplicitItemCount = 0;

  const ensureItemByName = (
    itemName: string,
    fallbackCategory: WorkshopItemCategory,
    mainCategory?: string,
  ): WorkshopItem => {
    const normalized = normalizeCatalogItemName(itemName);
    const key = normalizeCatalogLookupName(normalized);
    const existing = itemByLookup.get(key);
    if (existing) {
      return existing;
    }
    const normalizedMainCategory = mainCategory ? normalizeCatalogMainCategory(mainCategory) : "";
    const note = normalizedMainCategory
      ? `來源: ${sourceTag}; 大類: ${normalizedMainCategory}; 分類: 隱式`
      : `來源: ${sourceTag}; 分類: 隱式`;
    const created: WorkshopItem = {
      id: randomUUID(),
      name: normalized,
      category: fallbackCategory,
      icon: deps.resolveItemIconWithCache(iconCache, normalized, fallbackCategory),
      notes: note,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    items.push(created);
    itemByLookup.set(key, created);
    createdImplicitItemCount += 1;
    return created;
  };

  parsed.items.forEach((row) => {
    const key = normalizeCatalogLookupName(row.name);
    const mappedCategory = mapCatalogCategory(row.rawCategory);
    const normalizedMainCategory = row.mainCategory ? normalizeCatalogMainCategory(row.mainCategory) : "";
    const mainCategoryNote = normalizedMainCategory ? `; 大類: ${normalizedMainCategory}` : "";
    const note =
      row.alias
        ? `來源: ${sourceTag}${mainCategoryNote}; 分類: ${row.rawCategory}; 別名: ${row.alias}`
        : `來源: ${sourceTag}${mainCategoryNote}; 分類: ${row.rawCategory}`;
    const existing = itemByLookup.get(key);
    if (existing) {
      const shouldRefreshNote = !existing.notes || existing.notes.includes("來源:");
      const resolvedIcon = deps.resolveItemIconWithCache(iconCache, existing.name, mappedCategory, existing.icon);
      const nextExisting: WorkshopItem = {
        ...existing,
        category: mappedCategory,
        icon: resolvedIcon,
        notes: shouldRefreshNote ? note : existing.notes,
        updatedAt: nowIso,
      };
      const index = items.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        items[index] = nextExisting;
      }
      itemByLookup.set(key, nextExisting);
      deps.cacheIconByName(iconCache, row.name, resolvedIcon);
      if (row.alias) {
        deps.cacheIconByName(iconCache, row.alias, resolvedIcon);
      }
      importedItemCount += 1;
      return;
    }
    const createdIcon = deps.resolveItemIconWithCache(iconCache, row.name, mappedCategory);
    const created: WorkshopItem = {
      id: randomUUID(),
      name: row.name,
      category: mappedCategory,
      icon: createdIcon,
      notes: note,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    items.push(created);
    itemByLookup.set(key, created);
    if (row.alias) {
      deps.cacheIconByName(iconCache, row.alias, createdIcon);
    }
    importedItemCount += 1;
  });

  let importedRecipeCount = 0;
  let skippedRecipeCount = 0;
  const warnings = [...parsed.warnings];
  const nextRecipes = [...baseState.recipes];
  const touchedOutputItemIds = new Set<string>();
  const touchedOutputItemOrder: string[] = [];

  parsed.recipes.forEach((recipeRow) => {
    const outputItem = ensureItemByName(recipeRow.outputName, "equipment", recipeRow.mainCategory);
    if (touchedOutputItemIds.has(outputItem.id)) {
      skippedRecipeCount += 1;
      warnings.push(`重复产物配方已跳过: ${recipeRow.outputName}`);
      return;
    }
    touchedOutputItemIds.add(outputItem.id);
    touchedOutputItemOrder.push(outputItem.id);

    const inputRows = recipeRow.inputs
      .map((input) => {
        const inputItem = ensureItemByName(input.itemId, "component");
        return {
          itemId: inputItem.id,
          quantity: input.quantity,
        };
      })
      .filter((entry) => entry.quantity > 0);

    const dedupInputMap = new Map<string, number>();
    inputRows.forEach((entry) => {
      dedupInputMap.set(entry.itemId, (dedupInputMap.get(entry.itemId) ?? 0) + entry.quantity);
    });
    const dedupInputs: WorkshopRecipeInput[] = Array.from(dedupInputMap.entries())
      .map(([itemId, quantity]) => ({ itemId, quantity: Math.max(1, Math.floor(quantity)) }))
      .sort((left, right) => left.itemId.localeCompare(right.itemId));
    if (dedupInputs.length === 0) {
      skippedRecipeCount += 1;
      warnings.push(`配方材料为空已跳过: ${recipeRow.outputName}`);
      return;
    }

    const existingIndex = nextRecipes.findIndex((entry) => entry.outputItemId === outputItem.id);
    if (existingIndex >= 0) {
      nextRecipes[existingIndex] = {
        ...nextRecipes[existingIndex],
        outputQuantity: Math.max(1, Math.floor(recipeRow.outputQuantity)),
        inputs: dedupInputs,
        updatedAt: nowIso,
      };
    } else {
      nextRecipes.push({
        id: randomUUID(),
        outputItemId: outputItem.id,
        outputQuantity: Math.max(1, Math.floor(recipeRow.outputQuantity)),
        inputs: dedupInputs,
        updatedAt: nowIso,
      });
    }
    importedRecipeCount += 1;
  });

  const touchedOrderByOutputItemId = new Map<string, number>();
  touchedOutputItemOrder.forEach((itemId, index) => {
    touchedOrderByOutputItemId.set(itemId, index);
  });
  const orderedTouchedRecipes = nextRecipes
    .filter((recipe) => touchedOrderByOutputItemId.has(recipe.outputItemId))
    .sort(
      (left, right) =>
        (touchedOrderByOutputItemId.get(left.outputItemId) ?? Number.MAX_SAFE_INTEGER) -
        (touchedOrderByOutputItemId.get(right.outputItemId) ?? Number.MAX_SAFE_INTEGER),
    );
  const orderedUntouchedRecipes = nextRecipes.filter((recipe) => !touchedOrderByOutputItemId.has(recipe.outputItemId));
  const orderedRecipes = [...orderedTouchedRecipes, ...orderedUntouchedRecipes];

  const nextState = deps.normalizeState({
    ...baseState,
    version: deps.stateVersion,
    items,
    recipes: orderedRecipes,
  });

  return {
    state: nextState,
    importedItemCount,
    importedRecipeCount,
    createdImplicitItemCount,
    skippedRecipeCount,
    warnings,
  };
}
