import type { AppState } from "../../../../../shared/types";
import { toInt } from "../dashboard-utils";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;

interface ResetWeeklyStatsParams {
  appActions: AppActions;
  sync: SyncRunner;
  confirm: (message: string) => boolean;
}

export async function resetWeeklyStatsAction(params: ResetWeeklyStatsParams): Promise<void> {
  const { appActions, sync, confirm } = params;
  const ok = confirm("确认重置本周收益统计？仅重置统计，不影响任务进度。");
  if (!ok) return;
  await sync(appActions.resetWeeklyStats());
}

interface SaveWeeklyCompletionsParams {
  selectedCharacterId: string | null;
  weeklyExpeditionCompletedInput: string;
  weeklyTranscendenceCompletedInput: string;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function saveWeeklyCompletionsAction(params: SaveWeeklyCompletionsParams): Promise<void> {
  const {
    selectedCharacterId,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    appActions,
    sync,
    onError,
  } = params;
  if (!selectedCharacterId) return;
  const expeditionCompleted = toInt(weeklyExpeditionCompletedInput);
  const transcendenceCompleted = toInt(weeklyTranscendenceCompletedInput);
  if (expeditionCompleted === null || transcendenceCompleted === null || expeditionCompleted < 0 || transcendenceCompleted < 0) {
    onError("周统计次数必须是大于等于 0 的整数");
    return;
  }
  await sync(
    appActions.updateWeeklyCompletions(selectedCharacterId, {
      expeditionCompleted,
      transcendenceCompleted,
    }),
    "已校准当前角色周统计次数",
  );
}
