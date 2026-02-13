import { randomUUID } from "node:crypto";
import Store from "electron-store";
import type {
  AddWorkshopPriceSnapshotInput,
  UpsertWorkshopInventoryInput,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopInventoryItem,
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopRecipeInput,
  WorkshopState,
} from "../shared/types";

const WORKSHOP_STATE_VERSION = 1;
const WORKSHOP_PRICE_HISTORY_LIMIT = 8_000;

const workshopStore = new Store<Record<string, unknown>>({
  name: "aion2-dashboard-workshop",
  clearInvalidConfig: true,
  defaults: {
    version: WORKSHOP_STATE_VERSION,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
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
  const itemsRaw = Array.isArray(entity?.items) ? entity?.items : [];
  const itemMap = new Map<string, WorkshopItem>();
  itemsRaw.forEach((entry, index) => {
    const item = normalizeItem(entry, index);
    itemMap.set(item.id, item);
  });

  const items = Array.from(itemMap.values()).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
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
  const recipes = Array.from(recipeMap.values()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

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
  };
}

function writeWorkshopState(next: WorkshopState): WorkshopState {
  workshopStore.set("version", next.version);
  workshopStore.set("items", next.items);
  workshopStore.set("recipes", next.recipes);
  workshopStore.set("prices", next.prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT));
  workshopStore.set("inventory", next.inventory);
  return normalizeWorkshopState(workshopStore.store);
}

function readWorkshopState(): WorkshopState {
  return normalizeWorkshopState(workshopStore.store);
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
  recipe.inputs.forEach((input) => {
    expandNeededItem(input.itemId, input.quantity * runs);
  });

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
        icon: payload.icon?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        updatedAt: nowIso,
      }
    : {
        id: randomUUID(),
        name,
        category,
        icon: payload.icon?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

  const nextItems = [...state.items.filter((item) => item.id !== nextItem.id), nextItem].sort((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  );

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

  const nextRecipes = [...state.recipes.filter((recipe) => recipe.id !== nextRecipe.id), nextRecipe].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

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
  return buildSimulation(state, recipe, runs, taxRate);
}

export function getWorkshopCraftOptions(payload?: { taxRate?: number }): WorkshopCraftOption[] {
  const state = readWorkshopState();
  const taxRate = sanitizeTaxRate(payload?.taxRate);
  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry.quantity]));

  const options = state.recipes.map((recipe) => {
    const simulation = buildSimulation(state, recipe, 1, taxRate);
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
  });
}
