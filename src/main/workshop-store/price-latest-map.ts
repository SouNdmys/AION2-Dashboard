import type { WorkshopPriceMarket, WorkshopPriceSnapshot } from "../../shared/types";

function scoreByMarket(market: WorkshopPriceMarket | undefined): number {
  if (market === "server") return 3;
  if (market === "single") return 2;
  if (market === "world") return 1;
  return 0;
}

export function buildLatestWorkshopPriceSnapshotMap(prices: WorkshopPriceSnapshot[]): Map<string, WorkshopPriceSnapshot> {
  const map = new Map<string, WorkshopPriceSnapshot>();
  prices.forEach((snapshot) => {
    const previous = map.get(snapshot.itemId);
    if (!previous) {
      map.set(snapshot.itemId, snapshot);
      return;
    }
    const prevTs = new Date(previous.capturedAt).getTime();
    const nextTs = new Date(snapshot.capturedAt).getTime();
    if (nextTs > prevTs) {
      map.set(snapshot.itemId, snapshot);
      return;
    }
    if (nextTs === prevTs && scoreByMarket(snapshot.market) > scoreByMarket(previous.market)) {
      map.set(snapshot.itemId, snapshot);
    }
  });
  return map;
}
