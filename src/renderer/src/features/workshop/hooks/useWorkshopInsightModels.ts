import { useMemo } from "react";
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

interface UseWorkshopInsightModelsParams {
  historyDaysInput: string;
  historyServerResult: WorkshopPriceHistoryResult | null;
  historyWorldResult: WorkshopPriceHistoryResult | null;
  signalResult: WorkshopPriceSignalResult | null;
  focusStarOnly: boolean;
  starItemIdSet: Set<string>;
}

interface WorkshopInsightModels {
  activeHistoryQuickDays: number | null;
  historyServerInsight: HistoryInsightModel | null;
  historyWorldInsight: HistoryInsightModel | null;
  triggeredSignalRows: WorkshopPriceSignalRow[];
  buyZoneRows: WorkshopPriceSignalRow[];
  sellZoneRows: WorkshopPriceSignalRow[];
  dualHistoryChartModel: DualHistoryChartModel | null;
}

export function useWorkshopInsightModels(params: UseWorkshopInsightModelsParams): WorkshopInsightModels {
  const { historyDaysInput, historyServerResult, historyWorldResult, signalResult, focusStarOnly, starItemIdSet } = params;

  const activeHistoryQuickDays = useMemo(() => {
    const current = toInt(historyDaysInput);
    if (current === null) {
      return null;
    }
    return HISTORY_QUICK_DAY_OPTIONS.find((days) => days === current) ?? null;
  }, [historyDaysInput]);

  const historyServerInsight = useMemo(() => buildHistoryInsightModel(historyServerResult), [historyServerResult]);
  const historyWorldInsight = useMemo(() => buildHistoryInsightModel(historyWorldResult), [historyWorldResult]);

  const triggeredSignalRows = useMemo(() => {
    if (!signalResult) {
      return [];
    }
    return signalResult.rows
      .filter((row) => row.triggered)
      .filter((row) => (focusStarOnly ? starItemIdSet.has(row.itemId) : true))
      .sort((left, right) => {
        const leftStar = starItemIdSet.has(left.itemId) ? 1 : 0;
        const rightStar = starItemIdSet.has(right.itemId) ? 1 : 0;
        if (leftStar !== rightStar) {
          return rightStar - leftStar;
        }
        const leftDeviation = Math.abs(left.deviationRatioFromWeekdayAverage ?? 0);
        const rightDeviation = Math.abs(right.deviationRatioFromWeekdayAverage ?? 0);
        if (rightDeviation !== leftDeviation) {
          return rightDeviation - leftDeviation;
        }
        return right.sampleCount - left.sampleCount;
      });
  }, [signalResult, focusStarOnly, starItemIdSet]);

  const buyZoneRows = useMemo(() => {
    if (!signalResult) {
      return [];
    }
    return [...signalResult.rows]
      .filter((row) => row.trendTag === "buy-zone")
      .filter((row) => (focusStarOnly ? starItemIdSet.has(row.itemId) : true))
      .sort((left, right) => {
        const leftStar = starItemIdSet.has(left.itemId) ? 1 : 0;
        const rightStar = starItemIdSet.has(right.itemId) ? 1 : 0;
        if (leftStar !== rightStar) {
          return rightStar - leftStar;
        }
        const leftDeviation = left.deviationRatioFromWeekdayAverage ?? Number.POSITIVE_INFINITY;
        const rightDeviation = right.deviationRatioFromWeekdayAverage ?? Number.POSITIVE_INFINITY;
        if (leftDeviation !== rightDeviation) {
          return leftDeviation - rightDeviation;
        }
        return right.sampleCount - left.sampleCount;
      });
  }, [signalResult, focusStarOnly, starItemIdSet]);

  const sellZoneRows = useMemo(() => {
    if (!signalResult) {
      return [];
    }
    return [...signalResult.rows]
      .filter((row) => row.trendTag === "sell-zone")
      .filter((row) => (focusStarOnly ? starItemIdSet.has(row.itemId) : true))
      .sort((left, right) => {
        const leftStar = starItemIdSet.has(left.itemId) ? 1 : 0;
        const rightStar = starItemIdSet.has(right.itemId) ? 1 : 0;
        if (leftStar !== rightStar) {
          return rightStar - leftStar;
        }
        const leftDeviation = left.deviationRatioFromWeekdayAverage ?? Number.NEGATIVE_INFINITY;
        const rightDeviation = right.deviationRatioFromWeekdayAverage ?? Number.NEGATIVE_INFINITY;
        if (leftDeviation !== rightDeviation) {
          return rightDeviation - leftDeviation;
        }
        return right.sampleCount - left.sampleCount;
      });
  }, [signalResult, focusStarOnly, starItemIdSet]);

  const dualHistoryChartModel = useMemo(
    () => buildDualHistoryChartModel(historyServerResult, historyWorldResult),
    [historyServerResult, historyWorldResult],
  );

  return {
    activeHistoryQuickDays,
    historyServerInsight,
    historyWorldInsight,
    triggeredSignalRows,
    buyZoneRows,
    sellZoneRows,
    dualHistoryChartModel,
  };
}
