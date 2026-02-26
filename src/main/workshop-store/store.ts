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
