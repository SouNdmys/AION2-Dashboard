import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, TASK_DEFINITIONS, createDefaultCharacter } from "./constants";
import { applyTaskAction, getTaskProgressText, refreshCharacterState } from "./engine";
import type { TaskDefinition } from "./types";

function at(y: number, m: number, d: number, h: number, min = 0, sec = 0): Date {
  return new Date(y, m - 1, d, h, min, sec, 0);
}

function createCharacter(now: Date): ReturnType<typeof createDefaultCharacter> {
  return createDefaultCharacter("测试角色", now.toISOString(), "char-1", "acc-1");
}

function getTask(taskId: TaskDefinition["id"]): TaskDefinition {
  const hit = TASK_DEFINITIONS.find((task) => task.id === taskId);
  if (!hit) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return hit;
}

describe("shared/engine applyTaskAction", () => {
  it("completes expedition and consumes base energy first", () => {
    const character = createCharacter(at(2026, 2, 24, 4, 0, 0));
    character.energy.baseCurrent = 100;
    character.energy.bonusCurrent = 100;
    character.activities.expeditionRemaining = 3;
    character.activities.expeditionBossRemaining = 3;
    const original = structuredClone(character);

    const result = applyTaskAction(character, DEFAULT_SETTINGS, {
      characterId: character.id,
      taskId: "expedition",
      action: "complete_once",
      amount: 2,
    });

    expect(result.success).toBe(true);
    expect(result.goldDelta).toBe(DEFAULT_SETTINGS.expeditionGoldPerRun * 2);
    expect(result.next.energy.baseCurrent).toBe(0);
    expect(result.next.energy.bonusCurrent).toBe(40);
    expect(result.next.activities.expeditionRemaining).toBe(1);
    expect(result.next.activities.expeditionBossRemaining).toBe(1);
    expect(result.next.stats.completions.expedition).toBe(2);
    expect(result.next.stats.goldEarned).toBe(DEFAULT_SETTINGS.expeditionGoldPerRun * 2);
    expect(character).toEqual(original);
  });

  it("uses stacked ticket pool after base count is exhausted", () => {
    const character = createCharacter(at(2026, 2, 24, 4, 0, 0));
    character.energy.baseCurrent = 300;
    character.activities.expeditionRemaining = 1;
    character.activities.expeditionTicketBonus = 2;
    character.activities.expeditionBossRemaining = 10;

    const result = applyTaskAction(character, DEFAULT_SETTINGS, {
      characterId: character.id,
      taskId: "expedition",
      action: "complete_once",
      amount: 2,
    });

    expect(result.success).toBe(true);
    expect(result.next.activities.expeditionRemaining).toBe(0);
    expect(result.next.activities.expeditionTicketBonus).toBe(1);
    expect(result.next.activities.expeditionBossRemaining).toBe(8);
  });

  it("supports set_completed for daily mission", () => {
    const character = createCharacter(at(2026, 2, 24, 4, 0, 0));

    const result = applyTaskAction(character, DEFAULT_SETTINGS, {
      characterId: character.id,
      taskId: "daily_mission",
      action: "set_completed",
      amount: 3,
    });

    expect(result.success).toBe(true);
    expect(result.next.missions.dailyRemaining).toBe(2);
  });

  it("fails when energy is insufficient", () => {
    const character = createCharacter(at(2026, 2, 24, 4, 0, 0));
    character.energy.baseCurrent = 0;
    character.energy.bonusCurrent = 0;
    character.activities.expeditionRemaining = 2;
    character.activities.expeditionBossRemaining = 2;

    const result = applyTaskAction(character, DEFAULT_SETTINGS, {
      characterId: character.id,
      taskId: "expedition",
      action: "complete_once",
      amount: 1,
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("奥德能量不足");
    expect(result.next.activities.expeditionRemaining).toBe(2);
  });

  it("fails when available counts are insufficient", () => {
    const character = createCharacter(at(2026, 2, 24, 4, 0, 0));
    character.energy.baseCurrent = 400;
    character.activities.expeditionRemaining = 0;
    character.activities.expeditionTicketBonus = 0;
    character.activities.expeditionBossRemaining = 3;

    const result = applyTaskAction(character, DEFAULT_SETTINGS, {
      characterId: character.id,
      taskId: "expedition",
      action: "complete_once",
      amount: 1,
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("可用次数不足");
  });
});

describe("shared/engine refreshCharacterState", () => {
  it("applies daily reset and scheduled energy tick", () => {
    const from = at(2026, 2, 24, 4, 30, 0);
    const to = at(2026, 2, 24, 5, 30, 0);
    const character = createCharacter(from);
    character.energy.baseCurrent = 600;
    character.missions.dailyRemaining = 0;
    character.activities.nightmareRemaining = 0;
    character.activities.miniGameRemaining = 0;
    character.activities.spiritInvasionRemaining = 0;

    const next = refreshCharacterState(character, to);

    expect(next.energy.baseCurrent).toBe(615);
    expect(next.missions.dailyRemaining).toBe(5);
    expect(next.activities.nightmareRemaining).toBe(2);
    expect(next.activities.miniGameRemaining).toBe(2);
    expect(next.activities.spiritInvasionRemaining).toBe(1);
    expect(next.meta.lastSyncedAt).toBe(to.toISOString());
    expect(character.missions.dailyRemaining).toBe(0);
  });

  it("applies weekly reset and resets weekly stats", () => {
    const from = at(2026, 2, 24, 23, 30, 0);
    const to = at(2026, 2, 25, 5, 30, 0);
    const character = createCharacter(from);

    character.missions.weeklyRemaining = 0;
    character.missions.abyssLowerRemaining = 0;
    character.missions.abyssMiddleRemaining = 0;
    character.activities.awakeningRemaining = 0;
    character.activities.dailyDungeonRemaining = 0;
    character.activities.sanctumRaidRemaining = 0;
    character.activities.sanctumBoxRemaining = 0;
    character.activities.expeditionBossRemaining = 0;
    character.activities.transcendenceBossRemaining = 0;
    character.activities.expeditionRemaining = 0;
    character.activities.transcendenceRemaining = 0;
    character.stats.goldEarned = 999999;
    character.stats.completions.expedition = 6;

    const next = refreshCharacterState(character, to);

    expect(next.missions.weeklyRemaining).toBe(12);
    expect(next.missions.abyssLowerRemaining).toBe(20);
    expect(next.missions.abyssMiddleRemaining).toBe(5);
    expect(next.activities.awakeningRemaining).toBe(3);
    expect(next.activities.dailyDungeonRemaining).toBe(14);
    expect(next.activities.sanctumRaidRemaining).toBe(2);
    expect(next.activities.sanctumBoxRemaining).toBe(2);
    expect(next.activities.expeditionBossRemaining).toBe(35);
    expect(next.activities.transcendenceBossRemaining).toBe(28);
    expect(next.activities.expeditionRemaining).toBe(1);
    expect(next.activities.transcendenceRemaining).toBe(1);
    expect(next.stats.goldEarned).toBe(0);
    expect(next.stats.completions.expedition).toBe(0);
    expect(next.stats.cycleStartedAt).toBe(to.toISOString());
  });
});

describe("shared/engine task helpers", () => {
  it("computes progress text with bonus display", () => {
    const character = createCharacter(at(2026, 2, 24, 4, 0, 0));
    character.activities.expeditionRemaining = 7;
    character.activities.expeditionTicketBonus = 2;

    const task = getTask("expedition");
    expect(getTaskProgressText(character, task, DEFAULT_SETTINGS)).toBe("7(+2)/14");
  });
});
