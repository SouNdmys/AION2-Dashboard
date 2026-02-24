import type { AppState } from "../../../../../shared/types";
import { toInt } from "../dashboard-utils";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;

interface UndoSingleStepParams {
  state: AppState | null;
  appActions: AppActions;
  sync: SyncRunner;
}

export async function undoSingleStepAction(params: UndoSingleStepParams): Promise<void> {
  const { state, appActions, sync } = params;
  if (!state || state.history.length === 0) return;
  await sync(appActions.undoOperations(1), "已撤销一步");
}

interface UndoMultiStepParams {
  state: AppState | null;
  undoStepsInput: string;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function undoMultiStepAction(params: UndoMultiStepParams): Promise<void> {
  const { state, undoStepsInput, appActions, sync, onError } = params;
  if (!state || state.history.length === 0) return;
  const steps = toInt(undoStepsInput);
  if (steps === null || steps <= 0) {
    onError("请输入有效的撤销步数");
    return;
  }
  await sync(appActions.undoOperations(steps), `已撤销 ${steps} 步`);
}

interface ClearHistoryParams {
  state: AppState | null;
  appActions: AppActions;
  sync: SyncRunner;
  confirm: (message: string) => boolean;
}

export async function clearHistoryAction(params: ClearHistoryParams): Promise<void> {
  const { state, appActions, sync, confirm } = params;
  if (!state || state.history.length === 0) return;
  const ok = confirm("确认清空所有操作历史日志？该操作不可撤销。");
  if (!ok) return;
  await sync(appActions.clearHistory(), "已清空操作历史");
}
