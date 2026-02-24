import type { WorkshopState } from "../../../../../shared/types";
import { toInt } from "../workshop-view-helpers";

type WorkshopActions = NonNullable<Window["aionApi"]>;
type CommitRunner = (action: () => Promise<WorkshopState>, successText: string) => Promise<void>;

interface LatestPriceMetaLite {
  server: { price: number; capturedAt: number } | null;
  world: { price: number; capturedAt: number } | null;
  single: { price: number; capturedAt: number } | null;
}

interface CreateWorkshopCorrectionHandlersParams {
  selectedItemId: string;
  selectedItemPrice: string;
  selectedItemInventory: string;
  selectedItemPriceMarket: "server" | "world";
  latestPriceMetaByItemId: Map<string, LatestPriceMetaLite>;
  inventoryByItemId: Map<string, number>;
  workshopActions: WorkshopActions;
  commit: CommitRunner;
  setError: (message: string | null) => void;
  setSelectedItemId: (itemId: string) => void;
  setSelectedItemPrice: (value: string) => void;
  setSelectedItemInventory: (value: string) => void;
}

interface WorkshopCorrectionHandlers {
  onSaveSelectedPrice: () => void;
  onSaveSelectedInventory: () => void;
  onPickItemForCorrection: (itemId: string) => void;
}

export function createWorkshopCorrectionHandlers(params: CreateWorkshopCorrectionHandlersParams): WorkshopCorrectionHandlers {
  const {
    selectedItemId,
    selectedItemPrice,
    selectedItemInventory,
    selectedItemPriceMarket,
    latestPriceMetaByItemId,
    inventoryByItemId,
    workshopActions,
    commit,
    setError,
    setSelectedItemId,
    setSelectedItemPrice,
    setSelectedItemInventory,
  } = params;

  function onSaveSelectedPrice(): void {
    if (!selectedItemId) {
      setError("请先选择物品。");
      return;
    }
    const unitPrice = toInt(selectedItemPrice);
    if (unitPrice === null || unitPrice <= 0) {
      setError("价格必须是大于 0 的整数。");
      return;
    }
    void commit(
      () =>
        workshopActions.addWorkshopPriceSnapshot({
          itemId: selectedItemId,
          unitPrice,
          source: "manual",
          market: selectedItemPriceMarket,
        }),
      "已记录价格快照",
    );
  }

  function onSaveSelectedInventory(): void {
    if (!selectedItemId) {
      setError("请先选择物品。");
      return;
    }
    const quantity = toInt(selectedItemInventory);
    if (quantity === null || quantity < 0) {
      setError("库存必须是大于等于 0 的整数。");
      return;
    }
    void commit(() => workshopActions.upsertWorkshopInventory({ itemId: selectedItemId, quantity }), "已更新库存");
  }

  function onPickItemForCorrection(itemId: string): void {
    setSelectedItemId(itemId);
    const latestMeta = latestPriceMetaByItemId.get(itemId);
    const priceByMarket = selectedItemPriceMarket === "server" ? latestMeta?.server : latestMeta?.world;
    const price = priceByMarket?.price ?? latestMeta?.single?.price ?? 0;
    const inventory = inventoryByItemId.get(itemId) ?? 0;
    setSelectedItemPrice(String(price));
    setSelectedItemInventory(String(inventory));
  }

  return {
    onSaveSelectedPrice,
    onSaveSelectedInventory,
    onPickItemForCorrection,
  };
}
