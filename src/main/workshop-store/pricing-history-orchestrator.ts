import type { WorkshopPriceHistoryQuery, WorkshopPriceHistoryResult, WorkshopState } from "../../shared/types";
import { buildWeekdayAverages } from "./pricing-analytics";
import { classifyPriceHistorySnapshotsByQuality } from "./pricing-history-classify";
import { composeWorkshopPriceHistoryResult } from "./pricing-history-composer";
import { resolveHistoryRange } from "./pricing-history-range";
import { selectPriceSnapshotsForHistoryQuery } from "./pricing-history-query";
import { buildPriceHistorySeries } from "./pricing-history-series";
import { sanitizePriceMarket } from "./pricing-snapshot-normalize";

export function buildWorkshopPriceHistoryResult(
  state: WorkshopState,
  payload: WorkshopPriceHistoryQuery,
): WorkshopPriceHistoryResult {
  const { from, to } = resolveHistoryRange(payload);
  const includeSuspect = payload.includeSuspect === true;
  const targetMarket = payload.market === undefined ? undefined : sanitizePriceMarket(payload.market);
  const itemById = new Map(state.items.map((item) => [item.id, item] as const));
  const snapshots = selectPriceSnapshotsForHistoryQuery(state.prices, payload.itemId, from, to, targetMarket);
  const classifiedSnapshots = classifyPriceHistorySnapshotsByQuality(snapshots, itemById);
  const { points, suspectPoints, sampleCount, suspectCount, latestPrice, latestCapturedAt, averagePrice, ma7Latest } =
    buildPriceHistorySeries(classifiedSnapshots, includeSuspect);

  return composeWorkshopPriceHistoryResult({
    payload,
    targetMarket,
    from,
    to,
    sampleCount,
    suspectCount,
    latestPrice,
    latestCapturedAt,
    averagePrice,
    ma7Latest,
    points,
    suspectPoints,
    weekdayAverages: buildWeekdayAverages(points),
  });
}
