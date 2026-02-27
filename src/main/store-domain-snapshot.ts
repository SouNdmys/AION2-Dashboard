import { randomUUID } from "node:crypto";
import {
  APP_STATE_VERSION,
  createDefaultAccount,
  createDefaultCharacter,
  createEmptyWeeklyStats,
  ENERGY_BASE_CAP,
  ENERGY_BONUS_CAP,
} from "../shared/constants";
import type {
  AccountState,
  AppState,
  AppStateCharacterSnapshotDelta,
  AppStateSnapshot,
  AppStateSnapshotDelta,
  CharacterState,
  OperationLogEntry,
  TaskId,
} from "../shared/types";
import { applyConfiguredActivityCaps, normalizeAppSettings } from "./store-domain-settings";

const OPERATION_HISTORY_LIMIT = 200;
const SETTINGS_MAX_THRESHOLD = 999999;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCompletions(raw: unknown): Record<TaskId, number> {
  const base = createEmptyWeeklyStats(new Date().toISOString()).completions;
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const map = raw as Record<string, unknown>;
  (Object.keys(base) as TaskId[]).forEach((taskId) => {
    const value = map[taskId];
    if (typeof value === "number" && Number.isFinite(value)) {
      base[taskId] = Math.max(0, Math.floor(value));
    }
  });
  return base;
}

function normalizeCharacter(raw: unknown, fallbackName: string, fallbackAccountId: string): CharacterState {
  const now = new Date().toISOString();
  const id = typeof (raw as { id?: unknown })?.id === "string" ? ((raw as { id: string }).id ?? randomUUID()) : randomUUID();
  const base = createDefaultCharacter(fallbackName, now, id, fallbackAccountId);
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const entity = raw as Record<string, unknown>;
  const energyRaw = entity.energy as Record<string, unknown> | undefined;
  let baseCurrent = base.energy.baseCurrent;
  let bonusCurrent = base.energy.bonusCurrent;
  const baseCap = ENERGY_BASE_CAP;
  const bonusCap = ENERGY_BONUS_CAP;

  if (energyRaw) {
    if (typeof energyRaw.baseCurrent === "number" || typeof energyRaw.bonusCurrent === "number") {
      baseCurrent = typeof energyRaw.baseCurrent === "number" ? clamp(energyRaw.baseCurrent, 0, baseCap) : baseCurrent;
      bonusCurrent = typeof energyRaw.bonusCurrent === "number" ? clamp(energyRaw.bonusCurrent, 0, bonusCap) : bonusCurrent;
    } else if (typeof energyRaw.current === "number") {
      const total = clamp(Math.floor(energyRaw.current), 0, baseCap + bonusCap);
      baseCurrent = Math.min(total, baseCap);
      bonusCurrent = clamp(total - baseCurrent, 0, bonusCap);
    }
  }

  const missionsRaw = entity.missions as Record<string, unknown> | undefined;
  const activitiesRaw = entity.activities as Record<string, unknown> | undefined;
  const statsRaw = entity.stats as Record<string, unknown> | undefined;
  const metaRaw = entity.meta as Record<string, unknown> | undefined;
  const aodePlanRaw = entity.aodePlan as Record<string, unknown> | undefined;
  const legacyWeeklyPurchaseUsed =
    typeof aodePlanRaw?.weeklyPurchaseUsed === "number" ? clamp(Math.floor(aodePlanRaw.weeklyPurchaseUsed), 0, SETTINGS_MAX_THRESHOLD) : 0;
  const legacyWeeklyConvertUsed =
    typeof aodePlanRaw?.weeklyConvertUsed === "number" ? clamp(Math.floor(aodePlanRaw.weeklyConvertUsed), 0, SETTINGS_MAX_THRESHOLD) : 0;
  const suppressionRaw =
    typeof activitiesRaw?.suppressionRemaining === "number" ? Math.max(0, Math.floor(activitiesRaw.suppressionRemaining)) : 3;
  const suppressionBonusRaw =
    typeof activitiesRaw?.suppressionTicketBonus === "number"
      ? clamp(activitiesRaw.suppressionTicketBonus, 0, 999)
      : typeof activitiesRaw?.suppressionTicketStored === "number"
        ? clamp(activitiesRaw.suppressionTicketStored, 0, 999)
        : Math.max(0, suppressionRaw - 3);

  return {
    id,
    accountId: typeof entity.accountId === "string" ? entity.accountId : fallbackAccountId,
    name: typeof entity.name === "string" ? entity.name : fallbackName,
    isStarred: typeof entity.isStarred === "boolean" ? entity.isStarred : base.isStarred,
    classTag: typeof entity.classTag === "string" && entity.classTag.trim() ? entity.classTag.trim() : undefined,
    gearScore:
      typeof entity.gearScore === "number" && Number.isFinite(entity.gearScore)
        ? clamp(Math.floor(entity.gearScore), 0, SETTINGS_MAX_THRESHOLD)
        : undefined,
    avatarSeed: typeof entity.avatarSeed === "string" ? entity.avatarSeed : base.avatarSeed,
    energy: {
      baseCurrent,
      bonusCurrent,
      baseCap,
      bonusCap,
    },
    aodePlan: {
      shopAodePurchaseUsed:
        typeof aodePlanRaw?.shopAodePurchaseUsed === "number"
          ? clamp(Math.floor(aodePlanRaw.shopAodePurchaseUsed), 0, SETTINGS_MAX_THRESHOLD)
          : legacyWeeklyPurchaseUsed,
      shopDailyDungeonTicketPurchaseUsed:
        typeof aodePlanRaw?.shopDailyDungeonTicketPurchaseUsed === "number"
          ? clamp(Math.floor(aodePlanRaw.shopDailyDungeonTicketPurchaseUsed), 0, SETTINGS_MAX_THRESHOLD)
          : base.aodePlan.shopDailyDungeonTicketPurchaseUsed,
      transformAodeUsed:
        typeof aodePlanRaw?.transformAodeUsed === "number"
          ? clamp(Math.floor(aodePlanRaw.transformAodeUsed), 0, SETTINGS_MAX_THRESHOLD)
          : legacyWeeklyConvertUsed,
    },
    missions: {
      dailyRemaining:
        typeof missionsRaw?.dailyRemaining === "number" ? clamp(missionsRaw.dailyRemaining, 0, 5) : base.missions.dailyRemaining,
      weeklyRemaining:
        typeof missionsRaw?.weeklyRemaining === "number" ? clamp(missionsRaw.weeklyRemaining, 0, 12) : base.missions.weeklyRemaining,
      abyssLowerRemaining:
        typeof missionsRaw?.abyssLowerRemaining === "number"
          ? clamp(missionsRaw.abyssLowerRemaining, 0, 20)
          : base.missions.abyssLowerRemaining,
      abyssMiddleRemaining:
        typeof missionsRaw?.abyssMiddleRemaining === "number"
          ? clamp(missionsRaw.abyssMiddleRemaining, 0, 5)
          : base.missions.abyssMiddleRemaining,
    },
    activities: {
      nightmareRemaining:
        typeof activitiesRaw?.nightmareRemaining === "number"
          ? clamp(activitiesRaw.nightmareRemaining, 0, 14)
          : base.activities.nightmareRemaining,
      nightmareTicketBonus:
        typeof activitiesRaw?.nightmareTicketBonus === "number"
          ? clamp(activitiesRaw.nightmareTicketBonus, 0, 999)
          : 0,
      awakeningRemaining:
        typeof activitiesRaw?.awakeningRemaining === "number"
          ? clamp(activitiesRaw.awakeningRemaining, 0, 3)
          : base.activities.awakeningRemaining,
      awakeningTicketBonus:
        typeof activitiesRaw?.awakeningTicketBonus === "number"
          ? clamp(activitiesRaw.awakeningTicketBonus, 0, 999)
          : base.activities.awakeningTicketBonus,
      suppressionRemaining:
        typeof activitiesRaw?.suppressionRemaining === "number"
          ? clamp(activitiesRaw.suppressionRemaining, 0, 3)
          : base.activities.suppressionRemaining,
      suppressionTicketBonus: suppressionBonusRaw,
      dailyDungeonRemaining:
        typeof activitiesRaw?.dailyDungeonRemaining === "number"
          ? clamp(activitiesRaw.dailyDungeonRemaining, 0, 999)
          : base.activities.dailyDungeonRemaining,
      dailyDungeonTicketStored:
        typeof activitiesRaw?.dailyDungeonTicketStored === "number"
          ? clamp(activitiesRaw.dailyDungeonTicketStored, 0, 30)
          : base.activities.dailyDungeonTicketStored,
      expeditionRemaining:
        typeof activitiesRaw?.expeditionRemaining === "number"
          ? clamp(activitiesRaw.expeditionRemaining, 0, 21)
          : base.activities.expeditionRemaining,
      expeditionTicketBonus:
        typeof activitiesRaw?.expeditionTicketBonus === "number"
          ? clamp(activitiesRaw.expeditionTicketBonus, 0, 999)
          : 0,
      expeditionBossRemaining:
        typeof activitiesRaw?.expeditionBossRemaining === "number"
          ? clamp(activitiesRaw.expeditionBossRemaining, 0, 35)
          : base.activities.expeditionBossRemaining,
      transcendenceRemaining:
        typeof activitiesRaw?.transcendenceRemaining === "number"
          ? clamp(activitiesRaw.transcendenceRemaining, 0, 14)
          : base.activities.transcendenceRemaining,
      transcendenceTicketBonus:
        typeof activitiesRaw?.transcendenceTicketBonus === "number"
          ? clamp(activitiesRaw.transcendenceTicketBonus, 0, 999)
          : 0,
      transcendenceBossRemaining:
        typeof activitiesRaw?.transcendenceBossRemaining === "number"
          ? clamp(activitiesRaw.transcendenceBossRemaining, 0, 28)
          : base.activities.transcendenceBossRemaining,
      sanctumRaidRemaining:
        typeof activitiesRaw?.sanctumRaidRemaining === "number"
          ? clamp(activitiesRaw.sanctumRaidRemaining, 0, 4)
          : base.activities.sanctumRaidRemaining,
      sanctumBoxRemaining:
        typeof activitiesRaw?.sanctumBoxRemaining === "number"
          ? clamp(activitiesRaw.sanctumBoxRemaining, 0, 2)
          : base.activities.sanctumBoxRemaining,
      miniGameRemaining:
        typeof activitiesRaw?.miniGameRemaining === "number"
          ? clamp(activitiesRaw.miniGameRemaining, 0, 14)
          : base.activities.miniGameRemaining,
      miniGameTicketBonus:
        typeof activitiesRaw?.miniGameTicketBonus === "number"
          ? clamp(activitiesRaw.miniGameTicketBonus, 0, 999)
          : base.activities.miniGameTicketBonus,
      spiritInvasionRemaining:
        typeof activitiesRaw?.spiritInvasionRemaining === "number"
          ? clamp(activitiesRaw.spiritInvasionRemaining, 0, 7)
          : base.activities.spiritInvasionRemaining,
      corridorLowerAvailable:
        typeof activitiesRaw?.corridorLowerAvailable === "number"
          ? clamp(activitiesRaw.corridorLowerAvailable, 0, 3)
          : typeof activitiesRaw?.artifactAvailable === "number"
            ? clamp(activitiesRaw.artifactAvailable, 0, 3)
            : 0,
      corridorLowerNextAt:
        typeof activitiesRaw?.corridorLowerNextAt === "string"
          ? activitiesRaw.corridorLowerNextAt
          : typeof activitiesRaw?.artifactNextAt === "string"
            ? activitiesRaw.artifactNextAt
            : null,
      corridorMiddleAvailable:
        typeof activitiesRaw?.corridorMiddleAvailable === "number" ? clamp(activitiesRaw.corridorMiddleAvailable, 0, 3) : 0,
      corridorMiddleNextAt: typeof activitiesRaw?.corridorMiddleNextAt === "string" ? activitiesRaw.corridorMiddleNextAt : null,
    },
    stats: {
      cycleStartedAt:
        typeof statsRaw?.cycleStartedAt === "string" ? statsRaw.cycleStartedAt : createEmptyWeeklyStats(now).cycleStartedAt,
      goldEarned: typeof statsRaw?.goldEarned === "number" ? Math.max(0, statsRaw.goldEarned) : 0,
      completions: normalizeCompletions(statsRaw?.completions),
    },
    meta: {
      lastSyncedAt: typeof metaRaw?.lastSyncedAt === "string" ? metaRaw.lastSyncedAt : now,
    },
  };
}

function migrateDailyDungeonLegacy(character: CharacterState): CharacterState {
  const { dailyDungeonRemaining, dailyDungeonTicketStored } = character.activities;
  if (dailyDungeonTicketStored <= 0) {
    return character;
  }

  const inferredBase = dailyDungeonRemaining - dailyDungeonTicketStored;
  if (inferredBase < 0 || inferredBase > 7) {
    return character;
  }

  return {
    ...character,
    activities: {
      ...character.activities,
      dailyDungeonRemaining: inferredBase,
    },
  };
}

function normalizeAccount(raw: unknown, index: number): AccountState {
  const entity = raw as Record<string, unknown> | undefined;
  const id = typeof entity?.id === "string" && entity.id.trim() ? entity.id : randomUUID();
  const name =
    typeof entity?.name === "string" && entity.name.trim() ? entity.name.trim() : `账号 ${index + 1}`;
  return {
    id,
    name,
    regionTag: typeof entity?.regionTag === "string" && entity.regionTag.trim() ? entity.regionTag.trim() : undefined,
    extraAodeCharacterId:
      typeof entity?.extraAodeCharacterId === "string" && entity.extraAodeCharacterId.trim()
        ? entity.extraAodeCharacterId.trim()
        : undefined,
  };
}

function alignAccountExtraAodeCharacter(accounts: AccountState[], characters: CharacterState[]): AccountState[] {
  return accounts.map((account) => {
    if (!account.extraAodeCharacterId) {
      return account;
    }
    const valid = characters.some((character) => character.id === account.extraAodeCharacterId && character.accountId === account.id);
    if (valid) {
      return account;
    }
    return { ...account, extraAodeCharacterId: undefined };
  });
}

function normalizeSnapshot(raw: unknown): AppStateSnapshot {
  const entity = (raw ?? {}) as Record<string, unknown>;
  const settings = normalizeAppSettings(entity.settings);
  const rawAccounts = Array.isArray(entity.accounts) ? entity.accounts : [];
  let accounts = rawAccounts.length > 0 ? rawAccounts.map((item, index) => normalizeAccount(item, index)) : [];
  const rawCharacters = Array.isArray(entity.characters) ? entity.characters : [];
  if (accounts.length === 0 && rawCharacters.length > 0) {
    accounts = [createDefaultAccount("账号 1", randomUUID())];
  }
  const fallbackAccountId = accounts[0]?.id ?? null;
  const charactersRaw =
    rawCharacters.length > 0 && fallbackAccountId
      ? rawCharacters.map((item, index) =>
          applyConfiguredActivityCaps(normalizeCharacter(item, `Character ${index + 1}`, fallbackAccountId), settings),
        )
      : [];
  const accountIds = new Set(accounts.map((item) => item.id));
  const safeFallbackAccountId = fallbackAccountId ?? "";
  const characters = charactersRaw.map((item) => ({
    ...item,
    accountId: accountIds.has(item.accountId) ? item.accountId : safeFallbackAccountId,
  }));
  const accountsAligned = alignAccountExtraAodeCharacter(accounts, characters);
  const selectedCharacterIdRaw = entity.selectedCharacterId;
  const selectedCharacterId =
    typeof selectedCharacterIdRaw === "string" && characters.some((item) => item.id === selectedCharacterIdRaw)
      ? selectedCharacterIdRaw
      : characters[0]?.id ?? null;
  const selectedCharacter = characters.find((item) => item.id === selectedCharacterId) ?? characters[0];
  const selectedAccountIdRaw = entity.selectedAccountId;
  const selectedAccountId =
    typeof selectedAccountIdRaw === "string" && accountIds.has(selectedAccountIdRaw)
      ? selectedAccountIdRaw
      : selectedCharacter?.accountId ?? fallbackAccountId;

  return {
    selectedAccountId,
    selectedCharacterId,
    settings,
    accounts: accountsAligned,
    characters,
  };
}

function hasOwnProperty(entity: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(entity, key);
}

function normalizeSnapshotDelta(raw: unknown): AppStateSnapshotDelta | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const entity = raw as Record<string, unknown>;
  const delta: AppStateSnapshotDelta = {};
  let hasField = false;

  if (hasOwnProperty(entity, "selectedAccountId")) {
    const value = entity.selectedAccountId;
    if (typeof value === "string" || value === null) {
      delta.selectedAccountId = value;
      hasField = true;
    }
  }

  if (hasOwnProperty(entity, "selectedCharacterId")) {
    const value = entity.selectedCharacterId;
    if (typeof value === "string" || value === null) {
      delta.selectedCharacterId = value;
      hasField = true;
    }
  }

  if (Array.isArray(entity.accounts)) {
    delta.accounts = entity.accounts.map((item, index) => normalizeAccount(item, index));
    hasField = true;
  }

  if (entity.settings && typeof entity.settings === "object") {
    delta.settings = normalizeAppSettings(entity.settings);
    hasField = true;
  }

  if (Array.isArray(entity.characterChanges)) {
    const changes: AppStateCharacterSnapshotDelta[] = [];
    entity.characterChanges.forEach((rawChange) => {
      if (!rawChange || typeof rawChange !== "object") {
        return;
      }
      const change = rawChange as Record<string, unknown>;
      if (typeof change.id !== "string" || !change.id.trim()) {
        return;
      }
      if (change.before === null) {
        changes.push({ id: change.id, before: null });
        return;
      }
      if (!change.before || typeof change.before !== "object") {
        return;
      }
      const rawBefore = change.before as Record<string, unknown>;
      const fallbackName =
        typeof rawBefore.name === "string" && rawBefore.name.trim() ? rawBefore.name.trim() : `Character ${change.id.slice(0, 6)}`;
      const fallbackAccountId = typeof rawBefore.accountId === "string" ? rawBefore.accountId : "";
      changes.push({
        id: change.id,
        before: normalizeCharacter(rawBefore, fallbackName, fallbackAccountId),
      });
    });
    if (changes.length > 0) {
      delta.characterChanges = changes;
      hasField = true;
    }
  }

  if (Array.isArray(entity.characterOrder)) {
    const order = entity.characterOrder.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (order.length > 0) {
      delta.characterOrder = order;
      hasField = true;
    }
  }

  return hasField ? delta : null;
}

function normalizeHistory(raw: unknown): OperationLogEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized = raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const entity = item as Record<string, unknown>;
    const at =
      typeof entity.at === "string" && !Number.isNaN(new Date(entity.at).getTime())
        ? entity.at
        : new Date().toISOString();
    const action = typeof entity.action === "string" && entity.action.trim() ? entity.action : "未命名操作";
    const description =
      typeof entity.description === "string" && entity.description.trim() ? entity.description.trim() : undefined;
    const characterId = typeof entity.characterId === "string" ? entity.characterId : null;
    const before = entity.before === undefined ? undefined : normalizeSnapshot(entity.before);
    const beforeDelta = normalizeSnapshotDelta(entity.beforeDelta);
    if (!before && !beforeDelta) {
      return [];
    }
    return [
      {
        id: typeof entity.id === "string" && entity.id.trim() ? entity.id : randomUUID(),
        at,
        action,
        characterId,
        description,
        before,
        beforeDelta: beforeDelta ?? undefined,
      } satisfies OperationLogEntry,
    ];
  });

  return normalized.slice(-OPERATION_HISTORY_LIMIT);
}

export function normalizeAppState(raw: unknown): AppState {
  const entity = (raw ?? {}) as Record<string, unknown>;
  const sourceVersion = typeof entity.version === "number" ? Math.floor(entity.version) : 0;
  const settings = normalizeAppSettings(entity.settings);
  const rawAccounts = Array.isArray(entity.accounts) ? entity.accounts : [];
  let accounts = rawAccounts.length > 0 ? rawAccounts.map((item, index) => normalizeAccount(item, index)) : [];
  const rawCharacters = Array.isArray(entity.characters) ? entity.characters : [];
  if (accounts.length === 0 && rawCharacters.length > 0) {
    accounts = [createDefaultAccount("账号 1", randomUUID())];
  }
  const fallbackAccountId = accounts[0]?.id ?? null;
  const accountIds = new Set(accounts.map((item) => item.id));
  const charactersRaw =
    rawCharacters.length > 0 && fallbackAccountId
      ? rawCharacters.map((item, index) =>
          applyConfiguredActivityCaps(normalizeCharacter(item, `Character ${index + 1}`, fallbackAccountId), settings),
        )
      : [];
  const safeFallbackAccountId = fallbackAccountId ?? "";
  let characters = charactersRaw.map((item) => ({
    ...item,
    accountId: accountIds.has(item.accountId) ? item.accountId : safeFallbackAccountId,
  }));

  if (sourceVersion < 4) {
    characters = characters.map((item) => migrateDailyDungeonLegacy(item));
  }
  const accountsAligned = alignAccountExtraAodeCharacter(accounts, characters);

  const selectedCharacterIdRaw = entity.selectedCharacterId;
  const selectedCharacterId =
    typeof selectedCharacterIdRaw === "string" && characters.some((item) => item.id === selectedCharacterIdRaw)
      ? selectedCharacterIdRaw
      : characters[0]?.id ?? null;
  const selectedCharacter = characters.find((item) => item.id === selectedCharacterId) ?? characters[0];
  const selectedAccountIdRaw = entity.selectedAccountId;
  const selectedAccountId =
    typeof selectedAccountIdRaw === "string" && accountIds.has(selectedAccountIdRaw)
      ? selectedAccountIdRaw
      : selectedCharacter?.accountId ?? fallbackAccountId;

  return {
    version: APP_STATE_VERSION,
    selectedAccountId,
    selectedCharacterId,
    settings,
    accounts: accountsAligned,
    characters,
    history: normalizeHistory(entity.history),
  };
}
