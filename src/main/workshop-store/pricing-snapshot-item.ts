import type { WorkshopItemCategory, WorkshopState } from "../../shared/types";

export interface ResolveWorkshopPriceSnapshotItemCategoryDeps {
  ensureItemExists: (state: WorkshopState, itemId: string) => void;
}

export function resolveWorkshopPriceSnapshotItemCategory(
  state: WorkshopState,
  itemId: string,
  deps: ResolveWorkshopPriceSnapshotItemCategoryDeps,
): WorkshopItemCategory | "other" {
  deps.ensureItemExists(state, itemId);
  return state.items.find((entry) => entry.id === itemId)?.category ?? "other";
}
