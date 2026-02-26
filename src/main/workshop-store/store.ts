import { randomUUID } from "node:crypto";
import type {
  UpsertWorkshopInventoryInput,
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
import { buildWorkshopInventoryAfterUpsert } from "./store-inventory-upsert";
import { buildWorkshopSampleSeedState } from "./store-sample-seed";

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
  const nextInventory = buildWorkshopInventoryAfterUpsert({
    inventory: state.inventory,
    itemId: payload.itemId,
    quantity,
    nowIso: new Date().toISOString(),
  });

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    inventory: nextInventory,
  });
}

export function seedWorkshopSampleData(): WorkshopState {
  const state = readWorkshopState();
  const nextState = buildWorkshopSampleSeedState(state, new Date().toISOString(), {
    createId: randomUUID,
    normalizeRecipeInputs,
    priceHistoryLimit: WORKSHOP_PRICE_HISTORY_LIMIT,
  });
  return writeWorkshopState({
    ...nextState,
    version: WORKSHOP_STATE_VERSION,
  });
}
