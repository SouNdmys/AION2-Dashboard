import type {
  WorkshopOcrAutoRunState,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopScreenPreviewResult,
} from "../../../../../shared/types";
import {
  parseAutoRunFailLimitOrError,
  parseAutoRunIntervalSecondsOrError,
  parseScreenCaptureOptionsOrError,
  parseTradeBoardPresetOrError,
} from "../workshop-ocr-handlers";
import { OCR_HOTKEY_DEFAULT_LANGUAGE, OCR_HOTKEY_DEFAULT_PSM } from "../workshop-persistence";

type WorkshopActions = NonNullable<Window["aionApi"]>;

interface CreateWorkshopOcrConfigHandlersParams {
  ocrTradeRowCount: string;
  ocrTradeNamesX: string;
  ocrTradeNamesY: string;
  ocrTradeNamesWidth: string;
  ocrTradeNamesHeight: string;
  ocrTradePricesX: string;
  ocrTradePricesY: string;
  ocrTradePricesWidth: string;
  ocrTradePricesHeight: string;
  ocrTradePriceMode: "single" | "dual";
  ocrTradePriceColumn: "left" | "right";
  ocrTradeLeftPriceRole: "server" | "world";
  ocrTradeRightPriceRole: "server" | "world";
  ocrHotkeyShortcut: string;
  ocrSafeMode: boolean;
  ocrCaptureDelayMs: string;
  ocrHideAppBeforeCapture: boolean;
  ocrAutoRunIntervalSeconds: string;
  ocrAutoRunFailLimit: string;
  ocrAutoRunOverlayEnabled: boolean;
  workshopActions: WorkshopActions;
  loadState: () => Promise<void>;
  loadCraftOptions: () => Promise<void>;
  loadSignals: () => Promise<void>;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setOcrHotkeyState: (state: WorkshopOcrHotkeyState | null) => void;
  setOcrHotkeyShortcut: (value: string) => void;
  setOcrSafeMode: (value: boolean) => void;
  setOcrHotkeyLastResult: (result: WorkshopOcrHotkeyRunResult | null) => void;
  setOcrScreenPreview: (preview: WorkshopScreenPreviewResult | null) => void;
  setOcrAutoRunState: (state: WorkshopOcrAutoRunState | null) => void;
  setOcrAutoRunIntervalSeconds: (value: string) => void;
  setOcrAutoRunOverlayEnabled: (value: boolean) => void;
  setOcrAutoRunFailLimit: (value: string) => void;
}

interface WorkshopOcrConfigHandlers {
  onApplyOcrHotkeyConfig: (nextEnabled: boolean) => Promise<void>;
  onTriggerOcrHotkeyNow: () => Promise<void>;
  onCaptureOcrScreenPreview: () => Promise<void>;
  onConfigureOcrAutoRun: (nextEnabled: boolean) => Promise<void>;
}

export function createWorkshopOcrConfigHandlers(params: CreateWorkshopOcrConfigHandlersParams): WorkshopOcrConfigHandlers {
  const {
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
  } = params;

  async function onApplyOcrHotkeyConfig(nextEnabled: boolean): Promise<void> {
    const tradePresetParsed = parseTradeBoardPresetOrError({
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
    });
    if (tradePresetParsed.error) {
      setError(tradePresetParsed.error);
      return;
    }
    const shortcut = ocrHotkeyShortcut.trim();
    if (!shortcut) {
      setError("请先填写快捷键组合。");
      return;
    }
    const captureParsed = parseScreenCaptureOptionsOrError({
      ocrCaptureDelayMs,
      ocrHideAppBeforeCapture,
    });
    if (captureParsed.error) {
      setError(captureParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await workshopActions.configureWorkshopOcrHotkey({
        enabled: nextEnabled,
        shortcut,
        language: OCR_HOTKEY_DEFAULT_LANGUAGE,
        psm: OCR_HOTKEY_DEFAULT_PSM,
        safeMode: ocrSafeMode,
        captureDelayMs: captureParsed.options?.delayMs,
        hideAppBeforeCapture: captureParsed.options?.hideAppBeforeCapture,
        autoCreateMissingItems: false,
        defaultCategory: "material",
        strictIconMatch: false,
        tradeBoardPreset: tradePresetParsed.preset,
      });
      setOcrHotkeyState(next);
      setOcrHotkeyShortcut(next.shortcut);
      setOcrSafeMode(next.safeMode);
      setOcrHotkeyLastResult(next.lastResult);
      if (next.enabled && !next.registered) {
        setError(`快捷键未注册成功：${next.shortcut}。建议改用 Ctrl+Shift+F1 或避免与游戏内热键冲突。`);
      } else {
        setMessage(next.enabled ? `快捷抓价已启用（${next.shortcut}）` : "快捷抓价已关闭");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "快捷抓价配置失败");
    } finally {
      setBusy(false);
    }
  }

  async function onTriggerOcrHotkeyNow(): Promise<void> {
    const captureParsed = parseScreenCaptureOptionsOrError({
      ocrCaptureDelayMs,
      ocrHideAppBeforeCapture,
    });
    if (captureParsed.error) {
      setError(captureParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await workshopActions.triggerWorkshopOcrHotkeyNow(captureParsed.options ?? undefined);
      setOcrHotkeyLastResult(result);
      await Promise.all([loadState(), loadCraftOptions(), loadSignals()]);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "手动触发快捷抓价失败");
    } finally {
      setBusy(false);
    }
  }

  async function onCaptureOcrScreenPreview(): Promise<void> {
    const captureParsed = parseScreenCaptureOptionsOrError({
      ocrCaptureDelayMs,
      ocrHideAppBeforeCapture,
    });
    if (captureParsed.error) {
      setError(captureParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await workshopActions.captureWorkshopScreenPreview(captureParsed.options ?? undefined);
      setOcrScreenPreview(preview);
      setMessage(`校准图已捕获：${preview.width}x${preview.height}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "捕获校准图失败");
    } finally {
      setBusy(false);
    }
  }

  async function onConfigureOcrAutoRun(nextEnabled: boolean): Promise<void> {
    const intervalParsed = parseAutoRunIntervalSecondsOrError(ocrAutoRunIntervalSeconds);
    if (intervalParsed.error) {
      setError(intervalParsed.error);
      return;
    }
    const failLimitParsed = parseAutoRunFailLimitOrError(ocrAutoRunFailLimit);
    if (failLimitParsed.error) {
      setError(failLimitParsed.error);
      return;
    }
    const tradePresetParsed = parseTradeBoardPresetOrError({
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
    });
    if (tradePresetParsed.error) {
      setError(tradePresetParsed.error);
      return;
    }
    const captureParsed = parseScreenCaptureOptionsOrError({
      ocrCaptureDelayMs,
      ocrHideAppBeforeCapture,
    });
    if (captureParsed.error) {
      setError(captureParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await workshopActions.configureWorkshopOcrAutoRun({
        enabled: nextEnabled,
        intervalSeconds: intervalParsed.intervalSeconds ?? undefined,
        showOverlay: ocrAutoRunOverlayEnabled,
        safeMode: ocrSafeMode,
        captureDelayMs: captureParsed.options?.delayMs,
        hideAppBeforeCapture: captureParsed.options?.hideAppBeforeCapture,
        maxConsecutiveFailures: failLimitParsed.failLimit ?? undefined,
        tradeBoardPreset: tradePresetParsed.preset,
      });
      setOcrAutoRunState(next);
      setOcrAutoRunIntervalSeconds(String(next.intervalSeconds));
      setOcrAutoRunOverlayEnabled(next.showOverlay);
      setOcrAutoRunFailLimit(String(next.maxConsecutiveFailures));
      setMessage(next.enabled ? `自动抓价已启动（每 ${next.intervalSeconds} 秒）` : "自动抓价已停止");
    } catch (err) {
      setError(err instanceof Error ? err.message : "自动抓价配置失败");
    } finally {
      setBusy(false);
    }
  }

  return {
    onApplyOcrHotkeyConfig,
    onTriggerOcrHotkeyNow,
    onCaptureOcrScreenPreview,
    onConfigureOcrAutoRun,
  };
}
