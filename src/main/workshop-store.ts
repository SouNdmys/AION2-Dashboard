import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Store from "electron-store";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopCatalogImportFromFileInput,
  WorkshopCatalogImportResult,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
  UpsertWorkshopInventoryInput,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopInventoryItem,
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopPriceHistoryPoint,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
  WorkshopPriceSignalRule,
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

function sanitizeName(raw: unknown, fallback = ""): string {
  if (typeof raw !== "string") {
    return fallback;
  }
  return raw.trim();
}

function normalizeLookupName(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/\s+/g, "");
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
  const icon = sanitizeName((raw as { icon?: unknown })?.icon) || undefined;
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
  const capturedAt = asIso((raw as { capturedAt?: unknown }).capturedAt, new Date().toISOString());
  const note = sanitizeName((raw as { note?: unknown }).note) || undefined;

  return {
    id,
    itemId,
    unitPrice,
    capturedAt,
    source,
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
  const itemsRaw = Array.isArray(entity?.items) ? entity?.items : [];
  const itemMap = new Map<string, WorkshopItem>();
  itemsRaw.forEach((entry, index) => {
    const item = normalizeItem(entry, index);
    itemMap.set(item.id, item);
  });

  const items = Array.from(itemMap.values());
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
  workshopStore.set("version", next.version);
  workshopStore.set("items", next.items);
  workshopStore.set("recipes", next.recipes);
  workshopStore.set("prices", next.prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT));
  workshopStore.set("inventory", next.inventory);
  workshopStore.set("signalRule", normalizeSignalRule(next.signalRule));
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
  const map = new Map<string, WorkshopPriceSnapshot>();
  state.prices.forEach((snapshot) => {
    const previous = map.get(snapshot.itemId);
    if (!previous) {
      map.set(snapshot.itemId, snapshot);
      return;
    }
    const prevTs = new Date(previous.capturedAt).getTime();
    const nextTs = new Date(snapshot.capturedAt).getTime();
    if (nextTs >= prevTs) {
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
}

function sanitizeOcrImportPayload(payload: WorkshopOcrPriceImportInput): {
  source: "manual" | "import";
  capturedAt: string;
  autoCreateMissingItems: boolean;
  defaultCategory: WorkshopItemCategory;
  text: string;
} {
  const source = payload.source === "manual" ? "manual" : "import";
  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const autoCreateMissingItems = payload.autoCreateMissingItems ?? false;
  const defaultCategory = sanitizeCategory(payload.defaultCategory);
  return {
    source,
    capturedAt,
    autoCreateMissingItems,
    defaultCategory,
    text: typeof payload.text === "string" ? payload.text : "",
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
    const match = normalizedLine.match(/(-?\d[\d,\.\s]*)$/);
    if (!match || match.index === undefined) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    let itemName = normalizedLine.slice(0, match.index).trim();
    itemName = itemName
      .replace(/[:=\-–—|]\s*$/g, "")
      .replace(/^\d+\s*[.)、:：\-]\s*/, "")
      .trim();
    const normalizedPriceText = match[1].replace(/[,\.\s]/g, "").replace(/[oO]/g, "0").replace(/[lI]/g, "1");
    const unitPrice = Number(normalizedPriceText);
    if (!itemName || !Number.isFinite(unitPrice) || unitPrice < 0) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    parsedLines.push({
      lineNumber,
      raw,
      itemName,
      unitPrice: Math.floor(unitPrice),
    });
  });

  return {
    parsedLines,
    invalidLines,
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
  const nextItem: WorkshopItem = existing
    ? {
        ...existing,
        name,
        category,
        icon: payload.icon?.trim() || existing.icon || inferItemIcon(name, category),
        notes: payload.notes?.trim() || undefined,
        updatedAt: nowIso,
      }
    : {
        id: randomUUID(),
        name,
        category,
        icon: payload.icon?.trim() || inferItemIcon(name, category),
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
  const nextSnapshot: WorkshopPriceSnapshot = {
    id: randomUUID(),
    itemId: payload.itemId,
    unitPrice,
    capturedAt,
    source,
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
  if (!sanitized.text.trim()) {
    throw new Error("OCR 导入内容为空，请先粘贴文本。");
  }

  const { parsedLines, invalidLines } = parseOcrPriceLines(sanitized.text);
  const items = [...state.items];
  const prices = [...state.prices];
  const itemByLookupName = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookupName.set(normalizeLookupName(item.name), item);
  });

  const unknownItemNameSet = new Set<string>();
  let importedCount = 0;
  let createdItemCount = 0;

  parsedLines.forEach((line) => {
    const key = normalizeLookupName(line.itemName);
    let item = itemByLookupName.get(key);
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
        icon: inferItemIcon(line.itemName, sanitized.defaultCategory),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      items.push(item);
      itemByLookupName.set(key, item);
      createdItemCount += 1;
    }

    prices.push({
      id: randomUUID(),
      itemId: item.id,
      unitPrice: line.unitPrice,
      capturedAt: sanitized.capturedAt,
      source: sanitized.source,
      note: `ocr-import#line-${line.lineNumber}`,
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
      icon: inferItemIcon(normalized, fallbackCategory),
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
      const nextExisting: WorkshopItem = {
        ...existing,
        category: mappedCategory,
        icon: existing.icon ?? inferItemIcon(existing.name, mappedCategory),
        notes: shouldRefreshNote ? note : existing.notes,
        updatedAt: nowIso,
      };
      const index = items.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        items[index] = nextExisting;
      }
      itemByLookup.set(key, nextExisting);
      importedItemCount += 1;
      return;
    }
    const created: WorkshopItem = {
      id: randomUUID(),
      name: row.name,
      category: mappedCategory,
      icon: inferItemIcon(row.name, mappedCategory),
      notes: note,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    items.push(created);
    itemByLookup.set(key, created);
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
    const triggered =
      state.signalRule.enabled &&
      deviationRatioFromWeekdayAverage !== null &&
      deviationRatioFromWeekdayAverage <= -thresholdRatio;

    return {
      itemId: item.id,
      itemName: item.name,
      latestPrice: history.latestPrice,
      latestCapturedAt: history.latestCapturedAt,
      latestWeekday,
      weekdayAveragePrice,
      deviationRatioFromWeekdayAverage,
      sampleCount: history.sampleCount,
      triggered,
    };
  });

  rows.sort((left, right) => {
    if (left.triggered !== right.triggered) {
      return left.triggered ? -1 : 1;
    }
    const leftDeviation = left.deviationRatioFromWeekdayAverage;
    const rightDeviation = right.deviationRatioFromWeekdayAverage;
    if (leftDeviation !== null && rightDeviation !== null && leftDeviation !== rightDeviation) {
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
