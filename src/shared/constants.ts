import type { AccountState, AppSettings, CharacterState, TaskDefinition } from "./types";

export const APP_STATE_VERSION = 9;

export const ENERGY_TICK_HOURS = 3;
export const ENERGY_PER_TICK = 15;
export const ENERGY_BASE_CAP = 840;
export const ENERGY_BONUS_CAP = 2000;
export const ENERGY_DEFAULT_BASE_START = 840;
export const ENERGY_DEFAULT_BONUS_START = 0;

export const DAILY_RESET_HOUR = 5;
export const WEEKLY_RESET_DAY = 3;
export const WEEKLY_RESET_HOUR = 5;

export const AODE_ENERGY_SCHEDULE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23] as const;
export const EXPEDITION_SCHEDULE_HOURS = [5, 13, 21] as const;
export const TRANSCENDENCE_SCHEDULE_HOURS = [5, 17] as const;
export const CORRIDOR_UNIFIED_REFRESH_HOUR = 21;
export const CORRIDOR_UNIFIED_REFRESH_DAYS = [2, 4, 6] as const;

export const EXPEDITION_REWARD_MAX = 14;
export const EXPEDITION_BOSS_MAX = 35;
export const TRANSCENDENCE_REWARD_MAX = 7;
export const TRANSCENDENCE_BOSS_MAX = 28;
export const DAILY_DUNGEON_SHARED_MAX = 14;
export const NIGHTMARE_MAX = 14;
export const MINI_GAME_MAX = 14;
export const SPIRIT_INVASION_MAX = 7;
export const AODE_SHOP_SERVER_LIMIT = 21;
export const UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT = 21;
export const EXPEDITION_CHOICE_BOX_SERVER_LIMIT = 21;
export const NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT = 14;
export const ABYSS_REPLENISH_TICKET_SERVER_LIMIT = 1;
export const AODE_CONVERT_SERVER_LIMIT = 20;
export const AODE_POINT_PER_OPERATION = 40;
export const AODE_BASE_ENERGY_OVERFLOW_WARN_THRESHOLD = 800;

export const DEFAULT_SETTINGS: AppSettings = {
  expeditionGoldPerRun: 1_000_000,
  transcendenceGoldPerRun: 1_200_000,
  expeditionRunCap: null,
  transcendenceRunCap: null,
  nightmareRunCap: null,
  awakeningRunCap: null,
  expeditionWarnThreshold: 63,
  transcendenceWarnThreshold: 42,
  priorityWeightAode: 3,
  priorityWeightSanctum: 3,
  priorityWeightCorridor: 3,
  priorityWeightDungeon: 3,
  priorityWeightWeekly: 3,
  priorityWeightMission: 3,
  priorityWeightLeisure: 3,
};

export const TASK_IDS = [
  "expedition",
  "transcendence",
  "mini_game",
  "spirit_invasion",
  "sanctum_box",
  "sanctum_raid",
  "daily_mission",
  "weekly_order",
  "abyss_lower",
  "abyss_middle",
  "nightmare",
  "awakening",
  "daily_dungeon",
] as const;

export const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    id: "expedition",
    title: "远征副本",
    description: "默认每次消耗 80 奥德，收益可配置。",
    category: "副本",
    energyCost: 80,
    goldReward: 1_000_000,
    goldRewardSettingKey: "expeditionGoldPerRun",
    counterTargets: [
      { scope: "activities", key: "expeditionRemaining" },
      { scope: "activities", key: "expeditionBossRemaining" },
    ],
    allowComplete: true,
    allowUseTicket: true,
    allowSetCompleted: false,
    ticketTarget: { key: "expeditionTicketBonus", increment: 1 },
    baseCapDisplay: EXPEDITION_REWARD_MAX,
    useBonusDisplay: true,
  },
  {
    id: "transcendence",
    title: "超越副本",
    description: "默认每次消耗 80 奥德，收益可配置。",
    category: "副本",
    energyCost: 80,
    goldReward: 1_200_000,
    goldRewardSettingKey: "transcendenceGoldPerRun",
    counterTargets: [
      { scope: "activities", key: "transcendenceRemaining" },
      { scope: "activities", key: "transcendenceBossRemaining" },
    ],
    allowComplete: true,
    allowUseTicket: true,
    allowSetCompleted: false,
    ticketTarget: { key: "transcendenceTicketBonus", increment: 1 },
    baseCapDisplay: TRANSCENDENCE_REWARD_MAX,
    useBonusDisplay: true,
  },
  {
    id: "mini_game",
    title: "小游戏",
    description: "每日新增 2 次，最多储存 14 次。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "miniGameRemaining" }],
    allowComplete: true,
    allowUseTicket: true,
    allowSetCompleted: false,
    ticketTarget: { key: "miniGameTicketBonus", increment: 1 },
    baseCapDisplay: MINI_GAME_MAX,
    useBonusDisplay: true,
  },
  {
    id: "spirit_invasion",
    title: "精灵入侵",
    description: "每日新增 1 次，最多储存 7 次。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "spiritInvasionRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: false,
    baseCapDisplay: SPIRIT_INVASION_MAX,
    useBonusDisplay: false,
  },
  {
    id: "sanctum_box",
    title: "圣域：侵蚀净化所",
    description: "每周可完成 2 次，每次默认消耗 80 奥德。",
    category: "副本",
    energyCost: 80,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "sanctumBoxRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: false,
    baseCapDisplay: 2,
    useBonusDisplay: false,
  },
  {
    id: "sanctum_raid",
    title: "圣域：卢德莱",
    description: "每周可完成 2 次，每次默认消耗 80 奥德。",
    category: "副本",
    energyCost: 80,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "sanctumRaidRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: false,
    baseCapDisplay: 2,
    useBonusDisplay: false,
  },
  {
    id: "daily_mission",
    title: "每日使命",
    description: "每日 5 次，凌晨 5 点刷新。",
    category: "使命",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "missions", key: "dailyRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: true,
    setCompletedTotal: 5,
    baseCapDisplay: 5,
    useBonusDisplay: false,
  },
  {
    id: "weekly_order",
    title: "每周指令书",
    description: "当前伺服器共享每周 12 次，周三凌晨 5 点刷新。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "missions", key: "weeklyRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: true,
    setCompletedTotal: 12,
    baseCapDisplay: 12,
    useBonusDisplay: false,
  },
  {
    id: "abyss_lower",
    title: "深渊下层指令",
    description: "当前伺服器共享每周 20 次，周三凌晨 5 点刷新。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "missions", key: "abyssLowerRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: true,
    setCompletedTotal: 20,
    baseCapDisplay: 20,
    useBonusDisplay: false,
  },
  {
    id: "abyss_middle",
    title: "深渊中层指令",
    description: "当前伺服器共享每周 5 次，周三凌晨 5 点刷新。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "missions", key: "abyssMiddleRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: true,
    setCompletedTotal: 5,
    baseCapDisplay: 5,
    useBonusDisplay: false,
  },
  {
    id: "nightmare",
    title: "恶梦",
    description: "每日新增 2 次，最多储存 14 次。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "nightmareRemaining" }],
    allowComplete: true,
    allowUseTicket: true,
    allowSetCompleted: false,
    ticketTarget: { key: "nightmareTicketBonus", increment: 1 },
    baseCapDisplay: NIGHTMARE_MAX,
    useBonusDisplay: true,
  },
  {
    id: "awakening",
    title: "觉醒战",
    description: "每周重置基础挑战次数。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "awakeningRemaining" }],
    allowComplete: true,
    allowUseTicket: true,
    allowSetCompleted: false,
    ticketTarget: { key: "awakeningTicketBonus", increment: 1 },
    baseCapDisplay: 3,
    useBonusDisplay: true,
  },
  {
    id: "daily_dungeon",
    title: "每日副本",
    description: "当前伺服器共享每周 14 次，补充券库存同样按伺服器共享。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "dailyDungeonRemaining" }],
    allowComplete: true,
    allowUseTicket: true,
    allowSetCompleted: false,
    ticketTarget: { key: "dailyDungeonTicketStored", increment: 1 },
    baseCapDisplay: DAILY_DUNGEON_SHARED_MAX,
    useBonusDisplay: true,
  },
];

export function createEmptyCompletions(): Record<(typeof TASK_IDS)[number], number> {
  return TASK_IDS.reduce(
    (acc, taskId) => {
      acc[taskId] = 0;
      return acc;
    },
    {} as Record<(typeof TASK_IDS)[number], number>,
  );
}

export function createEmptyWeeklyStats(nowIso: string) {
  return {
    cycleStartedAt: nowIso,
    goldEarned: 0,
    completions: createEmptyCompletions(),
  };
}

export function createDefaultAccount(name: string, id: string): AccountState {
  return {
    id,
    name,
    sharedActivities: {
      dailyDungeonRemaining: DAILY_DUNGEON_SHARED_MAX,
      dailyDungeonTicketStored: 0,
      weeklyRemaining: 12,
      abyssLowerRemaining: 20,
      abyssMiddleRemaining: 5,
    },
    breezePlan: {
      shopAodePurchaseUsed: 0,
      shopUnknownChallengeTicketUsed: 0,
      shopExpeditionChoiceBoxUsed: 0,
      shopNightmareInstantUsed: 0,
      shopAbyssReplenishUsed: 0,
      transformAodeUsed: 0,
    },
  };
}

export function createDefaultCharacter(name: string, nowIso: string, id: string, accountId: string): CharacterState {
  return {
    id,
    accountId,
    name,
    isStarred: false,
    avatarSeed: id.slice(0, 6),
    energy: {
      baseCurrent: ENERGY_DEFAULT_BASE_START,
      bonusCurrent: ENERGY_DEFAULT_BONUS_START,
      baseCap: ENERGY_BASE_CAP,
      bonusCap: ENERGY_BONUS_CAP,
    },
    aodePlan: {
      shopAodePurchaseUsed: 0,
      shopUnknownChallengeTicketUsed: 0,
      shopExpeditionChoiceBoxUsed: 0,
      shopNightmareInstantUsed: 0,
      shopAbyssReplenishUsed: 0,
      transformAodeUsed: 0,
    },
    missions: {
      dailyRemaining: 5,
      weeklyRemaining: 12,
      abyssLowerRemaining: 20,
      abyssMiddleRemaining: 5,
    },
    activities: {
      nightmareRemaining: NIGHTMARE_MAX,
      nightmareTicketBonus: 0,
      awakeningRemaining: 3,
      awakeningTicketBonus: 0,
      dailyDungeonRemaining: DAILY_DUNGEON_SHARED_MAX,
      dailyDungeonTicketStored: 0,
      expeditionRemaining: EXPEDITION_REWARD_MAX,
      expeditionTicketBonus: 0,
      expeditionBossRemaining: EXPEDITION_BOSS_MAX,
      transcendenceRemaining: TRANSCENDENCE_REWARD_MAX,
      transcendenceTicketBonus: 0,
      transcendenceBossRemaining: TRANSCENDENCE_BOSS_MAX,
      sanctumRaidRemaining: 2,
      sanctumBoxRemaining: 2,
      miniGameRemaining: MINI_GAME_MAX,
      miniGameTicketBonus: 0,
      spiritInvasionRemaining: SPIRIT_INVASION_MAX,
      corridorLowerAvailable: 0,
      corridorLowerCap: 3,
      corridorLowerNextAt: null,
      corridorMiddleAvailable: 0,
      corridorMiddleCap: 3,
      corridorMiddleNextAt: null,
    },
    stats: createEmptyWeeklyStats(nowIso),
    meta: {
      lastSyncedAt: nowIso,
    },
  };
}
