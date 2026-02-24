import { useEffect, useRef } from "react";
import type { WorkshopPriceHistoryResult } from "../../../../../shared/types";
import { toInt } from "../workshop-view-helpers";

type WorkshopActions = NonNullable<Window["aionApi"]>;

interface UseWorkshopHistoryLoaderParams {
  workshopActions: WorkshopActions;
  historyItemId: string;
  historyDaysInput: string;
  historyIncludeSuspect: boolean;
  externalPriceChangeNonce: number;
  loadState: () => Promise<void>;
  loadCraftOptions: () => Promise<void>;
  loadSignals: () => Promise<void>;
  setError: (message: string | null) => void;
  setHistoryLoading: (loading: boolean) => void;
  setHistoryServerResult: (result: WorkshopPriceHistoryResult | null) => void;
  setHistoryWorldResult: (result: WorkshopPriceHistoryResult | null) => void;
  setHistoryHasLoaded: (loaded: boolean) => void;
}

interface WorkshopHistoryLoaderHandlers {
  onLoadPriceHistory: (daysOverride?: number, options?: { silent?: boolean }) => Promise<void>;
}

export function useWorkshopHistoryLoader(params: UseWorkshopHistoryLoaderParams): WorkshopHistoryLoaderHandlers {
  const {
    workshopActions,
    historyItemId,
    historyDaysInput,
    historyIncludeSuspect,
    externalPriceChangeNonce,
    loadState,
    loadCraftOptions,
    loadSignals,
    setError,
    setHistoryLoading,
    setHistoryServerResult,
    setHistoryWorldResult,
    setHistoryHasLoaded,
  } = params;
  const historyQuerySeqRef = useRef(0);

  async function onLoadPriceHistory(daysOverride?: number, options?: { silent?: boolean }): Promise<void> {
    const silent = options?.silent ?? false;
    if (!historyItemId) {
      if (!silent) {
        setError("请先选择要查询的物品。");
      }
      return;
    }
    const days = daysOverride ?? toInt(historyDaysInput);
    if (days === null || days <= 0) {
      if (!silent) {
        setError("查询天数必须是正整数。");
      }
      return;
    }
    const seq = historyQuerySeqRef.current + 1;
    historyQuerySeqRef.current = seq;
    if (!silent) {
      setError(null);
    }
    setHistoryLoading(true);
    try {
      const [serverResult, worldResult] = await Promise.all([
        workshopActions.getWorkshopPriceHistory({
          itemId: historyItemId,
          days,
          includeSuspect: historyIncludeSuspect,
          market: "server",
        }),
        workshopActions.getWorkshopPriceHistory({
          itemId: historyItemId,
          days,
          includeSuspect: historyIncludeSuspect,
          market: "world",
        }),
      ]);
      if (historyQuerySeqRef.current !== seq) {
        return;
      }
      setHistoryServerResult(serverResult);
      setHistoryWorldResult(worldResult);
      setHistoryHasLoaded(true);
    } catch (err) {
      if (historyQuerySeqRef.current !== seq) {
        return;
      }
      setError(err instanceof Error ? err.message : "价格历史查询失败");
    } finally {
      if (historyQuerySeqRef.current === seq) {
        setHistoryLoading(false);
      }
    }
  }

  useEffect(() => {
    const days = toInt(historyDaysInput);
    if (!historyItemId || days === null || days <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      void onLoadPriceHistory(days, { silent: true });
    }, 120);
    return () => {
      window.clearTimeout(timer);
    };
  }, [historyItemId, historyDaysInput, historyIncludeSuspect]);

  useEffect(() => {
    if (externalPriceChangeNonce <= 0) {
      return;
    }
    const days = toInt(historyDaysInput);
    void (async () => {
      try {
        await Promise.all([loadState(), loadCraftOptions(), loadSignals()]);
        if (historyItemId && days !== null && days > 0) {
          await onLoadPriceHistory(days, { silent: true });
        }
      } catch {
        // sidebar mutation sync should be best-effort and silent
      }
    })();
  }, [externalPriceChangeNonce]);

  return {
    onLoadPriceHistory,
  };
}
