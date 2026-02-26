import type { WorkshopPriceHistoryPoint, WorkshopPriceMarket } from "../../shared/types";

export interface ClassifiedPriceHistorySnapshot {
  id: string;
  itemId: string;
  unitPrice: number;
  capturedAt: string;
  weekday: number;
  market: WorkshopPriceMarket;
  note?: string;
  isSuspect: boolean;
  suspectReason: string | null;
}

export interface PriceHistorySeriesResult {
  points: WorkshopPriceHistoryPoint[];
  suspectPoints: WorkshopPriceHistoryPoint[];
  sampleCount: number;
  suspectCount: number;
  latestPrice: number | null;
  latestCapturedAt: string | null;
  averagePrice: number | null;
  ma7Latest: number | null;
}

export function buildPriceHistorySeries(
  classifiedSnapshots: ClassifiedPriceHistorySnapshot[],
  includeSuspect: boolean,
): PriceHistorySeriesResult {
  const snapshotsForSeries = includeSuspect ? classifiedSnapshots : classifiedSnapshots.filter((entry) => !entry.isSuspect);
  let rollingSum = 0;
  const rollingWindow: number[] = [];
  const points: WorkshopPriceHistoryPoint[] = snapshotsForSeries.map((entry) => {
    rollingWindow.push(entry.unitPrice);
    rollingSum += entry.unitPrice;
    if (rollingWindow.length > 7) {
      const popped = rollingWindow.shift();
      if (popped !== undefined) {
        rollingSum -= popped;
      }
    }
    const ma7 = rollingWindow.length >= 7 ? rollingSum / rollingWindow.length : null;
    return {
      id: entry.id,
      itemId: entry.itemId,
      unitPrice: entry.unitPrice,
      capturedAt: entry.capturedAt,
      weekday: entry.weekday,
      ma7,
      market: entry.market,
      note: entry.note,
      isSuspect: entry.isSuspect,
      suspectReason: entry.suspectReason ?? undefined,
    };
  });
  const pointById = new Map(points.map((point) => [point.id, point]));
  const suspectPoints: WorkshopPriceHistoryPoint[] = classifiedSnapshots
    .filter((entry) => entry.isSuspect)
    .map((entry) => {
      const inSeries = pointById.get(entry.id);
      if (inSeries) {
        return inSeries;
      }
      return {
        id: entry.id,
        itemId: entry.itemId,
        unitPrice: entry.unitPrice,
        capturedAt: entry.capturedAt,
        weekday: entry.weekday,
        ma7: null,
        market: entry.market,
        note: entry.note,
        isSuspect: true,
        suspectReason: entry.suspectReason ?? undefined,
      };
    });

  const sampleCount = points.length;
  const averagePrice = sampleCount > 0 ? points.reduce((acc, point) => acc + point.unitPrice, 0) / sampleCount : null;
  const latestPoint = points[sampleCount - 1] ?? null;

  return {
    points,
    suspectPoints,
    sampleCount,
    suspectCount: suspectPoints.length,
    latestPrice: latestPoint?.unitPrice ?? null,
    latestCapturedAt: latestPoint?.capturedAt ?? null,
    averagePrice,
    ma7Latest: latestPoint?.ma7 ?? null,
  };
}
