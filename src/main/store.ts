import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { app, dialog } from "electron";
import Store from "electron-store";
import {
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  AODE_WEEKLY_EXTRA_CONVERT_MAX,
  AODE_WEEKLY_EXTRA_PURCHASE_MAX,
  APP_STATE_VERSION,
  DEFAULT_SETTINGS,
  MINI_GAME_MAX,
  SPIRIT_INVASION_MAX,
  createDefaultAccount,
  createDefaultCharacter,
  createEmptyWeeklyStats,
} from "../shared/constants";
import { applyTaskAction, refreshCharacterState } from "../shared/engine";
import type {
  AppSettings,
  AppState,
  AppStateSnapshot,
  AppStateSnapshotDelta,
  AppStateCharacterSnapshotDelta,
  ApplyTaskActionInput,
  CharacterState,
  ExportDataResult,
  ImportDataResult,
  OperationLogEntry,
} from "../shared/types";
import {
  applyConfiguredActivityCaps,
  getEffectiveActivityCap,
  mergeAppSettings,
} from "./store-domain-settings";
import { normalizeAppState } from "./store-domain-snapshot";
import {
  buildDefaultExportPath as buildDefaultExportPathByInfra,
  maybeCreateDailyAutoBackup as maybeCreateDailyAutoBackupByInfra,
} from "./store-infra-io";

const OPERATION_HISTORY_LIMIT = 200;
const SETTINGS_MAX_THRESHOLD = 999999;
const IMPORT_EXPORT_SCHEMA_VERSION = 1;
const MAX_CHARACTERS_PER_ACCOUNT = 8;
const AUTO_BACKUP_META_KEY = "lastAutoBackupDate";
const HISTORY_DELTA_MAX_SIZE_RATIO = 0.92;

const store = new Store<Record<string, unknown>>({
  name: "aion2-dashboard",
  clearInvalidConfig: true,
  defaults: {
    version: APP_STATE_VERSION,
    selectedAccountId: null,
    selectedCharacterId: null,
    settings: DEFAULT_SETTINGS,
    accounts: [],
    characters: [],
    history: [],
  },
});

const metaStore = new Store<Record<string, unknown>>({
  name: "aion2-dashboard-meta",
  clearInvalidConfig: true,
  defaults: {
    [AUTO_BACKUP_META_KEY]: "",
  },
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function hasOwnProperty(entity: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(entity, key);
}

function persistState(state: AppState): AppState {
  store.store = state as unknown as Record<string, unknown>;
  maybeCreateDailyAutoBackup(state);
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

function buildMutationSignature(state: AppState): string {
  return JSON.stringify({
    selectedAccountId: state.selectedAccountId,
    selectedCharacterId: state.selectedCharacterId,
    settings: state.settings,
    accounts: state.accounts,
    characters: state.characters,
  });
}

function createMutationDraft(state: AppState): AppState {
  return structuredClone({
    ...state,
    // commitMutation never relies on history during mutation; keep draft lean.
    history: [],
  });
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function estimateSerializedSize(value: unknown): number {
  return JSON.stringify(value).length;
}

function buildCharacterChanges(
  beforeCharacters: CharacterState[],
  afterCharacters: CharacterState[],
): { changes: AppStateCharacterSnapshotDelta[]; order: string[] | undefined } {
  const beforeById = new Map(beforeCharacters.map((item) => [item.id, item]));
  const afterById = new Map(afterCharacters.map((item) => [item.id, item]));
  const changes: AppStateCharacterSnapshotDelta[] = [];

  beforeCharacters.forEach((beforeItem) => {
    const afterItem = afterById.get(beforeItem.id);
    if (!afterItem || !jsonEquals(beforeItem, afterItem)) {
      changes.push({
        id: beforeItem.id,
        before: structuredClone(beforeItem),
      });
    }
  });

  afterCharacters.forEach((afterItem) => {
    if (!beforeById.has(afterItem.id)) {
      changes.push({
        id: afterItem.id,
        before: null,
      });
    }
  });

  const beforeOrder = beforeCharacters.map((item) => item.id);
  const afterOrder = afterCharacters.map((item) => item.id);
  const orderChanged = !jsonEquals(beforeOrder, afterOrder);
  return {
    changes,
    order: orderChanged ? beforeOrder : undefined,
  };
}

function buildSnapshotDelta(before: AppState, after: AppState): AppStateSnapshotDelta | null {
  const delta: AppStateSnapshotDelta = {};
  let hasField = false;

  if (before.selectedAccountId !== after.selectedAccountId) {
    delta.selectedAccountId = before.selectedAccountId;
    hasField = true;
  }

  if (before.selectedCharacterId !== after.selectedCharacterId) {
    delta.selectedCharacterId = before.selectedCharacterId;
    hasField = true;
  }

  if (!jsonEquals(before.settings, after.settings)) {
    delta.settings = structuredClone(before.settings);
    hasField = true;
  }

  if (!jsonEquals(before.accounts, after.accounts)) {
    delta.accounts = structuredClone(before.accounts);
    hasField = true;
  }

  const characterDelta = buildCharacterChanges(before.characters, after.characters);
  if (characterDelta.changes.length > 0) {
    delta.characterChanges = characterDelta.changes;
    hasField = true;
  }
  if (characterDelta.order && characterDelta.order.length > 0) {
    delta.characterOrder = characterDelta.order;
    hasField = true;
  }

  return hasField ? delta : null;
}

function buildRollbackPayload(before: AppState, after: AppState): { before?: AppStateSnapshot; beforeDelta?: AppStateSnapshotDelta } {
  const delta = buildSnapshotDelta(before, after);
  if (!delta) {
    return { before: createSnapshot(before) };
  }

  const beforeSnapshot = createSnapshot(before);
  const deltaSize = estimateSerializedSize(delta);
  const snapshotSize = estimateSerializedSize(beforeSnapshot);
  if (snapshotSize <= 0) {
    return { beforeDelta: delta };
  }
  if (deltaSize <= Math.floor(snapshotSize * HISTORY_DELTA_MAX_SIZE_RATIO)) {
    return { beforeDelta: delta };
  }
  return { before: beforeSnapshot };
}

function applyCharacterChanges(
  currentCharacters: CharacterState[],
  changes: AppStateCharacterSnapshotDelta[] | undefined,
  order: string[] | undefined,
): CharacterState[] {
  if ((!changes || changes.length === 0) && (!order || order.length === 0)) {
    return currentCharacters;
  }

  const currentById = new Map(currentCharacters.map((item) => [item.id, item]));
  const changedIdSet = new Set<string>();
  (changes ?? []).forEach((change) => {
    changedIdSet.add(change.id);
    if (change.before === null) {
      currentById.delete(change.id);
      return;
    }
    currentById.set(change.id, structuredClone(change.before));
  });

  if (!order || order.length === 0) {
    const restored = currentCharacters
      .map((item) => currentById.get(item.id))
      .filter((item): item is CharacterState => item !== undefined);
    const existingIds = new Set(restored.map((item) => item.id));
    (changes ?? []).forEach((change) => {
      if (!change.before || existingIds.has(change.id)) {
        return;
      }
      const restoredItem = currentById.get(change.id);
      if (restoredItem) {
        restored.push(restoredItem);
        existingIds.add(change.id);
      }
    });
    return restored;
  }

  const ordered: CharacterState[] = [];
  const visited = new Set<string>();
  order.forEach((id) => {
    const item = currentById.get(id);
    if (!item) {
      return;
    }
    ordered.push(item);
    visited.add(id);
  });

  currentCharacters.forEach((item) => {
    if (visited.has(item.id)) {
      return;
    }
    const restored = currentById.get(item.id);
    if (!restored) {
      return;
    }
    ordered.push(restored);
    visited.add(item.id);
  });

  currentById.forEach((item, id) => {
    if (visited.has(id)) {
      return;
    }
    ordered.push(item);
    visited.add(id);
  });

  return ordered;
}

function restoreStateByDelta(current: AppState, delta: AppStateSnapshotDelta): AppState {
  const selectedAccountId = hasOwnProperty(delta as Record<string, unknown>, "selectedAccountId")
    ? delta.selectedAccountId ?? null
    : current.selectedAccountId;
  const selectedCharacterId = hasOwnProperty(delta as Record<string, unknown>, "selectedCharacterId")
    ? delta.selectedCharacterId ?? null
    : current.selectedCharacterId;

  return {
    ...current,
    selectedAccountId,
    selectedCharacterId,
    settings: delta.settings ? structuredClone(delta.settings) : current.settings,
    accounts: delta.accounts ? structuredClone(delta.accounts) : current.accounts,
    characters: applyCharacterChanges(current.characters, delta.characterChanges, delta.characterOrder),
  };
}

function commitMutation(
  meta: { action: string; characterId?: string | null; description?: string; trackHistory?: boolean },
  mutator: (draft: AppState) => AppState | void,
): AppState {
  const current = getAppState();
  const beforeSignature = buildMutationSignature(current);
  const draft = createMutationDraft(current);
  const maybeNext = mutator(draft);
  const normalized = normalizeAppState(maybeNext ?? draft);
  const changed = beforeSignature !== buildMutationSignature(normalized);

  if (meta.trackHistory !== false && changed) {
    const rollback = buildRollbackPayload(current, normalized);
    const entry: OperationLogEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      action: meta.action,
      characterId: meta.characterId ?? null,
      description: meta.description,
      ...rollback,
    };
    normalized.history = [...current.history, entry].slice(-OPERATION_HISTORY_LIMIT);
  } else {
    normalized.history = current.history;
  }

  return persistState(normalized);
}

function getAodeLimitsForCharacter(state: AppState, character: CharacterState): { purchaseLimit: number; convertLimit: number } {
  const account = state.accounts.find((item) => item.id === character.accountId);
  const isExtra = account?.extraAodeCharacterId === character.id;
  return {
    purchaseLimit: AODE_WEEKLY_BASE_PURCHASE_MAX + (isExtra ? AODE_WEEKLY_EXTRA_PURCHASE_MAX : 0),
    convertLimit: AODE_WEEKLY_BASE_CONVERT_MAX + (isExtra ? AODE_WEEKLY_EXTRA_CONVERT_MAX : 0),
  };
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
    return normalizeAppState((raw as { state: unknown }).state);
  }
  return normalizeAppState(raw);
}

function buildDefaultExportPath(): string {
  return buildDefaultExportPathByInfra(() => app.getPath("documents"));
}

function maybeCreateDailyAutoBackup(state: AppState): void {
  maybeCreateDailyAutoBackupByInfra(
    state,
    {
      getDocumentsPath: () => app.getPath("documents"),
      getLastBackupDate: () => metaStore.get(AUTO_BACKUP_META_KEY),
      setLastBackupDate: (value) => metaStore.set(AUTO_BACKUP_META_KEY, value),
      ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
      writeTextFile: (path, content) => writeFileSync(path, content, "utf-8"),
      buildExportPayload,
      onAutoBackupError: (error) => {
        console.error("[aion2-dashboard] auto backup failed", error);
      },
    },
    new Date(),
  );
}

export function getAppState(): AppState {
  const current = normalizeAppState(store.store);
  return {
    ...current,
    characters: refreshAllCharacters(current.characters, current.settings),
  };
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
      if (draft.accounts.length === 0) {
        throw new Error("请先新增账号");
      }
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
      draft.accounts = draft.accounts.map((account) => {
        if (account.extraAodeCharacterId !== characterId) {
          return account;
        }
        return { ...account, extraAodeCharacterId: undefined };
      });
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

export function updateCharacterProfile(
  characterId: string,
  payload: { classTag?: string | null; gearScore?: number | null },
): AppState {
  return commitMutation(
    { action: "更新角色档案", characterId },
    (draft) => {
      const index = draft.characters.findIndex((item) => item.id === characterId);
      if (index < 0) {
        throw new Error("角色不存在");
      }
      const target = draft.characters[index];
      const classTag =
        payload.classTag === undefined
          ? target.classTag
          : typeof payload.classTag === "string" && payload.classTag.trim()
            ? payload.classTag.trim()
            : undefined;
      const gearScore =
        payload.gearScore === undefined
          ? target.gearScore
          : typeof payload.gearScore === "number" && Number.isFinite(payload.gearScore)
            ? clamp(Math.floor(payload.gearScore), 0, SETTINGS_MAX_THRESHOLD)
            : undefined;
      draft.characters[index] = {
        ...target,
        classTag,
        gearScore,
      };
      return draft;
    },
  );
}

export function reorderCharacters(characterIds: string[]): AppState {
  return commitMutation(
    { action: "调整角色排序", description: `${characterIds.length} 个角色` },
    (draft) => {
      if (characterIds.length !== draft.characters.length) {
        throw new Error("排序数据与角色数量不一致");
      }
      const idSet = new Set(characterIds);
      if (idSet.size !== characterIds.length) {
        throw new Error("排序数据存在重复角色");
      }
      const byId = new Map(draft.characters.map((item) => [item.id, item]));
      const reordered = characterIds.map((id) => {
        const found = byId.get(id);
        if (!found) {
          throw new Error("排序数据包含未知角色");
        }
        return found;
      });
      draft.characters = reordered;
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

export function setCorridorCompleted(characterId: string, lane: "lower" | "middle", completed: number): AppState {
  return commitMutation(
    { action: "设置深渊回廊已完成", characterId, description: `${lane === "lower" ? "下层" : "中层"} 已完成 ${completed}` },
    (draft) => {
      const safeCompleted = clamp(Math.floor(completed), 0, 3);
      const nextAvailable = clamp(3 - safeCompleted, 0, 3);
      draft.characters = draft.characters.map((item) => {
        if (item.id !== characterId) {
          return item;
        }
        return {
          ...item,
          activities: {
            ...item.activities,
            corridorLowerAvailable: lane === "lower" ? nextAvailable : item.activities.corridorLowerAvailable,
            corridorMiddleAvailable: lane === "middle" ? nextAvailable : item.activities.corridorMiddleAvailable,
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
      const expeditionCap = getEffectiveActivityCap(draft.settings.expeditionRunCap, 21);
      const transcendenceCap = getEffectiveActivityCap(draft.settings.transcendenceRunCap, 14);
      const nightmareCap = getEffectiveActivityCap(draft.settings.nightmareRunCap, 14);
      const awakeningCap = getEffectiveActivityCap(draft.settings.awakeningRunCap, 3);
      const suppressionCap = getEffectiveActivityCap(draft.settings.suppressionRunCap, 3);

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

export function updateWeeklyCompletions(
  characterId: string,
  payload: { expeditionCompleted?: number; transcendenceCompleted?: number },
): AppState {
  return commitMutation(
    { action: "校准周统计次数", characterId },
    (draft) => {
      draft.characters = draft.characters.map((item) => {
        if (item.id !== characterId) {
          return item;
        }
        return {
          ...item,
          stats: {
            ...item.stats,
            completions: {
              ...item.stats.completions,
              expedition:
                typeof payload.expeditionCompleted === "number"
                  ? clamp(payload.expeditionCompleted, 0, SETTINGS_MAX_THRESHOLD)
                  : item.stats.completions.expedition,
              transcendence:
                typeof payload.transcendenceCompleted === "number"
                  ? clamp(payload.transcendenceCompleted, 0, SETTINGS_MAX_THRESHOLD)
                  : item.stats.completions.transcendence,
            },
          },
        };
      });
      return draft;
    },
  );
}

export function updateAodePlan(
  characterId: string,
  payload: {
    shopAodePurchaseUsed?: number;
    shopDailyDungeonTicketPurchaseUsed?: number;
    transformAodeUsed?: number;
    assignExtra?: boolean;
  },
): AppState {
  return commitMutation(
    { action: "更新微风商店/变换记录", characterId },
    (draft) => {
      const target = draft.characters.find((item) => item.id === characterId);
      if (!target) {
        throw new Error("角色不存在");
      }

      if (typeof payload.assignExtra === "boolean") {
        draft.accounts = draft.accounts.map((account) => {
          if (account.id !== target.accountId) {
            return account;
          }
          if (payload.assignExtra) {
            return { ...account, extraAodeCharacterId: characterId };
          }
          if (account.extraAodeCharacterId === characterId) {
            return { ...account, extraAodeCharacterId: undefined };
          }
          return account;
        });
      }

      draft.characters = draft.characters.map((item) => {
        if (item.accountId !== target.accountId) {
          return item;
        }
        const limits = getAodeLimitsForCharacter(draft, item);
        const nextShopAodePurchaseUsed =
          item.id === characterId && typeof payload.shopAodePurchaseUsed === "number"
            ? clamp(Math.floor(payload.shopAodePurchaseUsed), 0, limits.purchaseLimit)
            : clamp(item.aodePlan.shopAodePurchaseUsed, 0, limits.purchaseLimit);
        const nextShopDailyDungeonTicketPurchaseUsed =
          item.id === characterId && typeof payload.shopDailyDungeonTicketPurchaseUsed === "number"
            ? clamp(Math.floor(payload.shopDailyDungeonTicketPurchaseUsed), 0, limits.purchaseLimit)
            : clamp(item.aodePlan.shopDailyDungeonTicketPurchaseUsed, 0, limits.purchaseLimit);
        const nextTransformAodeUsed =
          item.id === characterId && typeof payload.transformAodeUsed === "number"
            ? clamp(Math.floor(payload.transformAodeUsed), 0, limits.convertLimit)
            : clamp(item.aodePlan.transformAodeUsed, 0, limits.convertLimit);
        return {
          ...item,
          aodePlan: {
            shopAodePurchaseUsed: nextShopAodePurchaseUsed,
            shopDailyDungeonTicketPurchaseUsed: nextShopDailyDungeonTicketPurchaseUsed,
            transformAodeUsed: nextTransformAodeUsed,
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
      draft.settings = mergeAppSettings(draft.settings, payload);
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
    if (last.beforeDelta) {
      next = restoreStateByDelta(next, last.beforeDelta);
    } else if (last.before) {
      next.selectedAccountId = last.before.selectedAccountId;
      next.selectedCharacterId = last.before.selectedCharacterId;
      next.settings = last.before.settings;
      next.accounts = last.before.accounts;
      next.characters = last.before.characters;
    }
    next.history = next.history.slice(0, -1);
    remain -= 1;
  }

  next.characters = refreshAllCharacters(next.characters, next.settings);
  return persistState(normalizeAppState(next));
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
  const persisted = persistState(normalizeAppState(next));
  return { cancelled: false, path: filePath, state: persisted };
}
