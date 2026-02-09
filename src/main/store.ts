import { randomUUID } from "node:crypto";
import Store from "electron-store";
import {
  APP_STATE_VERSION,
  DEFAULT_SETTINGS,
  ENERGY_BASE_CAP,
  ENERGY_BONUS_CAP,
  createDefaultCharacter,
  createEmptyWeeklyStats,
} from "../shared/constants";
import { applyTaskAction, refreshCharacterState } from "../shared/engine";
import type { AppState, ApplyTaskActionInput, CharacterState, TaskId } from "../shared/types";
const nowIso = new Date().toISOString();
const firstCharacter = createDefaultCharacter("Character 1", nowIso, randomUUID());

const store = new Store<Record<string, unknown>>({
  name: "aion2-dashboard",
  clearInvalidConfig: true,
  defaults: {
    version: APP_STATE_VERSION,
    selectedCharacterId: firstCharacter.id,
    settings: DEFAULT_SETTINGS,
    characters: [firstCharacter],
  },
});

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

function normalizeCharacter(raw: unknown, fallbackName: string): CharacterState {
  const now = new Date().toISOString();
  const id = typeof (raw as { id?: unknown })?.id === "string" ? ((raw as { id: string }).id ?? randomUUID()) : randomUUID();
  const base = createDefaultCharacter(fallbackName, now, id);
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
      artifactAvailable:
        typeof activitiesRaw?.artifactAvailable === "number" ? clamp(activitiesRaw.artifactAvailable, 0, 999) : 0,
      artifactNextAt: typeof activitiesRaw?.artifactNextAt === "string" ? activitiesRaw.artifactNextAt : null,
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

function normalizeState(raw: unknown): AppState {
  const entity = (raw ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const rawCharacters = Array.isArray(entity.characters) ? entity.characters : [];
  const characters =
    rawCharacters.length > 0
      ? rawCharacters.map((item, index) => normalizeCharacter(item, `Character ${index + 1}`))
      : [createDefaultCharacter("Character 1", now, randomUUID())];

  const settingsRaw = entity.settings as Record<string, unknown> | undefined;
  const selectedCharacterIdRaw = entity.selectedCharacterId;
  const selectedCharacterId =
    typeof selectedCharacterIdRaw === "string" && characters.some((item) => item.id === selectedCharacterIdRaw)
      ? selectedCharacterIdRaw
      : characters[0].id;

  return {
    version: APP_STATE_VERSION,
    selectedCharacterId,
    settings: {
      expeditionGoldPerRun:
        typeof settingsRaw?.expeditionGoldPerRun === "number"
          ? Math.max(0, settingsRaw.expeditionGoldPerRun)
          : DEFAULT_SETTINGS.expeditionGoldPerRun,
      transcendenceGoldPerRun:
        typeof settingsRaw?.transcendenceGoldPerRun === "number"
          ? Math.max(0, settingsRaw.transcendenceGoldPerRun)
          : DEFAULT_SETTINGS.transcendenceGoldPerRun,
    },
    characters,
  };
}

function persistState(state: AppState): AppState {
  store.set(state);
  return state;
}

function refreshAllCharacters(characters: CharacterState[]): CharacterState[] {
  const now = new Date();
  return characters.map((item) => refreshCharacterState(item, now));
}

export function getAppState(): AppState {
  const current = normalizeState(store.store);
  const refreshed = {
    ...current,
    characters: refreshAllCharacters(current.characters),
  };
  return persistState(refreshed);
}

export function addCharacter(name: string): AppState {
  const state = getAppState();
  const now = new Date().toISOString();
  const created = createDefaultCharacter(name.trim() || `Character ${state.characters.length + 1}`, now, randomUUID());
  const next: AppState = {
    ...state,
    selectedCharacterId: created.id,
    characters: [...state.characters, created],
  };
  return persistState(next);
}

export function renameCharacter(characterId: string, name: string): AppState {
  const nextName = name.trim();
  if (!nextName) {
    return getAppState();
  }

  const state = getAppState();
  const nextCharacters = state.characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }
    return {
      ...item,
      name: nextName,
    };
  });
  return persistState({
    ...state,
    characters: nextCharacters,
  });
}

export function deleteCharacter(characterId: string): AppState {
  const state = getAppState();
  if (state.characters.length <= 1) {
    throw new Error("至少保留 1 个角色");
  }

  const nextCharacters = state.characters.filter((item) => item.id !== characterId);
  if (nextCharacters.length === state.characters.length) {
    throw new Error("角色不存在");
  }

  const nextSelected =
    state.selectedCharacterId === characterId ? (nextCharacters[0]?.id ?? null) : state.selectedCharacterId;

  return persistState({
    ...state,
    selectedCharacterId: nextSelected,
    characters: nextCharacters,
  });
}

export function selectCharacter(characterId: string): AppState {
  const state = getAppState();
  if (!state.characters.some((item) => item.id === characterId)) {
    return state;
  }
  return persistState({
    ...state,
    selectedCharacterId: characterId,
  });
}

export function applyAction(input: ApplyTaskActionInput): AppState {
  const state = getAppState();
  const index = state.characters.findIndex((item) => item.id === input.characterId);
  if (index < 0) {
    throw new Error("角色不存在");
  }

  const result = applyTaskAction(state.characters[index], state.settings, input);
  if (!result.success) {
    throw new Error(result.message);
  }

  const nextCharacters = [...state.characters];
  nextCharacters[index] = result.next;

  return persistState({
    ...state,
    characters: nextCharacters,
  });
}

export function updateArtifactStatus(characterId: string, artifactAvailable: number, artifactNextAt: string | null): AppState {
  const state = getAppState();
  const nextCharacters = state.characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }
    return {
      ...item,
      activities: {
        ...item.activities,
        artifactAvailable: Math.max(0, artifactAvailable),
        artifactNextAt,
      },
    };
  });
  return persistState({
    ...state,
    characters: nextCharacters,
  });
}

export function updateEnergySegments(characterId: string, baseCurrent: number, bonusCurrent: number): AppState {
  const state = getAppState();
  const nextCharacters = state.characters.map((item) => {
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
  return persistState({
    ...state,
    characters: nextCharacters,
  });
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
    sanctumRaidRemaining?: number;
    sanctumBoxRemaining?: number;
  },
): AppState {
  const state = getAppState();
  const nextCharacters = state.characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }

    return {
      ...item,
      activities: {
        ...item.activities,
        expeditionRemaining:
          typeof payload.expeditionRemaining === "number"
            ? clamp(payload.expeditionRemaining, 0, 21)
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
            ? clamp(payload.transcendenceRemaining, 0, 14)
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
            ? clamp(payload.nightmareRemaining, 0, 14)
            : item.activities.nightmareRemaining,
        nightmareTicketBonus:
          typeof payload.nightmareTicketBonus === "number"
            ? clamp(payload.nightmareTicketBonus, 0, 999)
            : item.activities.nightmareTicketBonus,
        awakeningRemaining:
          typeof payload.awakeningRemaining === "number"
            ? clamp(payload.awakeningRemaining, 0, 3)
            : item.activities.awakeningRemaining,
        awakeningTicketBonus:
          typeof payload.awakeningTicketBonus === "number"
            ? clamp(payload.awakeningTicketBonus, 0, 999)
            : item.activities.awakeningTicketBonus,
        suppressionRemaining:
          typeof payload.suppressionRemaining === "number"
            ? clamp(payload.suppressionRemaining, 0, 3)
            : item.activities.suppressionRemaining,
        suppressionTicketBonus:
          typeof payload.suppressionTicketBonus === "number"
            ? clamp(payload.suppressionTicketBonus, 0, 999)
            : item.activities.suppressionTicketBonus,
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

  return persistState({
    ...state,
    characters: nextCharacters,
  });
}

export function resetWeeklyStats(): AppState {
  const state = getAppState();
  const now = new Date().toISOString();
  const nextCharacters = state.characters.map((item) => ({
    ...item,
    stats: createEmptyWeeklyStats(now),
  }));
  return persistState({
    ...state,
    characters: nextCharacters,
  });
}
