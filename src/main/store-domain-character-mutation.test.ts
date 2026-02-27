import { describe, expect, it } from "vitest";
import { createDefaultAccount, createDefaultCharacter } from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";
import {
  applyCorridorCompletionToCharacter,
  reorderCharactersByIds,
  setCharacterStarInList,
  setCorridorCompletedForCharacter,
  updateArtifactStatusForAccount,
  updateCharacterProfileInList,
  updateEnergySegmentsForCharacter,
} from "./store-domain-character-mutation";

function createCharacter(id: string, accountId = "acc-1"): CharacterState {
  return createDefaultCharacter(`角色-${id}`, "2026-02-26T00:00:00.000Z", id, accountId);
}

function createAccount(id: string): AccountState {
  return createDefaultAccount(`账号-${id}`, id);
}

describe("store/store-domain-character-mutation", () => {
  it("updates character profile and throws when target is missing", () => {
    const characters = [createCharacter("char-a")];
    const next = updateCharacterProfileInList(
      characters,
      "char-a",
      { classTag: "  Gladiator  ", gearScore: 999_999_999 },
      999_999,
    );

    expect(next[0].classTag).toBe("Gladiator");
    expect(next[0].gearScore).toBe(999_999);

    expect(() =>
      updateCharacterProfileInList(characters, "char-missing", { classTag: "x" }, 999_999),
    ).toThrowError("角色不存在");
  });

  it("reorders characters and validates reorder payload", () => {
    const characters = [createCharacter("char-a"), createCharacter("char-b"), createCharacter("char-c")];
    const reordered = reorderCharactersByIds(characters, ["char-c", "char-a", "char-b"]);
    expect(reordered.map((item) => item.id)).toEqual(["char-c", "char-a", "char-b"]);

    expect(() => reorderCharactersByIds(characters, ["char-a"])).toThrowError("排序数据与角色数量不一致");
    expect(() => reorderCharactersByIds(characters, ["char-a", "char-a", "char-c"])).toThrowError("排序数据存在重复角色");
    expect(() => reorderCharactersByIds(characters, ["char-a", "char-b", "char-x"])).toThrowError("排序数据包含未知角色");
  });

  it("toggles character star state and validates target existence", () => {
    const characters = [createCharacter("char-a"), createCharacter("char-b")];
    const next = setCharacterStarInList(characters, "char-a", { isStarred: true });
    expect(next[0].isStarred).toBe(true);
    expect(next[1].isStarred).toBe(false);

    const unchanged = setCharacterStarInList(next, "char-a", { isStarred: true });
    expect(unchanged).toBe(next);

    expect(() => setCharacterStarInList(characters, "char-x", { isStarred: true })).toThrowError("角色不存在");
  });

  it("updates account corridor status and validates account existence", () => {
    const accounts = [createAccount("acc-1"), createAccount("acc-2")];
    const characters = [createCharacter("char-a", "acc-1"), createCharacter("char-b", "acc-2")];

    const next = updateArtifactStatusForAccount(accounts, characters, {
      accountId: "acc-1",
      lowerAvailable: 99,
      lowerNextAt: "2026-03-01T00:00:00.000Z",
      middleAvailable: -1,
      middleNextAt: null,
    });

    expect(next[0].activities.corridorLowerAvailable).toBe(3);
    expect(next[0].activities.corridorMiddleAvailable).toBe(0);
    expect(next[1].activities.corridorLowerAvailable).toBe(characters[1].activities.corridorLowerAvailable);
    expect(() =>
      updateArtifactStatusForAccount(accounts, characters, {
        accountId: "acc-missing",
        lowerAvailable: 1,
        lowerNextAt: null,
        middleAvailable: 1,
        middleNextAt: null,
      }),
    ).toThrowError("账号不存在");
  });

  it("applies and sets corridor completion with clamping", () => {
    const characters = [createCharacter("char-a")];
    const applied = applyCorridorCompletionToCharacter(characters, "char-a", "lower", 10);
    expect(applied[0].activities.corridorLowerAvailable).toBe(0);

    const set = setCorridorCompletedForCharacter(characters, "char-a", "middle", 2);
    expect(set[0].activities.corridorMiddleAvailable).toBe(1);
  });

  it("updates energy segments under character caps", () => {
    const characters = [createCharacter("char-a"), createCharacter("char-b")];
    const next = updateEnergySegmentsForCharacter(characters, "char-a", 9999, -5);
    expect(next[0].energy.baseCurrent).toBe(next[0].energy.baseCap);
    expect(next[0].energy.bonusCurrent).toBe(0);
    expect(next[1].energy.baseCurrent).toBe(characters[1].energy.baseCurrent);
  });
});
