import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, createDefaultCharacter } from "../shared/constants";
import type { CharacterState } from "../shared/types";
import { applyRaidCountsUpdate, applyWeeklyCompletionsUpdate } from "./store-domain-counters";

function createCharacter(id: string): CharacterState {
  return createDefaultCharacter(`角色-${id}`, "2026-02-26T00:00:00.000Z", id, "acc-1");
}

describe("store/store-domain-counters", () => {
  it("applies raid counts with caps from settings and fixed bounds", () => {
    const characters = [createCharacter("char-a")];
    const settings = {
      ...DEFAULT_SETTINGS,
      expeditionRunCap: 10,
      transcendenceRunCap: 8,
      nightmareRunCap: 6,
      awakeningRunCap: 2,
      suppressionRunCap: 1,
    };

    const next = applyRaidCountsUpdate(characters, settings, "char-a", {
      expeditionRemaining: 999,
      transcendenceRemaining: 999,
      nightmareRemaining: 999,
      awakeningRemaining: 999,
      suppressionRemaining: 999,
      dailyDungeonTicketStored: 999,
      miniGameRemaining: 999,
      spiritInvasionRemaining: 999,
      sanctumRaidRemaining: 999,
      sanctumBoxRemaining: 999,
    });

    expect(next[0].activities.expeditionRemaining).toBe(10);
    expect(next[0].activities.transcendenceRemaining).toBe(8);
    expect(next[0].activities.nightmareRemaining).toBe(6);
    expect(next[0].activities.awakeningRemaining).toBe(2);
    expect(next[0].activities.suppressionRemaining).toBe(1);
    expect(next[0].activities.dailyDungeonTicketStored).toBe(30);
    expect(next[0].activities.miniGameRemaining).toBe(14);
    expect(next[0].activities.spiritInvasionRemaining).toBe(7);
    expect(next[0].activities.sanctumRaidRemaining).toBe(2);
    expect(next[0].activities.sanctumBoxRemaining).toBe(2);
  });

  it("keeps non-target character unchanged", () => {
    const characters = [createCharacter("char-a"), createCharacter("char-b")];
    const baseline = characters[1].activities.expeditionRemaining;

    const next = applyRaidCountsUpdate(characters, DEFAULT_SETTINGS, "char-a", {
      expeditionRemaining: 1,
    });

    expect(next[1].activities.expeditionRemaining).toBe(baseline);
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
