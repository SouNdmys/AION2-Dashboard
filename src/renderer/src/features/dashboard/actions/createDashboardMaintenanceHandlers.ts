import type { AppState } from "../../../../../shared/types";
import type { SettingsDraft } from "../dashboard-types";
import {
  checkAppUpdateAction,
  clearHistoryAction,
  exportDashboardDataAction,
  importDashboardDataAction,
  resetWeeklyStatsAction,
  saveDashboardSettingsAction,
  saveWeeklyCompletionsAction,
  undoMultiStepAction,
  undoSingleStepAction,
} from "./dashboardMaintenanceActions";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;
type SetBusy = (busy: boolean) => void;
type SetError = (message: string | null) => void;
type SetInfoMessage = (message: string | null) => void;
type SetState = (state: AppState) => void;

interface CreateDashboardMaintenanceHandlersParams {
  state: AppState | null;
  selectedCharacterId: string | null;
  weeklyExpeditionCompletedInput: string;
  weeklyTranscendenceCompletedInput: string;
  undoStepsInput: string;
  settingsDraft: SettingsDraft | null;
  appActions: AppActions;
  sync: SyncRunner;
  setBusy: SetBusy;
  setError: SetError;
  setInfoMessage: SetInfoMessage;
  setState: SetState;
  confirm: (message: string) => boolean;
}

interface MaintenanceHandlers {
  onCheckAppUpdate: () => void;
  onResetWeeklyStats: () => void;
  onSaveWeeklyCompletions: () => void;
  onUndoSingleStep: () => void;
  onUndoMultiStep: () => void;
  onClearHistory: () => void;
  onSaveSettings: () => void;
  onExportData: () => Promise<void>;
  onImportData: () => Promise<void>;
}

export function createDashboardMaintenanceHandlers(params: CreateDashboardMaintenanceHandlersParams): MaintenanceHandlers {
  const {
    state,
    selectedCharacterId,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    undoStepsInput,
    settingsDraft,
    appActions,
    sync,
    setBusy,
    setError,
    setInfoMessage,
    setState,
    confirm,
  } = params;

  function onResetWeeklyStats(): void {
    void resetWeeklyStatsAction({
      appActions,
      sync,
      confirm,
    });
  }

  function onCheckAppUpdate(): void {
    void checkAppUpdateAction({
      appActions,
      onBusyChange: setBusy,
      onError: setError,
      onInfoMessage: setInfoMessage,
    });
  }

  function onSaveWeeklyCompletions(): void {
    void saveWeeklyCompletionsAction({
      selectedCharacterId,
      weeklyExpeditionCompletedInput,
      weeklyTranscendenceCompletedInput,
      appActions,
      sync,
      onError: (message) => setError(message),
    });
  }

  function onUndoSingleStep(): void {
    void undoSingleStepAction({
      state,
      appActions,
      sync,
    });
  }

  function onUndoMultiStep(): void {
    void undoMultiStepAction({
      state,
      undoStepsInput,
      appActions,
      sync,
      onError: (message) => setError(message),
    });
  }

  function onClearHistory(): void {
    void clearHistoryAction({
      state,
      appActions,
      sync,
      confirm,
    });
  }

  function onSaveSettings(): void {
    void saveDashboardSettingsAction({
      settingsDraft,
      appActions,
      sync,
      onError: (message) => setError(message),
    });
  }

  async function onExportData(): Promise<void> {
    await exportDashboardDataAction({
      appActions,
      onBusyChange: setBusy,
      onError: setError,
      onInfoMessage: setInfoMessage,
    });
  }

  async function onImportData(): Promise<void> {
    await importDashboardDataAction({
      appActions,
      onBusyChange: setBusy,
      onError: setError,
      onInfoMessage: setInfoMessage,
      onStateImported: setState,
    });
  }

  return {
    onCheckAppUpdate,
    onResetWeeklyStats,
    onSaveWeeklyCompletions,
    onUndoSingleStep,
    onUndoMultiStep,
    onClearHistory,
    onSaveSettings,
    onExportData,
    onImportData,
  };
}
