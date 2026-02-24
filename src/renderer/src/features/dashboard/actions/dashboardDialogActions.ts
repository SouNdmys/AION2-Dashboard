import { getNextUnifiedCorridorRefresh } from "../../../../../shared/time";
import type { AppState, CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { CorridorDraft, DialogState } from "../dashboard-types";
import { toInt } from "../dashboard-utils";

type DialogAppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;
type OpenDialog = (dialog: DialogState) => void;
type ResetDialogError = () => void;
type TaskEditId = "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game";

interface ConfirmDashboardDialogParams {
  dialog: DialogState;
  selected: CharacterState;
  selectedAccountId: string | null;
  appActions: DialogAppActions;
  taskById: Map<TaskId, TaskDefinition>;
  sync: SyncRunner;
  onDialogError: (message: string) => void;
  onDialogClose: () => void;
  onCorridorDraftSyncCounts: (lower: number, middle: number) => void;
  onCorridorDraftSyncCompletion: (completed: number, lane: "lower" | "middle") => void;
}

export async function confirmDashboardDialog(params: ConfirmDashboardDialogParams): Promise<void> {
  const {
    dialog,
    selected,
    selectedAccountId,
    appActions,
    taskById,
    sync,
    onDialogError,
    onDialogClose,
    onCorridorDraftSyncCounts,
    onCorridorDraftSyncCompletion,
  } = params;

  if (dialog.kind === "complete") {
    const task = taskById.get(dialog.taskId);
    const requested = toInt(dialog.amount);
    if (!task || requested === null || requested <= 0) {
      onDialogError("请输入有效的完成次数");
      return;
    }
    const ok = await sync(
      appActions.applyTaskAction({
        characterId: selected.id,
        taskId: dialog.taskId,
        action: "complete_once",
        amount: requested,
      }),
    );
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "use_ticket") {
    const amount = toInt(dialog.amount);
    if (amount === null || amount <= 0) {
      onDialogError("请输入有效的吃券数量");
      return;
    }
    const ok = await sync(
      appActions.applyTaskAction({
        characterId: selected.id,
        taskId: dialog.taskId,
        action: "use_ticket",
        amount,
      }),
    );
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "set_completed") {
    const amount = toInt(dialog.amount);
    if (amount === null || amount < 0) {
      onDialogError("请输入有效的已完成次数");
      return;
    }
    const capped = Math.min(amount, dialog.task.setCompletedTotal ?? 0);
    const ok = await sync(
      appActions.applyTaskAction({
        characterId: selected.id,
        taskId: dialog.task.id,
        action: "set_completed",
        amount: capped,
      }),
    );
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "energy") {
    const base = toInt(dialog.baseCurrent);
    const bonus = toInt(dialog.bonusCurrent);
    if (base === null || bonus === null || base < 0 || bonus < 0) {
      onDialogError("请输入有效的能量数值");
      return;
    }
    const ok = await sync(appActions.updateEnergySegments(selected.id, base, bonus));
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "corridor_sync") {
    if (!selectedAccountId) {
      onDialogError("未找到当前账号");
      return;
    }
    const lowerCount = toInt(dialog.lowerAvailable);
    const middleCount = toInt(dialog.middleAvailable);
    if (lowerCount === null || lowerCount < 0 || lowerCount > 3 || middleCount === null || middleCount < 0 || middleCount > 3) {
      onDialogError("回廊数量必须是 0-3");
      return;
    }
    const nextUnifiedAt = getNextUnifiedCorridorRefresh(new Date()).toISOString();
    const ok = await sync(
      appActions.updateArtifactStatus(selectedAccountId, lowerCount, nextUnifiedAt, middleCount, nextUnifiedAt),
      "已同步深渊回廊到当前账号角色",
    );
    if (ok) {
      onCorridorDraftSyncCounts(lowerCount, middleCount);
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "corridor_complete") {
    const completed = toInt(dialog.amount);
    if (completed === null || completed <= 0) {
      onDialogError("请输入有效的完成次数");
      return;
    }
    const ok = await sync(appActions.applyCorridorCompletion(selected.id, dialog.lane, completed), "已录入深渊回廊完成次数");
    if (ok) {
      onCorridorDraftSyncCompletion(completed, dialog.lane);
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "task_edit") {
    const remaining = toInt(dialog.remaining);
    const bonus = toInt(dialog.bonus);
    const boss = dialog.boss !== undefined ? toInt(dialog.boss) : null;
    if (remaining === null || bonus === null || remaining < 0 || bonus < 0 || (dialog.boss !== undefined && (boss === null || boss < 0))) {
      onDialogError("请输入有效的次数");
      return;
    }
    let ok = false;
    if (dialog.taskId === "expedition") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          expeditionRemaining: remaining,
          expeditionTicketBonus: bonus,
          expeditionBossRemaining: boss ?? undefined,
        }),
      );
    } else if (dialog.taskId === "transcendence") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          transcendenceRemaining: remaining,
          transcendenceTicketBonus: bonus,
          transcendenceBossRemaining: boss ?? undefined,
        }),
      );
    } else if (dialog.taskId === "nightmare") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          nightmareRemaining: remaining,
          nightmareTicketBonus: bonus,
        }),
      );
    } else if (dialog.taskId === "awakening") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          awakeningRemaining: remaining,
          awakeningTicketBonus: bonus,
        }),
      );
    } else if (dialog.taskId === "daily_dungeon") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          dailyDungeonRemaining: remaining,
          dailyDungeonTicketStored: bonus,
        }),
      );
    } else if (dialog.taskId === "mini_game") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          miniGameRemaining: remaining,
          miniGameTicketBonus: bonus,
        }),
      );
    } else {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          suppressionRemaining: remaining,
          suppressionTicketBonus: bonus,
        }),
      );
    }
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "sanctum_edit") {
    const raidRemaining = toInt(dialog.raidRemaining);
    const boxRemaining = toInt(dialog.boxRemaining);
    if (raidRemaining === null || boxRemaining === null || raidRemaining < 0 || boxRemaining < 0) {
      onDialogError("请输入有效的圣域次数");
      return;
    }
    const ok = await sync(
      appActions.updateRaidCounts(selected.id, {
        sanctumRaidRemaining: raidRemaining,
        sanctumBoxRemaining: boxRemaining,
      }),
    );
    if (ok) {
      onDialogClose();
    }
  }
}

interface OpenCompleteTaskDialogParams {
  taskId: TaskId;
  title: string;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openCompleteTaskDialogAction(params: OpenCompleteTaskDialogParams): void {
  const { taskId, title, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildCompleteDialog(taskId, title));
}

interface OpenUseTicketTaskDialogParams {
  taskId: TaskId;
  title: string;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openUseTicketTaskDialogAction(params: OpenUseTicketTaskDialogParams): void {
  const { taskId, title, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildUseTicketDialog(taskId, title));
}

interface OpenSetCompletedTaskDialogParams {
  task: TaskDefinition;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openSetCompletedTaskDialogAction(params: OpenSetCompletedTaskDialogParams): void {
  const { task, onDialogOpen, onDialogErrorReset } = params;
  const nextDialog = buildSetCompletedDialog(task);
  if (!nextDialog) return;
  onDialogErrorReset();
  onDialogOpen(nextDialog);
}

interface OpenEnergyDialogParams {
  selectedCharacter: CharacterState | null;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openEnergyDialogAction(params: OpenEnergyDialogParams): void {
  const { selectedCharacter, onDialogOpen, onDialogErrorReset } = params;
  if (!selectedCharacter) return;
  onDialogErrorReset();
  onDialogOpen(buildEnergyDialog(selectedCharacter));
}

interface OpenTaskEditDialogParams {
  selectedCharacter: CharacterState | null;
  taskId: TaskEditId;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openTaskEditDialogAction(params: OpenTaskEditDialogParams): void {
  const { selectedCharacter, taskId, onDialogOpen, onDialogErrorReset } = params;
  if (!selectedCharacter) return;
  onDialogErrorReset();
  onDialogOpen(buildTaskEditDialog(selectedCharacter, taskId));
}

interface OpenSanctumEditDialogParams {
  selectedCharacter: CharacterState | null;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openSanctumEditDialogAction(params: OpenSanctumEditDialogParams): void {
  const { selectedCharacter, onDialogOpen, onDialogErrorReset } = params;
  if (!selectedCharacter) return;
  onDialogErrorReset();
  onDialogOpen(buildSanctumEditDialog(selectedCharacter));
}

interface OpenCorridorSyncDialogParams {
  corridorDraft: CorridorDraft;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openCorridorSyncDialogAction(params: OpenCorridorSyncDialogParams): void {
  const { corridorDraft, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildCorridorSyncDialog(corridorDraft));
}

interface OpenCorridorCompleteDialogParams {
  corridorDraft: CorridorDraft;
  onDialogOpen: OpenDialog;
  onDialogErrorReset: ResetDialogError;
}

export function openCorridorCompleteDialogAction(params: OpenCorridorCompleteDialogParams): void {
  const { corridorDraft, onDialogOpen, onDialogErrorReset } = params;
  onDialogErrorReset();
  onDialogOpen(buildCorridorCompleteDialog(corridorDraft));
}

function buildCompleteDialog(taskId: TaskId, title: string): DialogState {
  return { kind: "complete", taskId, title, amount: "1" };
}

function buildUseTicketDialog(taskId: TaskId, title: string): DialogState {
  return { kind: "use_ticket", taskId, title, amount: "1" };
}

function buildSetCompletedDialog(task: TaskDefinition): DialogState | null {
  if (!task.setCompletedTotal) return null;
  return { kind: "set_completed", task, amount: "0" };
}

function buildEnergyDialog(selected: CharacterState): DialogState {
  return {
    kind: "energy",
    baseCurrent: String(selected.energy.baseCurrent),
    bonusCurrent: String(selected.energy.bonusCurrent),
  };
}

function buildTaskEditDialog(selected: CharacterState, taskId: TaskEditId): DialogState {
  if (taskId === "expedition") {
    return {
      kind: "task_edit",
      taskId,
      title: "远征副本",
      remainingLabel: "基础次数",
      bonusLabel: "券次数",
      remaining: String(selected.activities.expeditionRemaining),
      bonus: String(selected.activities.expeditionTicketBonus),
      boss: String(selected.activities.expeditionBossRemaining),
      bossLabel: "首领次数",
    };
  }
  if (taskId === "transcendence") {
    return {
      kind: "task_edit",
      taskId,
      title: "超越副本",
      remainingLabel: "基础次数",
      bonusLabel: "券次数",
      remaining: String(selected.activities.transcendenceRemaining),
      bonus: String(selected.activities.transcendenceTicketBonus),
      boss: String(selected.activities.transcendenceBossRemaining),
      bossLabel: "首领次数",
    };
  }
  if (taskId === "nightmare") {
    return {
      kind: "task_edit",
      taskId,
      title: "恶梦",
      remainingLabel: "基础次数",
      bonusLabel: "券次数",
      remaining: String(selected.activities.nightmareRemaining),
      bonus: String(selected.activities.nightmareTicketBonus),
    };
  }
  if (taskId === "awakening") {
    return {
      kind: "task_edit",
      taskId,
      title: "觉醒战",
      remainingLabel: "基础次数",
      bonusLabel: "券次数",
      remaining: String(selected.activities.awakeningRemaining),
      bonus: String(selected.activities.awakeningTicketBonus),
    };
  }
  if (taskId === "daily_dungeon") {
    return {
      kind: "task_edit",
      taskId,
      title: "每日副本",
      remainingLabel: "基础次数",
      bonusLabel: "券库存",
      remaining: String(selected.activities.dailyDungeonRemaining),
      bonus: String(selected.activities.dailyDungeonTicketStored),
    };
  }
  if (taskId === "mini_game") {
    return {
      kind: "task_edit",
      taskId,
      title: "小游戏",
      remainingLabel: "基础次数",
      bonusLabel: "券次数",
      remaining: String(selected.activities.miniGameRemaining),
      bonus: String(selected.activities.miniGameTicketBonus),
    };
  }
  return {
    kind: "task_edit",
    taskId,
    title: "讨伐战",
    remainingLabel: "基础次数",
    bonusLabel: "券次数",
    remaining: String(selected.activities.suppressionRemaining),
    bonus: String(selected.activities.suppressionTicketBonus),
  };
}

function buildSanctumEditDialog(selected: CharacterState): DialogState {
  return {
    kind: "sanctum_edit",
    raidRemaining: String(selected.activities.sanctumRaidRemaining),
    boxRemaining: String(selected.activities.sanctumBoxRemaining),
  };
}

function buildCorridorSyncDialog(corridorDraft: CorridorDraft): DialogState {
  return {
    kind: "corridor_sync",
    lowerAvailable: corridorDraft.lowerAvailable,
    middleAvailable: corridorDraft.middleAvailable,
  };
}

function buildCorridorCompleteDialog(corridorDraft: CorridorDraft): DialogState {
  return { kind: "corridor_complete", lane: corridorDraft.completeLane, amount: corridorDraft.completeAmount };
}
