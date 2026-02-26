import { describe, expect, it } from "vitest";
import { createDefaultAccount, createDefaultCharacter } from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";
import {
  addAccountToRoster,
  addCharacterToRoster,
  deleteAccountFromRoster,
  deleteCharacterFromRoster,
  renameAccountInRoster,
  renameCharacterInRoster,
} from "./store-domain-roster";

function account(id: string, extraAodeCharacterId?: string): AccountState {
  return {
    ...createDefaultAccount(`账号-${id}`, id),
    extraAodeCharacterId,
  };
}

function character(id: string, accountId: string): CharacterState {
  return createDefaultCharacter(`角色-${id}`, "2026-02-26T00:00:00.000Z", id, accountId);
}

describe("store/store-domain-roster", () => {
  it("adds account with fallback name and creates initial character", () => {
    const result = addAccountToRoster({
      accounts: [account("acc-1")],
      characters: [character("char-1", "acc-1")],
      name: "   ",
      regionTag: "  S1  ",
      accountId: "acc-2",
      characterId: "char-2",
      nowIso: "2026-02-26T10:00:00.000Z",
    });

    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[1].name).toBe("账号 2");
    expect(result.accounts[1].regionTag).toBe("S1");
    expect(result.characters).toHaveLength(2);
    expect(result.characters[1].accountId).toBe("acc-2");
    expect(result.selectedAccountId).toBe("acc-2");
    expect(result.selectedCharacterId).toBe("char-2");
  });

  it("renames account and normalizes empty region tag", () => {
    const result = renameAccountInRoster([account("acc-1")], "acc-1", "账号新名", "   ");
    expect(result[0].name).toBe("账号新名");
    expect(result[0].regionTag).toBeUndefined();
  });

  it("deletes account and creates fallback character when character list becomes empty", () => {
    const result = deleteAccountFromRoster({
      accounts: [account("acc-1"), account("acc-2")],
      characters: [character("char-1", "acc-1")],
      accountId: "acc-1",
      fallbackCharacterId: "char-fallback",
      nowIso: "2026-02-26T11:00:00.000Z",
    });

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe("acc-2");
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].id).toBe("char-fallback");
    expect(result.characters[0].accountId).toBe("acc-2");
  });

  it("adds character using selected account and enforces per-account limit", () => {
    const accounts = [account("acc-1"), account("acc-2")];
    const characters = [character("char-a", "acc-1")];

    const added = addCharacterToRoster({
      accounts,
      characters,
      name: "   ",
      selectedAccountId: "acc-1",
      requestedAccountId: undefined,
      characterId: "char-b",
      nowIso: "2026-02-26T12:00:00.000Z",
      maxCharactersPerAccount: 2,
    });

    expect(added.characters).toHaveLength(2);
    expect(added.selectedAccountId).toBe("acc-1");
    expect(added.selectedCharacterId).toBe("char-b");
    expect(added.characters[1].name).toBe("Character 2");

    expect(() =>
      addCharacterToRoster({
        accounts,
        characters: [character("char-1", "acc-1"), character("char-2", "acc-1")],
        name: "new",
        selectedAccountId: "acc-1",
        requestedAccountId: "acc-1",
        characterId: "char-3",
        nowIso: "2026-02-26T12:00:00.000Z",
        maxCharactersPerAccount: 2,
      }),
    ).toThrowError("每个账号最多 2 个角色");
  });

  it("renames and deletes character with account extra-aode cleanup", () => {
    const renamed = renameCharacterInRoster([character("char-1", "acc-1")], "char-1", "角色新名");
    expect(renamed[0].name).toBe("角色新名");

    const deleted = deleteCharacterFromRoster({
      accounts: [account("acc-1", "char-1"), account("acc-2")],
      characters: [character("char-1", "acc-1"), character("char-2", "acc-1"), character("char-3", "acc-2")],
      characterId: "char-1",
    });
    expect(deleted.characters.some((item) => item.id === "char-1")).toBe(false);
    expect(deleted.accounts[0].extraAodeCharacterId).toBeUndefined();

    expect(() =>
      deleteCharacterFromRoster({
        accounts: [account("acc-1"), account("acc-2")],
        characters: [character("char-a", "acc-1"), character("char-b", "acc-2")],
        characterId: "char-a",
      }),
    ).toThrowError("每个账号至少保留 1 个角色");
  });
});
