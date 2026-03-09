import type { DragEvent } from "react";
import type { AppState, TaskActionKind, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { OverviewSortKey, QuickTaskId } from "../dashboard-types";
import { getQuickActionsForTask, toInt } from "../dashboard-utils";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;

interface StartOverviewCardDragParams {
  overviewSortKey: OverviewSortKey;
  busy: boolean;
  characterId: string;
  onDraggingCharacterChange: (characterId: string | null) => void;
  onDragOverCharacterChange: (characterId: string | null) => void;
}

export function startOverviewCardDragAction(params: StartOverviewCardDragParams): void {
  const { overviewSortKey, busy, characterId, onDraggingCharacterChange, onDragOverCharacterChange } = params;
  if (overviewSortKey !== "manual" || busy) return;
  onDraggingCharacterChange(characterId);
  onDragOverCharacterChange(characterId);
}

interface OverviewCardDragOverParams {
  event: DragEvent<HTMLElement>;
  overviewSortKey: OverviewSortKey;
  draggingCharacterId: string | null;
  characterId: string;
  dragOverCharacterId: string | null;
  onDragOverCharacterChange: (characterId: string) => void;
}

export function overviewCardDragOverAction(params: OverviewCardDragOverParams): void {
  const { event, overviewSortKey, draggingCharacterId, characterId, dragOverCharacterId, onDragOverCharacterChange } = params;
  if (overviewSortKey !== "manual" || !draggingCharacterId || draggingCharacterId === characterId) {
    return;
  }
  event.preventDefault();
  if (dragOverCharacterId !== characterId) {
    onDragOverCharacterChange(characterId);
  }
}

interface OverviewCardDropParams {
  event: DragEvent<HTMLElement>;
  overviewSortKey: OverviewSortKey;
  state: AppState | null;
  draggingCharacterId: string | null;
  targetCharacterId: string;
  appActions: AppActions;
  sync: SyncRunner;
  onDragStateReset: () => void;
}

export function overviewCardDropAction(params: OverviewCardDropParams): void {
  const { event, overviewSortKey, state, draggingCharacterId, targetCharacterId, appActions, sync, onDragStateReset } = params;
  event.preventDefault();
  if (overviewSortKey !== "manual" || !state || !draggingCharacterId) {
    onDragStateReset();
    return;
  }
  if (draggingCharacterId === targetCharacterId) {
    onDragStateReset();
    return;
  }
  const ids = state.characters.map((item) => item.id);
  const fromIndex = ids.indexOf(draggingCharacterId);
  const toIndex = ids.indexOf(targetCharacterId);
  if (fromIndex < 0 || toIndex < 0) {
    onDragStateReset();
    return;
  }
  const [moved] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, moved);
  onDragStateReset();
  void sync(appActions.reorderCharacters(ids), "角色卡片排序已更新");
}

interface EndOverviewCardDragParams {
  onDragStateReset: () => void;
}

export function endOverviewCardDragAction(params: EndOverviewCardDragParams): void {
  const { onDragStateReset } = params;
  onDragStateReset();
}

interface ApplyQuickEntryParams {
  state: AppState | null;
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
  onError: (message: string) => void;
}

export function applyQuickEntryAction(params: ApplyQuickEntryParams): void {
  const {
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
    onError,
  } = params;
  if (!state) return;
  const characterId = quickCharacterId || selectedCharacterId;
  if (!characterId) {
    onError("请选择角色");
    return;
  }
  const rawAmount = toInt(quickAmountInput);
  if (rawAmount === null) {
    onError("请输入有效次数");
    return;
  }
  const characterName = characterNameById.get(characterId) ?? "角色";

  if (quickCorridorTask) {
    if (quickAction !== "set_completed") {
      onError("回廊快速录入仅支持输入已完成次数");
      return;
    }
    if (rawAmount < 0) {
      onError("已完成次数不能小于 0");
      return;
    }
    const targetCharacter = state.characters.find((item) => item.id === characterId);
    const cap = quickCorridorTask.lane === "lower"
      ? targetCharacter?.activities.corridorLowerCap ?? 3
      : targetCharacter?.activities.corridorMiddleCap ?? 3;
    const completed = Math.min(rawAmount, cap);
    void sync(
      appActions.setCorridorCompleted(characterId, quickCorridorTask.lane, completed),
      `${characterName} ${quickCorridorTask.title} 已录入`,
    );
    return;
  }

  const task = taskById.get(quickTaskId as TaskId);
  if (!task) {
    onError("请选择有效内容");
    return;
  }
  const allowedActions = getQuickActionsForTask(task);
  if (!allowedActions.includes(quickAction)) {
    onError("该内容不支持当前动作");
    return;
  }

  let amount = rawAmount;
  if (quickAction === "set_completed") {
    if (amount < 0) {
      onError("已完成次数不能小于 0");
      return;
    }
    if (task.setCompletedTotal) {
      amount = Math.min(amount, task.setCompletedTotal);
    }
  } else if (amount <= 0) {
    onError("次数必须大于 0");
    return;
  }

  void sync(
    appActions.applyTaskAction({
      characterId,
      taskId: task.id,
      action: quickAction,
      amount,
    }),
    `${characterName} ${task.title} 已录入`,
  );
}
