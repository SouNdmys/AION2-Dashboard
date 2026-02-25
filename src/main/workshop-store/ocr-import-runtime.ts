import type { WorkshopPriceMarket, WorkshopPriceSnapshot } from "../../shared/types";

export function isDuplicatePriceSnapshotByWindow(
  prices: WorkshopPriceSnapshot[],
  itemId: string,
  market: WorkshopPriceMarket | undefined,
  unitPrice: number,
  capturedAtIso: string,
  dedupeWithinSeconds: number,
): boolean {
  if (dedupeWithinSeconds <= 0) {
    return false;
  }
  const capturedAtMs = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(capturedAtMs)) {
    return false;
  }
  const dedupeWindowMs = dedupeWithinSeconds * 1000;
  for (let index = prices.length - 1; index >= 0; index -= 1) {
    const row = prices[index];
    if (row.itemId !== itemId) {
      continue;
    }
    if ((row.market ?? "single") !== (market ?? "single")) {
      continue;
    }
    if (row.unitPrice !== unitPrice) {
      continue;
    }
    const rowMs = new Date(row.capturedAt).getTime();
    if (!Number.isFinite(rowMs)) {
      continue;
    }
    if (Math.abs(capturedAtMs - rowMs) <= dedupeWindowMs) {
      return true;
    }
  }
  return false;
}

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
