import type { WorkshopPriceSignalRule } from "../../shared/types";

export const WORKSHOP_HISTORY_DEFAULT_DAYS = 30;
export const WORKSHOP_HISTORY_MAX_DAYS = 365;
export const WORKSHOP_SIGNAL_THRESHOLD_DEFAULT = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MIN = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MAX = 0.5;

export const DEFAULT_WORKSHOP_SIGNAL_RULE: WorkshopPriceSignalRule = {
  enabled: true,
  lookbackDays: WORKSHOP_HISTORY_DEFAULT_DAYS,
  dropBelowWeekdayAverageRatio: WORKSHOP_SIGNAL_THRESHOLD_DEFAULT,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeLookbackDays(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_HISTORY_DEFAULT_DAYS;
  }
  return clamp(Math.floor(raw), 1, WORKSHOP_HISTORY_MAX_DAYS);
}

export function sanitizeSignalThresholdRatio(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_SIGNAL_THRESHOLD_DEFAULT;
  }
  return clamp(raw, WORKSHOP_SIGNAL_THRESHOLD_MIN, WORKSHOP_SIGNAL_THRESHOLD_MAX);
}

export function normalizeSignalRule(raw: unknown): WorkshopPriceSignalRule {
  const entity = raw as Record<string, unknown> | undefined;
  const enabled = typeof entity?.enabled === "boolean" ? entity.enabled : DEFAULT_WORKSHOP_SIGNAL_RULE.enabled;
  return {
    enabled,
    lookbackDays: sanitizeLookbackDays(entity?.lookbackDays),
    dropBelowWeekdayAverageRatio: sanitizeSignalThresholdRatio(entity?.dropBelowWeekdayAverageRatio),
  };
}
