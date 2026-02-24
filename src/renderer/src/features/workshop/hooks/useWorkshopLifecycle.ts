import { useCallback, useEffect } from "react";
import type {
  WorkshopCraftOption,
  WorkshopOcrAutoRunState,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopPriceSignalResult,
  WorkshopState,
} from "../../../../../shared/types";

type WorkshopActions = NonNullable<Window["aionApi"]>;

interface UseWorkshopLifecycleParams {
  workshopActions: WorkshopActions;
  taxRate: number;
  setState: (state: WorkshopState) => void;
  setCraftOptions: (options: WorkshopCraftOption[]) => void;
  setSignalResult: (result: WorkshopPriceSignalResult | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setOcrHotkeyState: (state: WorkshopOcrHotkeyState | null) => void;
  setOcrHotkeyShortcut: (value: string) => void;
  setOcrHotkeyLastResult: (result: WorkshopOcrHotkeyRunResult | null) => void;
  setOcrAutoRunState: (state: WorkshopOcrAutoRunState | null) => void;
  setOcrAutoRunIntervalSeconds: (value: string) => void;
  setOcrAutoRunOverlayEnabled: (value: boolean) => void;
  setOcrAutoRunFailLimit: (value: string) => void;
}

interface WorkshopLifecycleHandlers {
  loadState: () => Promise<void>;
  loadCraftOptions: () => Promise<void>;
  loadSignals: () => Promise<void>;
}

export function useWorkshopLifecycle(params: UseWorkshopLifecycleParams): WorkshopLifecycleHandlers {
  const {
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
  } = params;

  const loadState = useCallback(async (): Promise<void> => {
    const next = await workshopActions.getWorkshopState();
    setState(next);
  }, [workshopActions, setState]);

  const loadCraftOptions = useCallback(async (): Promise<void> => {
    const next = await workshopActions.getWorkshopCraftOptions({ taxRate });
    setCraftOptions(next);
  }, [workshopActions, taxRate, setCraftOptions]);

  const loadSignals = useCallback(async (): Promise<void> => {
    const [serverResult, worldResult] = await Promise.all([
      workshopActions.getWorkshopPriceSignals({ market: "server" }),
      workshopActions.getWorkshopPriceSignals({ market: "world" }),
    ]);
    const rows = [
      ...serverResult.rows.map((row) => ({ ...row, market: row.market ?? "server" })),
      ...worldResult.rows.map((row) => ({ ...row, market: row.market ?? "world" })),
    ];
    const next: WorkshopPriceSignalResult = {
      generatedAt: new Date().toISOString(),
      market: undefined,
      lookbackDays: serverResult.lookbackDays,
      thresholdRatio: serverResult.thresholdRatio,
      effectiveThresholdRatio: serverResult.effectiveThresholdRatio,
      ruleEnabled: serverResult.ruleEnabled,
      triggeredCount: rows.filter((row) => row.triggered).length,
      buyZoneCount: rows.filter((row) => row.trendTag === "buy-zone").length,
      sellZoneCount: rows.filter((row) => row.trendTag === "sell-zone").length,
      rows,
    };
    setSignalResult(next);
  }, [workshopActions, setSignalResult]);

  const loadOcrHotkeyState = useCallback(async (): Promise<void> => {
    const next = await workshopActions.getWorkshopOcrHotkeyState();
    setOcrHotkeyState(next);
    setOcrHotkeyShortcut(next.shortcut);
    setOcrHotkeyLastResult(next.lastResult);
  }, [workshopActions, setOcrHotkeyState, setOcrHotkeyShortcut, setOcrHotkeyLastResult]);

  const loadOcrAutoRunState = useCallback(async (): Promise<void> => {
    const next = await workshopActions.getWorkshopOcrAutoRunState();
    setOcrAutoRunState(next);
    setOcrAutoRunIntervalSeconds(String(next.intervalSeconds));
    setOcrAutoRunOverlayEnabled(next.showOverlay);
    setOcrAutoRunFailLimit(String(next.maxConsecutiveFailures));
  }, [
    workshopActions,
    setOcrAutoRunState,
    setOcrAutoRunIntervalSeconds,
    setOcrAutoRunOverlayEnabled,
    setOcrAutoRunFailLimit,
  ]);

  const bootstrap = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await Promise.all([loadState(), loadCraftOptions(), loadSignals(), loadOcrHotkeyState(), loadOcrAutoRunState()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "工坊初始化失败");
    } finally {
      setBusy(false);
    }
  }, [setBusy, setError, loadState, loadCraftOptions, loadSignals, loadOcrHotkeyState, loadOcrAutoRunState]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const off = workshopActions.onWorkshopOcrHotkeyResult((result) => {
      setOcrHotkeyLastResult(result);
      setMessage(result.message);
      if (!result.success) {
        setError(result.message);
      }
      void Promise.all([loadState(), loadCraftOptions(), loadSignals()]);
    });
    return () => {
      off();
    };
  }, [workshopActions, setOcrHotkeyLastResult, setMessage, setError, loadState, loadCraftOptions, loadSignals]);

  useEffect(() => {
    const off = workshopActions.onWorkshopOcrAutoRunState((next) => {
      setOcrAutoRunState(next);
      setOcrAutoRunIntervalSeconds(String(next.intervalSeconds));
      setOcrAutoRunOverlayEnabled(next.showOverlay);
      setOcrAutoRunFailLimit(String(next.maxConsecutiveFailures));
    });
    return () => {
      off();
    };
  }, [workshopActions, setOcrAutoRunState, setOcrAutoRunIntervalSeconds, setOcrAutoRunOverlayEnabled, setOcrAutoRunFailLimit]);

  return {
    loadState,
    loadCraftOptions,
    loadSignals,
  };
}
