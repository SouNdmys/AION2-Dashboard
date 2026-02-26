import type {
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopPriceMarket,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopState,
} from "../../shared/types";
import { clamp, readWorkshopState } from "../workshop-store-core";
import { buildLatestWorkshopPriceSnapshotMap } from "./price-latest-map";
import { buildWorkshopCraftSimulationFromState } from "./simulation-craft-entry";
import { buildWorkshopCraftOptionsFromState } from "./simulation-craft-options";

function toPositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.floor(raw));
}

interface LatestPriceByMarket {
  server: WorkshopPriceSnapshot | null;
  world: WorkshopPriceSnapshot | null;
  single: WorkshopPriceSnapshot | null;
}

function normalizePriceMarketForCompare(market: WorkshopPriceMarket | undefined): WorkshopPriceMarket {
  return market === "server" || market === "world" ? market : "single";
}

function getLatestPriceByItemAndMarketMap(state: WorkshopState): Map<string, LatestPriceByMarket> {
  const map = new Map<string, LatestPriceByMarket>();
  state.prices.forEach((snapshot) => {
    const market = normalizePriceMarketForCompare(snapshot.market);
    const current = map.get(snapshot.itemId) ?? { server: null, world: null, single: null };
    const previous = current[market];
    if (!previous) {
      current[market] = snapshot;
      map.set(snapshot.itemId, current);
      return;
    }
    const prevTs = new Date(previous.capturedAt).getTime();
    const nextTs = new Date(snapshot.capturedAt).getTime();
    if (nextTs > prevTs || (nextTs === prevTs && snapshot.id.localeCompare(previous.id) > 0)) {
      current[market] = snapshot;
      map.set(snapshot.itemId, current);
    }
  });
  return map;
}

function resolveCheapestMaterialPrice(
  row: LatestPriceByMarket | undefined,
): { unitPrice: number | null; market: WorkshopPriceMarket | undefined } {
  if (!row) {
    return { unitPrice: null, market: undefined };
  }
  const serverPrice = row.server?.unitPrice ?? null;
  const worldPrice = row.world?.unitPrice ?? null;
  if (serverPrice !== null && worldPrice !== null) {
    if (serverPrice <= worldPrice) {
      return { unitPrice: serverPrice, market: "server" };
    }
    return { unitPrice: worldPrice, market: "world" };
  }
  if (serverPrice !== null) {
    return { unitPrice: serverPrice, market: "server" };
  }
  if (worldPrice !== null) {
    return { unitPrice: worldPrice, market: "world" };
  }
  if (row.single?.unitPrice !== undefined) {
    return { unitPrice: row.single.unitPrice, market: "single" };
  }
  return { unitPrice: null, market: undefined };
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
  const latestPriceByItemId = buildLatestWorkshopPriceSnapshotMap(state.prices);
  const latestPriceByItemAndMarket = getLatestPriceByItemAndMarketMap(state);
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
      const priceChoice = resolveCheapestMaterialPrice(latestPriceByItemAndMarket.get(itemId));
      const latestUnitPrice = priceChoice.unitPrice;
      const requiredCost = latestUnitPrice === null ? null : latestUnitPrice * requiredQty;
      const missingCost = latestUnitPrice === null ? null : latestUnitPrice * missing;
      return {
        itemId,
        itemName: itemById.get(itemId)?.name ?? itemId,
        required: requiredQty,
        owned,
        missing,
        latestUnitPrice,
        latestPriceMarket: priceChoice.market,
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

export function simulateWorkshopCraft(payload: WorkshopCraftSimulationInput): WorkshopCraftSimulationResult {
  const state = readWorkshopState();
  return buildWorkshopCraftSimulationFromState(state, payload, {
    toPositiveInt,
    sanitizeTaxRate,
    buildSimulation,
  });
}

export function getWorkshopCraftOptions(payload?: { taxRate?: number }): WorkshopCraftOption[] {
  const state = readWorkshopState();
  const taxRate = sanitizeTaxRate(payload?.taxRate);
  return buildWorkshopCraftOptionsFromState(state, taxRate, {
    buildSimulation,
  });
}
