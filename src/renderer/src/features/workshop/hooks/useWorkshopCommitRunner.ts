import { useCallback } from "react";
import type { WorkshopState } from "../../../../../shared/types";

interface UseWorkshopCommitRunnerParams {
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  setMessage: (value: string | null) => void;
  setState: (value: WorkshopState) => void;
  loadCraftOptions: () => Promise<void>;
  loadSignals: () => Promise<void>;
}

interface WorkshopCommitRunner {
  commit: (action: () => Promise<WorkshopState>, successText: string) => Promise<void>;
}

export function useWorkshopCommitRunner(params: UseWorkshopCommitRunnerParams): WorkshopCommitRunner {
  const { setBusy, setError, setMessage, setState, loadCraftOptions, loadSignals } = params;

  const commit = useCallback(
    async (action: () => Promise<WorkshopState>, successText: string): Promise<void> => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const next = await action();
        setState(next);
        setMessage(successText);
        await Promise.all([loadCraftOptions(), loadSignals()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "工坊操作失败");
      } finally {
        setBusy(false);
      }
    },
    [setBusy, setError, setMessage, setState, loadCraftOptions, loadSignals],
  );

  return { commit };
}
