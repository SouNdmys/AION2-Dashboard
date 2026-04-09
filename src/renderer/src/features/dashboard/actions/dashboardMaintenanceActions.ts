import type { AppState } from "../../../../../shared/types";
import type { SettingsDraft } from "../dashboard-types";
import { parseOptionalCap, toInt, toNumber } from "../dashboard-utils";

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

interface SaveDashboardSettingsParams {
  settingsDraft: SettingsDraft | null;
  appActions: AppActions;
  sync: SyncRunner;
  onError: (message: string) => void;
}

export async function saveDashboardSettingsAction(params: SaveDashboardSettingsParams): Promise<void> {
  const { settingsDraft, appActions, sync, onError } = params;
  if (!settingsDraft) return;
  const expeditionGoldPerRunWan = toNumber(settingsDraft.expeditionGoldPerRun);
  const transcendenceGoldPerRunWan = toNumber(settingsDraft.transcendenceGoldPerRun);
  const expeditionGoldPerRun =
    expeditionGoldPerRunWan === null ? null : Math.max(0, Math.round(expeditionGoldPerRunWan * 10_000));
  const transcendenceGoldPerRun =
    transcendenceGoldPerRunWan === null ? null : Math.max(0, Math.round(transcendenceGoldPerRunWan * 10_000));
  const expeditionWarn = toInt(settingsDraft.expeditionWarnThreshold);
  const transcendenceWarn = toInt(settingsDraft.transcendenceWarnThreshold);
  const expeditionRunCap = parseOptionalCap(settingsDraft.expeditionRunCap);
  const transcendenceRunCap = parseOptionalCap(settingsDraft.transcendenceRunCap);
  const nightmareRunCap = parseOptionalCap(settingsDraft.nightmareRunCap);
  const awakeningRunCap = parseOptionalCap(settingsDraft.awakeningRunCap);
  const priorityWeightAode = toInt(settingsDraft.priorityWeightAode);
  const priorityWeightSanctum = toInt(settingsDraft.priorityWeightSanctum);
  const priorityWeightCorridor = toInt(settingsDraft.priorityWeightCorridor);
  const priorityWeightDungeon = toInt(settingsDraft.priorityWeightDungeon);
  const priorityWeightWeekly = toInt(settingsDraft.priorityWeightWeekly);
  const priorityWeightMission = toInt(settingsDraft.priorityWeightMission);
  const priorityWeightLeisure = toInt(settingsDraft.priorityWeightLeisure);

  if (expeditionGoldPerRun === null || expeditionGoldPerRunWan === null || expeditionGoldPerRunWan < 0) {
    onError("远征金币收益参数无效（单位: 万）");
    return;
  }
  if (transcendenceGoldPerRun === null || transcendenceGoldPerRunWan === null || transcendenceGoldPerRunWan < 0) {
    onError("超越金币收益参数无效（单位: 万）");
    return;
  }
  if (expeditionWarn === null || expeditionWarn <= 0) {
    onError("远征阈值参数无效");
    return;
  }
  if (transcendenceWarn === null || transcendenceWarn <= 0) {
    onError("超越阈值参数无效");
    return;
  }
  if (
    expeditionRunCap === "invalid" ||
    transcendenceRunCap === "invalid" ||
    nightmareRunCap === "invalid" ||
    awakeningRunCap === "invalid"
  ) {
    onError("次数上限参数无效，请填写正整数或留空");
    return;
  }
  if (
    priorityWeightAode === null ||
    priorityWeightSanctum === null ||
    priorityWeightCorridor === null ||
    priorityWeightDungeon === null ||
    priorityWeightWeekly === null ||
    priorityWeightMission === null ||
    priorityWeightLeisure === null ||
    priorityWeightAode < 1 ||
    priorityWeightAode > 5 ||
    priorityWeightSanctum < 1 ||
    priorityWeightSanctum > 5 ||
    priorityWeightCorridor < 1 ||
    priorityWeightCorridor > 5 ||
    priorityWeightDungeon < 1 ||
    priorityWeightDungeon > 5 ||
    priorityWeightWeekly < 1 ||
    priorityWeightWeekly > 5 ||
    priorityWeightMission < 1 ||
    priorityWeightMission > 5 ||
    priorityWeightLeisure < 1 ||
    priorityWeightLeisure > 5
  ) {
    onError("优先级偏好需填写 1-5 的整数");
    return;
  }

  await sync(
    appActions.updateSettings({
      expeditionGoldPerRun,
      transcendenceGoldPerRun,
      expeditionRunCap,
      transcendenceRunCap,
      nightmareRunCap,
      awakeningRunCap,
      expeditionWarnThreshold: expeditionWarn,
      transcendenceWarnThreshold: transcendenceWarn,
      priorityWeightAode,
      priorityWeightSanctum,
      priorityWeightCorridor,
      priorityWeightDungeon,
      priorityWeightWeekly,
      priorityWeightMission,
      priorityWeightLeisure,
    }),
    "设置已保存",
  );
}

interface ExportDashboardDataParams {
  appActions: AppActions;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onInfoMessage: (message: string | null) => void;
}

export async function exportDashboardDataAction(params: ExportDashboardDataParams): Promise<void> {
  const { appActions, onBusyChange, onError, onInfoMessage } = params;
  onBusyChange(true);
  onError(null);
  onInfoMessage(null);
  try {
    const result = await appActions.exportData();
    if (result.cancelled) {
      return;
    }
    onInfoMessage(`导出成功: ${result.path}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "导出失败";
    onError(message);
  } finally {
    onBusyChange(false);
  }
}

interface ImportDashboardDataParams {
  appActions: AppActions;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onInfoMessage: (message: string | null) => void;
  onStateImported: (nextState: AppState) => void;
}

export async function importDashboardDataAction(params: ImportDashboardDataParams): Promise<void> {
  const { appActions, onBusyChange, onError, onInfoMessage, onStateImported } = params;
  onBusyChange(true);
  onError(null);
  onInfoMessage(null);
  try {
    const result = await appActions.importData();
    if (result.cancelled) {
      return;
    }
    if (result.state) {
      onStateImported(result.state);
    }
    onInfoMessage(`导入成功: ${result.path}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "导入失败";
    onError(message);
  } finally {
    onBusyChange(false);
  }
}

interface CheckAppUpdateParams {
  appActions: AppActions;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onInfoMessage: (message: string | null) => void;
}

export async function checkAppUpdateAction(params: CheckAppUpdateParams): Promise<void> {
  const { appActions, onBusyChange, onError, onInfoMessage } = params;
  onBusyChange(true);
  onError(null);
  onInfoMessage(null);
  try {
    const result = await appActions.checkAppUpdate();
    if (result.status === "error") {
      onError(result.message);
      return;
    }
    onInfoMessage(result.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新检查失败";
    onError(message);
  } finally {
    onBusyChange(false);
  }
}
