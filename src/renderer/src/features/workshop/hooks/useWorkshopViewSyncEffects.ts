import { useEffect } from "react";
import type {
  WorkshopCraftSimulationResult,
  WorkshopOcrAutoRunState,
  WorkshopPriceHistoryResult,
  WorkshopState,
} from "../../../../../shared/types";
import type { ClassifiedItemOption, LatestPriceMetaByMarket, SimulationRecipeOption } from "../workshop-view-helpers";
import { OCR_TRADE_BOARD_PRESETS, type OcrTradePresetKey } from "../workshop-persistence";

interface UseWorkshopViewSyncEffectsParams {
  itemMainCategory: string;
  itemMainCategoryOptions: string[];
  itemSubCategory: "all" | string;
  itemSubCategoryOptions: string[];
  selectedItemId: string;
  filteredItems: ClassifiedItemOption[];
  setItemMainCategory: (value: string) => void;
  setItemSubCategory: (value: "all" | string) => void;
  setSelectedItemId: (value: string) => void;

  historyMainCategory: string;
  historyMainCategoryOptions: string[];
  historySubCategory: "all" | string;
  historySubCategoryOptions: string[];
  historyItemId: string;
  filteredHistoryItems: ClassifiedItemOption[];
  setHistoryMainCategory: (value: string) => void;
  setHistorySubCategory: (value: "all" | string) => void;
  setHistoryItemId: (value: string) => void;
  setHistoryServerResult: (value: WorkshopPriceHistoryResult | null) => void;
  setHistoryWorldResult: (value: WorkshopPriceHistoryResult | null) => void;
  setHistoryHasLoaded: (value: boolean) => void;

  simulateMainCategory: string;
  simulationMainCategoryOptions: string[];
  simulateSubCategory: "all" | string;
  simulationSubCategoryOptions: string[];
  simulateRecipeId: string;
  filteredSimulationRecipes: SimulationRecipeOption[];
  setSimulateMainCategory: (value: string) => void;
  setSimulateSubCategory: (value: "all" | string) => void;
  setSimulateRecipeId: (value: string) => void;
  setSimulation: (value: WorkshopCraftSimulationResult | null) => void;
  setSimulationOutputPriceDraft: (value: string) => void;

  reverseFocusMaterialId: string;
  classifiedItemOptions: ClassifiedItemOption[];
  setReverseFocusMaterialId: (value: string) => void;

  state: WorkshopState | null;
  setSignalRuleEnabled: (value: boolean) => void;
  setSignalLookbackDaysInput: (value: string) => void;
  setSignalThresholdPercentInput: (value: string) => void;

  selectedItemPriceMarket: "server" | "world";
  latestPriceMetaByItemId: Map<string, LatestPriceMetaByMarket>;
  inventoryByItemId: Map<string, number>;
  setSelectedItemPrice: (value: string) => void;
  setSelectedItemInventory: (value: string) => void;

  taxMode: "0.1" | "0.2";
  loadCraftOptions: () => Promise<void>;

  ocrTradePresetKey: OcrTradePresetKey;
  setOcrTradeRowCount: (value: string) => void;
  setOcrTradeNamesX: (value: string) => void;
  setOcrTradeNamesY: (value: string) => void;
  setOcrTradeNamesWidth: (value: string) => void;
  setOcrTradeNamesHeight: (value: string) => void;
  setOcrTradePricesX: (value: string) => void;
  setOcrTradePricesY: (value: string) => void;
  setOcrTradePricesWidth: (value: string) => void;
  setOcrTradePricesHeight: (value: string) => void;
  setOcrTradePriceMode: (value: "single" | "dual") => void;
  setOcrTradePriceColumn: (value: "left" | "right") => void;
  setOcrTradeLeftPriceRole: (value: "server" | "world") => void;
  setOcrTradeRightPriceRole: (value: "server" | "world") => void;

  starItemIds: string[];
  setStarItemIds: (value: string[] | ((prev: string[]) => string[])) => void;

  ocrAutoRunState: WorkshopOcrAutoRunState | null;
  setOcrAutoRunNowMs: (value: number) => void;
}

export function useWorkshopViewSyncEffects(params: UseWorkshopViewSyncEffectsParams): void {
  const {
    itemMainCategory,
    itemMainCategoryOptions,
    itemSubCategory,
    itemSubCategoryOptions,
    selectedItemId,
    filteredItems,
    setItemMainCategory,
    setItemSubCategory,
    setSelectedItemId,
    historyMainCategory,
    historyMainCategoryOptions,
    historySubCategory,
    historySubCategoryOptions,
    historyItemId,
    filteredHistoryItems,
    setHistoryMainCategory,
    setHistorySubCategory,
    setHistoryItemId,
    setHistoryServerResult,
    setHistoryWorldResult,
    setHistoryHasLoaded,
    simulateMainCategory,
    simulationMainCategoryOptions,
    simulateSubCategory,
    simulationSubCategoryOptions,
    simulateRecipeId,
    filteredSimulationRecipes,
    setSimulateMainCategory,
    setSimulateSubCategory,
    setSimulateRecipeId,
    setSimulation,
    setSimulationOutputPriceDraft,
    reverseFocusMaterialId,
    classifiedItemOptions,
    setReverseFocusMaterialId,
    state,
    setSignalRuleEnabled,
    setSignalLookbackDaysInput,
    setSignalThresholdPercentInput,
    selectedItemPriceMarket,
    latestPriceMetaByItemId,
    inventoryByItemId,
    setSelectedItemPrice,
    setSelectedItemInventory,
    taxMode,
    loadCraftOptions,
    ocrTradePresetKey,
    setOcrTradeRowCount,
    setOcrTradeNamesX,
    setOcrTradeNamesY,
    setOcrTradeNamesWidth,
    setOcrTradeNamesHeight,
    setOcrTradePricesX,
    setOcrTradePricesY,
    setOcrTradePricesWidth,
    setOcrTradePricesHeight,
    setOcrTradePriceMode,
    setOcrTradePriceColumn,
    setOcrTradeLeftPriceRole,
    setOcrTradeRightPriceRole,
    starItemIds,
    setStarItemIds,
    ocrAutoRunState,
    setOcrAutoRunNowMs,
  } = params;
  const hasState = state !== null;

  useEffect(() => {
    if (!itemMainCategoryOptions.includes(itemMainCategory)) {
      setItemMainCategory(itemMainCategoryOptions[0] ?? "鐵匠");
      return;
    }
    if (itemSubCategory !== "all" && !itemSubCategoryOptions.includes(itemSubCategory)) {
      setItemSubCategory("all");
      return;
    }
    const exists = selectedItemId && filteredItems.some((item) => item.id === selectedItemId);
    if (!exists) {
      const fallback = filteredItems[0]?.id ?? "";
      setSelectedItemId(fallback);
    }
  }, [itemMainCategory, itemMainCategoryOptions, itemSubCategory, itemSubCategoryOptions, selectedItemId, filteredItems]);

  useEffect(() => {
    if (!historyMainCategoryOptions.includes(historyMainCategory)) {
      setHistoryMainCategory(historyMainCategoryOptions[0] ?? "鐵匠");
      return;
    }
    if (historySubCategory !== "all" && !historySubCategoryOptions.includes(historySubCategory)) {
      setHistorySubCategory("all");
      return;
    }
    const exists = historyItemId && filteredHistoryItems.some((item) => item.id === historyItemId);
    if (!exists) {
      const fallback = filteredHistoryItems[0]?.id ?? "";
      setHistoryItemId(fallback);
      setHistoryServerResult(null);
      setHistoryWorldResult(null);
      setHistoryHasLoaded(false);
    }
  }, [
    historyMainCategory,
    historyMainCategoryOptions,
    historySubCategory,
    historySubCategoryOptions,
    historyItemId,
    filteredHistoryItems,
  ]);

  useEffect(() => {
    if (!simulationMainCategoryOptions.includes(simulateMainCategory)) {
      setSimulateMainCategory(simulationMainCategoryOptions[0] ?? "鐵匠");
      return;
    }
    if (simulateSubCategory !== "all" && !simulationSubCategoryOptions.includes(simulateSubCategory)) {
      setSimulateSubCategory("all");
      return;
    }
    const exists = simulateRecipeId && filteredSimulationRecipes.some((recipe) => recipe.id === simulateRecipeId);
    if (!exists) {
      const fallback = filteredSimulationRecipes[0]?.id ?? "";
      setSimulateRecipeId(fallback);
      setSimulation(null);
      setSimulationOutputPriceDraft("");
    }
  }, [
    simulateMainCategory,
    simulationMainCategoryOptions,
    simulateSubCategory,
    simulationSubCategoryOptions,
    simulateRecipeId,
    filteredSimulationRecipes,
  ]);

  useEffect(() => {
    if (!reverseFocusMaterialId) {
      return;
    }
    const exists = classifiedItemOptions.some((item) => item.id === reverseFocusMaterialId);
    if (!exists) {
      setReverseFocusMaterialId("");
    }
  }, [reverseFocusMaterialId, classifiedItemOptions]);

  useEffect(() => {
    if (!state) {
      return;
    }
    setSignalRuleEnabled(state.signalRule.enabled);
    setSignalLookbackDaysInput(String(state.signalRule.lookbackDays));
    setSignalThresholdPercentInput(String(Math.round(state.signalRule.dropBelowWeekdayAverageRatio * 10000) / 100));
  }, [state?.signalRule.enabled, state?.signalRule.lookbackDays, state?.signalRule.dropBelowWeekdayAverageRatio]);

  useEffect(() => {
    if (!selectedItemId) return;
    const latestMeta = latestPriceMetaByItemId.get(selectedItemId);
    const priceByMarket = selectedItemPriceMarket === "server" ? latestMeta?.server : latestMeta?.world;
    const price = priceByMarket?.price ?? latestMeta?.single?.price ?? 0;
    const inventory = inventoryByItemId.get(selectedItemId) ?? 0;
    setSelectedItemPrice(String(price));
    setSelectedItemInventory(String(inventory));
  }, [selectedItemId, selectedItemPriceMarket, latestPriceMetaByItemId, inventoryByItemId]);

  useEffect(() => {
    if (!hasState) return;
    void loadCraftOptions();
  }, [taxMode, hasState, loadCraftOptions]);

  useEffect(() => {
    const tradePreset = OCR_TRADE_BOARD_PRESETS[ocrTradePresetKey];
    if (!tradePreset) {
      return;
    }
    setOcrTradeRowCount(tradePreset.rowCount);
    setOcrTradeNamesX(tradePreset.namesX);
    setOcrTradeNamesY(tradePreset.namesY);
    setOcrTradeNamesWidth(tradePreset.namesWidth);
    setOcrTradeNamesHeight(tradePreset.namesHeight);
    setOcrTradePricesX(tradePreset.pricesX);
    setOcrTradePricesY(tradePreset.pricesY);
    setOcrTradePricesWidth(tradePreset.pricesWidth);
    setOcrTradePricesHeight(tradePreset.pricesHeight);
    setOcrTradePriceMode(tradePreset.priceMode);
    setOcrTradePriceColumn(tradePreset.priceColumn);
    setOcrTradeLeftPriceRole(tradePreset.leftPriceRole);
    setOcrTradeRightPriceRole(tradePreset.rightPriceRole);
  }, [ocrTradePresetKey]);

  useEffect(() => {
    if (!state) {
      return;
    }
    const validItemIdSet = new Set(classifiedItemOptions.map((entry) => entry.id));
    const sanitized = starItemIds.filter((itemId) => validItemIdSet.has(itemId));
    if (sanitized.length !== starItemIds.length) {
      setStarItemIds(sanitized);
    }
  }, [state, classifiedItemOptions, starItemIds]);

  useEffect(() => {
    if (!ocrAutoRunState?.enabled || !ocrAutoRunState.nextRunAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setOcrAutoRunNowMs(Date.now());
    }, 300);
    return () => {
      window.clearInterval(timer);
    };
  }, [ocrAutoRunState?.enabled, ocrAutoRunState?.nextRunAt]);
}
