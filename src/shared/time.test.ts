import { describe, expect, it } from "vitest";
import {
  countDailyResets,
  countScheduledTicks,
  countWeeklyResets,
  getNextDailyReset,
  getNextScheduledTick,
  getNextUnifiedCorridorRefresh,
  getNextWeeklyReset,
} from "./time";

function at(y: number, m: number, d: number, h: number, min = 0, sec = 0): Date {
  return new Date(y, m - 1, d, h, min, sec, 0);
}

describe("shared/time", () => {
  it("counts daily resets between two timestamps", () => {
    const from = at(2026, 2, 24, 4, 59, 0);
    const to = at(2026, 2, 25, 5, 1, 0);
    expect(countDailyResets(from, to)).toBe(2);
  });

  it("counts weekly reset at Wednesday 05:00", () => {
    const from = at(2026, 2, 24, 23, 30, 0);
    const to = at(2026, 2, 25, 5, 0, 0);
    expect(countWeeklyResets(from, to)).toBe(1);
  });

  it("counts scheduled ticks across day boundary", () => {
    const from = at(2026, 2, 24, 12, 30, 0);
    const to = at(2026, 2, 25, 5, 0, 0);
    expect(countScheduledTicks(from, to, [5, 13, 21])).toBe(3);
  });

  it("returns next daily reset", () => {
    const beforeReset = at(2026, 2, 24, 4, 10, 0);
    const afterReset = at(2026, 2, 24, 5, 10, 0);
    expect(getNextDailyReset(beforeReset)).toEqual(at(2026, 2, 24, 5, 0, 0));
    expect(getNextDailyReset(afterReset)).toEqual(at(2026, 2, 25, 5, 0, 0));
  });

  it("returns next weekly reset", () => {
    const beforeWeeklyReset = at(2026, 2, 25, 4, 0, 0);
    const afterWeeklyReset = at(2026, 2, 25, 5, 0, 0);
    expect(getNextWeeklyReset(beforeWeeklyReset)).toEqual(at(2026, 2, 25, 5, 0, 0));
    expect(getNextWeeklyReset(afterWeeklyReset)).toEqual(at(2026, 3, 4, 5, 0, 0));
  });

  it("returns next scheduled tick from unsorted hour list", () => {
    const current = at(2026, 2, 24, 13, 0, 0);
    const endOfDay = at(2026, 2, 24, 23, 30, 0);
    expect(getNextScheduledTick(current, [21, 13, 5])).toEqual(at(2026, 2, 24, 21, 0, 0));
    expect(getNextScheduledTick(endOfDay, [21, 13, 5])).toEqual(at(2026, 2, 25, 5, 0, 0));
  });

  it("returns next unified corridor refresh window", () => {
    const fromWednesday = at(2026, 2, 25, 10, 0, 0);
    const fromSaturdayLate = at(2026, 2, 28, 22, 0, 0);
    expect(getNextUnifiedCorridorRefresh(fromWednesday)).toEqual(at(2026, 2, 26, 21, 0, 0));
    expect(getNextUnifiedCorridorRefresh(fromSaturdayLate)).toEqual(at(2026, 3, 3, 21, 0, 0));
  });
});
