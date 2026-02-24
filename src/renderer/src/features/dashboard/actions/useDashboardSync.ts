import { useCallback } from "react";
import type { AppState } from "../../../../../shared/types";

type SetBusy = (busy: boolean) => void;
type SetError = (message: string | null) => void;
type SetDialogError = (message: string | null) => void;
type SetInfoMessage = (message: string | null) => void;
type SetState = (state: AppState) => void;

interface UseDashboardSyncParams {
  setBusy: SetBusy;
  setError: SetError;
  setDialogError: SetDialogError;
  setInfoMessage: SetInfoMessage;
  setState: SetState;
}

export function useDashboardSync(params: UseDashboardSyncParams): (action: Promise<AppState>, successMessage?: string) => Promise<boolean> {
  const { setBusy, setError, setDialogError, setInfoMessage, setState } = params;
  return useCallback(
    async (action: Promise<AppState>, successMessage?: string) => {
      setBusy(true);
      setError(null);
      if (successMessage) {
        setInfoMessage(null);
      }
      try {
        const next = await action;
        setState(next);
        if (successMessage) {
          setInfoMessage(successMessage);
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "操作失败";
        setError(message);
        setDialogError(message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setBusy, setDialogError, setError, setInfoMessage, setState],
  );
}
