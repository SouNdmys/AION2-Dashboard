import type { AccountState, AppState, CharacterState, TaskActionKind, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { CorridorDraft, DialogState, OverviewSortKey, QuickTaskId, SettingsDraft } from "../dashboard-types";
import { createDashboardAccountResourceHandlers } from "./createDashboardAccountResourceHandlers";
import { createDashboardDialogHandlers } from "./createDashboardDialogHandlers";
import { createDashboardMaintenanceHandlers } from "./createDashboardMaintenanceHandlers";
import { createDashboardOverviewHandlers } from "./createDashboardOverviewHandlers";
import { useDashboardSync } from "./useDashboardSync";

type AppActions = NonNullable<Window["aionApi"]>;

interface UseDashboardHandlersParams {
  appActions: AppActions;
  state: AppState | null;
  dialog: DialogState | null;
  settingsDraft: SettingsDraft | null;
  selectedCharacter: CharacterState | null;
  selectedAccount: AccountState | null;
  taskById: Map<TaskId, TaskDefinition>;
  corridorDraft: CorridorDraft;
  overviewSortKey: OverviewSortKey;
  busy: boolean;
  draggingCharacterId: string | null;
  dragOverCharacterId: string | null;
  quickCharacterId: string;
  quickTaskId: QuickTaskId;
  quickAction: TaskActionKind;
  quickAmountInput: string;
  quickCorridorTask: { title: string; lane: "lower" | "middle" } | null;
  characterNameById: Map<string, string>;
  weeklyExpeditionCompletedInput: string;
  weeklyTranscendenceCompletedInput: string;
  undoStepsInput: string;
  newAccountName: string;
  newAccountRegion: string;
  accountNameInput: string;
  accountRegionInput: string;
  canAddCharacterInSelectedAccount: boolean;
  newCharacterName: string;
  renameInput: string;
  profileClassTagInput: string;
  profileGearScoreInput: string;
  selectedAodePurchaseLimit: number;
  selectedAodeConvertLimit: number;
  shopAodePurchaseUsedInput: string;
  shopDailyDungeonTicketPurchaseUsedInput: string;
  transformAodeUsedInput: string;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  setDialogError: (message: string | null) => void;
  setInfoMessage: (message: string | null) => void;
  setState: (state: AppState) => void;
  setDialog: (dialog: DialogState | null) => void;
  setCorridorDraft: (updater: (prev: CorridorDraft) => CorridorDraft) => void;
  setDashboardMode: (mode: "overview" | "character") => void;
  setDraggingCharacterId: (characterId: string | null) => void;
  setDragOverCharacterId: (characterId: string | null) => void;
  setNewAccountName: (value: string) => void;
  setNewAccountRegion: (value: string) => void;
  setNewCharacterName: (value: string) => void;
  confirm: (message: string) => boolean;
}

type DashboardHandlers = ReturnType<typeof createDashboardDialogHandlers> &
  ReturnType<typeof createDashboardOverviewHandlers> &
  ReturnType<typeof createDashboardMaintenanceHandlers> &
  ReturnType<typeof createDashboardAccountResourceHandlers>;

export function useDashboardHandlers(params: UseDashboardHandlersParams): DashboardHandlers {
  const {
    appActions,
    state,
    dialog,
    settingsDraft,
    selectedCharacter,
    selectedAccount,
    taskById,
    corridorDraft,
    overviewSortKey,
    busy,
    draggingCharacterId,
    dragOverCharacterId,
    quickCharacterId,
    quickTaskId,
    quickAction,
    quickAmountInput,
    quickCorridorTask,
    characterNameById,
    weeklyExpeditionCompletedInput,
    weeklyTranscendenceCompletedInput,
    undoStepsInput,
    newAccountName,
    newAccountRegion,
    accountNameInput,
    accountRegionInput,
    canAddCharacterInSelectedAccount,
    newCharacterName,
    renameInput,
    profileClassTagInput,
    profileGearScoreInput,
    selectedAodePurchaseLimit,
    selectedAodeConvertLimit,
    shopAodePurchaseUsedInput,
    shopDailyDungeonTicketPurchaseUsedInput,
    transformAodeUsedInput,
    setBusy,
    setError,
    setDialogError,
    setInfoMessage,
    setState,
    setDialog,
    setCorridorDraft,
    setDashboardMode,
    setDraggingCharacterId,
    setDragOverCharacterId,
    setNewAccountName,
    setNewAccountRegion,
    setNewCharacterName,
    confirm,
  } = params;

  const sync = useDashboardSync({
    setBusy,
    setError,
    setDialogError,
    setInfoMessage,
    setState,
  });

  const dialogHandlers = createDashboardDialogHandlers({
    dialog,
    selectedCharacter,
    selectedAccountId: selectedAccount?.id ?? null,
    corridorDraft,
    taskById,
    appActions,
    sync,
    setDialog,
    setDialogError,
    setCorridorDraft,
  });

  const overviewHandlers = createDashboardOverviewHandlers({
    overviewSortKey,
    busy,
    state,
    draggingCharacterId,
    dragOverCharacterId,
    selectedCharacterId: selectedCharacter?.id ?? null,
    quickCharacterId,
    quickTaskId,
    quickAction,
    quickAmountInput,
    quickCorridorTask,
    characterNameById,
    taskById,
    appActions,
    sync,
    setDashboardMode,
    setDraggingCharacterId,
    setDragOverCharacterId,
    setError: (message) => setError(message),
  });

  const maintenanceHandlers = createDashboardMaintenanceHandlers({
    state,
    selectedCharacterId: selectedCharacter?.id ?? null,
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
  });

  const accountResourceHandlers = createDashboardAccountResourceHandlers({
    newAccountName,
    newAccountRegion,
    selectedAccount,
    accountNameInput,
    accountRegionInput,
    canAddCharacterInSelectedAccount,
    newCharacterName,
    selectedCharacter,
    renameInput,
    profileClassTagInput,
    profileGearScoreInput,
    corridorDraft,
    selectedAodePurchaseLimit,
    selectedAodeConvertLimit,
    shopAodePurchaseUsedInput,
    shopDailyDungeonTicketPurchaseUsedInput,
    transformAodeUsedInput,
    appActions,
    sync,
    setDashboardMode,
    setError,
    setNewAccountName,
    setNewAccountRegion,
    setNewCharacterName,
    confirm,
  });

  return {
    ...dialogHandlers,
    ...overviewHandlers,
    ...maintenanceHandlers,
    ...accountResourceHandlers,
  };
}
