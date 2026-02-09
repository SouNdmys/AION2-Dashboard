export type TaskActionKind = "complete_once" | "use_ticket" | "set_completed";
export type TaskId =
  | "expedition"
  | "transcendence"
  | "sanctum_box"
  | "daily_mission"
  | "weekly_order"
  | "abyss_lower"
  | "abyss_middle"
  | "nightmare"
  | "awakening"
  | "suppression"
  | "daily_dungeon"
  | "sanctum_raid";

export interface EnergyState {
  baseCurrent: number;
  bonusCurrent: number;
  baseCap: number;
  bonusCap: number;
}

export interface MissionState {
  dailyRemaining: number;
  weeklyRemaining: number;
  abyssLowerRemaining: number;
  abyssMiddleRemaining: number;
}

export interface ActivityState {
  nightmareRemaining: number;
  nightmareTicketBonus: number;
  awakeningRemaining: number;
  awakeningTicketBonus: number;
  suppressionRemaining: number;
  suppressionTicketBonus: number;
  dailyDungeonRemaining: number;
  dailyDungeonTicketStored: number;
  expeditionRemaining: number;
  expeditionTicketBonus: number;
  expeditionBossRemaining: number;
  transcendenceRemaining: number;
  transcendenceTicketBonus: number;
  transcendenceBossRemaining: number;
  sanctumRaidRemaining: number;
  sanctumBoxRemaining: number;
  artifactAvailable: number;
  artifactNextAt: string | null;
}

export interface ProgressMeta {
  lastSyncedAt: string;
}

export type MissionCounterKey = keyof MissionState;
export type ActivityCounterKey =
  | "nightmareRemaining"
  | "awakeningRemaining"
  | "suppressionRemaining"
  | "dailyDungeonRemaining"
  | "expeditionRemaining"
  | "expeditionBossRemaining"
  | "transcendenceRemaining"
  | "transcendenceBossRemaining"
  | "sanctumRaidRemaining"
  | "sanctumBoxRemaining";

export type ActivityTicketKey =
  | "nightmareTicketBonus"
  | "awakeningTicketBonus"
  | "suppressionTicketBonus"
  | "expeditionTicketBonus"
  | "transcendenceTicketBonus";

export interface WeeklyStats {
  cycleStartedAt: string;
  goldEarned: number;
  completions: Record<TaskId, number>;
}

export interface CharacterState {
  id: string;
  name: string;
  classTag?: string;
  avatarSeed: string;
  energy: EnergyState;
  missions: MissionState;
  activities: ActivityState;
  stats: WeeklyStats;
  meta: ProgressMeta;
}

export interface AppSettings {
  expeditionGoldPerRun: number;
  transcendenceGoldPerRun: number;
}

export interface AppState {
  version: number;
  selectedCharacterId: string | null;
  settings: AppSettings;
  characters: CharacterState[];
}

export interface TaskCounterTarget {
  scope: "missions" | "activities";
  key: MissionCounterKey | ActivityCounterKey;
  decrement?: number;
}

export interface TaskTicketTarget {
  key: ActivityTicketKey;
  increment?: number;
}

export interface TaskDefinition {
  id: TaskId;
  title: string;
  description: string;
  category: "副本" | "使命" | "周常";
  energyCost: number;
  goldReward: number;
  goldRewardSettingKey?: keyof AppSettings;
  counterTargets: TaskCounterTarget[];
  allowComplete: boolean;
  allowUseTicket: boolean;
  allowSetCompleted: boolean;
  setCompletedTotal?: number;
  ticketTarget?: TaskTicketTarget;
  baseCapDisplay?: number;
  useBonusDisplay?: boolean;
  consumeTicketFirst?: boolean;
}

export interface ApplyTaskActionInput {
  characterId: string;
  taskId: TaskId;
  action: TaskActionKind;
  amount?: number;
}

export interface CharacterSummary {
  characterId: string;
  name: string;
  canRunExpedition: boolean;
  estimatedGoldIfClearEnergy: number;
  weeklyGoldEarned: number;
  hasDailyMissionLeft: boolean;
  hasWeeklyMissionLeft: boolean;
  canRunNightmare: boolean;
  canRunAwakening: boolean;
  canRunSuppression: boolean;
  pendingLabels: string[];
}
