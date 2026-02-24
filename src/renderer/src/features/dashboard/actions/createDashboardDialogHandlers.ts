import type { AppState, CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { CorridorDraft, DialogState } from "../dashboard-types";
import {
  confirmDashboardDialogAction,
  openCompleteTaskDialogAction,
  openCorridorCompleteDialogAction,
  openCorridorSyncDialogAction,
  openEnergyDialogAction,
  openSanctumEditDialogAction,
  openSetCompletedTaskDialogAction,
  openTaskEditDialogAction,
  openUseTicketTaskDialogAction,
} from "./dashboardDialogActions";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;
type SetDialog = (value: DialogState | null) => void;
type SetDialogError = (message: string | null) => void;
type SetCorridorDraft = (updater: (prev: CorridorDraft) => CorridorDraft) => void;

interface CreateDashboardDialogHandlersParams {
  dialog: DialogState | null;
  selectedAccountId: string | null;
  selectedCharacter: CharacterState | null;
  corridorDraft: CorridorDraft;
  taskById: Map<TaskId, TaskDefinition>;
  appActions: AppActions;
  sync: SyncRunner;
  setDialog: SetDialog;
  setDialogError: SetDialogError;
  setCorridorDraft: SetCorridorDraft;
}

interface DialogHandlers {
  openCompleteDialog: (taskId: TaskId, title: string) => void;
  openUseTicketDialog: (taskId: TaskId, title: string) => void;
  openSetCompletedDialog: (task: TaskDefinition) => void;
  openEnergyDialog: () => void;
  openTaskEditDialog: (
    taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game",
  ) => void;
  openSanctumEditDialog: () => void;
  onSyncCorridorStatus: () => void;
  onApplyCorridorCompletion: () => void;
  onConfirmDialog: () => void;
}

export function createDashboardDialogHandlers(params: CreateDashboardDialogHandlersParams): DialogHandlers {
  const {
    dialog,
    selectedCharacter,
    selectedAccountId,
    corridorDraft,
    taskById,
    appActions,
    sync,
    setDialog,
    setDialogError,
    setCorridorDraft,
  } = params;

  const onDialogErrorReset = (): void => setDialogError(null);
  const onDialogClose = (): void => {
    setDialog(null);
    setDialogError(null);
  };
  const onCorridorDraftSyncCounts = (lower: number, middle: number): void => {
    setCorridorDraft((prev) => ({
      ...prev,
      lowerAvailable: String(lower),
      middleAvailable: String(middle),
    }));
  };
  const onCorridorDraftSyncCompletion = (completed: number, lane: "lower" | "middle"): void => {
    setCorridorDraft((prev) => ({
      ...prev,
      completeAmount: String(completed),
      completeLane: lane,
    }));
  };

  function openCompleteDialog(taskId: TaskId, title: string): void {
    openCompleteTaskDialogAction({
      taskId,
      title,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function openUseTicketDialog(taskId: TaskId, title: string): void {
    openUseTicketTaskDialogAction({
      taskId,
      title,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function openSetCompletedDialog(task: TaskDefinition): void {
    openSetCompletedTaskDialogAction({
      task,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function openEnergyDialog(): void {
    openEnergyDialogAction({
      selectedCharacter,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function openTaskEditDialog(
    taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game",
  ): void {
    openTaskEditDialogAction({
      selectedCharacter,
      taskId,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function openSanctumEditDialog(): void {
    openSanctumEditDialogAction({
      selectedCharacter,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function onSyncCorridorStatus(): void {
    openCorridorSyncDialogAction({
      corridorDraft,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function onApplyCorridorCompletion(): void {
    openCorridorCompleteDialogAction({
      corridorDraft,
      onDialogOpen: setDialog,
      onDialogErrorReset,
    });
  }

  function onConfirmDialog(): void {
    void confirmDashboardDialogAction({
      dialog,
      selected: selectedCharacter,
      selectedAccountId,
      appActions,
      taskById,
      sync,
      onDialogError: setDialogError,
      onDialogClose,
      onCorridorDraftSyncCounts,
      onCorridorDraftSyncCompletion,
    });
  }

  return {
    openCompleteDialog,
    openUseTicketDialog,
    openSetCompletedDialog,
    openEnergyDialog,
    openTaskEditDialog,
    openSanctumEditDialog,
    onSyncCorridorStatus,
    onApplyCorridorCompletion,
    onConfirmDialog,
  };
}
