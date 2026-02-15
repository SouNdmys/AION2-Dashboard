import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { nativeImage } from "electron";
import Store from "electron-store";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopCatalogImportFromFileInput,
  WorkshopCatalogImportResult,
  WorkshopOcrExtractTextInput,
  WorkshopOcrExtractTextResult,
  WorkshopOcrIconCaptureConfig,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
  WorkshopRect,
  WorkshopTradeBoardPreset,
  UpsertWorkshopInventoryInput,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopInventoryItem,
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopPriceMarket,
  WorkshopPriceHistoryPoint,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
  WorkshopPriceSignalRule,
  WorkshopPriceTrendTag,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopRecipeInput,
  WorkshopState,
  WorkshopWeekdayAverage,
} from "../shared/types";

const WORKSHOP_STATE_VERSION = 6;
const WORKSHOP_PRICE_HISTORY_LIMIT = 8_000;
const WORKSHOP_HISTORY_DEFAULT_DAYS = 30;
const WORKSHOP_HISTORY_MAX_DAYS = 365;
const WORKSHOP_SIGNAL_THRESHOLD_DEFAULT = 0.08;
const WORKSHOP_SIGNAL_THRESHOLD_MIN = 0.01;
const WORKSHOP_SIGNAL_THRESHOLD_MAX = 0.5;
const WORKSHOP_ICON_CACHE_KEY = "iconCache";
const WORKSHOP_OCR_DEFAULT_LANGUAGE = "chi_tra+eng";
const WORKSHOP_OCR_DEFAULT_PSM = 6;

const DEFAULT_WORKSHOP_SIGNAL_RULE: WorkshopPriceSignalRule = {
  enabled: true,
  lookbackDays: WORKSHOP_HISTORY_DEFAULT_DAYS,
  dropBelowWeekdayAverageRatio: WORKSHOP_SIGNAL_THRESHOLD_DEFAULT,
};
const BUILTIN_CATALOG_FILE_NAME = "制作管理.md";

const workshopStore = new Store<Record<string, unknown>>({
  name: "aion2-dashboard-workshop",
  clearInvalidConfig: true,
  defaults: {
    version: WORKSHOP_STATE_VERSION,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
    signalRule: DEFAULT_WORKSHOP_SIGNAL_RULE,
    iconCache: {},
  },
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asIso(raw: unknown, fallbackIso: string): string {
  if (typeof raw !== "string") {
    return fallbackIso;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return fallbackIso;
  }
  return date.toISOString();
}

function sanitizeCategory(raw: unknown): WorkshopItemCategory {
  if (raw === "material" || raw === "equipment" || raw === "component" || raw === "other") {
    return raw;
  }
  return "material";
}

function sanitizePriceMarket(raw: unknown): WorkshopPriceMarket {
  if (raw === "server" || raw === "world" || raw === "single") {
    return raw;
  }
  return "single";
}

function sanitizeName(raw: unknown, fallback = ""): string {
  if (typeof raw !== "string") {
    return fallback;
  }
  return raw.trim();
}

function sanitizeIconToken(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const icon = raw.trim();
  return icon || undefined;
}

function normalizeLookupName(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, "");
}

function sanitizeOcrLineItemName(raw: string): string {
  return raw
    .replace(/[|丨]/g, " ")
    .replace(/[，]/g, ",")
    .replace(/[：]/g, ":")
    .replace(/[“”‘’"'`]/g, "")
    .replace(/[()（）[\]{}<>﹤﹥]/g, " ")
    .replace(/^[^0-9a-zA-Z\u3400-\u9fff]+/gu, "")
    .replace(/[^0-9a-zA-Z\u3400-\u9fff]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOcrLookupCandidates(rawName: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string): void => {
    const normalized = normalizeLookupName(value);
    if (normalized.length >= 2) {
      candidates.add(normalized);
    }
  };
  add(rawName);
  const cleaned = sanitizeOcrLineItemName(rawName).replace(/[^0-9a-zA-Z\u3400-\u9fff]/gu, "");
  add(cleaned);
  const normalized = normalizeLookupName(cleaned);
  const trimLimit = Math.min(6, Math.max(0, normalized.length - 2));
  for (let index = 1; index <= trimLimit; index += 1) {
    add(normalized.slice(index));
  }
  if (normalized.length > 4) {
    add(normalized.slice(0, -1));
    add(normalized.slice(0, -2));
  }
  return Array.from(candidates);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return right.length;
  }
  if (!right) {
    return left.length;
  }
  const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const up = prev[j];
      const leftCost = prev[j - 1] + 1;
      const upCost = up + 1;
      const replaceCost = diagonal + (left[i - 1] === right[j - 1] ? 0 : 1);
      prev[j] = Math.min(leftCost, upCost, replaceCost);
      diagonal = up;
    }
  }
  return prev[right.length];
}

function resolveItemByOcrName(itemByLookupName: Map<string, WorkshopItem>, rawName: string): WorkshopItem | undefined {
  const candidates = buildOcrLookupCandidates(rawName);
  for (const candidate of candidates) {
    const exact = itemByLookupName.get(candidate);
    if (exact) {
      return exact;
    }
  }

  let bestContainItem: WorkshopItem | undefined;
  let bestContainOverlap = -1;
  let bestContainScore = -1;
  itemByLookupName.forEach((item, lookup) => {
    if (lookup.length < 4) {
      return;
    }
    candidates.forEach((candidate) => {
      const overlap = Math.min(candidate.length, lookup.length);
      if (overlap < 4) {
        return;
      }
      if (!candidate.includes(lookup) && !lookup.includes(candidate)) {
        return;
      }
      const score = overlap / Math.max(candidate.length, lookup.length);
      if (
        overlap > bestContainOverlap ||
        (overlap === bestContainOverlap && score > bestContainScore)
      ) {
        bestContainItem = item;
        bestContainOverlap = overlap;
        bestContainScore = score;
      }
    });
  });
  if (bestContainItem) {
    return bestContainItem;
  }

  const fuzzy: Array<{ item: WorkshopItem; ratio: number; maxLen: number }> = [];
  itemByLookupName.forEach((item, lookup) => {
    candidates.forEach((candidate) => {
      if (candidate.length < 4 || lookup.length < 4) {
        return;
      }
      if (Math.abs(candidate.length - lookup.length) > 4) {
        return;
      }
      const dist = levenshteinDistance(candidate, lookup);
      const maxLen = Math.max(candidate.length, lookup.length);
      const ratio = 1 - dist / maxLen;
      const threshold = maxLen >= 8 ? 0.62 : 0.68;
      if (ratio < threshold) {
        return;
      }
      fuzzy.push({ item, ratio, maxLen });
    });
  });
  if (fuzzy.length === 0) {
    return undefined;
  }
  fuzzy.sort((left, right) => {
    if (right.ratio !== left.ratio) {
      return right.ratio - left.ratio;
    }
    if (right.maxLen !== left.maxLen) {
      return right.maxLen - left.maxLen;
    }
    return left.item.name.localeCompare(right.item.name, "zh-CN");
  });
  const best = fuzzy[0];
  const second = fuzzy[1];
  if (best.ratio >= 0.9) {
    return best.item;
  }
  if (!second || best.ratio - second.ratio >= 0.08) {
    return best.item;
  }
  return undefined;
}

function resolveUniqueItemByIcon(items: WorkshopItem[], icon: string | undefined): WorkshopItem | undefined {
  if (!icon) {
    return undefined;
  }
  let matched: WorkshopItem | undefined;
  for (const item of items) {
    if (item.icon !== icon) {
      continue;
    }
    if (matched) {
      return undefined;
    }
    matched = item;
  }
  return matched;
}

function isAmbiguousExactOcrNameMatch(item: WorkshopItem, ocrName: string, items: WorkshopItem[]): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  if (!ocrKey) {
    return false;
  }
  const itemKey = normalizeLookupName(item.name);
  if (!itemKey || itemKey !== ocrKey) {
    return false;
  }
  return items.some((other) => {
    if (other.id === item.id) {
      return false;
    }
    const otherKey = normalizeLookupName(other.name);
    return otherKey.length > ocrKey.length && otherKey.includes(ocrKey);
  });
}

function isExactOcrNameMatch(item: WorkshopItem, ocrName: string): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  const itemKey = normalizeLookupName(item.name);
  return Boolean(ocrKey) && ocrKey === itemKey;
}

function inferItemIcon(name: string, category: WorkshopItemCategory): string | undefined {
  if (category === "equipment") {
    return "icon-equipment";
  }
  if (category === "component") {
    return "icon-component";
  }
  const normalized = name.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("矿") || normalized.includes("礦") || normalized.includes("结晶") || normalized.includes("結晶") || normalized.includes("石")) {
    return "icon-material-ore";
  }
  if (normalized.includes("粉") || normalized.includes("碎片") || normalized.includes("核心")) {
    return "icon-material-fragment";
  }
  return category === "material" ? "icon-material" : "icon-other";
}

function normalizeIconCache(raw: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || typeof raw !== "object") {
    return map;
  }
  Object.entries(raw as Record<string, unknown>).forEach(([rawKey, rawIcon]) => {
    const key = normalizeLookupName(rawKey);
    const icon = sanitizeIconToken(rawIcon);
    if (!key || !icon) {
      return;
    }
    map.set(key, icon);
  });
  return map;
}

function serializeIconCache(iconCache: Map<string, string>): Record<string, string> {
  const pairs = Array.from(iconCache.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  return Object.fromEntries(pairs);
}

function cacheIconByName(iconCache: Map<string, string>, name: string, icon: string | undefined): void {
  if (!icon) {
    return;
  }
  const key = normalizeLookupName(name);
  if (!key) {
    return;
  }
  iconCache.set(key, icon);
}

function extractItemAliasesFromNotes(notes?: string): string[] {
  if (!notes) {
    return [];
  }
  const match = notes.match(/別名:\s*([^;]+)/u);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(/[、,，/]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveItemIconWithCache(
  iconCache: Map<string, string>,
  name: string,
  category: WorkshopItemCategory,
  preferredIcon?: string,
): string | undefined {
  const explicitIcon = sanitizeIconToken(preferredIcon);
  if (explicitIcon) {
    cacheIconByName(iconCache, name, explicitIcon);
    return explicitIcon;
  }
  const lookup = normalizeLookupName(name);
  if (lookup) {
    const cached = iconCache.get(lookup);
    if (cached) {
      return cached;
    }
  }
  const inferred = inferItemIcon(name, category);
  cacheIconByName(iconCache, name, inferred);
  return inferred;
}

function stripCatalogImprintTag(value: string): string {
  return value.replace(/[（(]\s*刻印\s*[）)]/gu, "");
}

function normalizeCatalogItemName(name: string): string {
  return stripCatalogImprintTag(name).trim().replace(/\s+/g, " ");
}

function normalizeCatalogLookupName(name: string): string {
  return normalizeCatalogItemName(name).toLocaleLowerCase().replace(/\s+/g, "");
}

function normalizeCatalogMainCategory(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (value === "铁匠") {
    return "鐵匠";
  }
  if (value === "手工艺") {
    return "手工藝";
  }
  if (value === "采集材料") {
    return "採集材料";
  }
  return value;
}

function isMajorCatalogMainCategory(category: string): boolean {
  return (
    category === "採集材料" ||
    category === "鐵匠" ||
    category === "盔甲" ||
    category === "手工藝" ||
    category === "煉金" ||
    category === "料理"
  );
}

function sanitizeRecipeOutputName(raw: string): string {
  return normalizeCatalogItemName(raw).replace(/\s*[（(]批量[）)]\s*$/u, "");
}

function parseRecipeInputChunk(chunk: string): { itemName: string; quantity: number } | null {
  const value = chunk.trim();
  if (!value) {
    return null;
  }
  const match = value.match(/^(.*?)(\d+)$/u);
  if (!match) {
    return null;
  }
  const head = match[1]?.replace(/[*xX×]\s*$/u, "").trim() ?? "";
  const tail = match[2] ?? "";
  const quantity = Number(tail);
  if (!head || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  return {
    itemName: normalizeCatalogItemName(head),
    quantity: Math.floor(quantity),
  };
}

function mapCatalogCategory(rawCategory: string): WorkshopItemCategory {
  const category = rawCategory.trim();
  if (category.includes("武器") || category.includes("裝備") || category.includes("防具") || category.includes("盔甲")) {
    return "equipment";
  }
  if (category.includes("採集")) {
    return "material";
  }
  if (category.includes("材料") || category.includes("消耗")) {
    return "component";
  }
  return "other";
}

interface CatalogItemRow {
  name: string;
  rawCategory: string;
  mainCategory?: string;
  alias?: string;
}

interface CatalogRecipeRow {
  outputName: string;
  outputQuantity: number;
  mainCategory?: string;
  inputs: WorkshopRecipeInput[];
}

function parseCatalogCsvText(text: string): {
  items: CatalogItemRow[];
  recipes: CatalogRecipeRow[];
  warnings: string[];
} {
  const lines = text.split(/\r?\n/u);
  const warnings: string[] = [];
  const itemRows: CatalogItemRow[] = [];
  const recipeRows: CatalogRecipeRow[] = [];
  let mode: "item" | "recipe" = "item";
  let currentMainCategory = "未分類";

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (!line) {
      return;
    }
    if (line.startsWith("#")) {
      const heading = normalizeCatalogMainCategory(line.replace(/^#+\s*/u, ""));
      if (heading && isMajorCatalogMainCategory(heading)) {
        currentMainCategory = heading;
      }
      mode = "item";
      return;
    }
    if (line.startsWith("名稱(繁體),分類")) {
      mode = "item";
      return;
    }
    if (line.startsWith("成品名稱,產量")) {
      mode = "recipe";
      return;
    }

    if (mode === "item") {
      const segments = rawLine.split(",");
      const name = normalizeCatalogItemName(segments[0] ?? "");
      const rawCategory = (segments[1] ?? "").trim();
      const alias = normalizeCatalogItemName(segments.slice(2).join(","));
      if (!name) {
        return;
      }
      if (!rawCategory) {
        return;
      }
      itemRows.push({
        name,
        rawCategory,
        mainCategory: currentMainCategory,
        alias: alias || undefined,
      });
      return;
    }

    if (mode === "recipe") {
      const first = rawLine.indexOf(",");
      const second = first < 0 ? -1 : rawLine.indexOf(",", first + 1);
      if (first < 0 || second < 0) {
        warnings.push(`第 ${lineNo} 行配方格式异常: ${line}`);
        return;
      }
      const outputRawName = normalizeCatalogItemName(rawLine.slice(0, first));
      const outputQuantityRaw = rawLine.slice(first + 1, second).trim();
      const inputText = rawLine.slice(second + 1).trim();
      const outputQuantity = Number(outputQuantityRaw);
      if (!outputRawName || !Number.isFinite(outputQuantity) || outputQuantity <= 0) {
        warnings.push(`第 ${lineNo} 行配方产物格式异常: ${line}`);
        return;
      }
      const outputName = sanitizeRecipeOutputName(outputRawName);
      const inputChunks = inputText.split(/[;；]/u).map((entry) => entry.trim()).filter(Boolean);
      const parsedInputs = inputChunks
        .map((entry) => parseRecipeInputChunk(entry))
        .filter((entry): entry is { itemName: string; quantity: number } => entry !== null)
        .map((entry) => ({
          itemId: entry.itemName,
          quantity: entry.quantity,
        }));
      if (parsedInputs.length === 0) {
        warnings.push(`第 ${lineNo} 行配方材料为空: ${line}`);
        return;
      }
      recipeRows.push({
        outputName,
        outputQuantity: Math.floor(outputQuantity),
        mainCategory: currentMainCategory,
        inputs: parsedInputs,
      });
      return;
    }
  });

  return {
    items: itemRows,
    recipes: recipeRows,
    warnings,
  };
}

function toPositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.floor(raw));
}

function toNonNegativeInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(0, Math.floor(raw));
}

function normalizeRecipeInputs(raw: unknown): WorkshopRecipeInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const dedup = new Map<string, number>();
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const itemId = typeof (entry as { itemId?: unknown }).itemId === "string" ? (entry as { itemId: string }).itemId : "";
    const quantity = toPositiveInt((entry as { quantity?: unknown }).quantity, 0);
    if (!itemId || quantity <= 0) {
      return;
    }
    dedup.set(itemId, (dedup.get(itemId) ?? 0) + quantity);
  });

  return Array.from(dedup.entries())
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function normalizeItem(raw: unknown, index: number): WorkshopItem {
  const nowIso = new Date().toISOString();
  const id = typeof (raw as { id?: unknown })?.id === "string" ? ((raw as { id: string }).id ?? randomUUID()) : randomUUID();
  const nameFallback = `物品-${index + 1}`;
  const name = sanitizeName((raw as { name?: unknown })?.name, nameFallback) || nameFallback;
  const createdAt = asIso((raw as { createdAt?: unknown })?.createdAt, nowIso);
  const updatedAt = asIso((raw as { updatedAt?: unknown })?.updatedAt, nowIso);
  const icon = sanitizeIconToken((raw as { icon?: unknown })?.icon);
  const notes = sanitizeName((raw as { notes?: unknown })?.notes) || undefined;

  return {
    id,
    name,
    category: sanitizeCategory((raw as { category?: unknown })?.category),
    icon,
    notes,
    createdAt,
    updatedAt,
  };
}

function normalizeRecipe(raw: unknown): WorkshopRecipe | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : randomUUID();
  const outputItemId =
    typeof (raw as { outputItemId?: unknown }).outputItemId === "string" ? (raw as { outputItemId: string }).outputItemId : "";
  if (!outputItemId) {
    return null;
  }

  const outputQuantity = toPositiveInt((raw as { outputQuantity?: unknown }).outputQuantity, 1);
  const inputs = normalizeRecipeInputs((raw as { inputs?: unknown }).inputs);
  if (inputs.length === 0) {
    return null;
  }

  const updatedAt = asIso((raw as { updatedAt?: unknown }).updatedAt, new Date().toISOString());
  return {
    id,
    outputItemId,
    outputQuantity,
    inputs,
    updatedAt,
  };
}

function normalizePriceSnapshot(raw: unknown): WorkshopPriceSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : randomUUID();
  const itemId = typeof (raw as { itemId?: unknown }).itemId === "string" ? (raw as { itemId: string }).itemId : "";
  if (!itemId) {
    return null;
  }

  const unitPrice = toNonNegativeInt((raw as { unitPrice?: unknown }).unitPrice, -1);
  if (unitPrice < 0) {
    return null;
  }

  const sourceRaw = (raw as { source?: unknown }).source;
  const source = sourceRaw === "import" ? "import" : "manual";
  const market = sanitizePriceMarket((raw as { market?: unknown }).market);
  const capturedAt = asIso((raw as { capturedAt?: unknown }).capturedAt, new Date().toISOString());
  const note = sanitizeName((raw as { note?: unknown }).note) || undefined;

  return {
    id,
    itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note,
  };
}

function normalizeInventoryItem(raw: unknown): WorkshopInventoryItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const itemId = typeof (raw as { itemId?: unknown }).itemId === "string" ? (raw as { itemId: string }).itemId : "";
  if (!itemId) {
    return null;
  }
  const quantity = toNonNegativeInt((raw as { quantity?: unknown }).quantity, -1);
  if (quantity < 0) {
    return null;
  }
  const updatedAt = asIso((raw as { updatedAt?: unknown }).updatedAt, new Date().toISOString());
  return {
    itemId,
    quantity,
    updatedAt,
  };
}

function normalizeWorkshopState(raw: unknown): WorkshopState {
  const entity = raw as Record<string, unknown> | undefined;
  const version = typeof entity?.version === "number" ? Math.floor(entity.version) : 0;
  const signalRule = normalizeSignalRule(entity?.signalRule);
  const iconCache = normalizeIconCache(entity?.[WORKSHOP_ICON_CACHE_KEY]);
  const itemsRaw = Array.isArray(entity?.items) ? entity?.items : [];
  const itemMap = new Map<string, WorkshopItem>();
  itemsRaw.forEach((entry, index) => {
    const item = normalizeItem(entry, index);
    itemMap.set(item.id, item);
  });

  const items = Array.from(itemMap.values()).map((item) => {
    const icon = resolveItemIconWithCache(iconCache, item.name, item.category, item.icon);
    const aliases = extractItemAliasesFromNotes(item.notes);
    aliases.forEach((alias) => cacheIconByName(iconCache, alias, icon));
    return icon === item.icon ? item : { ...item, icon };
  });
  const validItemIds = new Set(items.map((item) => item.id));

  const recipesRaw = Array.isArray(entity?.recipes) ? entity?.recipes : [];
  const recipeMap = new Map<string, WorkshopRecipe>();
  recipesRaw.forEach((entry) => {
    const recipe = normalizeRecipe(entry);
    if (!recipe) {
      return;
    }
    if (!validItemIds.has(recipe.outputItemId)) {
      return;
    }
    if (recipe.inputs.some((input) => !validItemIds.has(input.itemId))) {
      return;
    }
    recipeMap.set(recipe.id, recipe);
  });
  const recipes = Array.from(recipeMap.values());

  const pricesRaw = Array.isArray(entity?.prices) ? entity?.prices : [];
  const prices = pricesRaw
    .map((entry) => normalizePriceSnapshot(entry))
    .filter((entry): entry is WorkshopPriceSnapshot => entry !== null)
    .filter((entry) => validItemIds.has(entry.itemId))
    .slice(-WORKSHOP_PRICE_HISTORY_LIMIT);

  const inventoryRaw = Array.isArray(entity?.inventory) ? entity?.inventory : [];
  const inventoryMap = new Map<string, WorkshopInventoryItem>();
  inventoryRaw.forEach((entry) => {
    const row = normalizeInventoryItem(entry);
    if (!row || !validItemIds.has(row.itemId)) {
      return;
    }
    inventoryMap.set(row.itemId, row);
  });

  return {
    version: version > 0 ? WORKSHOP_STATE_VERSION : WORKSHOP_STATE_VERSION,
    items,
    recipes,
    prices,
    inventory: Array.from(inventoryMap.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule,
  };
}

function writeWorkshopState(next: WorkshopState): WorkshopState {
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const normalizedItems = next.items.map((item) => {
    const icon = resolveItemIconWithCache(iconCache, item.name, item.category, item.icon);
    const aliases = extractItemAliasesFromNotes(item.notes);
    aliases.forEach((alias) => cacheIconByName(iconCache, alias, icon));
    return icon === item.icon ? item : { ...item, icon };
  });
  workshopStore.set("version", next.version);
  workshopStore.set("items", normalizedItems);
  workshopStore.set("recipes", next.recipes);
  workshopStore.set("prices", next.prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT));
  workshopStore.set("inventory", next.inventory);
  workshopStore.set("signalRule", normalizeSignalRule(next.signalRule));
  workshopStore.set(WORKSHOP_ICON_CACHE_KEY, serializeIconCache(iconCache));
  return normalizeWorkshopState(workshopStore.store);
}

function readWorkshopState(): WorkshopState {
  const rawVersion = workshopStore.get("version");
  const storedBuiltinCatalogSignature = workshopStore.get("builtinCatalogSignature");
  const normalized = normalizeWorkshopState(workshopStore.store);
  const version = typeof rawVersion === "number" ? Math.floor(rawVersion) : 0;
  const currentBuiltinCatalogSignature = resolveBuiltinCatalogSignature();
  const shouldRebuildForCatalogChange =
    typeof storedBuiltinCatalogSignature !== "string" || storedBuiltinCatalogSignature !== currentBuiltinCatalogSignature;
  const shouldRebuildFromBuiltin =
    version !== WORKSHOP_STATE_VERSION ||
    normalized.items.length === 0 ||
    normalized.recipes.length === 0 ||
    shouldRebuildForCatalogChange;
  if (!shouldRebuildFromBuiltin) {
    return normalized;
  }
  const builtin = buildBuiltinCatalogState();
  const rebuilt = remapRuntimeStateToBuiltin(normalized, builtin);
  const persisted = writeWorkshopState(rebuilt);
  workshopStore.set("builtinCatalogSignature", currentBuiltinCatalogSignature);
  return persisted;
}

function remapRuntimeStateToBuiltin(previous: WorkshopState, builtin: WorkshopState): WorkshopState {
  const builtinByLookup = new Map<string, WorkshopItem>();
  builtin.items.forEach((item) => {
    builtinByLookup.set(normalizeCatalogLookupName(item.name), item);
  });

  const mappedItemIdByLegacyId = new Map<string, string>();
  previous.items.forEach((item) => {
    const key = normalizeCatalogLookupName(item.name);
    const hit = builtinByLookup.get(key);
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
    .slice(-WORKSHOP_PRICE_HISTORY_LIMIT);

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

  return normalizeWorkshopState({
    ...builtin,
    version: WORKSHOP_STATE_VERSION,
    prices: mappedPrices,
    inventory: Array.from(mappedInventoryByItemId.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule: previous.signalRule,
  });
}

function ensureItemExists(state: WorkshopState, itemId: string): void {
  if (!state.items.some((item) => item.id === itemId)) {
    throw new Error("物品不存在，请先创建物品。");
  }
}

function getLatestPriceMap(state: WorkshopState): Map<string, WorkshopPriceSnapshot> {
  const scoreByMarket = (market: WorkshopPriceMarket | undefined): number => {
    if (market === "server") return 3;
    if (market === "single") return 2;
    if (market === "world") return 1;
    return 0;
  };
  const map = new Map<string, WorkshopPriceSnapshot>();
  state.prices.forEach((snapshot) => {
    const previous = map.get(snapshot.itemId);
    if (!previous) {
      map.set(snapshot.itemId, snapshot);
      return;
    }
    const prevTs = new Date(previous.capturedAt).getTime();
    const nextTs = new Date(snapshot.capturedAt).getTime();
    if (nextTs > prevTs) {
      map.set(snapshot.itemId, snapshot);
      return;
    }
    if (nextTs === prevTs && scoreByMarket(snapshot.market) > scoreByMarket(previous.market)) {
      map.set(snapshot.itemId, snapshot);
    }
  });
  return map;
}

function buildSimulation(
  state: WorkshopState,
  recipe: WorkshopRecipe,
  runs: number,
  taxRate: number,
  materialMode: "expanded" | "direct",
): WorkshopCraftSimulationResult {
  const recipeByOutput = new Map(state.recipes.map((entry) => [entry.outputItemId, entry]));
  const itemById = new Map(state.items.map((entry) => [entry.id, entry]));
  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry.quantity]));
  const latestPriceByItemId = getLatestPriceMap(state);
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
    const nestedRecipe = recipeByOutput.get(itemId);
    if (!nestedRecipe) {
      addMaterial(itemId, neededQuantity);
      return;
    }
    if (visiting.has(itemId)) {
      const loopPath = [...stack, itemId]
        .map((loopItemId) => itemById.get(loopItemId)?.name ?? loopItemId)
        .join(" -> ");
      throw new Error(`检测到配方循环引用: ${loopPath}`);
    }
    visiting.add(itemId);
    stack.push(itemId);

    const nestedRuns = Math.ceil(neededQuantity / nestedRecipe.outputQuantity);
    addCraftRuns(itemId, nestedRuns);

    nestedRecipe.inputs.forEach((input) => {
      expandNeededItem(input.itemId, input.quantity * nestedRuns);
    });

    stack.pop();
    visiting.delete(itemId);
  };

  addCraftRuns(recipe.outputItemId, runs);
  if (materialMode === "direct") {
    recipe.inputs.forEach((input) => {
      addMaterial(input.itemId, input.quantity * runs);
    });
  } else {
    recipe.inputs.forEach((input) => {
      expandNeededItem(input.itemId, input.quantity * runs);
    });
  }

  const materialRows = Array.from(requiredMaterials.entries())
    .map(([itemId, required]) => {
      const requiredQty = Math.max(0, Math.floor(required));
      const owned = Math.max(0, Math.floor(inventoryByItemId.get(itemId) ?? 0));
      const missing = Math.max(0, requiredQty - owned);
      const latestUnitPrice = latestPriceByItemId.get(itemId)?.unitPrice ?? null;
      const requiredCost = latestUnitPrice === null ? null : latestUnitPrice * requiredQty;
      const missingCost = latestUnitPrice === null ? null : latestUnitPrice * missing;
      return {
        itemId,
        itemName: itemById.get(itemId)?.name ?? itemId,
        required: requiredQty,
        owned,
        missing,
        latestUnitPrice,
        requiredCost,
        missingCost,
      };
    })
    .sort((left, right) => right.missing - left.missing || left.itemName.localeCompare(right.itemName, "zh-CN"));

  const unknownPriceItemIds = materialRows.filter((row) => row.latestUnitPrice === null).map((row) => row.itemId);
  const requiredMaterialCost =
    unknownPriceItemIds.length > 0 ? null : materialRows.reduce((acc, row) => acc + (row.requiredCost ?? 0), 0);
  const missingPurchaseCost =
    unknownPriceItemIds.length > 0 ? null : materialRows.reduce((acc, row) => acc + (row.missingCost ?? 0), 0);

  const outputUnitPrice = latestPriceByItemId.get(recipe.outputItemId)?.unitPrice ?? null;
  const totalOutputQuantity = recipe.outputQuantity * runs;
  const grossRevenue = outputUnitPrice === null ? null : outputUnitPrice * totalOutputQuantity;
  const netRevenueAfterTax = grossRevenue === null ? null : grossRevenue * (1 - taxRate);
  const estimatedProfit =
    netRevenueAfterTax === null || requiredMaterialCost === null ? null : netRevenueAfterTax - requiredMaterialCost;
  const estimatedProfitRate =
    estimatedProfit === null || requiredMaterialCost === null || requiredMaterialCost <= 0
      ? null
      : estimatedProfit / requiredMaterialCost;

  const craftSteps = Array.from(craftRuns.entries())
    .map(([itemId, itemRuns]) => ({
      itemId,
      itemName: itemById.get(itemId)?.name ?? itemId,
      runs: itemRuns,
    }))
    .sort((left, right) => right.runs - left.runs || left.itemName.localeCompare(right.itemName, "zh-CN"));

  return {
    recipeId: recipe.id,
    outputItemId: recipe.outputItemId,
    outputItemName: itemById.get(recipe.outputItemId)?.name ?? recipe.outputItemId,
    outputQuantity: recipe.outputQuantity,
    runs,
    totalOutputQuantity,
    taxRate,
    materialMode,
    materialRows,
    craftSteps,
    craftableNow: materialRows.every((row) => row.missing <= 0),
    unknownPriceItemIds,
    requiredMaterialCost,
    missingPurchaseCost,
    outputUnitPrice,
    grossRevenue,
    netRevenueAfterTax,
    estimatedProfit,
    estimatedProfitRate,
  };
}

function sanitizeTaxRate(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0.1;
  }
  return clamp(raw, 0, 0.95);
}

function parseOptionalIso(raw: unknown): Date | null {
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function sanitizeLookbackDays(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_HISTORY_DEFAULT_DAYS;
  }
  return clamp(Math.floor(raw), 1, WORKSHOP_HISTORY_MAX_DAYS);
}

function sanitizeSignalThresholdRatio(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_SIGNAL_THRESHOLD_DEFAULT;
  }
  return clamp(raw, WORKSHOP_SIGNAL_THRESHOLD_MIN, WORKSHOP_SIGNAL_THRESHOLD_MAX);
}

function normalizeSignalRule(raw: unknown): WorkshopPriceSignalRule {
  const entity = raw as Record<string, unknown> | undefined;
  const enabled = typeof entity?.enabled === "boolean" ? entity.enabled : DEFAULT_WORKSHOP_SIGNAL_RULE.enabled;
  return {
    enabled,
    lookbackDays: sanitizeLookbackDays(entity?.lookbackDays),
    dropBelowWeekdayAverageRatio: sanitizeSignalThresholdRatio(entity?.dropBelowWeekdayAverageRatio),
  };
}

function resolvePriceTrendTag(
  sampleCount: number,
  deviationFromWeekdayAverage: number | null,
  deviationFromMa7: number | null,
  thresholdRatio: number,
): WorkshopPriceTrendTag {
  if (sampleCount < 5 || deviationFromWeekdayAverage === null) {
    return "watch";
  }
  const ma7Threshold = thresholdRatio * 0.5;
  const buyByWeekday = deviationFromWeekdayAverage <= -thresholdRatio;
  const sellByWeekday = deviationFromWeekdayAverage >= thresholdRatio;
  const buyByMa7 = deviationFromMa7 === null ? true : deviationFromMa7 <= -ma7Threshold;
  const sellByMa7 = deviationFromMa7 === null ? true : deviationFromMa7 >= ma7Threshold;
  if (buyByWeekday && buyByMa7) {
    return "buy-zone";
  }
  if (sellByWeekday && sellByMa7) {
    return "sell-zone";
  }
  return "watch";
}

function buildWeekdayAverages(points: WorkshopPriceHistoryPoint[]): WorkshopWeekdayAverage[] {
  const aggregates = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  points.forEach((point) => {
    const bucket = aggregates[point.weekday];
    bucket.sum += point.unitPrice;
    bucket.count += 1;
  });
  return aggregates.map((entry, weekday) => ({
    weekday,
    averagePrice: entry.count > 0 ? entry.sum / entry.count : null,
    sampleCount: entry.count,
  }));
}

function resolveHistoryRange(payload: WorkshopPriceHistoryQuery): { from: Date; to: Date } {
  const lookbackDays = sanitizeLookbackDays(payload.days);
  const parsedTo = parseOptionalIso(payload.toAt);
  const parsedFrom = parseOptionalIso(payload.fromAt);
  const now = new Date();
  const to = parsedTo ?? now;
  let from: Date;

  if (payload.fromAt && parsedFrom === null) {
    throw new Error("fromAt 不是有效时间格式。");
  }
  if (payload.toAt && parsedTo === null) {
    throw new Error("toAt 不是有效时间格式。");
  }

  if (parsedFrom) {
    from = parsedFrom;
  } else {
    const fromMs = to.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
    from = new Date(fromMs);
  }

  if (from.getTime() > to.getTime()) {
    throw new Error("时间范围无效：fromAt 不能晚于 toAt。");
  }

  return { from, to };
}

function buildWorkshopPriceHistoryResult(state: WorkshopState, payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const { from, to } = resolveHistoryRange(payload);
  const snapshots = state.prices
    .filter((entry) => entry.itemId === payload.itemId)
    .map((entry) => ({
      ...entry,
      ts: new Date(entry.capturedAt).getTime(),
    }))
    .filter((entry) => Number.isFinite(entry.ts))
    .filter((entry) => entry.ts >= from.getTime() && entry.ts <= to.getTime())
    .sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id));

  let rollingSum = 0;
  const rollingWindow: number[] = [];
  const points: WorkshopPriceHistoryPoint[] = snapshots.map((entry) => {
    rollingWindow.push(entry.unitPrice);
    rollingSum += entry.unitPrice;
    if (rollingWindow.length > 7) {
      const popped = rollingWindow.shift();
      if (popped !== undefined) {
        rollingSum -= popped;
      }
    }
    const ma7 = rollingWindow.length >= 7 ? rollingSum / rollingWindow.length : null;
    return {
      id: entry.id,
      itemId: entry.itemId,
      unitPrice: entry.unitPrice,
      capturedAt: new Date(entry.ts).toISOString(),
      weekday: new Date(entry.ts).getDay(),
      ma7,
    };
  });

  const sampleCount = points.length;
  const averagePrice = sampleCount > 0 ? points.reduce((acc, point) => acc + point.unitPrice, 0) / sampleCount : null;
  const latestPoint = points[sampleCount - 1] ?? null;

  return {
    itemId: payload.itemId,
    fromAt: from.toISOString(),
    toAt: to.toISOString(),
    sampleCount,
    latestPrice: latestPoint?.unitPrice ?? null,
    latestCapturedAt: latestPoint?.capturedAt ?? null,
    averagePrice,
    ma7Latest: latestPoint?.ma7 ?? null,
    points,
    weekdayAverages: buildWeekdayAverages(points),
  };
}

interface WorkshopSampleItemSeed {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

interface WorkshopSampleRecipeSeed {
  outputName: string;
  outputQuantity: number;
  inputs: Array<{ inputName: string; quantity: number }>;
}

interface WorkshopSamplePriceSeed {
  itemName: string;
  unitPrice: number;
}

interface WorkshopSampleInventorySeed {
  itemName: string;
  quantity: number;
}

const WORKSHOP_SAMPLE_ITEMS: WorkshopSampleItemSeed[] = [
  { name: "样例-奥德矿石", category: "material", notes: "基础采集材料" },
  { name: "样例-副本核心", category: "material", notes: "副本掉落材料" },
  { name: "样例-研磨粉", category: "component", notes: "中间加工材料" },
  { name: "样例-强化锭", category: "component", notes: "进阶中间材料" },
  { name: "样例-勇者长剑", category: "equipment", notes: "样例成品装备" },
];

const WORKSHOP_SAMPLE_RECIPES: WorkshopSampleRecipeSeed[] = [
  {
    outputName: "样例-研磨粉",
    outputQuantity: 1,
    inputs: [{ inputName: "样例-奥德矿石", quantity: 3 }],
  },
  {
    outputName: "样例-强化锭",
    outputQuantity: 1,
    inputs: [
      { inputName: "样例-研磨粉", quantity: 2 },
      { inputName: "样例-副本核心", quantity: 1 },
    ],
  },
  {
    outputName: "样例-勇者长剑",
    outputQuantity: 1,
    inputs: [
      { inputName: "样例-强化锭", quantity: 5 },
      { inputName: "样例-副本核心", quantity: 2 },
    ],
  },
];

const WORKSHOP_SAMPLE_PRICES: WorkshopSamplePriceSeed[] = [
  { itemName: "样例-奥德矿石", unitPrice: 80 },
  { itemName: "样例-副本核心", unitPrice: 1200 },
  { itemName: "样例-研磨粉", unitPrice: 320 },
  { itemName: "样例-强化锭", unitPrice: 1900 },
  { itemName: "样例-勇者长剑", unitPrice: 18000 },
];

const WORKSHOP_SAMPLE_INVENTORY: WorkshopSampleInventorySeed[] = [
  { itemName: "样例-奥德矿石", quantity: 480 },
  { itemName: "样例-副本核心", quantity: 26 },
  { itemName: "样例-研磨粉", quantity: 8 },
  { itemName: "样例-强化锭", quantity: 3 },
  { itemName: "样例-勇者长剑", quantity: 0 },
];

interface ParsedOcrPriceLine {
  lineNumber: number;
  raw: string;
  itemName: string;
  unitPrice: number;
  market: WorkshopPriceMarket;
}

interface OcrIconCaptureOutcome {
  iconByLineNumber: Map<number, string>;
  iconCapturedCount: number;
  iconSkippedCount: number;
  warnings: string[];
}

function parseIntLike(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  return Math.floor(raw);
}

function sanitizeOcrIconCaptureConfig(raw: unknown): { config: WorkshopOcrIconCaptureConfig | null; warnings: string[] } {
  if (!raw || typeof raw !== "object") {
    return { config: null, warnings: [] };
  }
  const entity = raw as Partial<WorkshopOcrIconCaptureConfig>;
  const screenshotPath = typeof entity.screenshotPath === "string" ? entity.screenshotPath.trim() : "";
  const firstRowTop = parseIntLike(entity.firstRowTop);
  const rowHeight = parseIntLike(entity.rowHeight);
  const nameAnchorX = parseIntLike(entity.nameAnchorX);
  const iconOffsetX = parseIntLike(entity.iconOffsetX);
  const iconTopOffset = parseIntLike(entity.iconTopOffset);
  const iconWidth = parseIntLike(entity.iconWidth);
  const iconHeight = parseIntLike(entity.iconHeight);

  const warnings: string[] = [];
  if (!screenshotPath) {
    warnings.push("图标抓取已忽略：缺少截图路径。");
  }
  if (firstRowTop === null || firstRowTop < 0) {
    warnings.push("图标抓取已忽略：firstRowTop 必须是 >= 0 的整数。");
  }
  if (rowHeight === null || rowHeight <= 0) {
    warnings.push("图标抓取已忽略：rowHeight 必须是正整数。");
  }
  if (nameAnchorX === null || nameAnchorX < 0) {
    warnings.push("图标抓取已忽略：nameAnchorX 必须是 >= 0 的整数。");
  }
  if (iconOffsetX === null) {
    warnings.push("图标抓取已忽略：iconOffsetX 必须是整数。");
  }
  if (iconTopOffset === null) {
    warnings.push("图标抓取已忽略：iconTopOffset 必须是整数。");
  }
  if (iconWidth === null || iconWidth <= 0) {
    warnings.push("图标抓取已忽略：iconWidth 必须是正整数。");
  }
  if (iconHeight === null || iconHeight <= 0) {
    warnings.push("图标抓取已忽略：iconHeight 必须是正整数。");
  }

  if (warnings.length > 0) {
    return {
      config: null,
      warnings,
    };
  }

  return {
    config: {
      screenshotPath,
      firstRowTop: firstRowTop ?? 0,
      rowHeight: rowHeight ?? 1,
      nameAnchorX: nameAnchorX ?? 0,
      iconOffsetX: iconOffsetX ?? 0,
      iconTopOffset: iconTopOffset ?? 0,
      iconWidth: iconWidth ?? 1,
      iconHeight: iconHeight ?? 1,
    },
    warnings,
  };
}

function sanitizeOcrImportPayload(payload: WorkshopOcrPriceImportInput): {
  source: "manual" | "import";
  capturedAt: string;
  autoCreateMissingItems: boolean;
  strictIconMatch: boolean;
  defaultCategory: WorkshopItemCategory;
  text: string;
  tradeRows: WorkshopOcrPriceImportInput["tradeRows"];
  iconCapture: WorkshopOcrIconCaptureConfig | null;
  iconCaptureWarnings: string[];
} {
  const source = payload.source === "manual" ? "manual" : "import";
  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const autoCreateMissingItems = payload.autoCreateMissingItems ?? false;
  const strictIconMatch = payload.strictIconMatch === true;
  const defaultCategory = sanitizeCategory(payload.defaultCategory);
  const iconCaptureSanitized = sanitizeOcrIconCaptureConfig(payload.iconCapture);
  return {
    source,
    capturedAt,
    autoCreateMissingItems,
    strictIconMatch,
    defaultCategory,
    text: typeof payload.text === "string" ? payload.text : "",
    tradeRows: Array.isArray(payload.tradeRows) ? payload.tradeRows : undefined,
    iconCapture: iconCaptureSanitized.config,
    iconCaptureWarnings: iconCaptureSanitized.warnings,
  };
}

function captureOcrLineIcons(
  parsedLines: ParsedOcrPriceLine[],
  config: WorkshopOcrIconCaptureConfig,
): OcrIconCaptureOutcome {
  const iconByLineNumber = new Map<number, string>();
  const warnings: string[] = [];
  const uniqueLineCount = new Set(parsedLines.map((line) => line.lineNumber)).size;
  const addWarning = (message: string): void => {
    if (warnings.length < 40) {
      warnings.push(message);
    }
  };

  let imagePath: string;
  try {
    imagePath = resolveCatalogImportFilePath(config.screenshotPath);
  } catch (err) {
    addWarning(err instanceof Error ? `图标抓取失败：${err.message}` : "图标抓取失败：无法定位截图路径。");
    return {
      iconByLineNumber,
      iconCapturedCount: 0,
      iconSkippedCount: uniqueLineCount,
      warnings,
    };
  }

  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    addWarning(`图标抓取失败：截图无法读取 (${path.basename(imagePath)})。`);
    return {
      iconByLineNumber,
      iconCapturedCount: 0,
      iconSkippedCount: uniqueLineCount,
      warnings,
    };
  }

  const imageSize = image.getSize();
  let iconCapturedCount = 0;
  let iconSkippedCount = 0;
  const uniqueLines = new Map<number, ParsedOcrPriceLine>();
  parsedLines.forEach((line) => {
    if (!uniqueLines.has(line.lineNumber)) {
      uniqueLines.set(line.lineNumber, line);
    }
  });

  Array.from(uniqueLines.values()).forEach((line) => {
    const rowIndex = Math.max(0, line.lineNumber - 1);
    const left = config.nameAnchorX + config.iconOffsetX;
    const top = config.firstRowTop + rowIndex * config.rowHeight + config.iconTopOffset;
    const rect = {
      x: Math.floor(left),
      y: Math.floor(top),
      width: Math.floor(config.iconWidth),
      height: Math.floor(config.iconHeight),
    };
    const isInside =
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.x + rect.width <= imageSize.width &&
      rect.y + rect.height <= imageSize.height;
    if (!isInside) {
      iconSkippedCount += 1;
      addWarning(`第 ${line.lineNumber} 行图标窗口越界，已跳过。`);
      return;
    }
    const bitmap = image.crop(rect).toBitmap();
    if (!bitmap || bitmap.length === 0) {
      iconSkippedCount += 1;
      addWarning(`第 ${line.lineNumber} 行图标抓取为空，已跳过。`);
      return;
    }
    const hash = createHash("sha1").update(bitmap).digest("hex").slice(0, 16);
    iconByLineNumber.set(line.lineNumber, `icon-img-${hash}`);
    iconCapturedCount += 1;
  });

  return {
    iconByLineNumber,
    iconCapturedCount,
    iconSkippedCount,
    warnings,
  };
}

function parseOcrPriceLines(rawText: string): { parsedLines: ParsedOcrPriceLine[]; invalidLines: string[] } {
  const parsedLines: ParsedOcrPriceLine[] = [];
  const invalidLines: string[] = [];
  const lines = rawText.split(/\r?\n/);

  lines.forEach((origin, index) => {
    const lineNumber = index + 1;
    const raw = origin.trim();
    if (!raw) {
      return;
    }
    const normalizedLine = raw
      .replace(/[|丨]/g, " ")
      .replace(/[，]/g, ",")
      .replace(/[：]/g, ":")
      .replace(/\s+/g, " ");
    const match = normalizedLine.match(/(-?[0-9oOlI|sSbB][0-9oOlI|sSbB,\.\s]*)$/);
    if (!match || match.index === undefined) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    let itemName = normalizedLine.slice(0, match.index).trim();
    itemName = itemName
      .replace(/[:=\-–—|]\s*$/g, "")
      .replace(/^\d+\s*[.)、:：\-]\s*/, "")
      .trim();
    itemName = sanitizeOcrLineItemName(itemName);
    const unitPrice = normalizeNumericToken(match[1]);
    if (!itemName || unitPrice === null) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    parsedLines.push({
      lineNumber,
      raw,
      itemName,
      unitPrice,
      market: "single",
    });
  });

  return {
    parsedLines,
    invalidLines,
  };
}

function parseOcrTradeRows(
  tradeRows: WorkshopOcrPriceImportInput["tradeRows"],
): { parsedLines: ParsedOcrPriceLine[]; invalidLines: string[] } {
  if (!Array.isArray(tradeRows) || tradeRows.length === 0) {
    return {
      parsedLines: [],
      invalidLines: [],
    };
  }
  const parsedLines: ParsedOcrPriceLine[] = [];
  const invalidLines: string[] = [];

  tradeRows.forEach((row, index) => {
    const lineNumber = Number.isFinite(row.lineNumber) ? Math.max(1, Math.floor(row.lineNumber)) : index + 1;
    const rawName = typeof row.itemName === "string" ? row.itemName : "";
    const itemName = sanitizeOcrLineItemName(rawName);
    const serverPrice = normalizeNumericToken(String(row.serverPrice ?? ""));
    const worldPrice = normalizeNumericToken(String(row.worldPrice ?? ""));
    if (!itemName) {
      invalidLines.push(`#${lineNumber} ${rawName || "<空名称>"}`);
      return;
    }
    if (serverPrice === null && worldPrice === null) {
      invalidLines.push(`#${lineNumber} ${itemName} <双价格均为空>`);
      return;
    }
    if (serverPrice !== null) {
      parsedLines.push({
        lineNumber,
        raw: `${itemName} server=${serverPrice}`,
        itemName,
        unitPrice: serverPrice,
        market: "server",
      });
    }
    if (worldPrice !== null) {
      parsedLines.push({
        lineNumber,
        raw: `${itemName} world=${worldPrice}`,
        itemName,
        unitPrice: worldPrice,
        market: "world",
      });
    }
  });

  return {
    parsedLines,
    invalidLines,
  };
}

function sanitizeOcrLanguage(raw: unknown): string {
  if (typeof raw !== "string") {
    return WORKSHOP_OCR_DEFAULT_LANGUAGE;
  }
  const value = raw.trim();
  if (!value) {
    return WORKSHOP_OCR_DEFAULT_LANGUAGE;
  }
  if (!/^[a-zA-Z0-9_+]+$/u.test(value)) {
    return WORKSHOP_OCR_DEFAULT_LANGUAGE;
  }
  return value;
}

function sanitizeOcrPsm(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_OCR_DEFAULT_PSM;
  }
  return clamp(Math.floor(raw), 3, 13);
}

function resolveTradeNameLanguage(language: string): string {
  const parts = language
    .split("+")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return language;
  }
  const chinese = parts.filter((entry) => entry.startsWith("chi_"));
  if (chinese.length > 0) {
    return Array.from(new Set(chinese)).join("+");
  }
  return language;
}

function sanitizeRect(raw: unknown): WorkshopRect | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entity = raw as Partial<WorkshopRect>;
  const x = parseIntLike(entity.x);
  const y = parseIntLike(entity.y);
  const width = parseIntLike(entity.width);
  const height = parseIntLike(entity.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }
  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function sanitizeTradeBoardPreset(raw: unknown): WorkshopTradeBoardPreset | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entity = raw as Partial<WorkshopTradeBoardPreset>;
  if (!entity.enabled) {
    return null;
  }
  const namesRect = sanitizeRect(entity.namesRect);
  const pricesRect = sanitizeRect(entity.pricesRect);
  if (!namesRect || !pricesRect) {
    return null;
  }
  const rowCountRaw = parseIntLike(entity.rowCount);
  const rowCount = rowCountRaw === null ? 7 : clamp(rowCountRaw, 1, 30);
  return {
    enabled: true,
    rowCount,
    namesRect,
    pricesRect,
    priceMode: entity.priceMode === "single" ? "single" : "dual",
    priceColumn: entity.priceColumn === "right" ? "right" : "left",
    leftPriceRole: entity.leftPriceRole === "world" ? "world" : "server",
    rightPriceRole: entity.rightPriceRole === "server" ? "server" : "world",
  };
}

function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function runTesseractExtract(imagePath: string, language: string, psm: number): { stdout: string; stderr: string; ok: boolean; error?: Error } {
  const args = [imagePath, "stdout", "-l", language, "--psm", String(psm), "-c", "preserve_interword_spaces=1"];
  const proc = spawnSync("tesseract", args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = typeof proc.stdout === "string" ? proc.stdout : String(proc.stdout ?? "");
  const stderr = typeof proc.stderr === "string" ? proc.stderr : String(proc.stderr ?? "");
  const ok = proc.status === 0 && !proc.error;
  return {
    stdout,
    stderr,
    ok,
    error: proc.error ?? undefined,
  };
}

function runTesseractExtractWithOptions(
  imagePath: string,
  language: string,
  psm: number,
  options: Array<[string, string]>,
): { stdout: string; stderr: string; ok: boolean; error?: Error } {
  const baseArgs = [imagePath, "stdout", "-l", language, "--psm", String(psm)];
  const optionArgs = options.flatMap(([key, value]) => ["-c", `${key}=${value}`]);
  const proc = spawnSync("tesseract", [...baseArgs, ...optionArgs], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = typeof proc.stdout === "string" ? proc.stdout : String(proc.stdout ?? "");
  const stderr = typeof proc.stderr === "string" ? proc.stderr : String(proc.stderr ?? "");
  const ok = proc.status === 0 && !proc.error;
  return {
    stdout,
    stderr,
    ok,
    error: proc.error ?? undefined,
  };
}

function runTesseractTsvWithOptions(
  imagePath: string,
  language: string,
  psm: number,
  options: Array<[string, string]>,
): { stdout: string; stderr: string; ok: boolean; error?: Error } {
  const baseArgs = [imagePath, "stdout", "-l", language, "--psm", String(psm), "tsv"];
  const optionArgs = options.flatMap(([key, value]) => ["-c", `${key}=${value}`]);
  const proc = spawnSync("tesseract", [...baseArgs, ...optionArgs], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = typeof proc.stdout === "string" ? proc.stdout : String(proc.stdout ?? "");
  const stderr = typeof proc.stderr === "string" ? proc.stderr : String(proc.stderr ?? "");
  const ok = proc.status === 0 && !proc.error;
  return {
    stdout,
    stderr,
    ok,
    error: proc.error ?? undefined,
  };
}

interface OcrTsvWord {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

function parseTsvWords(tsvText: string): OcrTsvWord[] {
  const lines = tsvText.replace(/\r/g, "").split("\n");
  if (lines.length <= 1) {
    return [];
  }
  const words: OcrTsvWord[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    const segments = line.split("\t");
    if (segments.length < 12) {
      continue;
    }
    const level = Number(segments[0]);
    if (!Number.isFinite(level) || level !== 5) {
      continue;
    }
    const left = Number(segments[6]);
    const top = Number(segments[7]);
    const width = Number(segments[8]);
    const height = Number(segments[9]);
    const confidence = Number(segments[10]);
    const text = (segments[11] ?? "").trim();
    if (!text) {
      continue;
    }
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) {
      continue;
    }
    words.push({
      text,
      left: Math.floor(left),
      top: Math.floor(top),
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
      confidence: Number.isFinite(confidence) ? confidence : -1,
    });
  }
  return words;
}

function normalizeNumericToken(raw: string): number | null {
  const normalized = raw
    .replace(/[,\.\s]/g, "")
    .replace(/[oO]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[sS]/g, "5")
    .replace(/[bB]/g, "8")
    .replace(/[^0-9]/g, "");
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.floor(num);
}

function cropImageToTempFile(imagePath: string, rect: WorkshopRect, scale = 1): string {
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    throw new Error(`截图无法读取: ${path.basename(imagePath)}`);
  }
  const size = image.getSize();
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > size.width ||
    rect.y + rect.height > size.height
  ) {
    throw new Error(`ROI 越界: (${rect.x},${rect.y},${rect.width},${rect.height})，截图尺寸 ${size.width}x${size.height}`);
  }
  const cropped = image.crop({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
  const resized =
    scale > 1
      ? cropped.resize({
          width: Math.max(1, Math.floor(rect.width * scale)),
          height: Math.max(1, Math.floor(rect.height * scale)),
          quality: "best",
        })
      : cropped;
  const filePath = path.join(os.tmpdir(), `aion2-ocr-roi-${Date.now()}-${randomUUID()}.png`);
  fs.writeFileSync(filePath, resized.toPNG());
  return filePath;
}

function cleanupTempFile(filePath: string | null): void {
  if (!filePath) {
    return;
  }
  if (!fs.existsSync(filePath)) {
    return;
  }
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function parsePriceFromLine(line: string, column: "left" | "right"): number | null {
  const matches = Array.from(line.matchAll(/([0-9oOlI|sSbB][0-9oOlI|sSbB,\.\s]*)/g)).map((entry) => entry[1] ?? "");
  if (matches.length === 0) {
    return null;
  }
  const picked = column === "right" ? matches[matches.length - 1] : matches[0];
  return normalizeNumericToken(picked);
}

function parseNonEmptyLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function groupWordsByRow(words: OcrTsvWord[], rowCount: number, totalHeight: number): OcrTsvWord[][] {
  const buckets: OcrTsvWord[][] = Array.from({ length: rowCount }, () => []);
  const rowHeight = totalHeight / rowCount;
  words.forEach((word) => {
    const centerY = word.top + word.height / 2;
    const rowIndex = clamp(Math.floor(centerY / Math.max(1, rowHeight)), 0, rowCount - 1);
    buckets[rowIndex].push(word);
  });
  return buckets.map((bucket) => bucket.sort((left, right) => left.left - right.left));
}

function buildNameRowsFromWords(words: OcrTsvWord[], rowCount: number, totalHeight: number): Array<string | null> {
  const rows = groupWordsByRow(words, rowCount, totalHeight);
  return rows.map((row) => {
    const text = row.map((word) => word.text).join("").trim();
    return text || null;
  });
}

function buildPriceRowsFromWords(
  words: OcrTsvWord[],
  rowCount: number,
  totalHeight: number,
  column: "left" | "right",
  warnings: string[],
): Array<number | null> {
  const rows = groupWordsByRow(words, rowCount, totalHeight);
  return rows.map((row, index) => {
    const numericWords = row
      .map((word) => ({
        ...word,
        value: normalizeNumericToken(word.text),
      }))
      .filter((entry): entry is OcrTsvWord & { value: number } => entry.value !== null);
    if (numericWords.length === 0) {
      warnings.push(`第 ${index + 1} 行价格解析失败（TSV 无数字词）。`);
      return null;
    }
    numericWords.sort((left, right) => left.left - right.left);
    const picked = column === "right" ? numericWords[numericWords.length - 1] : numericWords[0];
    return picked.value;
  });
}

function detectTradePriceRoleByHeaderText(rawText: string): "server" | "world" | null {
  const normalized = rawText
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .toLocaleLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("世界") || normalized.includes("world")) {
    return "world";
  }
  if (
    normalized.includes("伺服器") ||
    normalized.includes("服务器") ||
    normalized.includes("本服") ||
    normalized.includes("server")
  ) {
    return "server";
  }
  return null;
}

function resolveDualPriceRolesByHeader(
  imagePath: string,
  pricesRect: WorkshopRect,
  language: string,
  psm: number,
  fallbackLeftRole: "server" | "world",
  fallbackRightRole: "server" | "world",
  warnings: string[],
): { leftRole: "server" | "world"; rightRole: "server" | "world" } {
  const headerHeight = clamp(Math.floor(pricesRect.height * 0.16), 40, 180);
  const leftWidth = Math.max(1, Math.floor(pricesRect.width / 2));
  const rightWidth = Math.max(1, pricesRect.width - leftWidth);
  const leftRect: WorkshopRect = {
    x: pricesRect.x,
    y: pricesRect.y,
    width: leftWidth,
    height: headerHeight,
  };
  const rightRect: WorkshopRect = {
    x: pricesRect.x + leftWidth,
    y: pricesRect.y,
    width: rightWidth,
    height: headerHeight,
  };
  const headerLanguage = resolveTradeNameLanguage(language);

  const readHeaderText = (rect: WorkshopRect, label: "左列" | "右列"): string => {
    let tempPath: string | null = null;
    try {
      tempPath = cropImageToTempFile(imagePath, rect, 2);
      const extract = runTesseractExtract(tempPath, headerLanguage, psm);
      if (!extract.ok) {
        const reason = extract.stderr.trim() || extract.error?.message || "未知错误";
        warnings.push(`${label}表头识别失败：${reason}`);
        return "";
      }
      return extract.stdout;
    } catch (err) {
      warnings.push(`${label}表头识别失败：${err instanceof Error ? err.message : "未知异常"}`);
      return "";
    } finally {
      cleanupTempFile(tempPath);
    }
  };

  const leftHeaderText = readHeaderText(leftRect, "左列");
  const rightHeaderText = readHeaderText(rightRect, "右列");
  const leftDetected = detectTradePriceRoleByHeaderText(leftHeaderText);
  const rightDetected = detectTradePriceRoleByHeaderText(rightHeaderText);

  if (leftDetected && rightDetected && leftDetected !== rightDetected) {
    return {
      leftRole: leftDetected,
      rightRole: rightDetected,
    };
  }
  if (leftDetected && !rightDetected) {
    return {
      leftRole: leftDetected,
      rightRole: leftDetected === "server" ? "world" : "server",
    };
  }
  if (!leftDetected && rightDetected) {
    return {
      leftRole: rightDetected === "server" ? "world" : "server",
      rightRole: rightDetected,
    };
  }
  warnings.push("价格表头自动识别失败，已回退到手动列角色预设。");
  return {
    leftRole: fallbackLeftRole,
    rightRole: fallbackRightRole,
  };
}

interface PriceRowsOcrOutcome {
  values: Array<number | null>;
  rawText: string;
  tsvText: string;
}

function extractPriceRowsForRect(
  imagePath: string,
  rect: WorkshopRect,
  psm: number,
  rowCount: number,
  scale: number,
  column: "left" | "right",
  warnings: string[],
  warningPrefix: string,
): PriceRowsOcrOutcome {
  const tempPath = cropImageToTempFile(imagePath, rect, scale);
  try {
    const extract = runTesseractExtractWithOptions(tempPath, "eng", psm, [
      ["tessedit_char_whitelist", "0123456789,."],
      ["preserve_interword_spaces", "1"],
    ]);
    if (!extract.ok) {
      const reason = extract.stderr.trim() || extract.error?.message || "未知错误";
      throw new Error(`${warningPrefix}OCR 失败：${reason}`);
    }
    const tsv = runTesseractTsvWithOptions(tempPath, "eng", psm, [
      ["tessedit_char_whitelist", "0123456789,."],
      ["preserve_interword_spaces", "1"],
    ]);
    const tsvWords = tsv.ok ? parseTsvWords(tsv.stdout) : [];
    const tsvRows = buildPriceRowsFromWords(tsvWords, rowCount, Math.floor(rect.height * scale), column, warnings);
    const fallbackRows = parseNonEmptyLines(extract.stdout)
      .slice(0, rowCount)
      .map((line, index) => {
        const parsed = parsePriceFromLine(line, column);
        if (parsed === null) {
          warnings.push(`${warningPrefix}第 ${index + 1} 行价格解析失败：${line}`);
          return null;
        }
        return parsed;
      });
    const tsvValid = tsvRows.filter((entry): entry is number => entry !== null).length;
    const fallbackValid = fallbackRows.filter((entry): entry is number => entry !== null).length;
    const values = tsvValid >= fallbackValid ? tsvRows : fallbackRows;
    if (tsvValid < fallbackValid) {
      warnings.push(`${warningPrefix}TSV 结果不足，已回退到普通文本行解析。`);
    }
    return {
      values,
      rawText: extract.stdout,
      tsvText: tsv.stdout,
    };
  } finally {
    cleanupTempFile(tempPath);
  }
}

export function extractWorkshopOcrText(payload: WorkshopOcrExtractTextInput): WorkshopOcrExtractTextResult {
  const imageRawPath = payload.imagePath?.trim();
  if (!imageRawPath) {
    throw new Error("OCR 识别失败：请先填写截图路径。");
  }
  const imagePath = resolveCatalogImportFilePath(imageRawPath);
  const language = sanitizeOcrLanguage(payload.language);
  const psm = sanitizeOcrPsm(payload.psm);
  const warnings: string[] = [];
  const tradeBoardPreset = sanitizeTradeBoardPreset(payload.tradeBoardPreset);

  if (tradeBoardPreset) {
    let namesTempPath: string | null = null;
    try {
      const namesLanguage = resolveTradeNameLanguage(language);
      const namesScale = 2;
      const pricesScale = 2;
      namesTempPath = cropImageToTempFile(imagePath, tradeBoardPreset.namesRect, namesScale);
      const namesExtract = runTesseractExtract(namesTempPath, namesLanguage, psm);
      if (!namesExtract.ok) {
        const reason = namesExtract.stderr.trim() || namesExtract.error?.message || "未知错误";
        throw new Error(`名称区 OCR 失败：${reason}`);
      }
      const namesTsv = runTesseractTsvWithOptions(namesTempPath, namesLanguage, psm, [["preserve_interword_spaces", "1"]]);
      const nameWords = namesTsv.ok ? parseTsvWords(namesTsv.stdout) : [];
      const nameRowsFromTsv = buildNameRowsFromWords(
        nameWords,
        tradeBoardPreset.rowCount,
        Math.floor(tradeBoardPreset.namesRect.height * namesScale),
      );
      const nameRowsTsvSanitized = nameRowsFromTsv.map((row) => {
        const cleaned = sanitizeOcrLineItemName(row ?? "");
        return cleaned || null;
      });
      const nameLinesFallback = parseNonEmptyLines(namesExtract.stdout)
        .map((line) => sanitizeOcrLineItemName(line))
        .filter(Boolean)
        .slice(0, tradeBoardPreset.rowCount);
      const nameRowsFallback = Array.from({ length: tradeBoardPreset.rowCount }, (_, index) => nameLinesFallback[index] ?? null);
      const nameRows =
        nameRowsTsvSanitized.filter((entry) => entry !== null).length >= nameLinesFallback.length
          ? nameRowsTsvSanitized
          : nameRowsFallback;

      let leftValues: Array<number | null> = [];
      let rightValues: Array<number | null> = [];
      let rawPriceSection = "";
      let rawPriceTsvSection = "";
      let effectiveLeftRole: "server" | "world" = tradeBoardPreset.leftPriceRole === "world" ? "world" : "server";
      let effectiveRightRole: "server" | "world" = tradeBoardPreset.rightPriceRole === "server" ? "server" : "world";

      if (tradeBoardPreset.priceMode === "dual") {
        const detectedRoles = resolveDualPriceRolesByHeader(
          imagePath,
          tradeBoardPreset.pricesRect,
          namesLanguage,
          psm,
          effectiveLeftRole,
          effectiveRightRole,
          warnings,
        );
        effectiveLeftRole = detectedRoles.leftRole;
        effectiveRightRole = detectedRoles.rightRole;
        const leftWidth = Math.max(1, Math.floor(tradeBoardPreset.pricesRect.width / 2));
        const rightWidth = Math.max(1, tradeBoardPreset.pricesRect.width - leftWidth);
        const leftRect: WorkshopRect = {
          x: tradeBoardPreset.pricesRect.x,
          y: tradeBoardPreset.pricesRect.y,
          width: leftWidth,
          height: tradeBoardPreset.pricesRect.height,
        };
        const rightRect: WorkshopRect = {
          x: tradeBoardPreset.pricesRect.x + leftWidth,
          y: tradeBoardPreset.pricesRect.y,
          width: rightWidth,
          height: tradeBoardPreset.pricesRect.height,
        };
        const leftOutcome = extractPriceRowsForRect(
          imagePath,
          leftRect,
          psm,
          tradeBoardPreset.rowCount,
          pricesScale,
          "left",
          warnings,
          "左列价格：",
        );
        const rightOutcome = extractPriceRowsForRect(
          imagePath,
          rightRect,
          psm,
          tradeBoardPreset.rowCount,
          pricesScale,
          "left",
          warnings,
          "右列价格：",
        );
        leftValues = leftOutcome.values;
        rightValues = rightOutcome.values;
        rawPriceSection = `${leftOutcome.rawText}\n\n---RIGHT_PRICE---\n\n${rightOutcome.rawText}`;
        rawPriceTsvSection = `${leftOutcome.tsvText}\n\n---RIGHT_PRICE_TSV---\n\n${rightOutcome.tsvText}`;
        warnings.push(
          `双价格列角色：左列=${effectiveLeftRole === "server" ? "伺服器" : "世界"}，右列=${
            effectiveRightRole === "server" ? "伺服器" : "世界"
          }。`,
        );
      } else {
        const singleOutcome = extractPriceRowsForRect(
          imagePath,
          tradeBoardPreset.pricesRect,
          psm,
          tradeBoardPreset.rowCount,
          pricesScale,
          tradeBoardPreset.priceColumn,
          warnings,
          "",
        );
        if (tradeBoardPreset.priceColumn === "right") {
          leftValues = Array.from({ length: tradeBoardPreset.rowCount }, () => null);
          rightValues = singleOutcome.values;
        } else {
          leftValues = singleOutcome.values;
          rightValues = Array.from({ length: tradeBoardPreset.rowCount }, () => null);
        }
        rawPriceSection = singleOutcome.rawText;
        rawPriceTsvSection = singleOutcome.tsvText;
      }

      const tradeRows: WorkshopOcrExtractTextResult["tradeRows"] = [];
      for (let index = 0; index < tradeBoardPreset.rowCount; index += 1) {
        const itemName = nameRows[index];
        if (!itemName) {
          continue;
        }
        const leftPrice = leftValues[index] ?? null;
        const rightPrice = rightValues[index] ?? null;
        const serverPrice =
          effectiveLeftRole === "server"
            ? leftPrice
            : effectiveRightRole === "server"
              ? rightPrice
              : null;
        const worldPrice =
          effectiveLeftRole === "world"
            ? leftPrice
            : effectiveRightRole === "world"
              ? rightPrice
              : null;
        if (serverPrice === null && worldPrice === null) {
          continue;
        }
        tradeRows.push({
          lineNumber: index + 1,
          itemName,
          serverPrice,
          worldPrice,
        });
      }

      const textLines = tradeRows
        .map((row) => {
          const primary =
            tradeBoardPreset.priceColumn === "right"
              ? effectiveRightRole === "server"
                ? row.serverPrice ?? row.worldPrice
                : row.worldPrice ?? row.serverPrice
              : effectiveLeftRole === "server"
                ? row.serverPrice ?? row.worldPrice
                : row.worldPrice ?? row.serverPrice;
          if (primary === null) {
            return null;
          }
          return `${row.itemName} ${primary}`;
        })
        .filter((entry): entry is string => entry !== null);
      if (tradeRows.length < tradeBoardPreset.rowCount) {
        warnings.push(`识别行不足：有效行 ${tradeRows.length}/${tradeBoardPreset.rowCount}。`);
      }
      const text = textLines.join("\n");
      return {
        rawText: `${namesExtract.stdout}\n\n---PRICE---\n\n${rawPriceSection}\n\n---NAMES_TSV---\n\n${namesTsv.stdout}\n\n---PRICES_TSV---\n\n${rawPriceTsvSection}`,
        text,
        lineCount: tradeRows.length,
        warnings,
        engine: `tesseract(names=${namesLanguage}, prices=eng, psm=${psm}, trade-board-roi)`,
        tradeRows,
      };
    } finally {
      cleanupTempFile(namesTempPath);
    }
  }

  const primary = runTesseractExtract(imagePath, language, psm);
  if (primary.error && (primary.error as NodeJS.ErrnoException).code === "ENOENT") {
    throw new Error("未检测到 tesseract 命令。请确认已安装 Tesseract 并加入系统 PATH。");
  }

  let usedLanguage = language;
  let final = primary;
  if (!primary.ok && language !== "eng") {
    const fallback = runTesseractExtract(imagePath, "eng", psm);
    if (fallback.ok) {
      warnings.push(`语言包 ${language} 识别失败，已自动回退到 eng。`);
      usedLanguage = "eng";
      final = fallback;
    }
  }

  if (!final.ok) {
    const reason = final.stderr.trim() || final.error?.message || "未知错误";
    throw new Error(`OCR 识别失败：${reason}`);
  }

  const rawText = final.stdout;
  const text = normalizeOcrText(rawText);
  const lineCount = text ? text.split(/\n/u).length : 0;
  if (lineCount === 0) {
    warnings.push("OCR 返回为空，请检查截图裁切范围、清晰度或语言包。");
  }

  return {
    rawText,
    text,
    lineCount,
    warnings,
    engine: `tesseract(${usedLanguage}, psm=${psm})`,
  };
}

export function getWorkshopState(): WorkshopState {
  return readWorkshopState();
}

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

export function addWorkshopPriceSnapshot(payload: AddWorkshopPriceSnapshotInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  const unitPrice = toNonNegativeInt(payload.unitPrice, -1);
  if (unitPrice < 0) {
    throw new Error("价格必须是大于等于 0 的整数。");
  }

  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const source = payload.source === "import" ? "import" : "manual";
  const market = sanitizePriceMarket(payload.market);
  const nextSnapshot: WorkshopPriceSnapshot = {
    id: randomUUID(),
    itemId: payload.itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note: payload.note?.trim() || undefined,
  };

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: [...state.prices, nextSnapshot].slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
  });
}

export function deleteWorkshopPriceSnapshot(snapshotId: string): WorkshopState {
  const state = readWorkshopState();
  if (!state.prices.some((entry) => entry.id === snapshotId)) {
    return state;
  }
  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: state.prices.filter((entry) => entry.id !== snapshotId),
  });
}

export function importWorkshopOcrPrices(payload: WorkshopOcrPriceImportInput): WorkshopOcrPriceImportResult {
  const state = readWorkshopState();
  const sanitized = sanitizeOcrImportPayload(payload);
  const hasStructuredTradeRows = Array.isArray(sanitized.tradeRows) && sanitized.tradeRows.length > 0;
  if (!sanitized.text.trim() && !hasStructuredTradeRows) {
    throw new Error("OCR 导入内容为空，请先粘贴文本。");
  }

  const tradeRowsParsed = parseOcrTradeRows(sanitized.tradeRows);
  const parsedFromTradeRows = tradeRowsParsed.parsedLines.length > 0;
  const { parsedLines, invalidLines } = parsedFromTradeRows ? tradeRowsParsed : parseOcrPriceLines(sanitized.text);
  const items = [...state.items];
  const prices = [...state.prices];
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const itemByLookupName = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookupName.set(normalizeLookupName(item.name), item);
  });
  const iconCaptureOutcome = sanitized.iconCapture
    ? captureOcrLineIcons(parsedLines, sanitized.iconCapture)
    : {
        iconByLineNumber: new Map<number, string>(),
        iconCapturedCount: 0,
        iconSkippedCount: 0,
        warnings: [] as string[],
      };
  const iconCaptureWarnings = [...sanitized.iconCaptureWarnings, ...iconCaptureOutcome.warnings];

  const unknownItemNameSet = new Set<string>();
  const importedEntries: WorkshopOcrPriceImportResult["importedEntries"] = [];
  let importedCount = 0;
  let createdItemCount = 0;

  parsedLines.forEach((line) => {
    const key = normalizeLookupName(line.itemName);
    const capturedIcon = iconCaptureOutcome.iconByLineNumber.get(line.lineNumber);
    const exactMatchedItem = itemByLookupName.get(key);
    let item = exactMatchedItem;
    let matchedByExactName = Boolean(exactMatchedItem);
    if (!item && !sanitized.strictIconMatch) {
      item = resolveItemByOcrName(itemByLookupName, line.itemName);
      if (item) {
        itemByLookupName.set(key, item);
      }
    }
    const iconMatchedItem = resolveUniqueItemByIcon(items, capturedIcon);

    if (sanitized.strictIconMatch) {
      if (!capturedIcon) {
        unknownItemNameSet.add(`${line.itemName}（严格模式需开启图标抓取）`);
        return;
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${line.itemName}（名称与图标冲突）`);
        return;
      }
      if (item && item.icon && item.icon !== capturedIcon) {
        unknownItemNameSet.add(`${line.itemName}（图标不匹配）`);
        return;
      }
      if (item && !item.icon) {
        unknownItemNameSet.add(`${line.itemName}（严格模式缺少图标基线）`);
        return;
      }
      if (item && !isExactOcrNameMatch(item, line.itemName) && !iconMatchedItem) {
        unknownItemNameSet.add(`${line.itemName}（严格模式下名称不精确）`);
        return;
      }
    } else {
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${line.itemName}（名称与图标冲突）`);
        return;
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      if (item && !iconMatchedItem && isAmbiguousExactOcrNameMatch(item, line.itemName, items)) {
        unknownItemNameSet.add(`${line.itemName}（名称歧义，已跳过）`);
        return;
      }
    }

    let createdItem = false;
    if (!item) {
      if (!sanitized.autoCreateMissingItems) {
        unknownItemNameSet.add(line.itemName);
        return;
      }
      const nowIso = new Date().toISOString();
      item = {
        id: randomUUID(),
        name: line.itemName,
        category: sanitized.defaultCategory,
        icon: resolveItemIconWithCache(iconCache, line.itemName, sanitized.defaultCategory, capturedIcon),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      items.push(item);
      itemByLookupName.set(key, item);
      createdItemCount += 1;
      createdItem = true;
    } else if (capturedIcon && item) {
      const currentItem = item;
      if (sanitized.strictIconMatch && currentItem.icon && currentItem.icon !== capturedIcon) {
        unknownItemNameSet.add(`${line.itemName}（图标不匹配）`);
        return;
      }
      const canRefreshIcon =
        !sanitized.strictIconMatch && (matchedByExactName || (iconMatchedItem !== undefined && iconMatchedItem.id === currentItem.id));
      if (canRefreshIcon) {
        const resolvedIcon = resolveItemIconWithCache(iconCache, currentItem.name, currentItem.category, capturedIcon);
        if (resolvedIcon !== currentItem.icon) {
          const nextItem: WorkshopItem = {
            ...currentItem,
            icon: resolvedIcon,
            updatedAt: new Date().toISOString(),
          };
          const index = items.findIndex((entry) => entry.id === currentItem.id);
          if (index >= 0) {
            items[index] = nextItem;
          }
          itemByLookupName.set(key, nextItem);
          item = nextItem;
        }
      }
    }

    prices.push({
      id: randomUUID(),
      itemId: item.id,
      unitPrice: line.unitPrice,
      capturedAt: sanitized.capturedAt,
      source: sanitized.source,
      market: line.market,
      note: `ocr-import#${line.market}#line-${line.lineNumber}`,
    });
    importedEntries.push({
      lineNumber: line.lineNumber,
      itemId: item.id,
      itemName: item.name,
      unitPrice: line.unitPrice,
      market: line.market,
      capturedAt: sanitized.capturedAt,
      source: sanitized.source,
      createdItem,
    });
    importedCount += 1;
  });

  const nextState = writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items,
    prices: prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
  });

  return {
    state: nextState,
    importedCount,
    createdItemCount,
    parsedLineCount: parsedLines.length,
    unknownItemNames: Array.from(unknownItemNameSet).sort((left, right) => left.localeCompare(right, "zh-CN")),
    invalidLines,
    iconCapturedCount: iconCaptureOutcome.iconCapturedCount,
    iconSkippedCount: iconCaptureOutcome.iconSkippedCount,
    iconCaptureWarnings,
    importedEntries,
  };
}

function resolveCatalogImportFilePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("导入文件路径不能为空。");
  }
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }
  const candidates = [
    path.resolve(process.cwd(), trimmed),
    path.resolve(process.cwd(), path.basename(trimmed)),
  ];
  const hit = candidates.find((entry) => fs.existsSync(entry));
  if (!hit) {
    throw new Error(`未找到导入文件: ${trimmed}`);
  }
  return hit;
}

function resolveBuiltinCatalogFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), BUILTIN_CATALOG_FILE_NAME),
    path.resolve(process.cwd(), "..", BUILTIN_CATALOG_FILE_NAME),
    path.resolve(process.cwd(), "..", "..", BUILTIN_CATALOG_FILE_NAME),
  ];
  const hit = candidates.find((entry) => fs.existsSync(entry));
  if (!hit) {
    throw new Error(`未找到内置目录文件: ${BUILTIN_CATALOG_FILE_NAME}`);
  }
  return hit;
}

function resolveBuiltinCatalogSignature(): string {
  const filePath = resolveBuiltinCatalogFilePath();
  const text = fs.readFileSync(filePath, "utf8");
  return createHash("sha1").update(text).digest("hex");
}

function applyCatalogData(
  baseState: WorkshopState,
  parsed: { items: CatalogItemRow[]; recipes: CatalogRecipeRow[]; warnings: string[] },
  sourceTag: string,
): WorkshopCatalogImportResult {
  const nowIso = new Date().toISOString();
  const items = [...baseState.items];
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
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
      icon: resolveItemIconWithCache(iconCache, normalized, fallbackCategory),
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
      const resolvedIcon = resolveItemIconWithCache(iconCache, existing.name, mappedCategory, existing.icon);
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
      cacheIconByName(iconCache, row.name, resolvedIcon);
      if (row.alias) {
        cacheIconByName(iconCache, row.alias, resolvedIcon);
      }
      importedItemCount += 1;
      return;
    }
    const createdIcon = resolveItemIconWithCache(iconCache, row.name, mappedCategory);
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
      cacheIconByName(iconCache, row.alias, createdIcon);
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
    const dedupInputs = Array.from(dedupInputMap.entries())
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

  const nextState = normalizeWorkshopState({
    ...baseState,
    version: WORKSHOP_STATE_VERSION,
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

function buildBuiltinCatalogState(): WorkshopState {
  const filePath = resolveBuiltinCatalogFilePath();
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = parseCatalogCsvText(text);
  const baseState: WorkshopState = {
    version: WORKSHOP_STATE_VERSION,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
    signalRule: DEFAULT_WORKSHOP_SIGNAL_RULE,
  };
  const result = applyCatalogData(baseState, parsed, path.basename(filePath));
  if (result.state.items.length === 0 || result.state.recipes.length === 0) {
    throw new Error(`内置目录解析失败: ${filePath}`);
  }
  return result.state;
}

export function importWorkshopCatalogFromFile(payload: WorkshopCatalogImportFromFileInput): WorkshopCatalogImportResult {
  const state = readWorkshopState();
  const fullPath = resolveCatalogImportFilePath(payload.filePath);
  const text = fs.readFileSync(fullPath, "utf8");
  const parsed = parseCatalogCsvText(text);
  const result = applyCatalogData(state, parsed, path.basename(fullPath));
  return {
    ...result,
    state: writeWorkshopState(result.state),
  };
}

export function upsertWorkshopInventory(payload: UpsertWorkshopInventoryInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);

  const quantity = toNonNegativeInt(payload.quantity, -1);
  if (quantity < 0) {
    throw new Error("库存必须是大于等于 0 的整数。");
  }

  const nextInventory =
    quantity === 0
      ? state.inventory.filter((row) => row.itemId !== payload.itemId)
      : [
          ...state.inventory.filter((row) => row.itemId !== payload.itemId),
          {
            itemId: payload.itemId,
            quantity,
            updatedAt: new Date().toISOString(),
          },
        ].sort((left, right) => left.itemId.localeCompare(right.itemId));

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    inventory: nextInventory,
  });
}

export function simulateWorkshopCraft(payload: WorkshopCraftSimulationInput): WorkshopCraftSimulationResult {
  const state = readWorkshopState();
  const recipe = state.recipes.find((entry) => entry.id === payload.recipeId);
  if (!recipe) {
    throw new Error("未找到目标配方。");
  }
  const runs = toPositiveInt(payload.runs, 0);
  if (runs <= 0) {
    throw new Error("制作次数必须是正整数。");
  }
  const taxRate = sanitizeTaxRate(payload.taxRate);
  const materialMode = payload.materialMode === "expanded" ? "expanded" : "direct";
  return buildSimulation(state, recipe, runs, taxRate, materialMode);
}

export function getWorkshopCraftOptions(payload?: { taxRate?: number }): WorkshopCraftOption[] {
  const state = readWorkshopState();
  const taxRate = sanitizeTaxRate(payload?.taxRate);
  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry.quantity]));

  const options = state.recipes.map((recipe) => {
    const simulation = buildSimulation(state, recipe, 1, taxRate, "expanded");
    const craftableCountFromInventory =
      simulation.materialRows.length === 0
        ? 0
        : simulation.materialRows.reduce((acc, row) => {
            if (row.required <= 0) {
              return acc;
            }
            const owned = inventoryByItemId.get(row.itemId) ?? 0;
            return Math.min(acc, Math.floor(owned / row.required));
          }, Number.MAX_SAFE_INTEGER);

    const craftableCount = Number.isFinite(craftableCountFromInventory) ? Math.max(0, craftableCountFromInventory) : 0;
    return {
      recipeId: recipe.id,
      outputItemId: recipe.outputItemId,
      outputItemName: simulation.outputItemName,
      craftableCount,
      requiredMaterialCostPerRun: simulation.requiredMaterialCost,
      estimatedProfitPerRun: simulation.estimatedProfit,
      unknownPriceItemIds: simulation.unknownPriceItemIds,
      missingRowsForOneRun: simulation.materialRows.filter((row) => row.missing > 0),
    };
  });

  return options.sort((left, right) => {
    if (right.craftableCount !== left.craftableCount) {
      return right.craftableCount - left.craftableCount;
    }
    const rightProfit = right.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
    const leftProfit = left.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
    if (rightProfit !== leftProfit) {
      return rightProfit - leftProfit;
    }
    return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
  });
}

export function getWorkshopPriceHistory(payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  return buildWorkshopPriceHistoryResult(state, payload);
}

export function updateWorkshopSignalRule(payload: Partial<WorkshopPriceSignalRule>): WorkshopState {
  const state = readWorkshopState();
  const nextRule: WorkshopPriceSignalRule = {
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : state.signalRule.enabled,
    lookbackDays:
      payload.lookbackDays === undefined ? state.signalRule.lookbackDays : sanitizeLookbackDays(payload.lookbackDays),
    dropBelowWeekdayAverageRatio:
      payload.dropBelowWeekdayAverageRatio === undefined
        ? state.signalRule.dropBelowWeekdayAverageRatio
        : sanitizeSignalThresholdRatio(payload.dropBelowWeekdayAverageRatio),
  };

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    signalRule: nextRule,
  });
}

export function getWorkshopPriceSignals(payload?: WorkshopPriceSignalQuery): WorkshopPriceSignalResult {
  const state = readWorkshopState();
  const lookbackDays = payload?.lookbackDays === undefined ? state.signalRule.lookbackDays : sanitizeLookbackDays(payload.lookbackDays);
  const thresholdRatio =
    payload?.thresholdRatio === undefined
      ? state.signalRule.dropBelowWeekdayAverageRatio
      : sanitizeSignalThresholdRatio(payload.thresholdRatio);
  const rows: WorkshopPriceSignalRow[] = state.items.map((item) => {
    const history = buildWorkshopPriceHistoryResult(state, {
      itemId: item.id,
      days: lookbackDays,
    });
    const latestPoint = history.points[history.points.length - 1] ?? null;
    const latestWeekday = latestPoint?.weekday ?? null;
    const weekdayAveragePrice =
      latestWeekday === null ? null : history.weekdayAverages.find((entry) => entry.weekday === latestWeekday)?.averagePrice ?? null;
    const deviationRatioFromWeekdayAverage =
      history.latestPrice === null || weekdayAveragePrice === null || weekdayAveragePrice <= 0
        ? null
        : (history.latestPrice - weekdayAveragePrice) / weekdayAveragePrice;
    const deviationRatioFromMa7 =
      history.latestPrice === null || history.ma7Latest === null || history.ma7Latest <= 0
        ? null
        : (history.latestPrice - history.ma7Latest) / history.ma7Latest;
    const trendTag = resolvePriceTrendTag(
      history.sampleCount,
      deviationRatioFromWeekdayAverage,
      deviationRatioFromMa7,
      thresholdRatio,
    );
    const triggered = state.signalRule.enabled && trendTag === "buy-zone";

    return {
      itemId: item.id,
      itemName: item.name,
      latestPrice: history.latestPrice,
      latestCapturedAt: history.latestCapturedAt,
      latestWeekday,
      weekdayAveragePrice,
      deviationRatioFromWeekdayAverage,
      ma7Price: history.ma7Latest,
      deviationRatioFromMa7,
      trendTag,
      sampleCount: history.sampleCount,
      triggered,
    };
  });

  rows.sort((left, right) => {
    if (left.triggered !== right.triggered) {
      return left.triggered ? -1 : 1;
    }
    const leftTrendRank = left.trendTag === "buy-zone" ? 0 : left.trendTag === "sell-zone" ? 1 : 2;
    const rightTrendRank = right.trendTag === "buy-zone" ? 0 : right.trendTag === "sell-zone" ? 1 : 2;
    if (leftTrendRank !== rightTrendRank) {
      return leftTrendRank - rightTrendRank;
    }
    const leftDeviation = left.deviationRatioFromWeekdayAverage;
    const rightDeviation = right.deviationRatioFromWeekdayAverage;
    if (leftDeviation !== null && rightDeviation !== null && leftDeviation !== rightDeviation) {
      if (left.trendTag === "sell-zone" && right.trendTag === "sell-zone") {
        return rightDeviation - leftDeviation;
      }
      return leftDeviation - rightDeviation;
    }
    if (leftDeviation === null && rightDeviation !== null) {
      return 1;
    }
    if (leftDeviation !== null && rightDeviation === null) {
      return -1;
    }
    if (right.sampleCount !== left.sampleCount) {
      return right.sampleCount - left.sampleCount;
    }
    return left.itemName.localeCompare(right.itemName, "zh-CN");
  });

  return {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    thresholdRatio,
    ruleEnabled: state.signalRule.enabled,
    triggeredCount: rows.filter((row) => row.triggered).length,
    buyZoneCount: rows.filter((row) => row.trendTag === "buy-zone").length,
    sellZoneCount: rows.filter((row) => row.trendTag === "sell-zone").length,
    rows,
  };
}

export function seedWorkshopSampleData(): WorkshopState {
  const state = readWorkshopState();
  const nowIso = new Date().toISOString();

  const byName = new Map(state.items.map((item) => [item.name, item] as const));
  const items = [...state.items];

  const ensureSampleItem = (seed: WorkshopSampleItemSeed): WorkshopItem => {
    const existing = byName.get(seed.name);
    if (existing) {
      const nextExisting: WorkshopItem = {
        ...existing,
        category: seed.category,
        notes: seed.notes ?? existing.notes,
        updatedAt: nowIso,
      };
      const index = items.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        items[index] = nextExisting;
      }
      byName.set(seed.name, nextExisting);
      return nextExisting;
    }

    const nextItem: WorkshopItem = {
      id: randomUUID(),
      name: seed.name,
      category: seed.category,
      notes: seed.notes,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    items.push(nextItem);
    byName.set(seed.name, nextItem);
    return nextItem;
  };

  WORKSHOP_SAMPLE_ITEMS.forEach((seed) => {
    ensureSampleItem(seed);
  });

  const sampleItemIdByName = new Map<string, string>();
  WORKSHOP_SAMPLE_ITEMS.forEach((seed) => {
    const item = byName.get(seed.name);
    if (!item) {
      throw new Error(`样例物品创建失败: ${seed.name}`);
    }
    sampleItemIdByName.set(seed.name, item.id);
  });

  const recipeByOutputItemId = new Map(state.recipes.map((recipe) => [recipe.outputItemId, recipe] as const));
  const nextRecipes = [...state.recipes];
  WORKSHOP_SAMPLE_RECIPES.forEach((seed) => {
    const outputItemId = sampleItemIdByName.get(seed.outputName);
    if (!outputItemId) {
      return;
    }
    const inputs = seed.inputs
      .map((inputSeed) => {
        const inputItemId = sampleItemIdByName.get(inputSeed.inputName);
        if (!inputItemId) {
          return null;
        }
        return {
          itemId: inputItemId,
          quantity: inputSeed.quantity,
        };
      })
      .filter((entry): entry is WorkshopRecipeInput => entry !== null);
    if (inputs.length === 0) {
      return;
    }

    const existing = recipeByOutputItemId.get(outputItemId);
    if (existing) {
      const index = nextRecipes.findIndex((recipe) => recipe.id === existing.id);
      const nextRecipe: WorkshopRecipe = {
        ...existing,
        outputQuantity: seed.outputQuantity,
        inputs: normalizeRecipeInputs(inputs),
        updatedAt: nowIso,
      };
      if (index >= 0) {
        nextRecipes[index] = nextRecipe;
      }
      recipeByOutputItemId.set(outputItemId, nextRecipe);
      return;
    }

    const created: WorkshopRecipe = {
      id: randomUUID(),
      outputItemId,
      outputQuantity: seed.outputQuantity,
      inputs: normalizeRecipeInputs(inputs),
      updatedAt: nowIso,
    };
    nextRecipes.push(created);
    recipeByOutputItemId.set(outputItemId, created);
  });

  const nextPrices = [...state.prices];
  const latestPriceMap = getLatestPriceMap({
    ...state,
    items,
    recipes: nextRecipes,
    prices: nextPrices,
    inventory: state.inventory,
  });
  WORKSHOP_SAMPLE_PRICES.forEach((seed) => {
    const itemId = sampleItemIdByName.get(seed.itemName);
    if (!itemId) {
      return;
    }
    const latest = latestPriceMap.get(itemId);
    if (latest && latest.unitPrice === seed.unitPrice) {
      return;
    }
    const snapshot: WorkshopPriceSnapshot = {
      id: randomUUID(),
      itemId,
      unitPrice: seed.unitPrice,
      capturedAt: nowIso,
      source: "manual",
      note: "phase1.1-sample-seed",
    };
    nextPrices.push(snapshot);
    latestPriceMap.set(itemId, snapshot);
  });

  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry] as const));
  WORKSHOP_SAMPLE_INVENTORY.forEach((seed) => {
    const itemId = sampleItemIdByName.get(seed.itemName);
    if (!itemId) {
      return;
    }
    inventoryByItemId.set(itemId, {
      itemId,
      quantity: Math.max(0, Math.floor(seed.quantity)),
      updatedAt: nowIso,
    });
  });

  return writeWorkshopState({
    version: WORKSHOP_STATE_VERSION,
    items,
    recipes: nextRecipes,
    prices: nextPrices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
    inventory: Array.from(inventoryByItemId.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule: state.signalRule,
  });
}
