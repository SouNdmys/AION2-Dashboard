import { describe, expect, it } from "vitest";
import { APP_STATE_VERSION, DEFAULT_SETTINGS, createDefaultAccount, createDefaultCharacter } from "../shared/constants";
import type { AppSettings, CharacterState } from "../shared/types";
import {
  applyTaskActionToState,
  buildTaskActionDescription,
  resetWeeklyStatsForCharacters,
} from "./store-domain-progression";

function createCharacters(): CharacterState[] {
  const account = createDefaultAccount("账号-1", "acc-1");
  return [createDefaultCharacter("角色-1", "2026-02-26T00:00:00.000Z", "char-1", account.id)];
}

function createSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
  };
}

describe("store/store-domain-progression", () => {
  it("builds task action description with clamped integer amount", () => {
    expect(
      buildTaskActionDescription({
        characterId: "char-1",
        taskId: "daily_mission",
        action: "complete_once",
        amount: 2.9,
      }),
    ).toBe("daily_mission x2");
    expect(
      buildTaskActionDescription({
        characterId: "char-1",
        taskId: "daily_mission",
        action: "complete_once",
        amount: 0,
      }),
    ).toBe("daily_mission x1");
  });

  it("applies task action to target character", () => {
    const accounts = [createDefaultAccount("账号-1", "acc-1")];
    const characters = createCharacters();
    const settings = createSettings();

    const next = applyTaskActionToState(accounts, characters, settings, {
      characterId: "char-1",
      taskId: "daily_mission",
      action: "complete_once",
      amount: 1,
    });

    expect(next.characters[0].missions.dailyRemaining).toBe(characters[0].missions.dailyRemaining - 1);
    expect(next.characters[0].stats.completions.daily_mission).toBe(characters[0].stats.completions.daily_mission + 1);
  });

  it("throws engine validation error when action is not allowed", () => {
    const accounts = [createDefaultAccount("账号-1", "acc-1")];
    const characters = createCharacters();
    const settings = createSettings();

    expect(() =>
      applyTaskActionToState(accounts, characters, settings, {
        characterId: "char-1",
        taskId: "spirit_invasion",
        action: "set_completed",
        amount: 1,
      }),
    ).toThrowError("该任务不支持录入已完成次数");
  });

  it("mirrors shared weekly order progress to all characters in the same account", () => {
    const accounts = [createDefaultAccount("账号-1", "acc-1")];
    const characters = [
      createDefaultCharacter("角色-1", "2026-02-26T00:00:00.000Z", "char-1", "acc-1"),
      createDefaultCharacter("角色-2", "2026-02-26T00:00:00.000Z", "char-2", "acc-1"),
    ];
    const settings = createSettings();

    const next = applyTaskActionToState(accounts, characters, settings, {
      characterId: "char-1",
      taskId: "weekly_order",
      action: "set_completed",
      amount: 4,
    });

    expect(next.accounts[0].sharedActivities.weeklyRemaining).toBe(8);
    expect(next.characters[0].missions.weeklyRemaining).toBe(8);
    expect(next.characters[1].missions.weeklyRemaining).toBe(8);
  });

  it("resets weekly stats for all characters", () => {
    const characters = createCharacters().map((item) => ({
      ...item,
      stats: {
        ...item.stats,
        goldEarned: APP_STATE_VERSION * 100,
        completions: {
          ...item.stats.completions,
          daily_mission: 99,
        },
      },
    }));

    const next = resetWeeklyStatsForCharacters(characters, "2026-03-01T00:00:00.000Z");

    expect(next[0].stats.cycleStartedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(next[0].stats.goldEarned).toBe(0);
    expect(next[0].stats.completions.daily_mission).toBe(0);
  });
});
