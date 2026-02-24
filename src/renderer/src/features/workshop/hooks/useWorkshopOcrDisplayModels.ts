import { useMemo } from "react";
import type { WorkshopOcrAutoRunState, WorkshopOcrHotkeyRunResult } from "../../../../../shared/types";

interface UseWorkshopOcrDisplayModelsParams {
  ocrHotkeyLastResult: WorkshopOcrHotkeyRunResult | null;
  ocrAutoRunState: WorkshopOcrAutoRunState | null;
  ocrAutoRunNowMs: number;
}

interface WorkshopOcrDisplayModels {
  recentOcrImportedEntries: WorkshopOcrHotkeyRunResult["importedEntries"];
  ocrAutoRunCountdownSeconds: number | null;
}

export function useWorkshopOcrDisplayModels(params: UseWorkshopOcrDisplayModelsParams): WorkshopOcrDisplayModels {
  const { ocrHotkeyLastResult, ocrAutoRunState, ocrAutoRunNowMs } = params;

  const recentOcrImportedEntries = useMemo(() => {
    return (ocrHotkeyLastResult?.importedEntries ?? [])
      .sort((left, right) => {
        const tsDiff = new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime();
        if (tsDiff !== 0) {
          return tsDiff;
        }
        return left.lineNumber - right.lineNumber;
      })
      .slice(0, 20);
  }, [ocrHotkeyLastResult]);

  const ocrAutoRunCountdownSeconds = useMemo(() => {
    if (!ocrAutoRunState?.enabled || !ocrAutoRunState.nextRunAt) {
      return null;
    }
    const diff = new Date(ocrAutoRunState.nextRunAt).getTime() - ocrAutoRunNowMs;
    if (!Number.isFinite(diff)) {
      return null;
    }
    return Math.max(0, Math.ceil(diff / 1000));
  }, [ocrAutoRunState?.enabled, ocrAutoRunState?.nextRunAt, ocrAutoRunNowMs]);

  return {
    recentOcrImportedEntries,
    ocrAutoRunCountdownSeconds,
  };
}
