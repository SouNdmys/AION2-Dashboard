import type { WorkshopPriceSnapshot } from "../../shared/types";

export function trimWorkshopPriceHistory(
  prices: WorkshopPriceSnapshot[],
  maxEntries: number,
): WorkshopPriceSnapshot[] {
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) {
    return [];
  }
  if (prices.length <= maxEntries) {
    return prices;
  }
  return prices.slice(-maxEntries);
}

export function appendWorkshopPriceSnapshot(
  prices: WorkshopPriceSnapshot[],
  snapshot: WorkshopPriceSnapshot,
  maxEntries: number,
): WorkshopPriceSnapshot[] {
  return trimWorkshopPriceHistory([...prices, snapshot], maxEntries);
}
