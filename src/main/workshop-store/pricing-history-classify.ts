import type { WorkshopItem, WorkshopPriceSnapshot } from "../../shared/types";
import { WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS, assessPriceAnomalyWithCategory, formatAnomalyReason, normalizePriceMarketForCompare, resolveSnapshotQualityTag } from "./pricing-anomaly";
import type { ClassifiedPriceHistorySnapshot } from "./pricing-history-series";

export interface PriceSnapshotWithTimestamp extends WorkshopPriceSnapshot {
  ts: number;
}

export function classifyPriceHistorySnapshotsByQuality(
  snapshots: PriceSnapshotWithTimestamp[],
  itemById: Map<string, WorkshopItem>,
): ClassifiedPriceHistorySnapshot[] {
  const anomalyWindowMs = WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS * 24 * 60 * 60 * 1000;
  const baselineByMarket = new Map<"server" | "world" | "single", Array<{ ts: number; unitPrice: number }>>();

  return snapshots.map((entry) => {
    const market = normalizePriceMarketForCompare(entry.market);
    const baseline = baselineByMarket.get(market) ?? [];
    const baselineInWindow = baseline.filter((row) => row.ts >= entry.ts - anomalyWindowMs);
    const qualityTag = resolveSnapshotQualityTag(entry.note);
    const itemCategory = itemById.get(entry.itemId)?.category ?? "other";
    const anomaly = qualityTag.isSuspect
      ? null
      : assessPriceAnomalyWithCategory(entry.unitPrice, baselineInWindow.map((row) => row.unitPrice), itemCategory);
    const isSuspect = qualityTag.isSuspect || (anomaly !== null && anomaly.kind !== "normal");
    const suspectReason = qualityTag.reason ?? (anomaly ? formatAnomalyReason(anomaly) || null : null);
    if (!isSuspect) {
      baselineInWindow.push({
        ts: entry.ts,
        unitPrice: entry.unitPrice,
      });
    }
    baselineByMarket.set(market, baselineInWindow);
    return {
      id: entry.id,
      itemId: entry.itemId,
      unitPrice: entry.unitPrice,
      capturedAt: new Date(entry.ts).toISOString(),
      weekday: new Date(entry.ts).getDay(),
      market,
      note: entry.note,
      isSuspect,
      suspectReason,
    };
  });
}
