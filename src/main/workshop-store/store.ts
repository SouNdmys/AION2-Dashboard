import { randomUUID } from "node:crypto";
import type {
  UpsertWorkshopInventoryInput,
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopRecipeInput,
  WorkshopState,
} from "../../shared/types";
import {
  WORKSHOP_PRICE_HISTORY_LIMIT,
  WORKSHOP_STATE_VERSION,
  ensureItemExists,
  normalizeRecipeInputs,
  readWorkshopState,
  toNonNegativeInt,
  writeWorkshopState,
} from "../workshop-store-core";
import { buildLatestWorkshopPriceSnapshotMap } from "./price-latest-map";

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
  const latestPriceMap = buildLatestWorkshopPriceSnapshotMap(nextPrices);
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
