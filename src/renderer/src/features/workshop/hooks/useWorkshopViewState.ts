import { useRef, useState } from "react";
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
} from "../../../../../shared/types";
import { usePersistedState } from "../../../hooks/usePersistedState";
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
} from "../workshop-persistence";
import type { ReverseScoreMode } from "../workshop-view-helpers";

export function useWorkshopViewState() {
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

  return {
    state,
    setState,
    craftOptions,
    setCraftOptions,
    simulation,
    setSimulation,
    busy,
    setBusy,
    error,
    setError,
    message,
    setMessage,
    itemMainCategory,
    setItemMainCategory,
    itemSubCategory,
    setItemSubCategory,
    itemKeyword,
    setItemKeyword,
    selectedItemId,
    setSelectedItemId,
    selectedItemPriceMarket,
    setSelectedItemPriceMarket,
    selectedItemPrice,
    setSelectedItemPrice,
    selectedItemInventory,
    setSelectedItemInventory,
    simulateRecipeId,
    setSimulateRecipeId,
    simulateMainCategory,
    setSimulateMainCategory,
    simulateSubCategory,
    setSimulateSubCategory,
    simulateRuns,
    setSimulateRuns,
    taxMode,
    setTaxMode,
    reverseCraftBudgetInput,
    setReverseCraftBudgetInput,
    reverseMaterialKeyword,
    setReverseMaterialKeyword,
    reverseFocusMaterialId,
    setReverseFocusMaterialId,
    reverseScoreMode,
    setReverseScoreMode,
    historyItemId,
    setHistoryItemId,
    historyMainCategory,
    setHistoryMainCategory,
    historySubCategory,
    setHistorySubCategory,
    historyKeyword,
    setHistoryKeyword,
    historyDaysInput,
    setHistoryDaysInput,
    historyIncludeSuspect,
    setHistoryIncludeSuspect,
    historyServerResult,
    setHistoryServerResult,
    historyWorldResult,
    setHistoryWorldResult,
    historyHasLoaded,
    setHistoryHasLoaded,
    historyLoading,
    setHistoryLoading,
    starItemIds,
    setStarItemIds,
    focusStarOnly,
    setFocusStarOnly,
    signalRuleEnabled,
    setSignalRuleEnabled,
    signalLookbackDaysInput,
    setSignalLookbackDaysInput,
    signalThresholdPercentInput,
    setSignalThresholdPercentInput,
    signalResult,
    setSignalResult,
    ocrHotkeyShortcut,
    setOcrHotkeyShortcut,
    ocrHotkeyState,
    setOcrHotkeyState,
    ocrHotkeyLastResult,
    setOcrHotkeyLastResult,
    ocrAutoRunState,
    setOcrAutoRunState,
    ocrAutoRunIntervalSeconds,
    setOcrAutoRunIntervalSeconds,
    ocrAutoRunOverlayEnabled,
    setOcrAutoRunOverlayEnabled,
    ocrAutoRunFailLimit,
    setOcrAutoRunFailLimit,
    ocrAutoRunNowMs,
    setOcrAutoRunNowMs,
    ocrScreenPreview,
    setOcrScreenPreview,
    ocrCaptureDelayMs,
    setOcrCaptureDelayMs,
    ocrHideAppBeforeCapture,
    setOcrHideAppBeforeCapture,
    ocrSafeMode,
    setOcrSafeMode,
    ocrTradePresetKey,
    setOcrTradePresetKey,
    ocrTradeRowCount,
    setOcrTradeRowCount,
    ocrTradeNamesX,
    setOcrTradeNamesX,
    ocrTradeNamesY,
    setOcrTradeNamesY,
    ocrTradeNamesWidth,
    setOcrTradeNamesWidth,
    ocrTradeNamesHeight,
    setOcrTradeNamesHeight,
    ocrTradePricesX,
    setOcrTradePricesX,
    ocrTradePricesY,
    setOcrTradePricesY,
    ocrTradePricesWidth,
    setOcrTradePricesWidth,
    ocrTradePricesHeight,
    setOcrTradePricesHeight,
    ocrTradePriceMode,
    setOcrTradePriceMode,
    ocrTradePriceColumn,
    setOcrTradePriceColumn,
    ocrTradeLeftPriceRole,
    setOcrTradeLeftPriceRole,
    ocrTradeRightPriceRole,
    setOcrTradeRightPriceRole,
    ocrCalibrationTarget,
    setOcrCalibrationTarget,
    ocrDragStart,
    setOcrDragStart,
    ocrDragMode,
    setOcrDragMode,
    ocrDragOffset,
    setOcrDragOffset,
    ocrDragRect,
    setOcrDragRect,
    simulationMaterialDraft,
    setSimulationMaterialDraft,
    simulationOutputPriceDraft,
    setSimulationOutputPriceDraft,
    historyChartAnchorRef,
  };
}
