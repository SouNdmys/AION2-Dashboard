import type { DragEvent } from "react";
import type { AppState, TaskActionKind, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { OverviewSortKey, QuickTaskId } from "../dashboard-types";
import {
  applyQuickEntryAction,
  endOverviewCardDragAction,
  overviewCardDragOverAction,
  overviewCardDropAction,
  startOverviewCardDragAction,
} from "./overviewInteractionActions";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;
type SetDashboardMode = (mode: "overview" | "character") => void;
type SetDraggingCharacterId = (characterId: string | null) => void;
type SetDragOverCharacterId = (characterId: string | null) => void;
type SetError = (message: string) => void;

interface CreateDashboardOverviewHandlersParams {
  overviewSortKey: OverviewSortKey;
  busy: boolean;
  state: AppState | null;
  draggingCharacterId: string | null;
  dragOverCharacterId: string | null;
  selectedCharacterId: string | null;
  quickCharacterId: string;
  quickTaskId: QuickTaskId;
  quickAction: TaskActionKind;
  quickAmountInput: string;
  quickCorridorTask: { title: string; lane: "lower" | "middle" } | null;
  characterNameById: Map<string, string>;
  taskById: Map<TaskId, TaskDefinition>;
  appActions: AppActions;
  sync: SyncRunner;
  setDashboardMode: SetDashboardMode;
  setDraggingCharacterId: SetDraggingCharacterId;
  setDragOverCharacterId: SetDragOverCharacterId;
  setError: SetError;
}

interface OverviewHandlers {
  onOverviewCardDragStart: (characterId: string) => void;
  onOverviewCardDragOver: (event: DragEvent<HTMLElement>, characterId: string) => void;
  onOverviewCardDrop: (event: DragEvent<HTMLElement>, targetCharacterId: string) => void;
  onOverviewCardDragEnd: () => void;
  onSwitchToOverview: () => void;
  onApplyQuickAction: () => void;
}

export function createDashboardOverviewHandlers(params: CreateDashboardOverviewHandlersParams): OverviewHandlers {
  const {
    overviewSortKey,
    busy,
    state,
    draggingCharacterId,
    dragOverCharacterId,
    selectedCharacterId,
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
    setError,
  } = params;

  const onDragStateReset = (): void => {
    setDraggingCharacterId(null);
    setDragOverCharacterId(null);
  };

  function onOverviewCardDragStart(characterId: string): void {
    startOverviewCardDragAction({
      overviewSortKey,
      busy,
      characterId,
      onDraggingCharacterChange: setDraggingCharacterId,
      onDragOverCharacterChange: setDragOverCharacterId,
    });
  }

  function onOverviewCardDragOver(event: DragEvent<HTMLElement>, characterId: string): void {
    overviewCardDragOverAction({
      event,
      overviewSortKey,
      draggingCharacterId,
      characterId,
      dragOverCharacterId,
      onDragOverCharacterChange: setDragOverCharacterId,
    });
  }

  function onOverviewCardDrop(event: DragEvent<HTMLElement>, targetCharacterId: string): void {
    overviewCardDropAction({
      event,
      overviewSortKey,
      state,
      draggingCharacterId,
      targetCharacterId,
      appActions,
      sync,
      onDragStateReset,
    });
  }

  function onOverviewCardDragEnd(): void {
    endOverviewCardDragAction({
      onDragStateReset,
    });
  }

  function onSwitchToOverview(): void {
    setDashboardMode("overview");
  }

  function onApplyQuickAction(): void {
    applyQuickEntryAction({
      state,
      selectedCharacterId,
      quickCharacterId,
      quickTaskId,
      quickAction,
      quickAmountInput,
      quickCorridorTask,
      characterNameById,
      taskById,
      appActions,
      sync,
      onError: setError,
    });
  }

  return {
    onOverviewCardDragStart,
    onOverviewCardDragOver,
    onOverviewCardDrop,
    onOverviewCardDragEnd,
    onSwitchToOverview,
    onApplyQuickAction,
  };
}
