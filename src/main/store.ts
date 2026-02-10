import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { app, dialog } from "electron";
import Store from "electron-store";
import {
  APP_STATE_VERSION,
  DEFAULT_SETTINGS,
  ENERGY_BASE_CAP,
  ENERGY_BONUS_CAP,
  EXPEDITION_REWARD_MAX,
  MINI_GAME_MAX,
  NIGHTMARE_MAX,
  SPIRIT_INVASION_MAX,
  TRANSCENDENCE_REWARD_MAX,
  createDefaultAccount,
  createDefaultCharacter,
  createEmptyWeeklyStats,
} from "../shared/constants";
import { applyTaskAction, refreshCharacterState } from "../shared/engine";
import type {
  AppSettings,
  AppState,
  AppStateSnapshot,
  AccountState,
  ApplyTaskActionInput,
  CharacterState,
  ExportDataResult,
  ImportDataResult,
  OperationLogEntry,
  TaskId,
} from "../shared/types";

const OPERATION_HISTORY_LIMIT = 200;
const SETTINGS_MAX_CAP = 9999;
const SETTINGS_MAX_THRESHOLD = 999999;
const IMPORT_EXPORT_SCHEMA_VERSION = 1;
const MAX_CHARACTERS_PER_ACCOUNT = 8;

const nowIso = new Date().toISOString();
const firstAccount = createDefaultAccount("账号 1", randomUUID());
const firstCharacter = createDefaultCharacter("Character 1", nowIso, randomUUID(), firstAccount.id);

const store = new Store<Record<string, unknown>>({
  name: "aion2-dashboard",
  clearInvalidConfig: true,
  defaults: {
    version: APP_STATE_VERSION,
    selectedAccountId: firstAccount.id,
    selectedCharacterId: firstCharacter.id,
    settings: DEFAULT_SETTINGS,
    accounts: [firstAccount],
    characters: [firstCharacter],
    history: [],
  },
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toOptionalCap(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(Math.floor(value), 1, SETTINGS_MAX_CAP);
  }
  return fallback;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, value);
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return clamp(Math.floor(value), 1, SETTINGS_MAX_THRESHOLD);
}

function normalizeSettings(raw: unknown): AppSettings {
  const entity = raw as Record<string, unknown> | undefined;
  return {
    expeditionGoldPerRun: toPositiveNumber(entity?.expeditionGoldPerRun, DEFAULT_SETTINGS.expeditionGoldPerRun),
    transcendenceGoldPerRun: toPositiveNumber(entity?.transcendenceGoldPerRun, DEFAULT_SETTINGS.transcendenceGoldPerRun),
    expeditionRunCap: toOptionalCap(entity?.expeditionRunCap, DEFAULT_SETTINGS.expeditionRunCap),
    transcendenceRunCap: toOptionalCap(entity?.transcendenceRunCap, DEFAULT_SETTINGS.transcendenceRunCap),
    nightmareRunCap: toOptionalCap(entity?.nightmareRunCap, DEFAULT_SETTINGS.nightmareRunCap),
    awakeningRunCap: toOptionalCap(entity?.awakeningRunCap, DEFAULT_SETTINGS.awakeningRunCap),
    suppressionRunCap: toOptionalCap(entity?.suppressionRunCap, DEFAULT_SETTINGS.suppressionRunCap),
    expeditionWarnThreshold: toPositiveInteger(entity?.expeditionWarnThreshold, DEFAULT_SETTINGS.expeditionWarnThreshold),
    transcendenceWarnThreshold: toPositiveInteger(
      entity?.transcendenceWarnThreshold,
      DEFAULT_SETTINGS.transcendenceWarnThreshold,
    ),
  };
}

function getEffectiveCap(override: number | null, baseCap: number): number {
  if (typeof override !== "number" || !Number.isFinite(override)) {
    return baseCap;
  }
  return clamp(Math.floor(override), 1, baseCap);
}

function applyConfiguredActivityCaps(character: CharacterState, settings: AppSettings): CharacterState {
  return {
    ...character,
    activities: {
      ...character.activities,
      expeditionRemaining: clamp(
        character.activities.expeditionRemaining,
        0,
        getEffectiveCap(settings.expeditionRunCap, EXPEDITION_REWARD_MAX),
      ),
      transcendenceRemaining: clamp(
        character.activities.transcendenceRemaining,
        0,
        getEffectiveCap(settings.transcendenceRunCap, TRANSCENDENCE_REWARD_MAX),
      ),
      nightmareRemaining: clamp(
        character.activities.nightmareRemaining,
        0,
        getEffectiveCap(settings.nightmareRunCap, NIGHTMARE_MAX),
      ),
      awakeningRemaining: clamp(character.activities.awakeningRemaining, 0, getEffectiveCap(settings.awakeningRunCap, 3)),
      suppressionRemaining: clamp(character.activities.suppressionRemaining, 0, getEffectiveCap(settings.suppressionRunCap, 3)),
    },
  };
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
    classTag: typeof entity.classTag === "string" ? entity.classTag : undefined,
    avatarSeed: typeof entity.avatarSeed === "string" ? entity.avatarSeed : base.avatarSeed,
    energy: {
      baseCurrent,
      bonusCurrent,
      baseCap,
      bonusCap,
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

  // Legacy model encoded "base + stored tickets" in remaining.
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
  };
}

function normalizeSnapshot(raw: unknown): AppStateSnapshot {
  const entity = (raw ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const settings = normalizeSettings(entity.settings);
  const rawAccounts = Array.isArray(entity.accounts) ? entity.accounts : [];
  const accounts =
    rawAccounts.length > 0
      ? rawAccounts.map((item, index) => normalizeAccount(item, index))
      : [createDefaultAccount("账号 1", randomUUID())];
  const fallbackAccountId = accounts[0].id;
  const rawCharacters = Array.isArray(entity.characters) ? entity.characters : [];
  const charactersRaw =
    rawCharacters.length > 0
      ? rawCharacters.map((item, index) =>
          applyConfiguredActivityCaps(normalizeCharacter(item, `Character ${index + 1}`, fallbackAccountId), settings),
        )
      : [createDefaultCharacter("Character 1", now, randomUUID(), fallbackAccountId)];
  const accountIds = new Set(accounts.map((item) => item.id));
  const characters = charactersRaw.map((item) => ({
    ...item,
    accountId: accountIds.has(item.accountId) ? item.accountId : fallbackAccountId,
  }));
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
    accounts,
    characters,
  };
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
    return [
      {
        id: typeof entity.id === "string" && entity.id.trim() ? entity.id : randomUUID(),
        at,
        action,
        characterId,
        description,
        before: normalizeSnapshot(entity.before),
      } satisfies OperationLogEntry,
    ];
  });

  return normalized.slice(-OPERATION_HISTORY_LIMIT);
}

function normalizeState(raw: unknown): AppState {
  const entity = (raw ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const sourceVersion = typeof entity.version === "number" ? Math.floor(entity.version) : 0;
  const settings = normalizeSettings(entity.settings);
  const rawAccounts = Array.isArray(entity.accounts) ? entity.accounts : [];
  const accounts =
    rawAccounts.length > 0
      ? rawAccounts.map((item, index) => normalizeAccount(item, index))
      : [createDefaultAccount("账号 1", randomUUID())];
  const fallbackAccountId = accounts[0].id;
  const accountIds = new Set(accounts.map((item) => item.id));
  const rawCharacters = Array.isArray(entity.characters) ? entity.characters : [];
  let charactersRaw =
    rawCharacters.length > 0
      ? rawCharacters.map((item, index) =>
          applyConfiguredActivityCaps(normalizeCharacter(item, `Character ${index + 1}`, fallbackAccountId), settings),
        )
      : [createDefaultCharacter("Character 1", now, randomUUID(), fallbackAccountId)];
  let characters = charactersRaw.map((item) => ({
    ...item,
    accountId: accountIds.has(item.accountId) ? item.accountId : fallbackAccountId,
  }));

  if (sourceVersion < 4) {
    characters = characters.map((item) => migrateDailyDungeonLegacy(item));
  }

  const selectedCharacterIdRaw = entity.selectedCharacterId;
  const selectedCharacterId =
    typeof selectedCharacterIdRaw === "string" && characters.some((item) => item.id === selectedCharacterIdRaw)
      ? selectedCharacterIdRaw
      : characters[0].id;
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
    accounts,
    characters,
    history: normalizeHistory(entity.history),
  };
}

function persistState(state: AppState): AppState {
  store.store = state as unknown as Record<string, unknown>;
  return state;
}

function refreshAllCharacters(characters: CharacterState[], settings: AppSettings): CharacterState[] {
  const now = new Date();
  return characters.map((item) => applyConfiguredActivityCaps(refreshCharacterState(item, now), settings));
}

function createSnapshot(state: AppState): AppStateSnapshot {
  return {
    selectedAccountId: state.selectedAccountId,
    selectedCharacterId: state.selectedCharacterId,
    settings: structuredClone(state.settings),
    accounts: structuredClone(state.accounts),
    characters: structuredClone(state.characters),
  };
}

function snapshotsEqual(left: AppStateSnapshot, right: AppStateSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function commitMutation(
  meta: { action: string; characterId?: string | null; description?: string; trackHistory?: boolean },
  mutator: (draft: AppState) => AppState | void,
): AppState {
  const current = getAppState();
  const before = createSnapshot(current);
  const draft = structuredClone(current);
  const maybeNext = mutator(draft);
  const normalized = normalizeState(maybeNext ?? draft);
  const after = createSnapshot(normalized);
  const changed = !snapshotsEqual(before, after);

  if (meta.trackHistory !== false && changed) {
    const entry: OperationLogEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      action: meta.action,
      characterId: meta.characterId ?? null,
      description: meta.description,
      before,
    };
    normalized.history = [...current.history, entry].slice(-OPERATION_HISTORY_LIMIT);
  } else {
    normalized.history = current.history;
  }

  return persistState(normalized);
}

function mergeSettings(current: AppSettings, payload: Partial<AppSettings>): AppSettings {
  return normalizeSettings({
    ...current,
    ...payload,
  });
}

function buildExportPayload(state: AppState): Record<string, unknown> {
  return {
    schemaVersion: IMPORT_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: "aion2-dashboard",
    state,
  };
}

function resolveImportedState(raw: unknown): AppState {
  if (raw && typeof raw === "object" && (raw as { state?: unknown }).state !== undefined) {
    return normalizeState((raw as { state: unknown }).state);
  }
  return normalizeState(raw);
}

function buildDefaultExportPath(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(app.getPath("documents"), `aion2-dashboard-backup-${timestamp}.json`);
}

export function getAppState(): AppState {
  const current = normalizeState(store.store);
  const refreshed = {
    ...current,
    characters: refreshAllCharacters(current.characters, current.settings),
  };
  return persistState(refreshed);
}

export function addAccount(name: string, regionTag?: string): AppState {
  const nextName = name.trim();
  return commitMutation(
    { action: "新增账号", description: nextName || "未命名账号" },
    (draft) => {
      const account = createDefaultAccount(nextName || `账号 ${draft.accounts.length + 1}`, randomUUID());
      if (regionTag?.trim()) {
        account.regionTag = regionTag.trim();
      }
      const now = new Date().toISOString();
      const created = createDefaultCharacter(`Character ${draft.characters.length + 1}`, now, randomUUID(), account.id);
      draft.accounts = [...draft.accounts, account];
      draft.characters = [...draft.characters, created];
      draft.selectedAccountId = account.id;
      draft.selectedCharacterId = created.id;
      return draft;
    },
  );
}

export function renameAccount(accountId: string, name: string, regionTag?: string): AppState {
  const nextName = name.trim();
  if (!nextName) {
    return getAppState();
  }
  return commitMutation(
    { action: "编辑账号", description: `${nextName}${regionTag ? ` (${regionTag})` : ""}` },
    (draft) => {
      draft.accounts = draft.accounts.map((item) =>
        item.id === accountId ? { ...item, name: nextName, regionTag: regionTag?.trim() || undefined } : item,
      );
      return draft;
    },
  );
}

export function deleteAccount(accountId: string): AppState {
  return commitMutation(
    { action: "删除账号", description: accountId },
    (draft) => {
      if (draft.accounts.length <= 1) {
        throw new Error("至少保留 1 个账号");
      }
      const nextAccounts = draft.accounts.filter((item) => item.id !== accountId);
      if (nextAccounts.length === draft.accounts.length) {
        throw new Error("账号不存在");
      }
      let nextCharacters = draft.characters.filter((item) => item.accountId !== accountId);
      if (nextCharacters.length === 0) {
        const now = new Date().toISOString();
        const fallbackAccountId = nextAccounts[0].id;
        nextCharacters = [createDefaultCharacter("Character 1", now, randomUUID(), fallbackAccountId)];
      }
      draft.accounts = nextAccounts;
      draft.characters = nextCharacters;
      const selectedStillExists = nextCharacters.some((item) => item.id === draft.selectedCharacterId);
      draft.selectedCharacterId = selectedStillExists ? draft.selectedCharacterId : nextCharacters[0].id;
      draft.selectedAccountId =
        nextAccounts.find((item) => item.id === draft.selectedAccountId)?.id ??
        nextCharacters.find((item) => item.id === draft.selectedCharacterId)?.accountId ??
        nextAccounts[0].id;
      return draft;
    },
  );
}

export function selectAccount(accountId: string): AppState {
  return commitMutation(
    { action: "切换账号", description: accountId },
    (draft) => {
      if (!draft.accounts.some((item) => item.id === accountId)) {
        return draft;
      }
      draft.selectedAccountId = accountId;
      const charInAccount = draft.characters.find((item) => item.accountId === accountId);
      if (charInAccount) {
        draft.selectedCharacterId = charInAccount.id;
      }
      return draft;
    },
  );
}

export function addCharacter(name: string, accountId?: string): AppState {
  const nextName = name.trim();
  return commitMutation(
    { action: "新增角色", description: nextName || "未命名角色" },
    (draft) => {
      const targetAccountId =
        accountId && draft.accounts.some((item) => item.id === accountId)
          ? accountId
          : draft.selectedAccountId && draft.accounts.some((item) => item.id === draft.selectedAccountId)
            ? draft.selectedAccountId
            : draft.accounts[0].id;
      const currentCount = draft.characters.filter((item) => item.accountId === targetAccountId).length;
      if (currentCount >= MAX_CHARACTERS_PER_ACCOUNT) {
        throw new Error(`每个账号最多 ${MAX_CHARACTERS_PER_ACCOUNT} 个角色`);
      }
      const now = new Date().toISOString();
      const created = createDefaultCharacter(
        nextName || `Character ${draft.characters.length + 1}`,
        now,
        randomUUID(),
        targetAccountId,
      );
      draft.selectedAccountId = targetAccountId;
      draft.selectedCharacterId = created.id;
      draft.characters = [...draft.characters, created];
      return draft;
    },
  );
}

export function renameCharacter(characterId: string, name: string): AppState {
  const nextName = name.trim();
  if (!nextName) {
    return getAppState();
  }

  return commitMutation(
    { action: "重命名角色", characterId, description: nextName },
    (draft) => {
      const index = draft.characters.findIndex((item) => item.id === characterId);
      if (index < 0) {
        return draft;
      }
      draft.characters[index] = {
        ...draft.characters[index],
        name: nextName,
      };
      return draft;
    },
  );
}

export function deleteCharacter(characterId: string): AppState {
  return commitMutation(
    { action: "删除角色", characterId },
    (draft) => {
      if (draft.characters.length <= 1) {
        throw new Error("至少保留 1 个角色");
      }

      const target = draft.characters.find((item) => item.id === characterId);
      if (!target) {
        throw new Error("角色不存在");
      }
      const accountCharacterCount = draft.characters.filter((item) => item.accountId === target.accountId).length;
      if (accountCharacterCount <= 1) {
        throw new Error("每个账号至少保留 1 个角色");
      }

      const nextCharacters = draft.characters.filter((item) => item.id !== characterId);
      if (nextCharacters.length === draft.characters.length) {
        throw new Error("角色不存在");
      }

      const nextSelectedCharacterId =
        draft.selectedCharacterId === characterId ? (nextCharacters[0]?.id ?? null) : draft.selectedCharacterId;
      draft.selectedCharacterId = nextSelectedCharacterId;
      const nextSelectedCharacter =
        nextCharacters.find((item) => item.id === nextSelectedCharacterId) ?? nextCharacters[0] ?? null;
      if (nextSelectedCharacter) {
        draft.selectedAccountId = nextSelectedCharacter.accountId;
      }
      draft.characters = nextCharacters;
      return draft;
    },
  );
}

export function selectCharacter(characterId: string): AppState {
  return commitMutation(
    { action: "切换角色", characterId },
    (draft) => {
      const target = draft.characters.find((item) => item.id === characterId);
      if (!target) {
        return draft;
      }
      draft.selectedCharacterId = characterId;
      draft.selectedAccountId = target.accountId;
      return draft;
    },
  );
}

export function applyAction(input: ApplyTaskActionInput): AppState {
  return commitMutation(
    {
      action: "任务打卡",
      characterId: input.characterId,
      description: `${input.taskId} x${Math.max(1, Math.floor(input.amount ?? 1))}`,
    },
    (draft) => {
      const index = draft.characters.findIndex((item) => item.id === input.characterId);
      if (index < 0) {
        throw new Error("角色不存在");
      }

      const result = applyTaskAction(draft.characters[index], draft.settings, input);
      if (!result.success) {
        throw new Error(result.message);
      }

      draft.characters[index] = result.next;
      return draft;
    },
  );
}

export function updateArtifactStatus(payload: {
  accountId: string;
  lowerAvailable: number;
  lowerNextAt: string | null;
  middleAvailable: number;
  middleNextAt: string | null;
}): AppState {
  return commitMutation(
    {
      action: "同步深渊回廊",
      description: `账号 ${payload.accountId}: 下层 ${payload.lowerAvailable} / 中层 ${payload.middleAvailable}`,
    },
    (draft) => {
      if (!draft.accounts.some((item) => item.id === payload.accountId)) {
        throw new Error("账号不存在");
      }
      draft.characters = draft.characters.map((item) => {
        if (item.accountId !== payload.accountId) {
          return item;
        }
        return {
          ...item,
          activities: {
            ...item.activities,
            corridorLowerAvailable: clamp(payload.lowerAvailable, 0, 3),
            corridorLowerNextAt: payload.lowerNextAt,
            corridorMiddleAvailable: clamp(payload.middleAvailable, 0, 3),
            corridorMiddleNextAt: payload.middleNextAt,
          },
        };
      });
      return draft;
    },
  );
}

export function applyCorridorCompletion(characterId: string, lane: "lower" | "middle", completed: number): AppState {
  return commitMutation(
    { action: "录入深渊回廊完成", characterId, description: `${lane === "lower" ? "下层" : "中层"} 完成 ${completed}` },
    (draft) => {
      const amount = clamp(Math.floor(completed), 0, 999);
      draft.characters = draft.characters.map((item) => {
        if (item.id !== characterId) {
          return item;
        }
        return {
          ...item,
          activities: {
            ...item.activities,
            corridorLowerAvailable:
              lane === "lower"
                ? clamp(item.activities.corridorLowerAvailable - amount, 0, 3)
                : item.activities.corridorLowerAvailable,
            corridorMiddleAvailable:
              lane === "middle"
                ? clamp(item.activities.corridorMiddleAvailable - amount, 0, 3)
                : item.activities.corridorMiddleAvailable,
          },
        };
      });
      return draft;
    },
  );
}

export function updateEnergySegments(characterId: string, baseCurrent: number, bonusCurrent: number): AppState {
  return commitMutation(
    { action: "手动改能量", characterId, description: `${baseCurrent}(+${bonusCurrent})` },
    (draft) => {
      draft.characters = draft.characters.map((item) => {
        if (item.id !== characterId) {
          return item;
        }
        return {
          ...item,
          energy: {
            ...item.energy,
            baseCurrent: clamp(baseCurrent, 0, item.energy.baseCap),
            bonusCurrent: clamp(bonusCurrent, 0, item.energy.bonusCap),
          },
        };
      });
      return draft;
    },
  );
}

export function updateRaidCounts(
  characterId: string,
  payload: {
    expeditionRemaining?: number;
    expeditionTicketBonus?: number;
    expeditionBossRemaining?: number;
    transcendenceRemaining?: number;
    transcendenceTicketBonus?: number;
    transcendenceBossRemaining?: number;
    nightmareRemaining?: number;
    nightmareTicketBonus?: number;
    awakeningRemaining?: number;
    awakeningTicketBonus?: number;
    suppressionRemaining?: number;
    suppressionTicketBonus?: number;
    dailyDungeonRemaining?: number;
    dailyDungeonTicketStored?: number;
    miniGameRemaining?: number;
    miniGameTicketBonus?: number;
    spiritInvasionRemaining?: number;
    sanctumRaidRemaining?: number;
    sanctumBoxRemaining?: number;
  },
): AppState {
  return commitMutation(
    { action: "手动设定次数", characterId },
    (draft) => {
      const expeditionCap = getEffectiveCap(draft.settings.expeditionRunCap, 21);
      const transcendenceCap = getEffectiveCap(draft.settings.transcendenceRunCap, 14);
      const nightmareCap = getEffectiveCap(draft.settings.nightmareRunCap, 14);
      const awakeningCap = getEffectiveCap(draft.settings.awakeningRunCap, 3);
      const suppressionCap = getEffectiveCap(draft.settings.suppressionRunCap, 3);

      draft.characters = draft.characters.map((item) => {
        if (item.id !== characterId) {
          return item;
        }

        return {
          ...item,
          activities: {
            ...item.activities,
            expeditionRemaining:
              typeof payload.expeditionRemaining === "number"
                ? clamp(payload.expeditionRemaining, 0, expeditionCap)
                : item.activities.expeditionRemaining,
            expeditionTicketBonus:
              typeof payload.expeditionTicketBonus === "number"
                ? clamp(payload.expeditionTicketBonus, 0, 999)
                : item.activities.expeditionTicketBonus,
            expeditionBossRemaining:
              typeof payload.expeditionBossRemaining === "number"
                ? clamp(payload.expeditionBossRemaining, 0, 35)
                : item.activities.expeditionBossRemaining,
            transcendenceRemaining:
              typeof payload.transcendenceRemaining === "number"
                ? clamp(payload.transcendenceRemaining, 0, transcendenceCap)
                : item.activities.transcendenceRemaining,
            transcendenceTicketBonus:
              typeof payload.transcendenceTicketBonus === "number"
                ? clamp(payload.transcendenceTicketBonus, 0, 999)
                : item.activities.transcendenceTicketBonus,
            transcendenceBossRemaining:
              typeof payload.transcendenceBossRemaining === "number"
                ? clamp(payload.transcendenceBossRemaining, 0, 28)
                : item.activities.transcendenceBossRemaining,
            nightmareRemaining:
              typeof payload.nightmareRemaining === "number"
                ? clamp(payload.nightmareRemaining, 0, nightmareCap)
                : item.activities.nightmareRemaining,
            nightmareTicketBonus:
              typeof payload.nightmareTicketBonus === "number"
                ? clamp(payload.nightmareTicketBonus, 0, 999)
                : item.activities.nightmareTicketBonus,
            awakeningRemaining:
              typeof payload.awakeningRemaining === "number"
                ? clamp(payload.awakeningRemaining, 0, awakeningCap)
                : item.activities.awakeningRemaining,
            awakeningTicketBonus:
              typeof payload.awakeningTicketBonus === "number"
                ? clamp(payload.awakeningTicketBonus, 0, 999)
                : item.activities.awakeningTicketBonus,
            suppressionRemaining:
              typeof payload.suppressionRemaining === "number"
                ? clamp(payload.suppressionRemaining, 0, suppressionCap)
                : item.activities.suppressionRemaining,
            suppressionTicketBonus:
              typeof payload.suppressionTicketBonus === "number"
                ? clamp(payload.suppressionTicketBonus, 0, 999)
                : item.activities.suppressionTicketBonus,
            dailyDungeonRemaining:
              typeof payload.dailyDungeonRemaining === "number"
                ? clamp(payload.dailyDungeonRemaining, 0, 999)
                : item.activities.dailyDungeonRemaining,
            dailyDungeonTicketStored:
              typeof payload.dailyDungeonTicketStored === "number"
                ? clamp(payload.dailyDungeonTicketStored, 0, 30)
                : item.activities.dailyDungeonTicketStored,
            miniGameRemaining:
              typeof payload.miniGameRemaining === "number"
                ? clamp(payload.miniGameRemaining, 0, MINI_GAME_MAX)
                : item.activities.miniGameRemaining,
            miniGameTicketBonus:
              typeof payload.miniGameTicketBonus === "number"
                ? clamp(payload.miniGameTicketBonus, 0, 999)
                : item.activities.miniGameTicketBonus,
            spiritInvasionRemaining:
              typeof payload.spiritInvasionRemaining === "number"
                ? clamp(payload.spiritInvasionRemaining, 0, SPIRIT_INVASION_MAX)
                : item.activities.spiritInvasionRemaining,
            sanctumRaidRemaining:
              typeof payload.sanctumRaidRemaining === "number"
                ? clamp(payload.sanctumRaidRemaining, 0, 4)
                : item.activities.sanctumRaidRemaining,
            sanctumBoxRemaining:
              typeof payload.sanctumBoxRemaining === "number"
                ? clamp(payload.sanctumBoxRemaining, 0, 2)
                : item.activities.sanctumBoxRemaining,
          },
        };
      });
      return draft;
    },
  );
}

export function resetWeeklyStats(): AppState {
  return commitMutation(
    { action: "重置周收益统计" },
    (draft) => {
      const now = new Date().toISOString();
      draft.characters = draft.characters.map((item) => ({
        ...item,
        stats: createEmptyWeeklyStats(now),
      }));
      return draft;
    },
  );
}

export function updateSettings(payload: Partial<AppSettings>): AppState {
  return commitMutation(
    { action: "更新设置" },
    (draft) => {
      draft.settings = mergeSettings(draft.settings, payload);
      draft.characters = draft.characters.map((item) => applyConfiguredActivityCaps(item, draft.settings));
      return draft;
    },
  );
}

export function undoOperations(steps: number): AppState {
  const current = getAppState();
  if (current.history.length === 0) {
    return current;
  }

  let remain = clamp(Math.floor(steps), 1, OPERATION_HISTORY_LIMIT);
  let next = structuredClone(current);

  while (remain > 0 && next.history.length > 0) {
    const last = next.history[next.history.length - 1];
    next.selectedAccountId = last.before.selectedAccountId;
    next.selectedCharacterId = last.before.selectedCharacterId;
    next.settings = last.before.settings;
    next.accounts = last.before.accounts;
    next.characters = last.before.characters;
    next.history = next.history.slice(0, -1);
    remain -= 1;
  }

  next.characters = refreshAllCharacters(next.characters, next.settings);
  return persistState(normalizeState(next));
}

export function clearHistory(): AppState {
  const current = getAppState();
  return persistState({
    ...current,
    history: [],
  });
}

export async function exportDataToFile(): Promise<ExportDataResult> {
  const state = getAppState();
  const result = await dialog.showSaveDialog({
    title: "导出备份数据",
    defaultPath: buildDefaultExportPath(),
    filters: [{ name: "JSON Files", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) {
    return { cancelled: true, path: null };
  }

  await writeFile(result.filePath, JSON.stringify(buildExportPayload(state), null, 2), "utf-8");
  return { cancelled: false, path: result.filePath };
}

export async function importDataFromFile(): Promise<ImportDataResult> {
  const result = await dialog.showOpenDialog({
    title: "导入备份数据",
    properties: ["openFile"],
    filters: [{ name: "JSON Files", extensions: ["json"] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true, path: null, state: null };
  }

  const filePath = result.filePaths[0];
  const text = await readFile(filePath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("导入文件不是有效的 JSON");
  }

  const imported = resolveImportedState(parsed);
  const beforeCurrent = getAppState();
  const before = createSnapshot(beforeCurrent);
  const entry: OperationLogEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    action: "导入数据",
    characterId: null,
    description: basename(filePath),
    before,
  };

  const next: AppState = {
    ...imported,
    history: [...imported.history, entry].slice(-OPERATION_HISTORY_LIMIT),
  };
  const persisted = persistState(normalizeState(next));
  return { cancelled: false, path: filePath, state: persisted };
}
