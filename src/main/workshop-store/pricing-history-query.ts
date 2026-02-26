import type { WorkshopPriceMarket, WorkshopPriceSnapshot } from "../../shared/types";
import { normalizePriceMarketForCompare } from "./pricing-anomaly";
import type { PriceSnapshotWithTimestamp } from "./pricing-history-classify";

export function selectPriceSnapshotsForHistoryQuery(
  prices: WorkshopPriceSnapshot[],
  itemId: string,
  from: Date,
  to: Date,
  targetMarket?: WorkshopPriceMarket,
): PriceSnapshotWithTimestamp[] {
  return prices
    .filter((entry) => entry.itemId === itemId)
    .filter((entry) =>
      targetMarket === undefined ? true : normalizePriceMarketForCompare(entry.market) === normalizePriceMarketForCompare(targetMarket),
    )
    .map((entry) => ({
      ...entry,
      ts: new Date(entry.capturedAt).getTime(),
    }))
    .filter((entry) => Number.isFinite(entry.ts))
    .filter((entry) => entry.ts >= from.getTime() && entry.ts <= to.getTime())
    .sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id));
}
