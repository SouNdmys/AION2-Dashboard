import { describe, expect, it } from "vitest";
import { createDefaultAccount, createDefaultCharacter } from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";
import {
  resolveSelectionAfterAccountDeletion,
  resolveSelectionAfterCharacterDeletion,
  resolveSelectionForAccount,
  resolveSelectionForCharacter,
} from "./store-domain-selection";

function createAccount(id: string): AccountState {
  return createDefaultAccount(`账号-${id}`, id);
}

function createCharacter(id: string, accountId: string): CharacterState {
  return createDefaultCharacter(`角色-${id}`, "2026-02-26T00:00:00.000Z", id, accountId);
}

describe("store/store-domain-selection", () => {
  it("re-aligns selection to available account/character after account deletion", () => {
    const accounts = [createAccount("acc-2")];
    const characters = [createCharacter("char-2", "acc-2")];

    const next = resolveSelectionAfterAccountDeletion({
      accounts,
      characters,
      selectedAccountId: "acc-1",
      selectedCharacterId: "char-1",
    });

    expect(next.selectedAccountId).toBe("acc-2");
    expect(next.selectedCharacterId).toBe("char-2");
  });

  it("switches to target account and prefers first character under it", () => {
    const accounts = [createAccount("acc-1"), createAccount("acc-2")];
    const characters = [createCharacter("char-a", "acc-1"), createCharacter("char-b", "acc-2")];

    const next = resolveSelectionForAccount({
      accounts,
      characters,
      accountId: "acc-2",
      selectedAccountId: "acc-1",
      selectedCharacterId: "char-a",
    });

    expect(next.selectedAccountId).toBe("acc-2");
    expect(next.selectedCharacterId).toBe("char-b");
  });

  it("keeps selection unchanged when selecting an unknown account", () => {
    const accounts = [createAccount("acc-1")];
    const characters = [createCharacter("char-a", "acc-1")];

    const next = resolveSelectionForAccount({
      accounts,
      characters,
      accountId: "acc-missing",
      selectedAccountId: "acc-1",
      selectedCharacterId: "char-a",
    });

    expect(next.selectedAccountId).toBe("acc-1");
    expect(next.selectedCharacterId).toBe("char-a");
  });

  it("rebinds selection to remaining character account after character deletion", () => {
    const characters = [createCharacter("char-2", "acc-2")];

    const next = resolveSelectionAfterCharacterDeletion({
      characters,
      deletedCharacterId: "char-1",
      selectedAccountId: "acc-1",
      selectedCharacterId: "char-1",
    });

    expect(next.selectedCharacterId).toBe("char-2");
    expect(next.selectedAccountId).toBe("acc-2");
  });

  it("selects character and syncs selected account", () => {
    const characters = [createCharacter("char-a", "acc-1"), createCharacter("char-b", "acc-2")];

    const next = resolveSelectionForCharacter({
      characters,
      characterId: "char-b",
      selectedAccountId: "acc-1",
      selectedCharacterId: "char-a",
    });

    expect(next.selectedCharacterId).toBe("char-b");
    expect(next.selectedAccountId).toBe("acc-2");
  });
});
