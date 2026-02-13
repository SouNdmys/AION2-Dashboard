import { DAILY_RESET_HOUR, WEEKLY_RESET_DAY, WEEKLY_RESET_HOUR } from "./constants";
import {
  CORRIDOR_UNIFIED_ANCHOR_LOCAL_ISO,
  CORRIDOR_UNIFIED_INTERVAL_HOURS,
  CORRIDOR_UNIFIED_REFRESH_HOUR,
} from "./constants";

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

export function getNextDailyReset(from = new Date()): Date {
  const next = new Date(from);
  next.setHours(DAILY_RESET_HOUR, 0, 0, 0);
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function getNextWeeklyReset(from = new Date()): Date {
  const next = new Date(from);
  next.setHours(WEEKLY_RESET_HOUR, 0, 0, 0);

  const diffDays = (WEEKLY_RESET_DAY - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + diffDays);
  if (next <= from) {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

export function getNextScheduledTick(from: Date, hours: readonly number[]): Date {
  const sortedHours = [...hours].sort((a, b) => a - b);
  for (const hour of sortedHours) {
    const candidate = new Date(from);
    candidate.setHours(hour, 0, 0, 0);
    if (candidate > from) {
      return candidate;
    }
  }

  const nextDay = new Date(from);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(sortedHours[0] ?? 0, 0, 0, 0);
  return nextDay;
}

export function getNextUnifiedCorridorRefresh(from = new Date()): Date {
  const base = new Date(CORRIDOR_UNIFIED_ANCHOR_LOCAL_ISO);
  if (Number.isNaN(base.getTime())) {
    const fallback = new Date(from);
    fallback.setHours(CORRIDOR_UNIFIED_REFRESH_HOUR, 0, 0, 0);
    if (fallback <= from) {
      fallback.setDate(fallback.getDate() + 1);
    }
    return fallback;
  }

  if (from < base) {
    return base;
  }

  const intervalMs = CORRIDOR_UNIFIED_INTERVAL_HOURS * 60 * 60 * 1000;
  const diffMs = from.getTime() - base.getTime();
  const steps = Math.floor(diffMs / intervalMs) + 1;
  return new Date(base.getTime() + steps * intervalMs);
}
