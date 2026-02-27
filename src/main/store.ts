import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { app, dialog } from "electron";
import Store from "electron-store";
import {
  APP_STATE_VERSION,
  DEFAULT_SETTINGS,
} from "../shared/constants";
import { refreshCharacterState } from "../shared/engine";
import type {
  AppSettings,
  AppState,
  ApplyTaskActionInput,
  CharacterState,
  ExportDataResult,
  ImportDataResult,
  OperationLogEntry,
} from "../shared/types";
import { applyAodePlanUpdate, type UpdateAodePlanPayload } from "./store-domain-aode";
import {
  applyCorridorCompletionToCharacter,
  reorderCharactersByIds,
  setCorridorCompletedForCharacter,
  setCharacterStarInList,
  updateArtifactStatusForAccount,
  updateCharacterProfileInList,
  updateEnergySegmentsForCharacter,
  type CorridorLane,
  type UpdateArtifactStatusPayload,
  type UpdateCharacterProfilePayload,
} from "./store-domain-character-mutation";
import {
  applyRaidCountsUpdate,
  applyWeeklyCompletionsUpdate,
  type UpdateRaidCountsPayload,
  type UpdateWeeklyCompletionsPayload,
} from "./store-domain-counters";
import {
  buildAppStateMutationSignature,
  buildAppStateRollbackPayload,
  createAppStateMutationDraft,
  restoreAppStateByDelta,
} from "./store-domain-history";
import {
  applyTaskActionToCharacters,
  buildTaskActionDescription,
  resetWeeklyStatsForCharacters,
} from "./store-domain-progression";
import {
  addAccountToRoster,
  addCharacterToRoster,
  deleteAccountFromRoster,
  deleteCharacterFromRoster,
  renameAccountInRoster,
  renameCharacterInRoster,
} from "./store-domain-roster";
import {
  applyConfiguredActivityCaps,
  mergeAppSettings,
} from "./store-domain-settings";
import {
  resolveSelectionAfterAccountDeletion,
  resolveSelectionAfterCharacterDeletion,
  resolveSelectionForAccount,
  resolveSelectionForCharacter,
} from "./store-domain-selection";
import { normalizeAppState } from "./store-domain-snapshot";
import { buildExportPayload, buildImportedState, parseImportPayload } from "./store-domain-transfer";
import {
  buildDefaultExportPath as buildDefaultExportPathByInfra,
  maybeCreateDailyAutoBackup as maybeCreateDailyAutoBackupByInfra,
} from "./store-infra-io";

const OPERATION_HISTORY_LIMIT = 200;
const SETTINGS_MAX_THRESHOLD = 999999;
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

function persistState(state: AppState): AppState {
  store.store = state as unknown as Record<string, unknown>;
  maybeCreateDailyAutoBackup(state);
  return state;
}

function refreshAllCharacters(characters: CharacterState[], settings: AppSettings): CharacterState[] {
  const now = new Date();
  return characters.map((item) => applyConfiguredActivityCaps(refreshCharacterState(item, now), settings));
}

function commitMutation(
  meta: { action: string; characterId?: string | null; description?: string; trackHistory?: boolean },
  mutator: (draft: AppState) => AppState | void,
): AppState {
  const current = getAppState();
  const beforeSignature = buildAppStateMutationSignature(current);
  const draft = createAppStateMutationDraft(current);
  const maybeNext = mutator(draft);
  const normalized = normalizeAppState(maybeNext ?? draft);
  const changed = beforeSignature !== buildAppStateMutationSignature(normalized);

  if (meta.trackHistory !== false && changed) {
    const rollback = buildAppStateRollbackPayload(current, normalized, HISTORY_DELTA_MAX_SIZE_RATIO);
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
      const next = addAccountToRoster({
        accounts: draft.accounts,
        characters: draft.characters,
        name,
        regionTag,
        accountId: randomUUID(),
        characterId: randomUUID(),
        nowIso: new Date().toISOString(),
      });
      draft.accounts = next.accounts;
      draft.characters = next.characters;
      draft.selectedAccountId = next.selectedAccountId;
      draft.selectedCharacterId = next.selectedCharacterId;
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
      draft.accounts = renameAccountInRoster(draft.accounts, accountId, nextName, regionTag);
      return draft;
    },
  );
}

export function deleteAccount(accountId: string): AppState {
  return commitMutation(
    { action: "删除账号", description: accountId },
    (draft) => {
      const nextRoster = deleteAccountFromRoster({
        accounts: draft.accounts,
        characters: draft.characters,
        accountId,
        fallbackCharacterId: randomUUID(),
        nowIso: new Date().toISOString(),
      });
      draft.accounts = nextRoster.accounts;
      draft.characters = nextRoster.characters;
      const nextSelection = resolveSelectionAfterAccountDeletion({
        accounts: nextRoster.accounts,
        characters: nextRoster.characters,
        selectedAccountId: draft.selectedAccountId,
        selectedCharacterId: draft.selectedCharacterId,
      });
      draft.selectedCharacterId = nextSelection.selectedCharacterId;
      draft.selectedAccountId = nextSelection.selectedAccountId;
      return draft;
    },
  );
}

export function selectAccount(accountId: string): AppState {
  return commitMutation(
    { action: "切换账号", description: accountId },
    (draft) => {
      const nextSelection = resolveSelectionForAccount({
        accounts: draft.accounts,
        characters: draft.characters,
        accountId,
        selectedAccountId: draft.selectedAccountId,
        selectedCharacterId: draft.selectedCharacterId,
      });
      draft.selectedAccountId = nextSelection.selectedAccountId;
      draft.selectedCharacterId = nextSelection.selectedCharacterId;
      return draft;
    },
  );
}

export function addCharacter(name: string, accountId?: string): AppState {
  const nextName = name.trim();
  return commitMutation(
    { action: "新增角色", description: nextName || "未命名角色" },
    (draft) => {
      const next = addCharacterToRoster({
        accounts: draft.accounts,
        characters: draft.characters,
        name,
        selectedAccountId: draft.selectedAccountId,
        requestedAccountId: accountId,
        characterId: randomUUID(),
        nowIso: new Date().toISOString(),
        maxCharactersPerAccount: MAX_CHARACTERS_PER_ACCOUNT,
      });
      draft.characters = next.characters;
      draft.selectedAccountId = next.selectedAccountId;
      draft.selectedCharacterId = next.selectedCharacterId;
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
      draft.characters = renameCharacterInRoster(draft.characters, characterId, nextName);
      return draft;
    },
  );
}

export function deleteCharacter(characterId: string): AppState {
  return commitMutation(
    { action: "删除角色", characterId },
    (draft) => {
      const nextRoster = deleteCharacterFromRoster({
        accounts: draft.accounts,
        characters: draft.characters,
        characterId,
      });
      const nextSelection = resolveSelectionAfterCharacterDeletion({
        characters: nextRoster.characters,
        deletedCharacterId: characterId,
        selectedAccountId: draft.selectedAccountId,
        selectedCharacterId: draft.selectedCharacterId,
      });
      draft.selectedCharacterId = nextSelection.selectedCharacterId;
      draft.selectedAccountId = nextSelection.selectedAccountId;
      draft.accounts = nextRoster.accounts;
      draft.characters = nextRoster.characters;
      return draft;
    },
  );
}

export function selectCharacter(characterId: string): AppState {
  return commitMutation(
    { action: "切换角色", characterId },
    (draft) => {
      const nextSelection = resolveSelectionForCharacter({
        characters: draft.characters,
        characterId,
        selectedAccountId: draft.selectedAccountId,
        selectedCharacterId: draft.selectedCharacterId,
      });
      draft.selectedCharacterId = nextSelection.selectedCharacterId;
      draft.selectedAccountId = nextSelection.selectedAccountId;
      return draft;
    },
  );
}

export function updateCharacterProfile(
  characterId: string,
  payload: UpdateCharacterProfilePayload,
): AppState {
  return commitMutation(
    { action: "更新角色档案", characterId },
    (draft) => {
      draft.characters = updateCharacterProfileInList(draft.characters, characterId, payload, SETTINGS_MAX_THRESHOLD);
      return draft;
    },
  );
}

export function setCharacterStar(characterId: string, isStarred: boolean): AppState {
  return commitMutation(
    {
      action: isStarred ? "星标角色" : "取消角色星标",
      characterId,
    },
    (draft) => {
      draft.characters = setCharacterStarInList(draft.characters, characterId, { isStarred });
      return draft;
    },
  );
}

export function reorderCharacters(characterIds: string[]): AppState {
  return commitMutation(
    { action: "调整角色排序", description: `${characterIds.length} 个角色` },
    (draft) => {
      draft.characters = reorderCharactersByIds(draft.characters, characterIds);
      return draft;
    },
  );
}

export function applyAction(input: ApplyTaskActionInput): AppState {
  return commitMutation(
    {
      action: "任务打卡",
      characterId: input.characterId,
      description: buildTaskActionDescription(input),
    },
    (draft) => {
      draft.characters = applyTaskActionToCharacters(draft.characters, draft.settings, input);
      return draft;
    },
  );
}

export function updateArtifactStatus(payload: UpdateArtifactStatusPayload): AppState {
  return commitMutation(
    {
      action: "同步深渊回廊",
      description: `账号 ${payload.accountId}: 下层 ${payload.lowerAvailable} / 中层 ${payload.middleAvailable}`,
    },
    (draft) => {
      draft.characters = updateArtifactStatusForAccount(draft.accounts, draft.characters, payload);
      return draft;
    },
  );
}

export function applyCorridorCompletion(characterId: string, lane: CorridorLane, completed: number): AppState {
  return commitMutation(
    { action: "录入深渊回廊完成", characterId, description: `${lane === "lower" ? "下层" : "中层"} 完成 ${completed}` },
    (draft) => {
      draft.characters = applyCorridorCompletionToCharacter(draft.characters, characterId, lane, completed);
      return draft;
    },
  );
}

export function setCorridorCompleted(characterId: string, lane: CorridorLane, completed: number): AppState {
  return commitMutation(
    { action: "设置深渊回廊已完成", characterId, description: `${lane === "lower" ? "下层" : "中层"} 已完成 ${completed}` },
    (draft) => {
      draft.characters = setCorridorCompletedForCharacter(draft.characters, characterId, lane, completed);
      return draft;
    },
  );
}

export function updateEnergySegments(characterId: string, baseCurrent: number, bonusCurrent: number): AppState {
  return commitMutation(
    { action: "手动改能量", characterId, description: `${baseCurrent}(+${bonusCurrent})` },
    (draft) => {
      draft.characters = updateEnergySegmentsForCharacter(draft.characters, characterId, baseCurrent, bonusCurrent);
      return draft;
    },
  );
}

export function updateRaidCounts(
  characterId: string,
  payload: UpdateRaidCountsPayload,
): AppState {
  return commitMutation(
    { action: "手动设定次数", characterId },
    (draft) => {
      draft.characters = applyRaidCountsUpdate(draft.characters, draft.settings, characterId, payload);
      return draft;
    },
  );
}

export function updateWeeklyCompletions(
  characterId: string,
  payload: UpdateWeeklyCompletionsPayload,
): AppState {
  return commitMutation(
    { action: "校准周统计次数", characterId },
    (draft) => {
      draft.characters = applyWeeklyCompletionsUpdate(draft.characters, characterId, payload, SETTINGS_MAX_THRESHOLD);
      return draft;
    },
  );
}

export function updateAodePlan(
  characterId: string,
  payload: UpdateAodePlanPayload,
): AppState {
  return commitMutation(
    { action: "更新微风商店/变换记录", characterId },
    (draft) => {
      const next = applyAodePlanUpdate({
        accounts: draft.accounts,
        characters: draft.characters,
        characterId,
        payload,
      });
      draft.accounts = next.accounts;
      draft.characters = next.characters;
      return draft;
    },
  );
}

export function resetWeeklyStats(): AppState {
  return commitMutation(
    { action: "重置周收益统计" },
    (draft) => {
      draft.characters = resetWeeklyStatsForCharacters(draft.characters, new Date().toISOString());
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
      next = restoreAppStateByDelta(next, last.beforeDelta);
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
  const parsed = parseImportPayload(text);
  const next = buildImportedState({
    raw: parsed,
    currentState: getAppState(),
    sourcePath: filePath,
    historyLimit: OPERATION_HISTORY_LIMIT,
    createEntryId: () => randomUUID(),
  });

  const persisted = persistState(next);
  return { cancelled: false, path: filePath, state: persisted };
}
