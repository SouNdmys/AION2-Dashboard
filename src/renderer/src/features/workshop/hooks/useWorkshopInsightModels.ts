import { useMemo } from "react";
import type {
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
} from "../../../../../shared/types";
import {
  type DualHistoryChartModel,
  type HistoryInsightModel,
} from "../workshop-view-helpers";
import { createWorkshopInsightSelectors } from "../selectors/workshopInsightSelectors";

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
  const selectors = useMemo(() => createWorkshopInsightSelectors(), []);

  const activeHistoryQuickDays = selectors.selectActiveHistoryQuickDays(historyDaysInput);
  const historyServerInsight = selectors.selectHistoryServerInsight(historyServerResult);
  const historyWorldInsight = selectors.selectHistoryWorldInsight(historyWorldResult);
  const triggeredSignalRows = selectors.selectTriggeredSignalRows(signalResult, focusStarOnly, starItemIdSet);
  const buyZoneRows = selectors.selectBuyZoneRows(signalResult, focusStarOnly, starItemIdSet);
  const sellZoneRows = selectors.selectSellZoneRows(signalResult, focusStarOnly, starItemIdSet);
  const dualHistoryChartModel = selectors.selectDualHistoryChartModel(historyServerResult, historyWorldResult);

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
