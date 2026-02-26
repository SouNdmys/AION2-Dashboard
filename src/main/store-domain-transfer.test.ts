import { describe, expect, it } from "vitest";
import {
  APP_STATE_VERSION,
  DEFAULT_SETTINGS,
  createDefaultAccount,
  createDefaultCharacter,
} from "../shared/constants";
import type { AppState } from "../shared/types";
import { createAppStateSnapshot } from "./store-domain-history";
import {
  IMPORT_EXPORT_SCHEMA_VERSION,
  buildExportPayload,
  buildImportedState,
  parseImportPayload,
  resolveImportedState,
} from "./store-domain-transfer";

function createState(accountId = "acc-1", characterId = "char-1"): AppState {
  const account = createDefaultAccount(`账号-${accountId}`, accountId);
  const character = createDefaultCharacter(`角色-${characterId}`, "2026-02-26T00:00:00.000Z", characterId, accountId);
  return {
    version: APP_STATE_VERSION,
    selectedAccountId: account.id,
    selectedCharacterId: character.id,
    settings: structuredClone(DEFAULT_SETTINGS),
    accounts: [account],
    characters: [character],
    history: [],
  };
}

describe("store/store-domain-transfer", () => {
  it("builds export payload with schema metadata", () => {
    const state = createState();

    const payload = buildExportPayload(state, new Date("2026-02-26T12:34:56.789Z"));

    expect(payload.schemaVersion).toBe(IMPORT_EXPORT_SCHEMA_VERSION);
    expect(payload.exportedAt).toBe("2026-02-26T12:34:56.789Z");
    expect(payload.app).toBe("aion2-dashboard");
    expect(payload.state).toEqual(state);
  });

  it("resolves wrapped and raw import payloads via normalizeAppState", () => {
    const state = createState("acc-x", "char-x");

    const wrapped = resolveImportedState({ state });
    const direct = resolveImportedState(state);

    expect(wrapped.selectedAccountId).toBe("acc-x");
    expect(wrapped.selectedCharacterId).toBe("char-x");
    expect(direct.selectedAccountId).toBe("acc-x");
    expect(direct.selectedCharacterId).toBe("char-x");
  });

  it("throws expected message when import json is invalid", () => {
    expect(() => parseImportPayload("{bad-json")).toThrowError("导入文件不是有效的 JSON");
  });

  it("builds imported state and appends import history entry within limit", () => {
    const currentState = createState("acc-current", "char-current");
    const importedState = createState("acc-imported", "char-imported");
    const previousSnapshot = createAppStateSnapshot(createState("acc-before", "char-before"));
    importedState.history = [
      {
        id: "history-old",
        at: "2026-02-20T00:00:00.000Z",
        action: "旧操作",
        characterId: null,
        before: previousSnapshot,
      },
    ];

    const next = buildImportedState({
      raw: { state: importedState },
      currentState,
      sourcePath: "D:/backup/aion-backup.json",
      historyLimit: 1,
      now: new Date("2026-02-26T09:08:07.006Z"),
      createEntryId: () => "history-import",
    });

    expect(next.selectedAccountId).toBe("acc-imported");
    expect(next.history).toHaveLength(1);
    expect(next.history[0].id).toBe("history-import");
    expect(next.history[0].description).toBe("aion-backup.json");
    expect(next.history[0].action).toBe("导入数据");
    expect(next.history[0].before?.selectedAccountId).toBe("acc-current");
    expect(next.history[0].at).toBe("2026-02-26T09:08:07.006Z");
  });
});
