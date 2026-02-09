import type { AppSettings, CharacterState, TaskDefinition } from "./types";

export const APP_STATE_VERSION = 2;

export const ENERGY_TICK_HOURS = 3;
export const ENERGY_PER_TICK = 15;
export const ENERGY_BASE_CAP = 840;
export const ENERGY_BONUS_CAP = 2000;
export const ENERGY_DEFAULT_BASE_START = 840;
export const ENERGY_DEFAULT_BONUS_START = 0;

export const DAILY_RESET_HOUR = 5;
export const WEEKLY_RESET_DAY = 3;
export const WEEKLY_RESET_HOUR = 5;

export const EXPEDITION_SCHEDULE_HOURS = [4, 12, 20] as const;
export const TRANSCENDENCE_SCHEDULE_HOURS = [3, 15] as const;

export const EXPEDITION_REWARD_MAX = 21;
export const EXPEDITION_BOSS_MAX = 35;
export const TRANSCENDENCE_REWARD_MAX = 14;
export const TRANSCENDENCE_BOSS_MAX = 28;
export const NIGHTMARE_MAX = 14;

export const DEFAULT_SETTINGS: AppSettings = {
  expeditionGoldPerRun: 1_000_000,
  transcendenceGoldPerRun: 1_200_000,
};

export const TASK_IDS = [
  "expedition",
  "transcendence",
  "sanctum_box",
  "sanctum_raid",
  "daily_mission",
  "weekly_order",
  "abyss_lower",
  "abyss_middle",
  "nightmare",
  "awakening",
  "suppression",
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
    id: "sanctum_box",
    title: "圣域开箱",
    description: "每周奖励开箱 2 次，每次消耗 40 奥德。",
    category: "副本",
    energyCost: 40,
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
    title: "圣域",
    description: "每周可挑战 4 次。",
    category: "副本",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "sanctumRaidRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: false,
    baseCapDisplay: 4,
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
    description: "每周 12 次，周三凌晨 5 点刷新。",
    category: "使命",
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
    title: "深渊指令书(下层)",
    description: "每周 20 次，周三凌晨 5 点刷新。",
    category: "使命",
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
    title: "深渊指令书(中层)",
    description: "每周 5 次，周三凌晨 5 点刷新。",
    category: "使命",
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
    id: "suppression",
    title: "讨伐战",
    description: "每周重置基础挑战次数，可叠加券储存。",
    category: "周常",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "suppressionRemaining" }],
    allowComplete: true,
    allowUseTicket: true,
    allowSetCompleted: false,
    ticketTarget: { key: "suppressionTicketBonus", increment: 1 },
    baseCapDisplay: 3,
    useBonusDisplay: true,
  },
  {
    id: "daily_dungeon",
    title: "每日副本",
    description: "每周 7 次，补充券可额外储存。",
    category: "副本",
    energyCost: 0,
    goldReward: 0,
    counterTargets: [{ scope: "activities", key: "dailyDungeonRemaining" }],
    allowComplete: true,
    allowUseTicket: false,
    allowSetCompleted: false,
    baseCapDisplay: 7,
    useBonusDisplay: false,
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

export function createDefaultCharacter(name: string, nowIso: string, id: string): CharacterState {
  return {
    id,
    name,
    avatarSeed: id.slice(0, 6),
    energy: {
      baseCurrent: ENERGY_DEFAULT_BASE_START,
      bonusCurrent: ENERGY_DEFAULT_BONUS_START,
      baseCap: ENERGY_BASE_CAP,
      bonusCap: ENERGY_BONUS_CAP,
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
      suppressionRemaining: 3,
      suppressionTicketBonus: 0,
      dailyDungeonRemaining: 7,
      dailyDungeonTicketStored: 0,
      expeditionRemaining: EXPEDITION_REWARD_MAX,
      expeditionTicketBonus: 0,
      expeditionBossRemaining: EXPEDITION_BOSS_MAX,
      transcendenceRemaining: TRANSCENDENCE_REWARD_MAX,
      transcendenceTicketBonus: 0,
      transcendenceBossRemaining: TRANSCENDENCE_BOSS_MAX,
      sanctumRaidRemaining: 4,
      sanctumBoxRemaining: 2,
      artifactAvailable: 0,
      artifactNextAt: null,
    },
    stats: createEmptyWeeklyStats(nowIso),
    meta: {
      lastSyncedAt: nowIso,
    },
  };
}
