import { describe, expect, it } from "vitest";
import { DAILY_DUNGEON_SHARED_MAX, DEFAULT_SETTINGS, createDefaultAccount, createDefaultCharacter } from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";
import { applyRaidCountsUpdate, applyWeeklyCompletionsUpdate } from "./store-domain-counters";

function createAccount(): AccountState {
  return createDefaultAccount("账号-1", "acc-1");
}

function createCharacter(id: string): CharacterState {
  return createDefaultCharacter(`角色-${id}`, "2026-02-26T00:00:00.000Z", id, "acc-1");
}

describe("store/store-domain-counters", () => {
  it("applies raid counts with caps from settings and updates shared daily dungeon", () => {
    const accounts = [createAccount()];
    const characters = [createCharacter("char-a")];
    const settings = {
      ...DEFAULT_SETTINGS,
      expeditionRunCap: 10,
      transcendenceRunCap: 6,
      nightmareRunCap: 6,
      awakeningRunCap: 2,
    };

    const next = applyRaidCountsUpdate(accounts, characters, settings, "char-a", {
      expeditionRemaining: 999,
      transcendenceRemaining: 999,
      nightmareRemaining: 999,
      awakeningRemaining: 999,
      dailyDungeonRemaining: 999,
      dailyDungeonTicketStored: 999,
      miniGameRemaining: 999,
      spiritInvasionRemaining: 999,
      sanctumRaidRemaining: 999,
      sanctumBoxRemaining: 999,
    });

    expect(next.characters[0].activities.expeditionRemaining).toBe(10);
    expect(next.characters[0].activities.transcendenceRemaining).toBe(6);
    expect(next.characters[0].activities.nightmareRemaining).toBe(6);
    expect(next.characters[0].activities.awakeningRemaining).toBe(2);
    expect(next.accounts[0].sharedActivities.dailyDungeonRemaining).toBe(DAILY_DUNGEON_SHARED_MAX);
    expect(next.characters[0].activities.dailyDungeonTicketStored).toBe(30);
    expect(next.characters[0].activities.miniGameRemaining).toBe(14);
    expect(next.characters[0].activities.spiritInvasionRemaining).toBe(7);
    expect(next.characters[0].activities.sanctumRaidRemaining).toBe(2);
    expect(next.characters[0].activities.sanctumBoxRemaining).toBe(2);
  });

  it("keeps non-target character unchanged except shared daily dungeon mirroring", () => {
    const accounts = [createAccount()];
    const characters = [createCharacter("char-a"), createCharacter("char-b")];
    const baseline = characters[1].activities.expeditionRemaining;

    const next = applyRaidCountsUpdate(accounts, characters, DEFAULT_SETTINGS, "char-a", {
      expeditionRemaining: 1,
    });

    expect(next.characters[1].activities.expeditionRemaining).toBe(baseline);
  });

  it("applies weekly completion calibration with threshold clamping", () => {
    const characters = [createCharacter("char-a")];
    const next = applyWeeklyCompletionsUpdate(
      characters,
      "char-a",
      {
        expeditionCompleted: 1000,
        transcendenceCompleted: -5,
      },
      99,
    );

    expect(next[0].stats.completions.expedition).toBe(99);
    expect(next[0].stats.completions.transcendence).toBe(0);
  });
});
