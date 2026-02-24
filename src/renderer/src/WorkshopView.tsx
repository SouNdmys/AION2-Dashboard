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
  toPercent,
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
      <article className="order-3 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">做装模拟器</h4>
          {simulation ? (
            <button className="pill-btn" onClick={() => void onApplySimulationMaterialEdits()} disabled={busy}>
              保存成品/材料价格与库存并重算
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateMainCategory}
            onChange={(event) => setSimulateMainCategory(event.target.value)}
            disabled={busy || simulationMainCategoryOptions.length === 0}
          >
            {simulationMainCategoryOptions.map((category) => (
              <option key={`sim-main-category-${category}`} value={category}>
                大类: {category}
              </option>
            ))}
          </select>
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateSubCategory}
            onChange={(event) => setSimulateSubCategory(event.target.value)}
            disabled={busy}
          >
            <option value="all">下级分类: 全部</option>
            {simulationSubCategoryOptions.map((category) => (
              <option key={`sim-sub-category-${category}`} value={category}>
                下级分类: {category}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_auto]">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateRecipeId}
            onChange={(event) => setSimulateRecipeId(event.target.value)}
            disabled={busy || filteredSimulationRecipes.length === 0}
          >
            {filteredSimulationRecipes.map((recipe) => (
              <option key={`sim-recipe-${recipe.id}`} value={recipe.id}>
                [{recipe.subCategory}] {recipe.outputName}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateRuns}
            onChange={(event) => setSimulateRuns(event.target.value)}
            disabled={busy}
            placeholder="制作次数"
          />
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulationOutputPriceDraft}
            onChange={(event) => setSimulationOutputPriceDraft(event.target.value)}
            disabled={busy || !simulation}
            placeholder="成品售价(可改)"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={taxMode}
            onChange={(event) => setTaxMode(event.target.value as "0.1" | "0.2")}
            disabled={busy}
          >
            <option value="0.1">服务器拍卖行税 10%</option>
            <option value="0.2">世界交易行税 20%</option>
          </select>
          <button className="task-btn px-4" onClick={() => void onSimulate()} disabled={busy || !simulateRecipeId}>
            运行模拟
          </button>
        </div>
        {filteredSimulationRecipes.length === 0 ? (
          <p className="mt-2 text-xs text-amber-300">当前分类下没有可模拟的配方。</p>
        ) : null}

        {simulation ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="data-pill">产物: {simulation.outputItemName}</div>
              <div className="data-pill">总产量: {simulation.totalOutputQuantity}</div>
              <div className="data-pill">材料成本: {formatGold(simulation.requiredMaterialCost)}</div>
              <div className="data-pill">净利润: {formatGold(simulation.estimatedProfit)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="data-pill">税后收入: {formatGold(simulation.netRevenueAfterTax)}</div>
              <div className="data-pill">利润率: {toPercent(simulation.estimatedProfitRate)}</div>
              <div className="data-pill">成品单价: {formatGold(simulation.outputUnitPrice)}</div>
              <div className="data-pill">缺口补齐成本: {formatGold(simulation.missingPurchaseCost)}</div>
              <div className="data-pill md:col-span-4">{simulation.craftableNow ? "库存可直接制作" : "库存不足，需补材料"}</div>
            </div>
            {simulation.unknownPriceItemIds.length > 0 ? (
              <p className="mt-2 text-amber-300">
                以下材料缺少价格，利润结果不完整:
                {simulation.unknownPriceItemIds
                  .map((itemId) => itemById.get(itemId)?.name ?? itemId)
                  .join("、")}
              </p>
            ) : null}
            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-2 py-1">材料</th>
                    <th className="px-2 py-1">需求</th>
                    <th className="px-2 py-1">库存(可改)</th>
                    <th className="px-2 py-1">缺口</th>
                    <th className="px-2 py-1">单价(可改)</th>
                    <th className="px-2 py-1">默认取价</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.materialRows.map((row) => (
                    <tr key={`sim-material-${row.itemId}`} className="border-t border-white/10">
                      <td className="px-2 py-1">{row.itemName}</td>
                      <td className="px-2 py-1">{row.required}</td>
                      <td className="px-2 py-1">
                        <input
                          className="w-24 rounded border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                          value={simulationMaterialDraft[row.itemId]?.owned ?? String(row.owned)}
                          onChange={(event) =>
                            setSimulationMaterialDraft((prev) => ({
                              ...prev,
                              [row.itemId]: {
                                unitPrice: prev[row.itemId]?.unitPrice ?? (row.latestUnitPrice === null ? "" : String(row.latestUnitPrice)),
                                owned: event.target.value,
                              },
                            }))
                          }
                          disabled={busy}
                        />
                      </td>
                      <td className={`px-2 py-1 ${row.missing > 0 ? "text-rose-300" : "text-emerald-300"}`}>{row.missing}</td>
                      <td className="px-2 py-1">
                        <input
                          className="w-28 rounded border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                          value={simulationMaterialDraft[row.itemId]?.unitPrice ?? (row.latestUnitPrice === null ? "" : String(row.latestUnitPrice))}
                          onChange={(event) =>
                            setSimulationMaterialDraft((prev) => ({
                              ...prev,
                              [row.itemId]: {
                                unitPrice: event.target.value,
                                owned: prev[row.itemId]?.owned ?? String(row.owned),
                              },
                            }))
                          }
                          disabled={busy}
                          placeholder="留空=不改"
                        />
                      </td>
                      <td className="px-2 py-1 text-slate-300">{formatMarketLabel(row.latestPriceMarket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </article>

      <article className="order-4 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">库存管理</h4>
          <button className="pill-btn" onClick={() => void loadCraftOptions()} disabled={busy}>
            刷新建议
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemKeyword}
              onChange={(event) => setItemKeyword(event.target.value)}
              disabled={busy}
              placeholder="搜索物品名（全局）"
            />
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemMainCategory}
              onChange={(event) => setItemMainCategory(event.target.value)}
              disabled={busy || itemMainCategoryOptions.length === 0}
            >
              {itemMainCategoryOptions.map((category) => (
                <option key={`item-main-category-${category}`} value={category}>
                  大类: {category}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemSubCategory}
              onChange={(event) => setItemSubCategory(event.target.value)}
              disabled={busy}
            >
              <option value="all">下级分类: 全部</option>
              {itemSubCategoryOptions.map((category) => (
                <option key={`item-sub-category-${category}`} value={category}>
                  下级分类: {category}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
              disabled={busy || filteredItems.length === 0}
            >
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.subCategory}] {item.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-300">提示：输入关键词后，将在全物品范围搜索并忽略大类/下级分类筛选。</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={selectedItemPriceMarket}
              onChange={(event) => setSelectedItemPriceMarket(event.target.value as "server" | "world")}
              disabled={busy || !selectedItemId}
            >
              <option value="server">价格市场: 伺服器</option>
              <option value="world">价格市场: 世界</option>
            </select>
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="录入价格"
              value={selectedItemPrice}
              onChange={(event) => setSelectedItemPrice(event.target.value)}
              disabled={busy || !selectedItemId}
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="库存数量"
              value={selectedItemInventory}
              onChange={(event) => setSelectedItemInventory(event.target.value)}
              disabled={busy || !selectedItemId}
            />
            <div className="flex gap-2">
              <button className="task-btn px-3" onClick={onSaveSelectedPrice} disabled={busy || !selectedItemId}>
                记价格
              </button>
              <button className="task-btn px-3" onClick={onSaveSelectedInventory} disabled={busy || !selectedItemId}>
                记库存
              </button>
            </div>
          </div>
          {selectedItemId ? (
            <p className="mt-2 text-xs text-slate-300">
              当前值: 伺服器 {formatGold(latestPriceMetaByItemId.get(selectedItemId)?.server?.price ?? null)}（
              {formatDateTime(latestPriceMetaByItemId.get(selectedItemId)?.server?.capturedAt ?? null)}） / 世界{" "}
              {formatGold(latestPriceMetaByItemId.get(selectedItemId)?.world?.price ?? null)}（
              {formatDateTime(latestPriceMetaByItemId.get(selectedItemId)?.world?.capturedAt ?? null)}） / 单列{" "}
              {formatGold(latestPriceMetaByItemId.get(selectedItemId)?.single?.price ?? null)}（
              {formatDateTime(latestPriceMetaByItemId.get(selectedItemId)?.single?.capturedAt ?? null)}） / 库存{" "}
              {inventoryByItemId.get(selectedItemId) ?? 0}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-300">当前分类下没有物品。</p>
          )}
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-2 py-1">物品</th>
                  <th className="px-2 py-1">分类</th>
                  <th className="px-2 py-1">伺服器价格</th>
                  <th className="px-2 py-1">世界价格</th>
                  <th className="px-2 py-1">库存</th>
                  <th className="px-2 py-1">选择</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-2 py-1">{item.name}</td>
                    <td className="px-2 py-1">{`${item.mainCategory} / ${item.subCategory}`}</td>
                    <td className="px-2 py-1">
                      <div>{formatGold(latestPriceMetaByItemId.get(item.id)?.server?.price ?? null)}</div>
                      <div className="text-[10px] text-slate-400">{formatDateTime(latestPriceMetaByItemId.get(item.id)?.server?.capturedAt ?? null)}</div>
                    </td>
                    <td className="px-2 py-1">
                      <div>{formatGold(latestPriceMetaByItemId.get(item.id)?.world?.price ?? null)}</div>
                      <div className="text-[10px] text-slate-400">{formatDateTime(latestPriceMetaByItemId.get(item.id)?.world?.capturedAt ?? null)}</div>
                    </td>
                    <td className="px-2 py-1">{inventoryByItemId.get(item.id) ?? 0}</td>
                    <td className="px-2 py-1">
                      <button className="pill-btn" onClick={() => onPickItemForCorrection(item.id)} disabled={busy}>
                        选择
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h5 className="mt-4 text-xs font-semibold text-slate-200">材料逆向推导制造推荐工具</h5>
        <p className="mt-2 text-xs text-slate-300">
          输入一个材料可反推关联配方；留空则按你当前背包的综合材料覆盖率自动推荐。系统会同步给出补差材料和预算内建议次数。
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseMaterialKeyword}
            onChange={(event) => setReverseMaterialKeyword(event.target.value)}
            disabled={busy}
            placeholder="材料关键词（如 奥里哈康）"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseFocusMaterialId}
            onChange={(event) => setReverseFocusMaterialId(event.target.value)}
            disabled={busy}
          >
            <option value="">材料筛选: 综合背包（全部）</option>
            {reverseMaterialOptions.map((item) => (
              <option key={`reverse-material-${item.id}`} value={item.id}>
                {item.name}（库存 {inventoryByItemId.get(item.id) ?? 0}）
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseCraftBudgetInput}
            onChange={(event) => setReverseCraftBudgetInput(event.target.value)}
            disabled={busy}
            placeholder="补差预算（金币）"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={reverseScoreMode}
            onChange={(event) => setReverseScoreMode(event.target.value as ReverseScoreMode)}
            disabled={busy}
          >
            <option value="balanced">关联偏好: 平衡模式</option>
            <option value="coverage">关联偏好: 覆盖率优先</option>
            <option value="profit">关联偏好: 利润优先</option>
            <option value="craftable">关联偏好: 可直接制作优先</option>
          </select>
          <button className="task-btn px-4" onClick={() => void loadCraftOptions()} disabled={busy}>
            刷新建议
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-300">
          当前模式: {reverseFocusMaterialName ? `按材料「${reverseFocusMaterialName}」反推` : "综合背包关联推荐"} | 当前预算:{" "}
          {formatGold(reverseCraftBudget)} 金币 | 评分偏好: {reverseScoreModeLabel}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-emerald-200">可直接制作</span>
          <span className="rounded border border-cyan-300/35 bg-cyan-500/10 px-2 py-1 text-cyan-200">补差后可做</span>
          <span className="rounded border border-amber-300/35 bg-amber-500/10 px-2 py-1 text-amber-200">缺价格待补</span>
          <span className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-rose-200">低利润/风险</span>
        </div>
        <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 text-xs">
          {craftOptions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">暂无可分析配方。</p>
          ) : reverseCraftSuggestions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">
              {reverseFocusMaterialName ? `没有找到使用「${reverseFocusMaterialName}」的可推荐配方。` : "当前背包材料不足，暂时没有可推荐配方。"}
            </p>
          ) : (
            reverseCraftSuggestions.slice(0, 30).map((entry) => {
              const hasUnknownPrice = entry.unknownPriceRows.length > 0;
              const hasGap = entry.missingRows.length > 0;
              const positiveProfit = (entry.estimatedProfitPerRun ?? 0) >= 0;
              const directCraftable = entry.craftableCount > 0;
              const coverageTone =
                entry.coverageRatio >= 0.75 ? "text-emerald-300" : entry.coverageRatio >= 0.4 ? "text-amber-300" : "text-rose-300";
              let statusLabel = "补差后可做";
              let statusClass = "border-cyan-300/35 bg-cyan-500/10 text-cyan-200";
              if (hasUnknownPrice) {
                statusLabel = "缺价格待补";
                statusClass = "border-amber-300/35 bg-amber-500/10 text-amber-200";
              } else if (directCraftable && positiveProfit) {
                statusLabel = "可直接制作";
                statusClass = "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
              } else if (!positiveProfit) {
                statusLabel = "低利润/风险";
                statusClass = "border-rose-300/35 bg-rose-500/10 text-rose-200";
              }
              const cardToneClass = hasUnknownPrice
                ? "border-amber-300/35"
                : !positiveProfit
                  ? "border-rose-300/35"
                  : directCraftable
                    ? "border-emerald-300/30"
                    : "border-cyan-300/25";

              return (
                <div
                  key={`reverse-${entry.recipeId}`}
                  className={`mb-2 rounded-lg border bg-white/5 p-2 ${cardToneClass} ${
                    isStarredItem(entry.outputItemId) ? "ring-1 ring-amber-300/35" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-slate-100">
                      成品: {entry.outputItemName}
                      {entry.relatedByFocusMaterial ? "（命中材料）" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-2 py-1 text-[11px] ${statusClass}`}>{statusLabel}</span>
                      <span className="data-pill !px-2 !py-1">关联分 {entry.relevanceScore.toFixed(1)}</span>
                      <button
                        className="pill-btn !border-amber-300/40 !text-amber-200"
                        onClick={() => onToggleStarItem(entry.outputItemId)}
                        disabled={busy}
                      >
                        {isStarredItem(entry.outputItemId) ? "★" : "☆"}
                      </button>
                      <button className="pill-btn" onClick={() => onViewHistoryCurveForItem(entry.outputItemId)} disabled={busy}>
                        曲线
                      </button>
                      <button className="pill-btn" onClick={() => onJumpSimulationRecipe(entry.recipeId)} disabled={busy}>
                        定位模拟器
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className={`data-pill ${coverageTone}`}>覆盖率: {toPercent(entry.coverageRatio)}</div>
                    <div className="data-pill">
                      已命中材料: {entry.matchedOwnedMaterialCount}/{entry.totalMaterialCount}
                    </div>
                    <div className={`data-pill ${directCraftable ? "text-emerald-300" : "text-slate-300"}`}>可直接制作: {entry.craftableCount}</div>
                    <div className="data-pill">单次总材料成本: {formatGold(entry.requiredMaterialCostPerRun)}</div>
                    <div className={`data-pill ${hasGap ? "text-amber-300" : "text-emerald-300"}`}>单次补差: {formatGold(entry.missingPurchaseCostPerRun)}</div>
                    <div className="data-pill">预算建议次数: {entry.suggestedRunsByBudget}</div>
                    <div className={`data-pill ${positiveProfit ? "text-emerald-300" : "text-rose-300"}`}>单次利润: {formatGold(entry.estimatedProfitPerRun)}</div>
                    <div className={`data-pill ${entry.estimatedBudgetProfit !== null && entry.estimatedBudgetProfit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      预算潜在利润: {formatGold(entry.estimatedBudgetProfit)}
                    </div>
                  </div>

                  {entry.relatedByFocusMaterial ? (
                    <p className="mt-2 text-slate-300">
                      目标材料占比: 需求 {entry.focusMaterialRequired} / 现有 {entry.focusMaterialOwned}
                    </p>
                  ) : null}

                  {entry.unknownPriceRows.length > 0 ? (
                    <p className="mt-2 text-amber-300">缺价格材料: {entry.unknownPriceRows.map((row) => row.itemName).join("、")}</p>
                  ) : entry.missingRows.length > 0 ? (
                    <p className="mt-2 text-slate-300">补差材料: {entry.missingRows.map((row) => `${row.itemName}(${row.missing})`).join("、")}</p>
                  ) : (
                    <p className="mt-2 text-emerald-300">当前库存可直接开做，无需补差材料。</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </article>
    </div>
  );
}

