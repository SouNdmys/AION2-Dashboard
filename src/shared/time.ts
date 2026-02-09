import { DAILY_RESET_HOUR, WEEKLY_RESET_DAY, WEEKLY_RESET_HOUR } from "./constants";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function countDailyResets(from: Date, to: Date): number {
  if (to <= from) {
    return 0;
  }

  let count = 0;
  const cursor = startOfDay(from);
  cursor.setDate(cursor.getDate() - 1);
  const end = startOfDay(to);

  for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const resetAt = new Date(cursor);
    resetAt.setHours(DAILY_RESET_HOUR, 0, 0, 0);
    if (resetAt > from && resetAt <= to) {
      count += 1;
    }
  }

  return count;
}

export function countWeeklyResets(from: Date, to: Date): number {
  if (to <= from) {
    return 0;
  }

  let count = 0;
  const cursor = startOfDay(from);
  cursor.setDate(cursor.getDate() - 7);
  const end = startOfDay(to);

  for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== WEEKLY_RESET_DAY) {
      continue;
    }

    const resetAt = new Date(cursor);
    resetAt.setHours(WEEKLY_RESET_HOUR, 0, 0, 0);
    if (resetAt > from && resetAt <= to) {
      count += 1;
    }
  }

  return count;
}

export function countScheduledTicks(from: Date, to: Date, hours: readonly number[]): number {
  if (to <= from) {
    return 0;
  }

  let count = 0;
  const cursor = startOfDay(from);
  cursor.setDate(cursor.getDate() - 1);
  const end = startOfDay(to);

  for (; cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    for (const hour of hours) {
      const tick = new Date(cursor);
      tick.setHours(hour, 0, 0, 0);
      if (tick > from && tick <= to) {
        count += 1;
      }
    }
  }

  return count;
}

