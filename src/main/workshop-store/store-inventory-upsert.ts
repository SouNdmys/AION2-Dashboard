import type { WorkshopInventoryItem } from "../../shared/types";

export interface BuildWorkshopInventoryAfterUpsertInput {
  inventory: WorkshopInventoryItem[];
  itemId: string;
  quantity: number;
  nowIso: string;
}

export function buildWorkshopInventoryAfterUpsert(
  input: BuildWorkshopInventoryAfterUpsertInput,
): WorkshopInventoryItem[] {
  if (input.quantity === 0) {
    return input.inventory.filter((row) => row.itemId !== input.itemId);
  }
  return [
    ...input.inventory.filter((row) => row.itemId !== input.itemId),
    {
      itemId: input.itemId,
      quantity: input.quantity,
      updatedAt: input.nowIso,
    },
  ].sort((left, right) => left.itemId.localeCompare(right.itemId));
}
