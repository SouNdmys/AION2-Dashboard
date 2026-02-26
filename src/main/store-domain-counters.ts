import type { AppSettings, CharacterState } from "../shared/types";
import { getEffectiveActivityCap } from "./store-domain-settings";

export interface UpdateRaidCountsPayload {
  expeditionRemaining?: number;
  expeditionTicketBonus?: number;
  expeditionBossRemaining?: number;
  transcendenceRemaining?: number;
  transcendenceTicketBonus?: number;
  transcendenceBossRemaining?: number;
  nightmareRemaining?: number;
  nightmareTicketBonus?: number;
  awakeningRemaining?: number;
  awakeningTicketBonus?: number;
  suppressionRemaining?: number;
  suppressionTicketBonus?: number;
  dailyDungeonRemaining?: number;
  dailyDungeonTicketStored?: number;
  miniGameRemaining?: number;
  miniGameTicketBonus?: number;
  spiritInvasionRemaining?: number;
  sanctumRaidRemaining?: number;
  sanctumBoxRemaining?: number;
}

export interface UpdateWeeklyCompletionsPayload {
  expeditionCompleted?: number;
  transcendenceCompleted?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function applyRaidCountsUpdate(
  characters: CharacterState[],
  settings: AppSettings,
  characterId: string,
  payload: UpdateRaidCountsPayload,
): CharacterState[] {
  const expeditionCap = getEffectiveActivityCap(settings.expeditionRunCap, 21);
  const transcendenceCap = getEffectiveActivityCap(settings.transcendenceRunCap, 14);
  const nightmareCap = getEffectiveActivityCap(settings.nightmareRunCap, 14);
  const awakeningCap = getEffectiveActivityCap(settings.awakeningRunCap, 3);
  const suppressionCap = getEffectiveActivityCap(settings.suppressionRunCap, 3);

  return characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }

    return {
      ...item,
      activities: {
        ...item.activities,
        expeditionRemaining:
          typeof payload.expeditionRemaining === "number"
            ? clamp(payload.expeditionRemaining, 0, expeditionCap)
            : item.activities.expeditionRemaining,
        expeditionTicketBonus:
          typeof payload.expeditionTicketBonus === "number"
            ? clamp(payload.expeditionTicketBonus, 0, 999)
            : item.activities.expeditionTicketBonus,
        expeditionBossRemaining:
          typeof payload.expeditionBossRemaining === "number"
            ? clamp(payload.expeditionBossRemaining, 0, 35)
            : item.activities.expeditionBossRemaining,
        transcendenceRemaining:
          typeof payload.transcendenceRemaining === "number"
            ? clamp(payload.transcendenceRemaining, 0, transcendenceCap)
            : item.activities.transcendenceRemaining,
        transcendenceTicketBonus:
          typeof payload.transcendenceTicketBonus === "number"
            ? clamp(payload.transcendenceTicketBonus, 0, 999)
            : item.activities.transcendenceTicketBonus,
        transcendenceBossRemaining:
          typeof payload.transcendenceBossRemaining === "number"
            ? clamp(payload.transcendenceBossRemaining, 0, 28)
            : item.activities.transcendenceBossRemaining,
        nightmareRemaining:
          typeof payload.nightmareRemaining === "number"
            ? clamp(payload.nightmareRemaining, 0, nightmareCap)
            : item.activities.nightmareRemaining,
        nightmareTicketBonus:
          typeof payload.nightmareTicketBonus === "number"
            ? clamp(payload.nightmareTicketBonus, 0, 999)
            : item.activities.nightmareTicketBonus,
        awakeningRemaining:
          typeof payload.awakeningRemaining === "number"
            ? clamp(payload.awakeningRemaining, 0, awakeningCap)
            : item.activities.awakeningRemaining,
        awakeningTicketBonus:
          typeof payload.awakeningTicketBonus === "number"
            ? clamp(payload.awakeningTicketBonus, 0, 999)
            : item.activities.awakeningTicketBonus,
        suppressionRemaining:
          typeof payload.suppressionRemaining === "number"
            ? clamp(payload.suppressionRemaining, 0, suppressionCap)
            : item.activities.suppressionRemaining,
        suppressionTicketBonus:
          typeof payload.suppressionTicketBonus === "number"
            ? clamp(payload.suppressionTicketBonus, 0, 999)
            : item.activities.suppressionTicketBonus,
        dailyDungeonRemaining:
          typeof payload.dailyDungeonRemaining === "number"
            ? clamp(payload.dailyDungeonRemaining, 0, 999)
            : item.activities.dailyDungeonRemaining,
        dailyDungeonTicketStored:
          typeof payload.dailyDungeonTicketStored === "number"
            ? clamp(payload.dailyDungeonTicketStored, 0, 30)
            : item.activities.dailyDungeonTicketStored,
        miniGameRemaining:
          typeof payload.miniGameRemaining === "number"
            ? clamp(payload.miniGameRemaining, 0, 14)
            : item.activities.miniGameRemaining,
        miniGameTicketBonus:
          typeof payload.miniGameTicketBonus === "number"
            ? clamp(payload.miniGameTicketBonus, 0, 999)
            : item.activities.miniGameTicketBonus,
        spiritInvasionRemaining:
          typeof payload.spiritInvasionRemaining === "number"
            ? clamp(payload.spiritInvasionRemaining, 0, 7)
            : item.activities.spiritInvasionRemaining,
        sanctumRaidRemaining:
          typeof payload.sanctumRaidRemaining === "number"
            ? clamp(payload.sanctumRaidRemaining, 0, 4)
            : item.activities.sanctumRaidRemaining,
        sanctumBoxRemaining:
          typeof payload.sanctumBoxRemaining === "number"
            ? clamp(payload.sanctumBoxRemaining, 0, 2)
            : item.activities.sanctumBoxRemaining,
      },
    };
  });
}

export function applyWeeklyCompletionsUpdate(
  characters: CharacterState[],
  characterId: string,
  payload: UpdateWeeklyCompletionsPayload,
  maxThreshold: number,
): CharacterState[] {
  return characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }
    return {
      ...item,
      stats: {
        ...item.stats,
        completions: {
          ...item.stats.completions,
          expedition:
            typeof payload.expeditionCompleted === "number"
              ? clamp(payload.expeditionCompleted, 0, maxThreshold)
              : item.stats.completions.expedition,
          transcendence:
            typeof payload.transcendenceCompleted === "number"
              ? clamp(payload.transcendenceCompleted, 0, maxThreshold)
              : item.stats.completions.transcendence,
        },
      },
    };
  });
}
