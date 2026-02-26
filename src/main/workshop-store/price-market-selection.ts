import type { WorkshopPriceMarket, WorkshopPriceSnapshot } from "../../shared/types";

export interface LatestWorkshopPriceByMarket {
  server: WorkshopPriceSnapshot | null;
  world: WorkshopPriceSnapshot | null;
  single: WorkshopPriceSnapshot | null;
}

export function normalizeWorkshopPriceMarketForCompare(market: WorkshopPriceMarket | undefined): WorkshopPriceMarket {
  return market === "server" || market === "world" ? market : "single";
}

export function buildLatestWorkshopPriceByItemAndMarketMap(
  prices: WorkshopPriceSnapshot[],
): Map<string, LatestWorkshopPriceByMarket> {
  const map = new Map<string, LatestWorkshopPriceByMarket>();
  prices.forEach((snapshot) => {
    const market = normalizeWorkshopPriceMarketForCompare(snapshot.market);
    const current = map.get(snapshot.itemId) ?? { server: null, world: null, single: null };
    const previous = current[market];
    if (!previous) {
      current[market] = snapshot;
      map.set(snapshot.itemId, current);
      return;
    }
    const prevTs = new Date(previous.capturedAt).getTime();
    const nextTs = new Date(snapshot.capturedAt).getTime();
    if (nextTs > prevTs || (nextTs === prevTs && snapshot.id.localeCompare(previous.id) > 0)) {
      current[market] = snapshot;
      map.set(snapshot.itemId, current);
    }
  });
  return map;
}

export function resolveCheapestWorkshopMaterialPrice(
  row: LatestWorkshopPriceByMarket | undefined,
): { unitPrice: number | null; market: WorkshopPriceMarket | undefined } {
  if (!row) {
    return { unitPrice: null, market: undefined };
  }
  const serverPrice = row.server?.unitPrice ?? null;
  const worldPrice = row.world?.unitPrice ?? null;
  if (serverPrice !== null && worldPrice !== null) {
    if (serverPrice <= worldPrice) {
      return { unitPrice: serverPrice, market: "server" };
    }
    return { unitPrice: worldPrice, market: "world" };
  }
  if (serverPrice !== null) {
    return { unitPrice: serverPrice, market: "server" };
  }
  if (worldPrice !== null) {
    return { unitPrice: worldPrice, market: "world" };
  }
  if (row.single?.unitPrice !== undefined) {
    return { unitPrice: row.single.unitPrice, market: "single" };
  }
  return { unitPrice: null, market: undefined };
}
