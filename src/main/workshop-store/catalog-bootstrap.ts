import fs from "node:fs";
import path from "node:path";
import type {
  WorkshopInventoryItem,
  WorkshopItem,
  WorkshopPriceSignalRule,
  WorkshopPriceSnapshot,
  WorkshopState,
} from "../../shared/types";
import { applyCatalogData, type CatalogApplyDependencies } from "./catalog-import-apply";
import {
  normalizeCatalogLookupName,
  parseCatalogCsvText,
  resolveBuiltinCatalogFilePath,
  resolveBuiltinCatalogSignature,
} from "./catalog-import-shared";

const LEGACY_BUILTIN_ITEM_NAME_REDIRECTS: Record<string, string> = {
  達人閃耀的法珠: "達人閃耀的真實法珠",
};

export interface CatalogBootstrapDependencies {
  stateVersion: number;
  priceHistoryLimit: number;
  defaultSignalRule: WorkshopPriceSignalRule;
  normalizeState: (state: WorkshopState) => WorkshopState;
  applyDeps: CatalogApplyDependencies;
}

function buildBuiltinCatalogState(deps: CatalogBootstrapDependencies): WorkshopState {
  const filePath = resolveBuiltinCatalogFilePath();
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = parseCatalogCsvText(text);
  const baseState: WorkshopState = {
    version: deps.stateVersion,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
    signalRule: deps.defaultSignalRule,
  };
  const result = applyCatalogData(baseState, parsed, path.basename(filePath), deps.applyDeps);
  if (result.state.items.length === 0 || result.state.recipes.length === 0) {
    throw new Error(`内置目录解析失败: ${filePath}`);
  }
  return result.state;
}

function remapRuntimeStateToBuiltin(previous: WorkshopState, builtin: WorkshopState, deps: CatalogBootstrapDependencies): WorkshopState {
  const builtinByLookup = new Map<string, WorkshopItem>();
  builtin.items.forEach((item) => {
    builtinByLookup.set(normalizeCatalogLookupName(item.name), item);
  });
  const legacyRedirectByLookup = new Map<string, string>();
  Object.entries(LEGACY_BUILTIN_ITEM_NAME_REDIRECTS).forEach(([legacyName, nextName]) => {
    legacyRedirectByLookup.set(normalizeCatalogLookupName(legacyName), normalizeCatalogLookupName(nextName));
  });

  const mappedItemIdByLegacyId = new Map<string, string>();
  previous.items.forEach((item) => {
    const key = normalizeCatalogLookupName(item.name);
    let hit = builtinByLookup.get(key);
    if (!hit) {
      const redirectedLookup = legacyRedirectByLookup.get(key);
      if (redirectedLookup) {
        hit = builtinByLookup.get(redirectedLookup);
      }
    }
    if (!hit) {
      return;
    }
    mappedItemIdByLegacyId.set(item.id, hit.id);
  });

  const mappedPrices = previous.prices
    .map((row) => {
      const mappedItemId = mappedItemIdByLegacyId.get(row.itemId);
      if (!mappedItemId) {
        return null;
      }
      return {
        ...row,
        itemId: mappedItemId,
      };
    })
    .filter((row): row is WorkshopPriceSnapshot => row !== null)
    .slice(-deps.priceHistoryLimit);

  const mappedInventoryByItemId = new Map<string, WorkshopInventoryItem>();
  previous.inventory.forEach((row) => {
    const mappedItemId = mappedItemIdByLegacyId.get(row.itemId);
    if (!mappedItemId) {
      return;
    }
    const prev = mappedInventoryByItemId.get(mappedItemId);
    if (!prev) {
      mappedInventoryByItemId.set(mappedItemId, {
        ...row,
        itemId: mappedItemId,
      });
      return;
    }
    const prevTs = new Date(prev.updatedAt).getTime();
    const nextTs = new Date(row.updatedAt).getTime();
    if (nextTs >= prevTs) {
      mappedInventoryByItemId.set(mappedItemId, {
        ...row,
        itemId: mappedItemId,
      });
    }
  });

  return deps.normalizeState({
    ...builtin,
    version: deps.stateVersion,
    prices: mappedPrices,
    inventory: Array.from(mappedInventoryByItemId.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule: previous.signalRule,
  });
}

export function rebuildStateWithBuiltinCatalog(previous: WorkshopState, deps: CatalogBootstrapDependencies): WorkshopState {
  const builtin = buildBuiltinCatalogState(deps);
  return remapRuntimeStateToBuiltin(previous, builtin, deps);
}

export function getBuiltinCatalogSignature(): string {
  return resolveBuiltinCatalogSignature();
}
