import { useRef, useState } from "react";
import { useWorkshopActions } from "./features/workshop/actions/useWorkshopActions";
import { createWorkshopHistoryHandlers } from "./features/workshop/actions/createWorkshopHistoryHandlers";
import { createWorkshopSimulationHandlers } from "./features/workshop/actions/createWorkshopSimulationHandlers";
import { createWorkshopCorrectionHandlers } from "./features/workshop/actions/createWorkshopCorrectionHandlers";
import { createWorkshopOcrConfigHandlers } from "./features/workshop/actions/createWorkshopOcrConfigHandlers";
import { createWorkshopSignalHandlers } from "./features/workshop/actions/createWorkshopSignalHandlers";
import { useWorkshopLifecycle } from "./features/workshop/hooks/useWorkshopLifecycle";
import { useWorkshopHistoryLoader } from "./features/workshop/hooks/useWorkshopHistoryLoader";
import { useWorkshopViewSyncEffects } from "./features/workshop/hooks/useWorkshopViewSyncEffects";
import { useWorkshopSimulationModels } from "./features/workshop/hooks/useWorkshopSimulationModels";
import { useWorkshopEconomyModels } from "./features/workshop/hooks/useWorkshopEconomyModels";
import { useWorkshopInsightModels } from "./features/workshop/hooks/useWorkshopInsightModels";
import { useWorkshopOcrDisplayModels } from "./features/workshop/hooks/useWorkshopOcrDisplayModels";
import { useWorkshopOcrPreviewModels } from "./features/workshop/hooks/useWorkshopOcrPreviewModels";
import { useWorkshopCatalogModels } from "./features/workshop/hooks/useWorkshopCatalogModels";
import { useWorkshopCommitRunner } from "./features/workshop/hooks/useWorkshopCommitRunner";
import {
  type ReverseScoreMode,
} from "./features/workshop/workshop-view-helpers";
import {
  DEFAULT_TRADE_BOARD_PRESET,
  OCR_AUTO_FAIL_LIMIT_STORAGE_KEY,
  OCR_AUTO_INTERVAL_STORAGE_KEY,
  OCR_AUTO_OVERLAY_STORAGE_KEY,
  OCR_CAPTURE_DELAY_STORAGE_KEY,
  OCR_HIDE_APP_STORAGE_KEY,
  OCR_SAFE_MODE_STORAGE_KEY,
  OCR_TRADE_PRESET_STORAGE_KEY,
  WORKSHOP_STAR_ITEM_IDS_STORAGE_KEY,
  type OcrTradePresetKey,
  readStoredAutoRunFailLimit,
  readStoredAutoRunIntervalSeconds,
  readStoredAutoRunOverlayEnabled,
  readStoredCaptureDelayMs,
  readStoredHideAppBeforeCapture,
  readStoredOcrSafeMode,
  readStoredTradePreset,
  readStoredWorkshopStarItemIds,
  serializeBooleanFlag,
  serializeRawString,
  serializeStringArray,
} from "./features/workshop/workshop-persistence";
import { WorkshopLoadingCard, WorkshopOverviewHeader } from "./features/workshop/views/WorkshopOverviewHeader";
import { WorkshopMarketAnalysisPanel } from "./features/workshop/views/WorkshopMarketAnalysisPanel";
import { WorkshopSimulationPanel } from "./features/workshop/views/WorkshopSimulationPanel";
import { WorkshopInventoryPanel } from "./features/workshop/views/WorkshopInventoryPanel";
import { WorkshopOcrPanel } from "./features/workshop/views/WorkshopOcrPanel";
import { buildWorkshopPanelProps } from "./features/workshop/views/buildWorkshopPanelProps";
import { usePersistedState } from "./hooks/usePersistedState";
import type {
  WorkshopCraftOption,
  WorkshopCraftSimulationResult,
  WorkshopOcrAutoRunState,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalResult,
  WorkshopScreenPreviewResult,
  WorkshopState,
} from "../../shared/types";
interface WorkshopViewProps {
  onJumpToHistoryManager?: (payload: { itemId: string; snapshotId?: string }) => void;
  externalPriceChangeNonce?: number;
}

export function WorkshopView(props: WorkshopViewProps = {}): JSX.Element {
  const { onJumpToHistoryManager, externalPriceChangeNonce = 0 } = props;
  const workshopActions = useWorkshopActions();
  const [state, setState] = useState<WorkshopState | null>(null);
  const [craftOptions, setCraftOptions] = useState<WorkshopCraftOption[]>([]);
  const [simulation, setSimulation] = useState<WorkshopCraftSimulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [itemMainCategory, setItemMainCategory] = useState("鐵匠");
  const [itemSubCategory, setItemSubCategory] = useState<"all" | string>("all");
  const [itemKeyword, setItemKeyword] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemPriceMarket, setSelectedItemPriceMarket] = useState<"server" | "world">("server");
  const [selectedItemPrice, setSelectedItemPrice] = useState("0");
  const [selectedItemInventory, setSelectedItemInventory] = useState("0");

  const [simulateRecipeId, setSimulateRecipeId] = useState("");
  const [simulateMainCategory, setSimulateMainCategory] = useState("鐵匠");
  const [simulateSubCategory, setSimulateSubCategory] = useState<"all" | string>("all");
  const [simulateRuns, setSimulateRuns] = useState("1");
  const [taxMode, setTaxMode] = useState<"0.1" | "0.2">("0.1");
  const [reverseCraftBudgetInput, setReverseCraftBudgetInput] = useState("50000");
  const [reverseMaterialKeyword, setReverseMaterialKeyword] = useState("");
  const [reverseFocusMaterialId, setReverseFocusMaterialId] = useState("");
  const [reverseScoreMode, setReverseScoreMode] = useState<ReverseScoreMode>("balanced");
  const [historyItemId, setHistoryItemId] = useState("");
  const [historyMainCategory, setHistoryMainCategory] = useState("鐵匠");
  const [historySubCategory, setHistorySubCategory] = useState<"all" | string>("all");
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyDaysInput, setHistoryDaysInput] = useState("30");
  const [historyIncludeSuspect, setHistoryIncludeSuspect] = useState(false);
  const [historyServerResult, setHistoryServerResult] = useState<WorkshopPriceHistoryResult | null>(null);
  const [historyWorldResult, setHistoryWorldResult] = useState<WorkshopPriceHistoryResult | null>(null);
  const [historyHasLoaded, setHistoryHasLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [starItemIds, setStarItemIds] = usePersistedState<string[]>(
    WORKSHOP_STAR_ITEM_IDS_STORAGE_KEY,
    () => readStoredWorkshopStarItemIds(),
    serializeStringArray,
  );
  const [focusStarOnly, setFocusStarOnly] = useState(false);
  const [signalRuleEnabled, setSignalRuleEnabled] = useState(true);
  const [signalLookbackDaysInput, setSignalLookbackDaysInput] = useState("30");
  const [signalThresholdPercentInput, setSignalThresholdPercentInput] = useState("15");
  const [signalResult, setSignalResult] = useState<WorkshopPriceSignalResult | null>(null);
  const [ocrHotkeyShortcut, setOcrHotkeyShortcut] = useState(
    navigator.userAgent.includes("Windows") ? "Shift+F1" : "CommandOrControl+Shift+F1",
  );
  const [ocrHotkeyState, setOcrHotkeyState] = useState<WorkshopOcrHotkeyState | null>(null);
  const [ocrHotkeyLastResult, setOcrHotkeyLastResult] = useState<WorkshopOcrHotkeyRunResult | null>(null);
  const [ocrAutoRunState, setOcrAutoRunState] = useState<WorkshopOcrAutoRunState | null>(null);
  const [ocrAutoRunIntervalSeconds, setOcrAutoRunIntervalSeconds] = usePersistedState(
    OCR_AUTO_INTERVAL_STORAGE_KEY,
    () => readStoredAutoRunIntervalSeconds(),
    serializeRawString,
  );
  const [ocrAutoRunOverlayEnabled, setOcrAutoRunOverlayEnabled] = usePersistedState(
    OCR_AUTO_OVERLAY_STORAGE_KEY,
    () => readStoredAutoRunOverlayEnabled(),
    serializeBooleanFlag,
  );
  const [ocrAutoRunFailLimit, setOcrAutoRunFailLimit] = usePersistedState(
    OCR_AUTO_FAIL_LIMIT_STORAGE_KEY,
    () => readStoredAutoRunFailLimit(),
    serializeRawString,
  );
  const [ocrAutoRunNowMs, setOcrAutoRunNowMs] = useState(Date.now());
  const [ocrScreenPreview, setOcrScreenPreview] = useState<WorkshopScreenPreviewResult | null>(null);
  const [ocrCaptureDelayMs, setOcrCaptureDelayMs] = usePersistedState(
    OCR_CAPTURE_DELAY_STORAGE_KEY,
    () => readStoredCaptureDelayMs(),
    serializeRawString,
  );
  const [ocrHideAppBeforeCapture, setOcrHideAppBeforeCapture] = usePersistedState(
    OCR_HIDE_APP_STORAGE_KEY,
    () => readStoredHideAppBeforeCapture(),
    serializeBooleanFlag,
  );
  const [ocrSafeMode, setOcrSafeMode] = usePersistedState(
    OCR_SAFE_MODE_STORAGE_KEY,
    () => readStoredOcrSafeMode(),
    serializeBooleanFlag,
  );
  const [ocrTradePresetKey, setOcrTradePresetKey] = usePersistedState<OcrTradePresetKey>(
    OCR_TRADE_PRESET_STORAGE_KEY,
    () => readStoredTradePreset(),
    serializeRawString,
  );
  const [ocrTradeRowCount, setOcrTradeRowCount] = useState(DEFAULT_TRADE_BOARD_PRESET.rowCount);
  const [ocrTradeNamesX, setOcrTradeNamesX] = useState(DEFAULT_TRADE_BOARD_PRESET.namesX);
  const [ocrTradeNamesY, setOcrTradeNamesY] = useState(DEFAULT_TRADE_BOARD_PRESET.namesY);
  const [ocrTradeNamesWidth, setOcrTradeNamesWidth] = useState(DEFAULT_TRADE_BOARD_PRESET.namesWidth);
  const [ocrTradeNamesHeight, setOcrTradeNamesHeight] = useState(DEFAULT_TRADE_BOARD_PRESET.namesHeight);
  const [ocrTradePricesX, setOcrTradePricesX] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesX);
  const [ocrTradePricesY, setOcrTradePricesY] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesY);
  const [ocrTradePricesWidth, setOcrTradePricesWidth] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesWidth);
  const [ocrTradePricesHeight, setOcrTradePricesHeight] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesHeight);
  const [ocrTradePriceMode, setOcrTradePriceMode] = useState<"single" | "dual">(DEFAULT_TRADE_BOARD_PRESET.priceMode);
  const [ocrTradePriceColumn, setOcrTradePriceColumn] = useState<"left" | "right">(DEFAULT_TRADE_BOARD_PRESET.priceColumn);
  const [ocrTradeLeftPriceRole, setOcrTradeLeftPriceRole] = useState<"server" | "world">(DEFAULT_TRADE_BOARD_PRESET.leftPriceRole);
  const [ocrTradeRightPriceRole, setOcrTradeRightPriceRole] = useState<"server" | "world">(DEFAULT_TRADE_BOARD_PRESET.rightPriceRole);
  const [ocrCalibrationTarget, setOcrCalibrationTarget] = useState<"names" | "prices">("names");
  const [ocrDragStart, setOcrDragStart] = useState<{ x: number; y: number } | null>(null);
  const [ocrDragMode, setOcrDragMode] = useState<"draw" | "move" | null>(null);
  const [ocrDragOffset, setOcrDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [ocrDragRect, setOcrDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [simulationMaterialDraft, setSimulationMaterialDraft] = useState<Record<string, { unitPrice: string; owned: string }>>({});
  const [simulationOutputPriceDraft, setSimulationOutputPriceDraft] = useState("");
  const historyChartAnchorRef = useRef<HTMLDivElement | null>(null);

  const taxRate = Number(taxMode);
  const {
    starItemIdSet,
    itemById,
    classifiedItemOptions,
    starredHistoryItems,
    itemMainCategoryOptions,
    filteredItems,
    itemSubCategoryOptions,
    historyMainCategoryOptions,
    filteredHistoryItems,
    historySubCategoryOptions,
  } = useWorkshopCatalogModels({
    state,
    starItemIds,
    itemMainCategory,
    itemSubCategory,
    itemKeyword,
    historyMainCategory,
    historySubCategory,
    historyKeyword,
    focusStarOnly,
  });

  const { simulationRecipeOptions, simulationMainCategoryOptions, filteredSimulationRecipes, simulationSubCategoryOptions } =
    useWorkshopSimulationModels({
      state,
      itemById,
      simulateMainCategory,
      simulateSubCategory,
    });

  const {
    latestPriceMetaByItemId,
    inventoryByItemId,
    reverseCraftBudget,
    reverseMaterialOptions,
    reverseFocusMaterialName,
    reverseScoreModeLabel,
    reverseCraftSuggestions,
  } = useWorkshopEconomyModels({
    state,
    craftOptions,
    itemById,
    classifiedItemOptions,
    reverseCraftBudgetInput,
    reverseMaterialKeyword,
    reverseFocusMaterialId,
    reverseScoreMode,
  });
  const {
    activeHistoryQuickDays,
    historyServerInsight,
    historyWorldInsight,
    triggeredSignalRows,
    buyZoneRows,
    sellZoneRows,
    dualHistoryChartModel,
  } = useWorkshopInsightModels({
    historyDaysInput,
    historyServerResult,
    historyWorldResult,
    signalResult,
    focusStarOnly,
    starItemIdSet,
  });
  const { recentOcrImportedEntries, ocrAutoRunCountdownSeconds } = useWorkshopOcrDisplayModels({
    ocrHotkeyLastResult,
    ocrAutoRunState,
    ocrAutoRunNowMs,
  });

  const { ocrTradeNamesRect, ocrTradePricesRect, onPreviewMouseDown, onPreviewMouseMove, onPreviewMouseUp } =
    useWorkshopOcrPreviewModels({
      ocrTradePresetKey,
      ocrCalibrationTarget,
      ocrTradeNamesX,
      ocrTradeNamesY,
      ocrTradeNamesWidth,
      ocrTradeNamesHeight,
      ocrTradePricesX,
      ocrTradePricesY,
      ocrTradePricesWidth,
      ocrTradePricesHeight,
      ocrDragMode,
      ocrDragOffset,
      ocrDragStart,
      ocrDragRect,
      ocrScreenPreview,
      setOcrTradePresetKey,
      setOcrTradeNamesX,
      setOcrTradeNamesY,
      setOcrTradeNamesWidth,
      setOcrTradeNamesHeight,
      setOcrTradePricesX,
      setOcrTradePricesY,
      setOcrTradePricesWidth,
      setOcrTradePricesHeight,
      setOcrDragMode,
      setOcrDragOffset,
      setOcrDragStart,
      setOcrDragRect,
    });
  const { loadState, loadCraftOptions, loadSignals } = useWorkshopLifecycle({
    workshopActions,
    taxRate,
    setState,
    setCraftOptions,
    setSignalResult,
    setBusy,
    setError,
    setMessage,
    setOcrHotkeyState,
    setOcrHotkeyShortcut,
    setOcrHotkeyLastResult,
    setOcrAutoRunState,
    setOcrAutoRunIntervalSeconds,
    setOcrAutoRunOverlayEnabled,
    setOcrAutoRunFailLimit,
  });
  const { commit } = useWorkshopCommitRunner({
    setBusy,
    setError,
    setMessage,
    setState,
    loadCraftOptions,
    loadSignals,
  });

  useWorkshopViewSyncEffects({
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
  });

  const { onLoadPriceHistory } = useWorkshopHistoryLoader({
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
  });

  function isStarredItem(itemId: string): boolean {
    return starItemIdSet.has(itemId);
  }

  const {
    onToggleStarItem,
    onJumpHistoryManagerForCurrentItem,
    onJumpHistoryManagerForSnapshot,
    onViewHistoryCurveForItem,
  } = createWorkshopHistoryHandlers({
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
  });
  const { onJumpSimulationRecipe, onSimulate, onApplySimulationMaterialEdits } = createWorkshopSimulationHandlers({
    simulateRecipeId,
    simulateRuns,
    taxRate,
    simulation,
    simulationRecipeOptions,
    simulationMaterialDraft,
    simulationOutputPriceDraft,
    workshopActions,
    setBusy,
    setError,
    setMessage,
    setState,
    setSimulation,
    setSimulationMaterialDraft,
    setSimulationOutputPriceDraft,
    setSimulateMainCategory,
    setSimulateSubCategory,
    setSimulateRecipeId,
    loadCraftOptions,
    loadSignals,
  });
  const { onSaveSelectedPrice, onSaveSelectedInventory, onPickItemForCorrection } = createWorkshopCorrectionHandlers({
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
  });
  const { onApplyOcrHotkeyConfig, onTriggerOcrHotkeyNow, onCaptureOcrScreenPreview, onConfigureOcrAutoRun } =
    createWorkshopOcrConfigHandlers({
      ocrTradeRowCount,
      ocrTradeNamesX,
      ocrTradeNamesY,
      ocrTradeNamesWidth,
      ocrTradeNamesHeight,
      ocrTradePricesX,
      ocrTradePricesY,
      ocrTradePricesWidth,
      ocrTradePricesHeight,
      ocrTradePriceMode,
      ocrTradePriceColumn,
      ocrTradeLeftPriceRole,
      ocrTradeRightPriceRole,
      ocrHotkeyShortcut,
      ocrSafeMode,
      ocrCaptureDelayMs,
      ocrHideAppBeforeCapture,
      ocrAutoRunIntervalSeconds,
      ocrAutoRunFailLimit,
      ocrAutoRunOverlayEnabled,
      workshopActions,
      loadState,
      loadCraftOptions,
      loadSignals,
      setBusy,
      setError,
      setMessage,
      setOcrHotkeyState,
      setOcrHotkeyShortcut,
      setOcrSafeMode,
      setOcrHotkeyLastResult,
      setOcrScreenPreview,
      setOcrAutoRunState,
      setOcrAutoRunIntervalSeconds,
      setOcrAutoRunOverlayEnabled,
      setOcrAutoRunFailLimit,
    });
  const { onSaveSignalRule, onRefreshSignals } = createWorkshopSignalHandlers({
    signalLookbackDaysInput,
    signalThresholdPercentInput,
    signalRuleEnabled,
    workshopActions,
    commit,
    loadSignals,
    setBusy,
    setError,
    setMessage,
  });

  if (!state) {
    return <WorkshopLoadingCard />;
  }

  const { ocrPanelProps, marketAnalysisPanelProps, simulationPanelProps, inventoryPanelProps } = buildWorkshopPanelProps({
    busy,
    ocrPanelProps: {
      ocrCaptureDelayMs,
      setOcrCaptureDelayMs,
      ocrHideAppBeforeCapture,
      setOcrHideAppBeforeCapture,
      ocrSafeMode,
      setOcrSafeMode,
      ocrHotkeyShortcut,
      setOcrHotkeyShortcut,
      onApplyOcrHotkeyConfig,
      onTriggerOcrHotkeyNow,
      ocrAutoRunIntervalSeconds,
      setOcrAutoRunIntervalSeconds,
      ocrAutoRunFailLimit,
      setOcrAutoRunFailLimit,
      ocrAutoRunOverlayEnabled,
      setOcrAutoRunOverlayEnabled,
      onConfigureOcrAutoRun,
      ocrAutoRunState,
      ocrAutoRunCountdownSeconds,
      ocrHotkeyState,
      ocrHotkeyLastResult,
      ocrTradePresetKey,
      setOcrTradePresetKey,
      ocrCalibrationTarget,
      setOcrCalibrationTarget,
      ocrTradeRowCount,
      setOcrTradeRowCount,
      onCaptureOcrScreenPreview,
      ocrScreenPreview,
      onPreviewMouseDown,
      onPreviewMouseMove,
      onPreviewMouseUp,
      ocrTradeNamesRect,
      ocrTradePricesRect,
      ocrDragRect,
    },
    marketAnalysisPanelProps: {
      historyMainCategory,
      setHistoryMainCategory,
      historyMainCategoryOptions,
      historySubCategory,
      setHistorySubCategory,
      historySubCategoryOptions,
      historyKeyword,
      setHistoryKeyword,
      historyItemId,
      setHistoryItemId,
      filteredHistoryItems,
      historyDaysInput,
      setHistoryDaysInput,
      onJumpHistoryManagerForCurrentItem,
      onToggleStarItem,
      isStarredItem,
      focusStarOnly,
      setFocusStarOnly,
      starredHistoryItems,
      onViewHistoryCurveForItem,
      historyIncludeSuspect,
      setHistoryIncludeSuspect,
      activeHistoryQuickDays,
      recentOcrImportedEntries,
      historyChartAnchorRef,
      historyLoading,
      historyHasLoaded,
      historyServerResult,
      historyWorldResult,
      dualHistoryChartModel,
      onJumpHistoryManagerForSnapshot,
      historyServerInsight,
      historyWorldInsight,
      signalRuleEnabled,
      setSignalRuleEnabled,
      signalLookbackDaysInput,
      setSignalLookbackDaysInput,
      signalThresholdPercentInput,
      setSignalThresholdPercentInput,
      onSaveSignalRule,
      onRefreshSignals,
      signalResult,
      triggeredSignalRows,
      buyZoneRows,
      sellZoneRows,
    },
    simulationPanelProps: {
      simulation,
      onApplySimulationMaterialEdits,
      simulateMainCategory,
      setSimulateMainCategory,
      simulationMainCategoryOptions,
      simulateSubCategory,
      setSimulateSubCategory,
      simulationSubCategoryOptions,
      simulateRecipeId,
      setSimulateRecipeId,
      filteredSimulationRecipes,
      simulateRuns,
      setSimulateRuns,
      simulationOutputPriceDraft,
      setSimulationOutputPriceDraft,
      taxMode,
      setTaxMode,
      onSimulate,
      resolveItemName: (itemId) => itemById.get(itemId)?.name ?? itemId,
      simulationMaterialDraft,
      setSimulationMaterialDraft,
    },
    inventoryPanelProps: {
      loadCraftOptions,
      itemKeyword,
      setItemKeyword,
      itemMainCategory,
      setItemMainCategory,
      itemMainCategoryOptions,
      itemSubCategory,
      setItemSubCategory,
      itemSubCategoryOptions,
      selectedItemId,
      setSelectedItemId,
      filteredItems,
      selectedItemPriceMarket,
      setSelectedItemPriceMarket,
      selectedItemPrice,
      setSelectedItemPrice,
      selectedItemInventory,
      setSelectedItemInventory,
      onSaveSelectedPrice,
      onSaveSelectedInventory,
      latestPriceMetaByItemId,
      inventoryByItemId,
      onPickItemForCorrection,
      reverseMaterialKeyword,
      setReverseMaterialKeyword,
      reverseFocusMaterialId,
      setReverseFocusMaterialId,
      reverseMaterialOptions,
      reverseCraftBudgetInput,
      setReverseCraftBudgetInput,
      reverseScoreMode,
      setReverseScoreMode,
      reverseFocusMaterialName,
      reverseCraftBudget,
      reverseScoreModeLabel,
      craftOptions,
      reverseCraftSuggestions,
      isStarredItem,
      onToggleStarItem,
      onViewHistoryCurveForItem,
      onJumpSimulationRecipe,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <WorkshopOverviewHeader state={state} starCount={starItemIds.length} message={message} error={error} />

      <WorkshopOcrPanel {...ocrPanelProps} />
      <WorkshopMarketAnalysisPanel {...marketAnalysisPanelProps} />
      <WorkshopSimulationPanel {...simulationPanelProps} />
      <WorkshopInventoryPanel {...inventoryPanelProps} />
    </div>
  );
}

