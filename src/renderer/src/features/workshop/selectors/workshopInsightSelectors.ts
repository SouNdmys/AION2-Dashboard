import type {
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
} from "../../../../../shared/types";
import {
  HISTORY_QUICK_DAY_OPTIONS,
  buildDualHistoryChartModel,
  buildHistoryInsightModel,
  type DualHistoryChartModel,
  type HistoryInsightModel,
  toInt,
} from "../workshop-view-helpers";
import { memoizeSelector } from "./memoizeSelector";

function sortByStarAndDeviation(
  left: WorkshopPriceSignalRow,
  right: WorkshopPriceSignalRow,
  starItemIdSet: Set<string>,
  direction: "buy" | "sell" | "triggered",
): number {
  const leftStar = starItemIdSet.has(left.itemId) ? 1 : 0;
  const rightStar = starItemIdSet.has(right.itemId) ? 1 : 0;
  if (leftStar !== rightStar) {
    return rightStar - leftStar;
  }

  if (direction === "triggered") {
    const leftDeviation = Math.abs(left.deviationRatioFromWeekdayAverage ?? 0);
    const rightDeviation = Math.abs(right.deviationRatioFromWeekdayAverage ?? 0);
    if (rightDeviation !== leftDeviation) {
      return rightDeviation - leftDeviation;
    }
    return right.sampleCount - left.sampleCount;
  }

  if (direction === "buy") {
    const leftDeviation = left.deviationRatioFromWeekdayAverage ?? Number.POSITIVE_INFINITY;
    const rightDeviation = right.deviationRatioFromWeekdayAverage ?? Number.POSITIVE_INFINITY;
    if (leftDeviation !== rightDeviation) {
      return leftDeviation - rightDeviation;
    }
    return right.sampleCount - left.sampleCount;
  }

  const leftDeviation = left.deviationRatioFromWeekdayAverage ?? Number.NEGATIVE_INFINITY;
  const rightDeviation = right.deviationRatioFromWeekdayAverage ?? Number.NEGATIVE_INFINITY;
  if (leftDeviation !== rightDeviation) {
    return rightDeviation - leftDeviation;
  }
  return right.sampleCount - left.sampleCount;
}

export function createWorkshopInsightSelectors(): {
  selectActiveHistoryQuickDays: (historyDaysInput: string) => number | null;
  selectHistoryServerInsight: (historyResult: WorkshopPriceHistoryResult | null) => HistoryInsightModel | null;
  selectHistoryWorldInsight: (historyResult: WorkshopPriceHistoryResult | null) => HistoryInsightModel | null;
  selectTriggeredSignalRows: (
    signalResult: WorkshopPriceSignalResult | null,
    focusStarOnly: boolean,
    starItemIdSet: Set<string>,
  ) => WorkshopPriceSignalRow[];
  selectBuyZoneRows: (
    signalResult: WorkshopPriceSignalResult | null,
    focusStarOnly: boolean,
    starItemIdSet: Set<string>,
  ) => WorkshopPriceSignalRow[];
  selectSellZoneRows: (
    signalResult: WorkshopPriceSignalResult | null,
    focusStarOnly: boolean,
    starItemIdSet: Set<string>,
  ) => WorkshopPriceSignalRow[];
  selectDualHistoryChartModel: (
    historyServerResult: WorkshopPriceHistoryResult | null,
    historyWorldResult: WorkshopPriceHistoryResult | null,
  ) => DualHistoryChartModel | null;
} {
  const selectActiveHistoryQuickDays = memoizeSelector((historyDaysInput: string): number | null => {
    const current = toInt(historyDaysInput);
    if (current === null) {
      return null;
    }
    return HISTORY_QUICK_DAY_OPTIONS.find((days) => days === current) ?? null;
  });

  const selectHistoryServerInsight = memoizeSelector((historyResult: WorkshopPriceHistoryResult | null): HistoryInsightModel | null =>
    buildHistoryInsightModel(historyResult),
  );
  const selectHistoryWorldInsight = memoizeSelector((historyResult: WorkshopPriceHistoryResult | null): HistoryInsightModel | null =>
    buildHistoryInsightModel(historyResult),
  );

  const selectTriggeredSignalRows = memoizeSelector(
    (
      signalResult: WorkshopPriceSignalResult | null,
      focusStarOnly: boolean,
      starItemIdSet: Set<string>,
    ): WorkshopPriceSignalRow[] => {
      if (!signalResult) {
        return [];
      }
      return signalResult.rows
        .filter((row) => row.triggered)
        .filter((row) => (focusStarOnly ? starItemIdSet.has(row.itemId) : true))
        .sort((left, right) => sortByStarAndDeviation(left, right, starItemIdSet, "triggered"));
    },
  );

  const selectBuyZoneRows = memoizeSelector(
    (
      signalResult: WorkshopPriceSignalResult | null,
      focusStarOnly: boolean,
      starItemIdSet: Set<string>,
    ): WorkshopPriceSignalRow[] => {
      if (!signalResult) {
        return [];
      }
      return signalResult.rows
        .filter((row) => row.trendTag === "buy-zone")
        .filter((row) => (focusStarOnly ? starItemIdSet.has(row.itemId) : true))
        .sort((left, right) => sortByStarAndDeviation(left, right, starItemIdSet, "buy"));
    },
  );

  const selectSellZoneRows = memoizeSelector(
    (
      signalResult: WorkshopPriceSignalResult | null,
      focusStarOnly: boolean,
      starItemIdSet: Set<string>,
    ): WorkshopPriceSignalRow[] => {
      if (!signalResult) {
        return [];
      }
      return signalResult.rows
        .filter((row) => row.trendTag === "sell-zone")
        .filter((row) => (focusStarOnly ? starItemIdSet.has(row.itemId) : true))
        .sort((left, right) => sortByStarAndDeviation(left, right, starItemIdSet, "sell"));
    },
  );

  const selectDualHistoryChartModel = memoizeSelector(
    (
      historyServerResult: WorkshopPriceHistoryResult | null,
      historyWorldResult: WorkshopPriceHistoryResult | null,
    ): DualHistoryChartModel | null => buildDualHistoryChartModel(historyServerResult, historyWorldResult),
  );

  return {
    selectActiveHistoryQuickDays,
    selectHistoryServerInsight,
    selectHistoryWorldInsight,
    selectTriggeredSignalRows,
    selectBuyZoneRows,
    selectSellZoneRows,
    selectDualHistoryChartModel,
  };
}
