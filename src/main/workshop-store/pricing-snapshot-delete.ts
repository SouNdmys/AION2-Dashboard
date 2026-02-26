import type { WorkshopPriceSnapshot } from "../../shared/types";

export function buildWorkshopPricesWithDeletedSnapshot(
  prices: WorkshopPriceSnapshot[],
  snapshotId: string,
): WorkshopPriceSnapshot[] | null {
  if (!prices.some((entry) => entry.id === snapshotId)) {
    return null;
  }
  return prices.filter((entry) => entry.id !== snapshotId);
}
