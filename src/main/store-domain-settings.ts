import {
  DEFAULT_SETTINGS,
  EXPEDITION_REWARD_MAX,
  NIGHTMARE_MAX,
  TRANSCENDENCE_REWARD_MAX,
} from "../shared/constants";
import type { AppSettings, CharacterState } from "../shared/types";

const SETTINGS_MAX_CAP = 9999;
const SETTINGS_MAX_THRESHOLD = 999999;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toOptionalCap(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(Math.floor(value), 1, SETTINGS_MAX_CAP);
  }
  return fallback;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, value);
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return clamp(Math.floor(value), 1, SETTINGS_MAX_THRESHOLD);
}

function toPriorityWeight(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return clamp(Math.floor(value), 1, 5);
}

export function normalizeAppSettings(raw: unknown): AppSettings {
  const entity = raw as Record<string, unknown> | undefined;
  return {
    expeditionGoldPerRun: toPositiveNumber(entity?.expeditionGoldPerRun, DEFAULT_SETTINGS.expeditionGoldPerRun),
    transcendenceGoldPerRun: toPositiveNumber(entity?.transcendenceGoldPerRun, DEFAULT_SETTINGS.transcendenceGoldPerRun),
    expeditionRunCap: toOptionalCap(entity?.expeditionRunCap, DEFAULT_SETTINGS.expeditionRunCap),
    transcendenceRunCap: toOptionalCap(entity?.transcendenceRunCap, DEFAULT_SETTINGS.transcendenceRunCap),
    nightmareRunCap: toOptionalCap(entity?.nightmareRunCap, DEFAULT_SETTINGS.nightmareRunCap),
    awakeningRunCap: toOptionalCap(entity?.awakeningRunCap, DEFAULT_SETTINGS.awakeningRunCap),
    suppressionRunCap: toOptionalCap(entity?.suppressionRunCap, DEFAULT_SETTINGS.suppressionRunCap),
    expeditionWarnThreshold: toPositiveInteger(entity?.expeditionWarnThreshold, DEFAULT_SETTINGS.expeditionWarnThreshold),
    transcendenceWarnThreshold: toPositiveInteger(
      entity?.transcendenceWarnThreshold,
      DEFAULT_SETTINGS.transcendenceWarnThreshold,
    ),
    priorityWeightAode: toPriorityWeight(entity?.priorityWeightAode, DEFAULT_SETTINGS.priorityWeightAode),
    priorityWeightSanctum: toPriorityWeight(entity?.priorityWeightSanctum, DEFAULT_SETTINGS.priorityWeightSanctum),
    priorityWeightCorridor: toPriorityWeight(entity?.priorityWeightCorridor, DEFAULT_SETTINGS.priorityWeightCorridor),
    priorityWeightDungeon: toPriorityWeight(entity?.priorityWeightDungeon, DEFAULT_SETTINGS.priorityWeightDungeon),
    priorityWeightWeekly: toPriorityWeight(entity?.priorityWeightWeekly, DEFAULT_SETTINGS.priorityWeightWeekly),
    priorityWeightMission: toPriorityWeight(entity?.priorityWeightMission, DEFAULT_SETTINGS.priorityWeightMission),
    priorityWeightLeisure: toPriorityWeight(entity?.priorityWeightLeisure, DEFAULT_SETTINGS.priorityWeightLeisure),
  };
}

export function mergeAppSettings(current: AppSettings, payload: Partial<AppSettings>): AppSettings {
  return normalizeAppSettings({
    ...current,
    ...payload,
  });
}

export function getEffectiveActivityCap(override: number | null, baseCap: number): number {
  if (typeof override !== "number" || !Number.isFinite(override)) {
    return baseCap;
  }
  return clamp(Math.floor(override), 1, baseCap);
}

export function applyConfiguredActivityCaps(character: CharacterState, settings: AppSettings): CharacterState {
  return {
    ...character,
    activities: {
      ...character.activities,
      expeditionRemaining: clamp(
        character.activities.expeditionRemaining,
        0,
        getEffectiveActivityCap(settings.expeditionRunCap, EXPEDITION_REWARD_MAX),
      ),
      transcendenceRemaining: clamp(
        character.activities.transcendenceRemaining,
        0,
        getEffectiveActivityCap(settings.transcendenceRunCap, TRANSCENDENCE_REWARD_MAX),
      ),
      nightmareRemaining: clamp(
        character.activities.nightmareRemaining,
        0,
        getEffectiveActivityCap(settings.nightmareRunCap, NIGHTMARE_MAX),
      ),
      awakeningRemaining: clamp(character.activities.awakeningRemaining, 0, getEffectiveActivityCap(settings.awakeningRunCap, 3)),
      suppressionRemaining: clamp(character.activities.suppressionRemaining, 0, getEffectiveActivityCap(settings.suppressionRunCap, 3)),
    },
  };
}
