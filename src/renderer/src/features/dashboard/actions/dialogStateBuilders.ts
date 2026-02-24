import type { CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { CorridorDraft, DialogState } from "../dashboard-types";

type TaskEditId = "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game";

export function buildCompleteDialog(taskId: TaskId, title: string): DialogState {
  return { kind: "complete", taskId, title, amount: "1" };
}

export function buildUseTicketDialog(taskId: TaskId, title: string): DialogState {
  return { kind: "use_ticket", taskId, title, amount: "1" };
}

export function buildSetCompletedDialog(task: TaskDefinition): DialogState | null {
  if (!task.setCompletedTotal) return null;
  return { kind: "set_completed", task, amount: "0" };
}

export function buildEnergyDialog(selected: CharacterState): DialogState {
  return {
    kind: "energy",
    baseCurrent: String(selected.energy.baseCurrent),
    bonusCurrent: String(selected.energy.bonusCurrent),
  };
}

export function buildTaskEditDialog(selected: CharacterState, taskId: TaskEditId): DialogState {
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

export function buildSanctumEditDialog(selected: CharacterState): DialogState {
  return {
    kind: "sanctum_edit",
    raidRemaining: String(selected.activities.sanctumRaidRemaining),
    boxRemaining: String(selected.activities.sanctumBoxRemaining),
  };
}

export function buildCorridorSyncDialog(corridorDraft: CorridorDraft): DialogState {
  return {
    kind: "corridor_sync",
    lowerAvailable: corridorDraft.lowerAvailable,
    middleAvailable: corridorDraft.middleAvailable,
  };
}

export function buildCorridorCompleteDialog(corridorDraft: CorridorDraft): DialogState {
  return { kind: "corridor_complete", lane: corridorDraft.completeLane, amount: corridorDraft.completeAmount };
}
