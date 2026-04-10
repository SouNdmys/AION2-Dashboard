import type { TaskDefinition, TaskId } from "../../../../shared/types";

export type ViewMode = "dashboard" | "settings" | "workshop";
export type DashboardMode = "overview" | "character";
export type OverviewSortKey = "manual" | "ready" | "account" | "region";
export type OverviewTaskFilter = "all" | "dungeon" | "weekly" | "mission";
export type QuickTaskId = TaskId | "corridor_lower" | "corridor_middle";
export const MAX_CHARACTERS_PER_ACCOUNT = 8;
export const NO_REGION_FILTER = "__none__";
export const COUNT_SELECT_MAX = 100;

export type DialogState =
  | { kind: "complete"; taskId: TaskId; title: string; amount: string }
  | { kind: "use_ticket"; taskId: TaskId; title: string; amount: string }
  | { kind: "set_completed"; task: TaskDefinition; amount: string }
  | { kind: "energy"; baseCurrent: string; bonusCurrent: string }
  | {
      kind: "corridor_sync";
      lowerAvailable: string;
      middleAvailable: string;
    }
  | { kind: "corridor_complete"; lane: "lower" | "middle"; amount: string }
  | {
      kind: "task_edit";
      taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "daily_dungeon" | "mini_game";
      title: string;
      remainingLabel: string;
      bonusLabel: string;
      remaining: string;
      bonus: string;
      boss?: string;
      bossLabel?: string;
    }
  | {
      kind: "sanctum_edit";
      raidChallengeRemaining: string;
      raidChallengeBonus: string;
      raidBoxRemaining: string;
      raidBoxBonus: string;
      purifyChallengeRemaining: string;
      purifyBoxRemaining: string;
    };

export interface SettingsDraft {
  expeditionGoldPerRun: string;
  transcendenceGoldPerRun: string;
  expeditionRunCap: string;
  transcendenceRunCap: string;
  nightmareRunCap: string;
  awakeningRunCap: string;
  expeditionWarnThreshold: string;
  transcendenceWarnThreshold: string;
  priorityWeightAode: string;
  priorityWeightSanctum: string;
  priorityWeightCorridor: string;
  priorityWeightDungeon: string;
  priorityWeightWeekly: string;
  priorityWeightMission: string;
  priorityWeightLeisure: string;
}

export interface CorridorDraft {
  lowerAvailable: string;
  middleAvailable: string;
  completeLane: "lower" | "middle";
  completeAmount: string;
}

export interface AccountEditorDraft {
  name: string;
  regionTag: string;
}

export type PriorityTone = "high" | "medium" | "low";

export interface PriorityTodoItem {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  score: number;
  tone: PriorityTone;
}

export type PriorityWeightKey = "aode" | "sanctum" | "corridor" | "dungeon" | "weekly" | "mission" | "leisure";

export const QUICK_CORRIDOR_TASKS: Record<"corridor_lower" | "corridor_middle", { title: string; lane: "lower" | "middle" }> = {
  corridor_lower: { title: "回廊完成(下层)", lane: "lower" },
  corridor_middle: { title: "回廊完成(中层)", lane: "middle" },
};

export const PRIORITY_SETTING_FIELDS = [
  { key: "priorityWeightAode", label: "奥德清体力" },
  { key: "priorityWeightSanctum", label: "圣域周本" },
  { key: "priorityWeightCorridor", label: "深渊回廊" },
  { key: "priorityWeightDungeon", label: "远征/超越" },
  { key: "priorityWeightWeekly", label: "周刷新项" },
  { key: "priorityWeightMission", label: "使命任务" },
  { key: "priorityWeightLeisure", label: "小游戏/精灵" },
] as const;
