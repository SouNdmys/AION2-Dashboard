import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  WorkshopCatalogImportFromFileInput,
  WorkshopCatalogImportResult,
  WorkshopItem,
  WorkshopRecipe,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
  WorkshopState,
} from "../../shared/types";
import {
  WORKSHOP_ICON_CACHE_KEY,
  WORKSHOP_STATE_VERSION,
  applyCatalogDataCore,
  ensureItemExists,
  normalizeIconCache,
  normalizeRecipeInputs,
  readWorkshopState,
  resolveItemIconWithCache,
  toPositiveInt,
  workshopStore,
  writeWorkshopState,
} from "../workshop-store-core";
import { parseCatalogCsvText, resolveCatalogImportFilePath } from "./catalog-import-shared";

export function upsertWorkshopItem(payload: UpsertWorkshopItemInput): WorkshopState {
  const state = readWorkshopState();
  const nowIso = new Date().toISOString();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("物品名称不能为空。");
  }

  const duplicate = state.items.find(
    (item) => item.id !== payload.id && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (duplicate) {
    throw new Error(`物品名称重复: ${duplicate.name}`);
  }

  const category = payload.category ?? "material";
  const existing = payload.id ? state.items.find((item) => item.id === payload.id) : undefined;
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const resolvedIcon = resolveItemIconWithCache(iconCache, name, category, payload.icon?.trim() || existing?.icon);
  const nextItem: WorkshopItem = existing
    ? {
        ...existing,
        name,
        category,
        icon: resolvedIcon,
        notes: payload.notes?.trim() || undefined,
        updatedAt: nowIso,
      }
    : {
        id: randomUUID(),
        name,
        category,
        icon: resolvedIcon,
        notes: payload.notes?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

  const existingIndex = state.items.findIndex((item) => item.id === nextItem.id);
  const nextItems = [...state.items];
  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
  } else {
    nextItems.push(nextItem);
  }

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items: nextItems,
  });
}

export function deleteWorkshopItem(itemId: string): WorkshopState {
  const state = readWorkshopState();
  const exists = state.items.some((item) => item.id === itemId);
  if (!exists) {
    return state;
  }

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items: state.items.filter((item) => item.id !== itemId),
    recipes: state.recipes.filter(
      (recipe) => recipe.outputItemId !== itemId && !recipe.inputs.some((input) => input.itemId === itemId),
    ),
    prices: state.prices.filter((price) => price.itemId !== itemId),
    inventory: state.inventory.filter((row) => row.itemId !== itemId),
  });
}

export function upsertWorkshopRecipe(payload: UpsertWorkshopRecipeInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.outputItemId);

  const outputQuantity = toPositiveInt(payload.outputQuantity, 0);
  if (outputQuantity <= 0) {
    throw new Error("成品数量必须是正整数。");
  }

  const inputs = normalizeRecipeInputs(payload.inputs);
  if (inputs.length === 0) {
    throw new Error("至少需要一个材料输入。");
  }

  inputs.forEach((input) => ensureItemExists(state, input.itemId));
  if (inputs.some((input) => input.itemId === payload.outputItemId)) {
    throw new Error("配方输入不能包含成品本身。");
  }

  const duplicateOutput = state.recipes.find(
    (recipe) => recipe.id !== payload.id && recipe.outputItemId === payload.outputItemId,
  );
  if (duplicateOutput) {
    throw new Error("同一个成品只允许存在一条配方，请先删除旧配方。");
  }

  const nowIso = new Date().toISOString();
  const nextRecipe: WorkshopRecipe = {
    id: payload.id ?? randomUUID(),
    outputItemId: payload.outputItemId,
    outputQuantity,
    inputs,
    updatedAt: nowIso,
  };

  const existingIndex = state.recipes.findIndex((recipe) => recipe.id === nextRecipe.id);
  const nextRecipes = [...state.recipes];
  if (existingIndex >= 0) {
    nextRecipes[existingIndex] = nextRecipe;
  } else {
    nextRecipes.push(nextRecipe);
  }

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    recipes: nextRecipes,
  });
}

export function deleteWorkshopRecipe(recipeId: string): WorkshopState {
  const state = readWorkshopState();
  if (!state.recipes.some((recipe) => recipe.id === recipeId)) {
    return state;
  }
  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    recipes: state.recipes.filter((recipe) => recipe.id !== recipeId),
  });
}

export function importWorkshopCatalogFromFile(payload: WorkshopCatalogImportFromFileInput): WorkshopCatalogImportResult {
  const state = readWorkshopState();
  const fullPath = resolveCatalogImportFilePath(payload.filePath);
  const text = fs.readFileSync(fullPath, "utf8");
  const parsed = parseCatalogCsvText(text);
  const result = applyCatalogDataCore(state, parsed, path.basename(fullPath));
  return {
    ...result,
    state: writeWorkshopState(result.state),
  };
}
