import type { WorkshopItem, WorkshopRecipe, WorkshopState } from "../../shared/types";
import { buildLatestWorkshopPriceSnapshotMap } from "./price-latest-map";
import {
  buildLatestWorkshopPriceByItemAndMarketMap,
  type LatestWorkshopPriceByMarket,
} from "./price-market-selection";

export interface WorkshopSimulationContext {
  recipeByOutput: Map<string, WorkshopRecipe>;
  itemById: Map<string, WorkshopItem>;
  inventoryByItemId: Map<string, number>;
  latestPriceByItemId: ReturnType<typeof buildLatestWorkshopPriceSnapshotMap>;
  latestPriceByItemAndMarket: Map<string, LatestWorkshopPriceByMarket>;
}

export function buildWorkshopSimulationContext(state: WorkshopState): WorkshopSimulationContext {
  return {
    recipeByOutput: new Map(state.recipes.map((entry) => [entry.outputItemId, entry])),
    itemById: new Map(state.items.map((entry) => [entry.id, entry])),
    inventoryByItemId: new Map(state.inventory.map((entry) => [entry.itemId, entry.quantity])),
    latestPriceByItemId: buildLatestWorkshopPriceSnapshotMap(state.prices),
    latestPriceByItemAndMarket: buildLatestWorkshopPriceByItemAndMarketMap(state.prices),
  };
}
