import {
  ENERGY_BASE_CAP,
  ENERGY_BONUS_CAP,
  ENERGY_PER_TICK,
  ENERGY_TICK_HOURS,
  EXPEDITION_BOSS_MAX,
  EXPEDITION_REWARD_MAX,
  EXPEDITION_SCHEDULE_HOURS,
  NIGHTMARE_MAX,
  MINI_GAME_MAX,
  SPIRIT_INVASION_MAX,
  TASK_DEFINITIONS,
  TRANSCENDENCE_BOSS_MAX,
  TRANSCENDENCE_REWARD_MAX,
  TRANSCENDENCE_SCHEDULE_HOURS,
  createEmptyWeeklyStats,
} from "./constants";
import { countDailyResets, countScheduledTicks, countWeeklyResets } from "./time";
import type {
  ActivityCounterKey,
  ActivityTicketKey,
  AppSettings,
  ApplyTaskActionInput,
  CharacterState,
  CharacterSummary,
  MissionCounterKey,
  TaskDefinition,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSafeInt(value: number | undefined, fallback = 1): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function getTaskDefinition(taskId: ApplyTaskActionInput["taskId"]): TaskDefinition | null {
  return TASK_DEFINITIONS.find((item) => item.id === taskId) ?? null;
}

function getSettingGoldReward(settings: AppSettings, task: TaskDefinition): number {
  if (task.goldRewardSettingKey) {
    return settings[task.goldRewardSettingKey];
  }
  return task.goldReward;
}

function getTaskCapDisplay(task: TaskDefinition, settings?: AppSettings): number | string {
  if (!settings) {
    return task.baseCapDisplay ?? "-";
  }
  if (task.id === "expedition") {
    return settings.expeditionRunCap ?? task.baseCapDisplay ?? "-";
  }
  if (task.id === "transcendence") {
    return settings.transcendenceRunCap ?? task.baseCapDisplay ?? "-";
  }
  if (task.id === "nightmare") {
    return settings.nightmareRunCap ?? task.baseCapDisplay ?? "-";
  }
  if (task.id === "awakening") {
    return settings.awakeningRunCap ?? task.baseCapDisplay ?? "-";
  }
  if (task.id === "suppression") {
    return settings.suppressionRunCap ?? task.baseCapDisplay ?? "-";
  }
  return task.baseCapDisplay ?? "-";
}

function getMissionCounter(character: CharacterState, key: MissionCounterKey): number {
  return character.missions[key];
}

function setMissionCounter(character: CharacterState, key: MissionCounterKey, value: number): void {
  character.missions[key] = value;
}

function getActivityCounter(character: CharacterState, key: ActivityCounterKey): number {
  return character.activities[key];
}

function setActivityCounter(character: CharacterState, key: ActivityCounterKey, value: number): void {
  character.activities[key] = value;
}

function getActivityTicket(character: CharacterState, key: ActivityTicketKey): number {
  return character.activities[key];
}

function setActivityTicket(character: CharacterState, key: ActivityTicketKey, value: number): void {
  character.activities[key] = value;
}

function getPrimaryActivityKey(task: TaskDefinition): ActivityCounterKey | null {
  const first = task.counterTargets[0];
  if (!first || first.scope !== "activities") {
    return null;
  }
  return first.key as ActivityCounterKey;
}

function getTaskBonusAvailable(character: CharacterState, task: TaskDefinition): number {
  if (!task.ticketTarget) {
    return 0;
  }
  return getActivityTicket(character, task.ticketTarget.key);
}

function getStackedAvailable(character: CharacterState, task: TaskDefinition): number {
  const primaryKey = getPrimaryActivityKey(task);
  if (!primaryKey) {
    return 0;
  }
  const base = getActivityCounter(character, primaryKey);
  return base + getTaskBonusAvailable(character, task);
}

function decrementStackedCounter(character: CharacterState, task: TaskDefinition, amount: number): void {
  const primaryKey = getPrimaryActivityKey(task);
  if (!primaryKey || !task.ticketTarget) {
    return;
  }

  const base = getActivityCounter(character, primaryKey);
  const bonus = getActivityTicket(character, task.ticketTarget.key);

  if (task.consumeTicketFirst) {
    const fromBonus = Math.min(bonus, amount);
    const remain = amount - fromBonus;
    setActivityTicket(character, task.ticketTarget.key, bonus - fromBonus);
    if (remain > 0) {
      setActivityCounter(character, primaryKey, Math.max(0, base - remain));
    }
    return;
  }

  const fromBase = Math.min(base, amount);
  const remain = amount - fromBase;
  setActivityCounter(character, primaryKey, base - fromBase);
  if (remain > 0) {
    setActivityTicket(character, task.ticketTarget.key, Math.max(0, bonus - remain));
  }
}

export function getTotalEnergy(character: CharacterState): number {
  return character.energy.baseCurrent + character.energy.bonusCurrent;
}

function increaseBaseEnergy(character: CharacterState, amount: number): void {
  character.energy.baseCurrent = clamp(character.energy.baseCurrent + amount, 0, character.energy.baseCap);
}

function consumeEnergy(character: CharacterState, amount: number): boolean {
  if (amount <= 0) {
    return true;
  }
  if (getTotalEnergy(character) < amount) {
    return false;
  }

  const baseConsumed = Math.min(character.energy.baseCurrent, amount);
  character.energy.baseCurrent -= baseConsumed;
  const remain = amount - baseConsumed;
  if (remain > 0) {
    character.energy.bonusCurrent = clamp(character.energy.bonusCurrent - remain, 0, character.energy.bonusCap);
  }
  return true;
}

function getRawTaskRemaining(character: CharacterState, task: TaskDefinition): number | null {
  if (task.counterTargets.length === 0) {
    return null;
  }
  const values = task.counterTargets.map((target) => {
    if (target.scope === "missions") {
      return getMissionCounter(character, target.key as MissionCounterKey);
    }
    return getActivityCounter(character, target.key as ActivityCounterKey);
  });
  return Math.min(...values);
}

export function getTaskRemaining(character: CharacterState, task: TaskDefinition): number | null {
  if (task.counterTargets.length === 0) {
    return null;
  }
  const raw = getRawTaskRemaining(character, task) ?? 0;
  if (!task.ticketTarget) {
    return raw;
  }

  const stacked = getStackedAvailable(character, task);
  if (task.counterTargets.length <= 1) {
    return stacked;
  }

  const secondaryValues = task.counterTargets.slice(1).map((target) => {
    if (target.scope === "missions") {
      return getMissionCounter(character, target.key as MissionCounterKey);
    }
    return getActivityCounter(character, target.key as ActivityCounterKey);
  });
  return Math.min(stacked, ...secondaryValues, raw + getTaskBonusAvailable(character, task));
}

export function getTaskProgressText(character: CharacterState, task: TaskDefinition, settings?: AppSettings): string {
  const remain = getTaskRemaining(character, task);
  if (remain === null) {
    return "-";
  }

  if (!task.useBonusDisplay) {
    const cap = getTaskCapDisplay(task, settings);
    return `${remain}/${cap}`;
  }

  const primaryKey = getPrimaryActivityKey(task);
  if (!primaryKey || !task.ticketTarget) {
    const cap = getTaskCapDisplay(task, settings);
    return `${remain}/${cap}`;
  }

  const base = getActivityCounter(character, primaryKey);
  const bonus = getActivityTicket(character, task.ticketTarget.key);
  const cap = getTaskCapDisplay(task, settings);
  return `${base}(+${bonus})/${cap}`;
}

export function getTaskGoldReward(settings: AppSettings, task: TaskDefinition): number {
  return getSettingGoldReward(settings, task);
}

export function refreshCharacterState(character: CharacterState, now = new Date()): CharacterState {
  const next = structuredClone(character);
  const previous = new Date(next.meta.lastSyncedAt);
  if (Number.isNaN(previous.getTime())) {
    next.meta.lastSyncedAt = now.toISOString();
    return next;
  }

  const elapsedMs = now.getTime() - previous.getTime();
  const energyTicks = Math.floor(elapsedMs / (ENERGY_TICK_HOURS * HOUR_MS));
  if (energyTicks > 0) {
    increaseBaseEnergy(next, energyTicks * ENERGY_PER_TICK);
  }

  const dailyResetCount = countDailyResets(previous, now);
  if (dailyResetCount > 0) {
    next.missions.dailyRemaining = 5;
    next.activities.nightmareRemaining = clamp(
      next.activities.nightmareRemaining + dailyResetCount * 2,
      0,
      NIGHTMARE_MAX,
    );
    next.activities.miniGameRemaining = clamp(next.activities.miniGameRemaining + dailyResetCount * 2, 0, MINI_GAME_MAX);
    next.activities.spiritInvasionRemaining = clamp(
      next.activities.spiritInvasionRemaining + dailyResetCount,
      0,
      SPIRIT_INVASION_MAX,
    );
  }

  const weeklyResetCount = countWeeklyResets(previous, now);
  if (weeklyResetCount > 0) {
    next.missions.weeklyRemaining = 12;
    next.missions.abyssLowerRemaining = 20;
    next.missions.abyssMiddleRemaining = 5;
    next.activities.awakeningRemaining = 3;
    next.activities.awakeningTicketBonus = 0;
    next.activities.suppressionRemaining = 3;
    next.activities.dailyDungeonRemaining = 7;
    next.activities.sanctumRaidRemaining = 4;
    next.activities.sanctumBoxRemaining = 2;
    next.activities.expeditionBossRemaining = EXPEDITION_BOSS_MAX;
    next.activities.transcendenceBossRemaining = TRANSCENDENCE_BOSS_MAX;
    next.stats = createEmptyWeeklyStats(now.toISOString());
  }

  const expeditionTicks = countScheduledTicks(previous, now, EXPEDITION_SCHEDULE_HOURS);
  if (expeditionTicks > 0) {
    next.activities.expeditionRemaining = clamp(
      next.activities.expeditionRemaining + expeditionTicks,
      0,
      EXPEDITION_REWARD_MAX,
    );
  }

  const transcendenceTicks = countScheduledTicks(previous, now, TRANSCENDENCE_SCHEDULE_HOURS);
  if (transcendenceTicks > 0) {
    next.activities.transcendenceRemaining = clamp(
      next.activities.transcendenceRemaining + transcendenceTicks,
      0,
      TRANSCENDENCE_REWARD_MAX,
    );
  }

  next.meta.lastSyncedAt = now.toISOString();
  next.energy.baseCap = ENERGY_BASE_CAP;
  next.energy.bonusCap = ENERGY_BONUS_CAP;
  next.energy.baseCurrent = clamp(next.energy.baseCurrent, 0, next.energy.baseCap);
  next.energy.bonusCurrent = clamp(next.energy.bonusCurrent, 0, next.energy.bonusCap);

  next.activities.nightmareTicketBonus = clamp(next.activities.nightmareTicketBonus, 0, 999);
  next.activities.awakeningTicketBonus = clamp(next.activities.awakeningTicketBonus, 0, 999);
  next.activities.suppressionTicketBonus = clamp(next.activities.suppressionTicketBonus, 0, 999);
  next.activities.dailyDungeonTicketStored = clamp(next.activities.dailyDungeonTicketStored, 0, 30);
  next.activities.miniGameTicketBonus = clamp(next.activities.miniGameTicketBonus, 0, 999);
  next.activities.expeditionTicketBonus = clamp(next.activities.expeditionTicketBonus, 0, 999);
  next.activities.transcendenceTicketBonus = clamp(next.activities.transcendenceTicketBonus, 0, 999);

  return next;
}

export function estimateCharacterGold(character: CharacterState, settings: AppSettings): number {
  let energyBudget = Math.floor(getTotalEnergy(character) / 80);
  const transcendenceRuns = Math.min(
    energyBudget,
    character.activities.transcendenceRemaining + character.activities.transcendenceTicketBonus,
    character.activities.transcendenceBossRemaining,
  );
  energyBudget -= transcendenceRuns;
  const expeditionRuns = Math.min(
    energyBudget,
    character.activities.expeditionRemaining + character.activities.expeditionTicketBonus,
    character.activities.expeditionBossRemaining,
  );

  return transcendenceRuns * settings.transcendenceGoldPerRun + expeditionRuns * settings.expeditionGoldPerRun;
}

export function buildCharacterSummary(character: CharacterState, settings: AppSettings): CharacterSummary {
  const pendingLabels: string[] = [];
  if (character.missions.dailyRemaining > 0) pendingLabels.push("每日使命未清");
  if (character.missions.weeklyRemaining > 0) pendingLabels.push("每周指令未清");
  if (character.activities.awakeningRemaining + character.activities.awakeningTicketBonus > 0) pendingLabels.push("觉醒战可打");
  if (character.activities.suppressionRemaining + character.activities.suppressionTicketBonus > 0) pendingLabels.push("讨伐战可打");
  if (character.activities.nightmareRemaining + character.activities.nightmareTicketBonus > 0) pendingLabels.push("恶梦可打");
  if (character.activities.corridorLowerAvailable > 0) pendingLabels.push("下层回廊可打");
  if (character.activities.corridorMiddleAvailable > 0) pendingLabels.push("中层回廊可打");
  if (character.activities.miniGameRemaining + character.activities.miniGameTicketBonus > 0) pendingLabels.push("小游戏可打");
  if (character.activities.spiritInvasionRemaining > 0) pendingLabels.push("精灵入侵可打");

  return {
    characterId: character.id,
    name: character.name,
    canRunExpedition:
      getTotalEnergy(character) >= 80 &&
      character.activities.expeditionBossRemaining > 0 &&
      character.activities.expeditionRemaining + character.activities.expeditionTicketBonus > 0,
    estimatedGoldIfClearEnergy: estimateCharacterGold(character, settings),
    weeklyGoldEarned: character.stats.goldEarned,
    hasDailyMissionLeft: character.missions.dailyRemaining > 0,
    hasWeeklyMissionLeft: character.missions.weeklyRemaining > 0,
    canRunNightmare: character.activities.nightmareRemaining + character.activities.nightmareTicketBonus > 0,
    canRunAwakening: character.activities.awakeningRemaining + character.activities.awakeningTicketBonus > 0,
    canRunSuppression: character.activities.suppressionRemaining + character.activities.suppressionTicketBonus > 0,
    pendingLabels,
  };
}

export function applyTaskAction(
  character: CharacterState,
  settings: AppSettings,
  input: ApplyTaskActionInput,
): { next: CharacterState; success: boolean; message: string; goldDelta: number } {
  const next = structuredClone(character);
  const task = getTaskDefinition(input.taskId);
  if (!task) {
    return { next, success: false, message: "未知任务", goldDelta: 0 };
  }

  const amount = toSafeInt(input.amount, 1);

  if (input.action === "use_ticket") {
    if (!task.allowUseTicket || !task.ticketTarget) {
      return { next, success: false, message: "该任务不支持吃券", goldDelta: 0 };
    }
    const increment = task.ticketTarget.increment ?? 1;
    const current = getActivityTicket(next, task.ticketTarget.key);
    setActivityTicket(next, task.ticketTarget.key, current + Math.max(1, amount) * increment);
    return { next, success: true, message: "已增加券次数", goldDelta: 0 };
  }

  if (input.action === "set_completed") {
    if (!task.allowSetCompleted || !task.setCompletedTotal || task.counterTargets.length !== 1) {
      return { next, success: false, message: "该任务不支持录入已完成次数", goldDelta: 0 };
    }
    const completed = clamp(amount, 0, task.setCompletedTotal);
    const remaining = task.setCompletedTotal - completed;
    const target = task.counterTargets[0];
    if (target.scope === "missions") {
      setMissionCounter(next, target.key as MissionCounterKey, remaining);
    } else {
      setActivityCounter(next, target.key as ActivityCounterKey, remaining);
    }
    return { next, success: true, message: "已更新已完成次数", goldDelta: 0 };
  }

  if (!task.allowComplete) {
    return { next, success: false, message: "该任务不可打卡", goldDelta: 0 };
  }

  if (amount <= 0) {
    return { next, success: false, message: "完成次数必须大于 0", goldDelta: 0 };
  }

  const energyRequired = task.energyCost * amount;
  if (energyRequired > 0 && getTotalEnergy(next) < energyRequired) {
    return { next, success: false, message: "奥德能量不足", goldDelta: 0 };
  }

  const rawRemaining = getRawTaskRemaining(next, task);
  if (rawRemaining !== null) {
    let available = rawRemaining;
    if (task.ticketTarget) {
      available = getTaskRemaining(next, task) ?? rawRemaining;
    }
    if (available < amount) {
      return { next, success: false, message: "可用次数不足", goldDelta: 0 };
    }
  }

  if (task.ticketTarget) {
    decrementStackedCounter(next, task, amount);
    const nonPrimaryTargets = task.counterTargets.slice(1);
    for (const target of nonPrimaryTargets) {
      const decrement = (target.decrement ?? 1) * amount;
      if (target.scope === "missions") {
        const current = getMissionCounter(next, target.key as MissionCounterKey);
        setMissionCounter(next, target.key as MissionCounterKey, clamp(current - decrement, 0, Number.MAX_SAFE_INTEGER));
      } else {
        const current = getActivityCounter(next, target.key as ActivityCounterKey);
        setActivityCounter(next, target.key as ActivityCounterKey, clamp(current - decrement, 0, Number.MAX_SAFE_INTEGER));
      }
    }
  } else {
    for (const target of task.counterTargets) {
      const decrement = (target.decrement ?? 1) * amount;
      if (target.scope === "missions") {
        const current = getMissionCounter(next, target.key as MissionCounterKey);
        setMissionCounter(next, target.key as MissionCounterKey, clamp(current - decrement, 0, Number.MAX_SAFE_INTEGER));
      } else {
        const current = getActivityCounter(next, target.key as ActivityCounterKey);
        setActivityCounter(next, target.key as ActivityCounterKey, clamp(current - decrement, 0, Number.MAX_SAFE_INTEGER));
      }
    }
  }

  if (energyRequired > 0) {
    consumeEnergy(next, energyRequired);
  }

  const goldDelta = getSettingGoldReward(settings, task) * amount;
  next.stats.completions[input.taskId] = (next.stats.completions[input.taskId] ?? 0) + amount;
  next.stats.goldEarned += goldDelta;

  return {
    next,
    success: true,
    message: "已更新",
    goldDelta,
  };
}
