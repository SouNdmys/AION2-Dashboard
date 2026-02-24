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
  formatDateTime,
  formatGold,
  formatMarketLabel,
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

  const historyMarketPanels = [
    {
      market: "server" as const,
      title: "伺服器交易所",
      result: historyServerResult,
      insight: historyServerInsight,
      colorClass: "text-cyan-200",
      borderClass: "border-cyan-300/20 bg-cyan-500/5",
    },
    {
      market: "world" as const,
      title: "世界交易所",
      result: historyWorldResult,
      insight: historyWorldInsight,
      colorClass: "text-emerald-200",
      borderClass: "border-emerald-300/20 bg-emerald-500/5",
    },
  ];

  if (!state) {
    return <WorkshopLoadingCard />;
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkshopOverviewHeader state={state} starCount={starItemIds.length} message={message} error={error} />

      <article className="order-1 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <h4 className="text-sm font-semibold">OCR抓价器</h4>
        <p className="mt-2 text-xs text-slate-300">保留热键自动截屏 + OCR 导入主流程，支持手动拖拽校准名称框与价格框。</p>
        <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-2 text-xs">
          <p className="text-cyan-200">快捷抓价（全局热键：自动截屏并完成 OCR 与导入）</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.5fr)]">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrCaptureDelayMs}
              onChange={(event) => setOcrCaptureDelayMs(event.target.value)}
              disabled={busy}
              placeholder="截屏延迟毫秒（建议 300~1000）"
            />
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrHideAppBeforeCapture ? "on" : "off"}
              onChange={(event) => setOcrHideAppBeforeCapture(event.target.value === "on")}
              disabled={busy}
            >
              <option value="on">截屏前自动隐藏程序</option>
              <option value="off">截屏前不隐藏程序</option>
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrSafeMode ? "on" : "off"}
              onChange={(event) => setOcrSafeMode(event.target.value === "on")}
              disabled={busy}
            >
              <option value="on">OCR 安全模式（CPU 优先）</option>
              <option value="off">OCR 性能模式（允许非 CPU）</option>
            </select>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">`1200` 表示按下热键后先等待 `1.2` 秒再截图；想提速可先试 `300~800`。</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrHotkeyShortcut}
              onChange={(event) => setOcrHotkeyShortcut(event.target.value)}
              disabled={busy}
              placeholder="快捷键（Windows 建议 Shift+F1）"
            />
            <button className="pill-btn" onClick={() => void onApplyOcrHotkeyConfig(true)} disabled={busy}>
              启用热键
            </button>
            <button className="pill-btn" onClick={() => void onApplyOcrHotkeyConfig(false)} disabled={busy}>
              关闭热键
            </button>
            <button className="task-btn px-4" onClick={() => void onTriggerOcrHotkeyNow()} disabled={busy}>
              立即抓取一次
            </button>
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
            <p className="text-[11px] text-cyan-200">自动巡航抓价（常驻轮询，适合你在交易行里持续滚动列表）</p>
            <p className="mt-1 text-[11px] text-slate-400">全局切换快捷键：`Shift+F2`（开始/暂停巡航）。</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.28fr)_minmax(0,0.24fr)_minmax(0,0.24fr)_auto_auto_auto]">
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrAutoRunIntervalSeconds}
                onChange={(event) => setOcrAutoRunIntervalSeconds(event.target.value)}
                disabled={busy}
                placeholder="抓取间隔秒（2~120）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrAutoRunFailLimit}
                onChange={(event) => setOcrAutoRunFailLimit(event.target.value)}
                disabled={busy}
                placeholder="连续失败暂停（1~10）"
              />
              <select
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrAutoRunOverlayEnabled ? "on" : "off"}
                onChange={(event) => setOcrAutoRunOverlayEnabled(event.target.value === "on")}
                disabled={busy}
              >
                <option value="on">浮窗状态条：开启</option>
                <option value="off">浮窗状态条：关闭</option>
              </select>
              <button
                className="pill-btn"
                onClick={() => void onConfigureOcrAutoRun(ocrAutoRunState?.enabled ?? false)}
                disabled={busy}
              >
                应用设置
              </button>
              <button className="pill-btn" onClick={() => void onConfigureOcrAutoRun(true)} disabled={busy}>
                开始巡航
              </button>
              <button className="pill-btn" onClick={() => void onConfigureOcrAutoRun(false)} disabled={busy}>
                停止巡航
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              <div className="data-pill">巡航: {ocrAutoRunState?.enabled ? (ocrAutoRunState.running ? "执行中" : "运行中") : "未启动"}</div>
              <div className="data-pill">间隔: {ocrAutoRunState?.intervalSeconds ?? "--"} s</div>
              <div className="data-pill">下一次: {ocrAutoRunCountdownSeconds === null ? "--" : `${ocrAutoRunCountdownSeconds}s`}</div>
              <div className="data-pill">浮窗: {ocrAutoRunState?.showOverlay ? "开" : "关"}</div>
              <div className="data-pill">轮次: {ocrAutoRunState?.loopCount ?? 0}</div>
              <div className="data-pill">成功: {ocrAutoRunState?.successCount ?? 0}</div>
              <div className="data-pill">失败: {ocrAutoRunState?.failureCount ?? 0}</div>
              <div className="data-pill">
                连败: {ocrAutoRunState?.consecutiveFailureCount ?? 0}/{ocrAutoRunState?.maxConsecutiveFailures ?? "--"}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="data-pill">巡航快捷键: {ocrAutoRunState?.toggleShortcut ?? "Shift+F2"}</div>
              <div className="data-pill">最近: {ocrAutoRunState?.lastResultAt ? formatDateTime(ocrAutoRunState.lastResultAt) : "--"}</div>
            </div>
            {ocrAutoRunState?.lastMessage ? <p className="mt-2 text-[11px] text-slate-300">{ocrAutoRunState.lastMessage}</p> : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-10">
            <div className="data-pill">状态: {ocrHotkeyState?.enabled ? (ocrHotkeyState.registered ? "已启用" : "注册失败") : "未启用"}</div>
            <div className="data-pill">快捷键: {ocrHotkeyState?.shortcut ?? "--"}</div>
            <div className="data-pill">延迟: {ocrCaptureDelayMs || "--"} ms</div>
            <div className="data-pill">OCR 模式: {ocrSafeMode ? "安全" : "性能"}</div>
            <div className="data-pill">
              上次识别:{" "}
              {ocrHotkeyLastResult?.expectedLineCount && ocrHotkeyLastResult.expectedLineCount > 0
                ? `${ocrHotkeyLastResult.extractedLineCount}/${ocrHotkeyLastResult.expectedLineCount}`
                : (ocrHotkeyLastResult?.extractedLineCount ?? 0)}
            </div>
            <div className="data-pill">上次导入: {ocrHotkeyLastResult?.importedCount ?? 0}</div>
            <div className="data-pill">去重跳过: {ocrHotkeyLastResult?.duplicateSkippedCount ?? 0}</div>
            <div className="data-pill">未匹配: {ocrHotkeyLastResult?.unknownItemCount ?? 0}</div>
            <div className="data-pill">异常行: {ocrHotkeyLastResult?.invalidLineCount ?? 0}</div>
            <div className="data-pill">警告: {ocrHotkeyLastResult?.warnings.length ?? 0}</div>
          </div>
          {ocrHotkeyLastResult ? (
            <p className={`mt-2 ${ocrHotkeyLastResult.success ? "text-emerald-300" : "text-rose-300"}`}>{ocrHotkeyLastResult.message}</p>
          ) : null}
          {ocrHotkeyLastResult && ocrHotkeyLastResult.warnings.length > 0 ? (
            <details className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
              <summary className="cursor-pointer text-[11px] text-cyan-300">查看快捷抓价警告（调试）</summary>
              <div className="mt-2 max-h-32 overflow-auto text-[11px]">
                {ocrHotkeyLastResult.warnings.slice(0, 30).map((line, index) => (
                  <p key={`ocr-hotkey-warning-${index}`}>{line}</p>
                ))}
              </div>
            </details>
          ) : null}
          {ocrHotkeyLastResult && ocrHotkeyLastResult.importedEntries.length > 0 ? (
            <details className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300" open>
              <summary className="cursor-pointer text-[11px] text-cyan-300">查看本次抓价明细（物品/价格）</summary>
              <div className="mt-2 max-h-44 overflow-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-2 py-1">行</th>
                      <th className="px-2 py-1">物品</th>
                      <th className="px-2 py-1">价格</th>
                      <th className="px-2 py-1">市场</th>
                      <th className="px-2 py-1">时间</th>
                      <th className="px-2 py-1">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocrHotkeyLastResult.importedEntries.map((entry, index) => (
                      <tr key={`ocr-hotkey-entry-${entry.itemId}-${entry.lineNumber}-${index}`} className="border-t border-white/10">
                        <td className="px-2 py-1">{entry.lineNumber}</td>
                        <td className="px-2 py-1">{entry.itemName}</td>
                        <td className="px-2 py-1">{formatGold(entry.unitPrice)}</td>
                        <td className="px-2 py-1">{formatMarketLabel(entry.market)}</td>
                        <td className="px-2 py-1">{formatDateTime(entry.capturedAt)}</td>
                        <td className={`px-2 py-1 ${entry.createdItem ? "text-amber-300" : "text-slate-300"}`}>
                          {entry.createdItem ? "新增物品" : "已存在物品"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2">
          <p className="text-[11px] text-slate-300">可视化校准：拖拽可重画大小；在框内拖动可平移；可见行数可自动识别（适配不同游戏 UI 大小）。</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradePresetKey}
              onChange={(event) => setOcrTradePresetKey(event.target.value as OcrTradePresetKey)}
              disabled={busy}
            >
              <option value="trade_1080p">交易行预设: 1080p</option>
              <option value="trade_1440p">交易行预设: 1440p（默认）</option>
              <option value="custom">交易行预设: 自定义</option>
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrCalibrationTarget}
              onChange={(event) => setOcrCalibrationTarget(event.target.value as "names" | "prices")}
              disabled={busy}
            >
              <option value="names">拖拽校准目标: 名称框</option>
              <option value="prices">拖拽校准目标: 价格框</option>
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeRowCount}
              onChange={(event) => setOcrTradeRowCount(event.target.value)}
              disabled={busy}
            >
              <option value="0">可见行数: 自动识别（推荐）</option>
              <option value="6">可见行数: 6</option>
              <option value="7">可见行数: 7</option>
              <option value="8">可见行数: 8</option>
              <option value="9">可见行数: 9</option>
              <option value="10">可见行数: 10</option>
            </select>
            <button className="pill-btn" onClick={() => void onCaptureOcrScreenPreview()} disabled={busy}>
              捕获校准图
            </button>
          </div>
          {ocrScreenPreview ? (
            <div className="mt-2 overflow-auto rounded-lg border border-white/10 bg-black/20 p-2">
              <div
                className="relative"
                style={{
                  width: `${ocrScreenPreview.width}px`,
                  height: `${ocrScreenPreview.height}px`,
                }}
                onMouseDown={onPreviewMouseDown}
                onMouseMove={onPreviewMouseMove}
                onMouseUp={onPreviewMouseUp}
                onMouseLeave={onPreviewMouseUp}
              >
                <img
                  src={ocrScreenPreview.dataUrl}
                  alt="ocr-screen-preview"
                  className="absolute left-0 top-0 h-full w-full object-contain"
                />
                {ocrTradeNamesRect ? (
                  <div
                    className="absolute border-2 border-cyan-300"
                    style={{
                      left: `${ocrTradeNamesRect.x}px`,
                      top: `${ocrTradeNamesRect.y}px`,
                      width: `${ocrTradeNamesRect.width}px`,
                      height: `${ocrTradeNamesRect.height}px`,
                    }}
                  />
                ) : null}
                {ocrTradePricesRect ? (
                  <div
                    className="absolute border-2 border-amber-300"
                    style={{
                      left: `${ocrTradePricesRect.x}px`,
                      top: `${ocrTradePricesRect.y}px`,
                      width: `${ocrTradePricesRect.width}px`,
                      height: `${ocrTradePricesRect.height}px`,
                    }}
                  />
                ) : null}
                {ocrDragRect ? (
                  <div
                    className="absolute border-2 border-dashed border-fuchsia-300"
                    style={{
                      left: `${ocrDragRect.x}px`,
                      top: `${ocrDragRect.y}px`,
                      width: `${ocrDragRect.width}px`,
                      height: `${ocrDragRect.height}px`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </article>

      <WorkshopMarketAnalysisPanel
        busy={busy}
        historyMainCategory={historyMainCategory}
        setHistoryMainCategory={setHistoryMainCategory}
        historyMainCategoryOptions={historyMainCategoryOptions}
        historySubCategory={historySubCategory}
        setHistorySubCategory={setHistorySubCategory}
        historySubCategoryOptions={historySubCategoryOptions}
        historyKeyword={historyKeyword}
        setHistoryKeyword={setHistoryKeyword}
        historyItemId={historyItemId}
        setHistoryItemId={setHistoryItemId}
        filteredHistoryItems={filteredHistoryItems}
        historyDaysInput={historyDaysInput}
        setHistoryDaysInput={setHistoryDaysInput}
        onJumpHistoryManagerForCurrentItem={onJumpHistoryManagerForCurrentItem}
        onToggleStarItem={onToggleStarItem}
        isStarredItem={isStarredItem}
        focusStarOnly={focusStarOnly}
        setFocusStarOnly={setFocusStarOnly}
        starredHistoryItems={starredHistoryItems}
        onViewHistoryCurveForItem={onViewHistoryCurveForItem}
        historyIncludeSuspect={historyIncludeSuspect}
        setHistoryIncludeSuspect={setHistoryIncludeSuspect}
        activeHistoryQuickDays={activeHistoryQuickDays}
        recentOcrImportedEntries={recentOcrImportedEntries}
        historyChartAnchorRef={historyChartAnchorRef}
        historyLoading={historyLoading}
        historyHasLoaded={historyHasLoaded}
        historyServerResult={historyServerResult}
        historyWorldResult={historyWorldResult}
        historyMarketPanels={historyMarketPanels}
        dualHistoryChartModel={dualHistoryChartModel}
        onJumpHistoryManagerForSnapshot={onJumpHistoryManagerForSnapshot}
        signalRuleEnabled={signalRuleEnabled}
        setSignalRuleEnabled={setSignalRuleEnabled}
        signalLookbackDaysInput={signalLookbackDaysInput}
        setSignalLookbackDaysInput={setSignalLookbackDaysInput}
        signalThresholdPercentInput={signalThresholdPercentInput}
        setSignalThresholdPercentInput={setSignalThresholdPercentInput}
        onSaveSignalRule={onSaveSignalRule}
        onRefreshSignals={onRefreshSignals}
        signalResult={signalResult}
        triggeredSignalRows={triggeredSignalRows}
        buyZoneRows={buyZoneRows}
        sellZoneRows={sellZoneRows}
      />
      <WorkshopSimulationPanel
        busy={busy}
        simulation={simulation}
        onApplySimulationMaterialEdits={onApplySimulationMaterialEdits}
        simulateMainCategory={simulateMainCategory}
        setSimulateMainCategory={setSimulateMainCategory}
        simulationMainCategoryOptions={simulationMainCategoryOptions}
        simulateSubCategory={simulateSubCategory}
        setSimulateSubCategory={setSimulateSubCategory}
        simulationSubCategoryOptions={simulationSubCategoryOptions}
        simulateRecipeId={simulateRecipeId}
        setSimulateRecipeId={setSimulateRecipeId}
        filteredSimulationRecipes={filteredSimulationRecipes}
        simulateRuns={simulateRuns}
        setSimulateRuns={setSimulateRuns}
        simulationOutputPriceDraft={simulationOutputPriceDraft}
        setSimulationOutputPriceDraft={setSimulationOutputPriceDraft}
        taxMode={taxMode}
        setTaxMode={setTaxMode}
        onSimulate={onSimulate}
        resolveItemName={(itemId) => itemById.get(itemId)?.name ?? itemId}
        simulationMaterialDraft={simulationMaterialDraft}
        setSimulationMaterialDraft={setSimulationMaterialDraft}
      />
      <WorkshopInventoryPanel
        busy={busy}
        loadCraftOptions={loadCraftOptions}
        itemKeyword={itemKeyword}
        setItemKeyword={setItemKeyword}
        itemMainCategory={itemMainCategory}
        setItemMainCategory={setItemMainCategory}
        itemMainCategoryOptions={itemMainCategoryOptions}
        itemSubCategory={itemSubCategory}
        setItemSubCategory={setItemSubCategory}
        itemSubCategoryOptions={itemSubCategoryOptions}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        filteredItems={filteredItems}
        selectedItemPriceMarket={selectedItemPriceMarket}
        setSelectedItemPriceMarket={setSelectedItemPriceMarket}
        selectedItemPrice={selectedItemPrice}
        setSelectedItemPrice={setSelectedItemPrice}
        selectedItemInventory={selectedItemInventory}
        setSelectedItemInventory={setSelectedItemInventory}
        onSaveSelectedPrice={onSaveSelectedPrice}
        onSaveSelectedInventory={onSaveSelectedInventory}
        latestPriceMetaByItemId={latestPriceMetaByItemId}
        inventoryByItemId={inventoryByItemId}
        onPickItemForCorrection={onPickItemForCorrection}
        reverseMaterialKeyword={reverseMaterialKeyword}
        setReverseMaterialKeyword={setReverseMaterialKeyword}
        reverseFocusMaterialId={reverseFocusMaterialId}
        setReverseFocusMaterialId={setReverseFocusMaterialId}
        reverseMaterialOptions={reverseMaterialOptions}
        reverseCraftBudgetInput={reverseCraftBudgetInput}
        setReverseCraftBudgetInput={setReverseCraftBudgetInput}
        reverseScoreMode={reverseScoreMode}
        setReverseScoreMode={setReverseScoreMode}
        reverseFocusMaterialName={reverseFocusMaterialName}
        reverseCraftBudget={reverseCraftBudget}
        reverseScoreModeLabel={reverseScoreModeLabel}
        craftOptions={craftOptions}
        reverseCraftSuggestions={reverseCraftSuggestions}
        isStarredItem={isStarredItem}
        onToggleStarItem={onToggleStarItem}
        onViewHistoryCurveForItem={onViewHistoryCurveForItem}
        onJumpSimulationRecipe={onJumpSimulationRecipe}
      />
    </div>
  );
}

