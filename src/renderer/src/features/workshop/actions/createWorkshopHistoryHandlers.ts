import { formatDateTime, toInt } from "../workshop-view-helpers";
import type { WorkshopPriceMarket } from "../../../../../shared/types";

interface ClassifiedItemOptionLite {
  id: string;
  mainCategory: string;
  subCategory: string;
}

interface ItemMetaLite {
  name: string;
}

interface CreateWorkshopHistoryHandlersParams {
  historyItemId: string;
  historyDaysInput: string;
  starItemIdSet: Set<string>;
  itemById: Map<string, ItemMetaLite>;
  classifiedItemOptions: ClassifiedItemOptionLite[];
  onLoadPriceHistory: (daysOverride?: number, options?: { silent?: boolean }) => Promise<void>;
  onJumpToHistoryManager?: (payload: { itemId: string; snapshotId?: string }) => void;
  setSelectedItemPriceMarket: (market: "server" | "world") => void;
  setHistoryKeyword: (value: string) => void;
  setHistoryMainCategory: (value: string) => void;
  setHistorySubCategory: (value: "all" | string) => void;
  setHistoryItemId: (value: string) => void;
  setStarItemIds: (updater: (prev: string[]) => string[]) => void;
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  historyChartAnchorRef: { current: HTMLDivElement | null };
}

interface WorkshopHistoryHandlers {
  onToggleStarItem: (itemId: string) => void;
  onJumpHistoryManagerForCurrentItem: () => void;
  onJumpHistoryManagerForSnapshot: (snapshotId: string, capturedAt: string) => void;
  onViewHistoryCurveForItem: (itemId: string, options?: { scroll?: boolean; market?: WorkshopPriceMarket }) => void;
}

export function createWorkshopHistoryHandlers(params: CreateWorkshopHistoryHandlersParams): WorkshopHistoryHandlers {
  const {
    historyItemId,
    historyDaysInput,
    starItemIdSet,
    itemById,
    classifiedItemOptions,
    onLoadPriceHistory,
    onJumpToHistoryManager,
    setSelectedItemPriceMarket,
    setHistoryKeyword,
    setHistoryMainCategory,
    setHistorySubCategory,
    setHistoryItemId,
    setStarItemIds,
    setError,
    setMessage,
    historyChartAnchorRef,
  } = params;

  function onToggleStarItem(itemId: string): void {
    const itemName = itemById.get(itemId)?.name ?? itemId;
    const nextStarred = !starItemIdSet.has(itemId);
    setStarItemIds((prev) => {
      if (nextStarred) {
        return prev.includes(itemId) ? prev : [...prev, itemId];
      }
      return prev.filter((entry) => entry !== itemId);
    });
    setMessage(nextStarred ? `已加入重点关注：${itemName}` : `已取消重点关注：${itemName}`);
  }

  function onJumpHistoryManagerForCurrentItem(): void {
    if (!historyItemId) {
      setError("请先选择要管理历史价格的物品。");
      return;
    }
    onJumpToHistoryManager?.({ itemId: historyItemId });
  }

  function onJumpHistoryManagerForSnapshot(snapshotId: string, capturedAt: string): void {
    if (!historyItemId) {
      setError("请先选择要管理历史价格的物品。");
      return;
    }
    onJumpToHistoryManager?.({
      itemId: historyItemId,
      snapshotId,
    });
    setMessage(`已定位到历史价格管理：${formatDateTime(capturedAt)}`);
  }

  function onViewHistoryCurveForItem(itemId: string, options?: { scroll?: boolean; market?: WorkshopPriceMarket }): void {
    const shouldScroll = options?.scroll ?? true;
    if (options?.market === "server" || options?.market === "world") {
      setSelectedItemPriceMarket(options.market);
    }
    const target = classifiedItemOptions.find((entry) => entry.id === itemId);
    if (!target) {
      setError("无法定位该物品的行情曲线。");
      return;
    }
    setHistoryKeyword("");
    setHistoryMainCategory(target.mainCategory);
    setHistorySubCategory(target.subCategory);
    setHistoryItemId(itemId);
    const days = toInt(historyDaysInput);
    if (days !== null && days > 0) {
      void onLoadPriceHistory(days, { silent: true });
    }
    if (shouldScroll) {
      window.setTimeout(() => {
        historyChartAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  }

  return {
    onToggleStarItem,
    onJumpHistoryManagerForCurrentItem,
    onJumpHistoryManagerForSnapshot,
    onViewHistoryCurveForItem,
  };
}
