import { DAILY_DUNGEON_SHARED_MAX } from "../shared/constants";
import type { AccountState, AppSettings, CharacterState } from "../shared/types";
import { getEffectiveActivityCap } from "./store-domain-settings";
import { syncAccountSharedStateToCharacters } from "./store-domain-snapshot";

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
  dailyDungeonRemaining?: number;
  dailyDungeonTicketStored?: number;
  miniGameRemaining?: number;
  miniGameTicketBonus?: number;
  spiritInvasionRemaining?: number;
  sanctumRaidChallengeRemaining?: number;
  sanctumRaidChallengeBonus?: number;
  sanctumRaidBoxRemaining?: number;
  sanctumRaidBoxBonus?: number;
  sanctumPurifyChallengeRemaining?: number;
  sanctumPurifyBoxRemaining?: number;
}

export interface UpdateWeeklyCompletionsPayload {
  expeditionCompleted?: number;
  transcendenceCompleted?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function applyRaidCountsUpdate(
  accounts: AccountState[],
  characters: CharacterState[],
  settings: AppSettings,
  characterId: string,
  payload: UpdateRaidCountsPayload,
): { accounts: AccountState[]; characters: CharacterState[] } {
  const target = characters.find((item) => item.id === characterId);
  if (!target) {
    return { accounts, characters };
  }

  const expeditionCap = getEffectiveActivityCap(settings.expeditionRunCap, 14);
  const transcendenceCap = getEffectiveActivityCap(settings.transcendenceRunCap, 7);
  const nightmareCap = getEffectiveActivityCap(settings.nightmareRunCap, 14);
  const awakeningCap = getEffectiveActivityCap(settings.awakeningRunCap, 3);

  let nextAccounts = accounts;
  if (typeof payload.dailyDungeonRemaining === "number" || typeof payload.dailyDungeonTicketStored === "number") {
    nextAccounts = accounts.map((account) => {
      if (account.id !== target.accountId) {
        return account;
      }
      return {
        ...account,
        sharedActivities: {
          ...account.sharedActivities,
          dailyDungeonRemaining:
            typeof payload.dailyDungeonRemaining === "number"
              ? clamp(payload.dailyDungeonRemaining, 0, DAILY_DUNGEON_SHARED_MAX)
              : account.sharedActivities.dailyDungeonRemaining,
          dailyDungeonTicketStored:
            typeof payload.dailyDungeonTicketStored === "number"
              ? clamp(payload.dailyDungeonTicketStored, 0, 30)
              : account.sharedActivities.dailyDungeonTicketStored,
        },
      };
    });
  }

  const nextCharacters = characters.map((item) => {
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
        sanctumRaidChallengeRemaining:
          typeof payload.sanctumRaidChallengeRemaining === "number"
            ? clamp(payload.sanctumRaidChallengeRemaining, 0, 4)
            : item.activities.sanctumRaidChallengeRemaining,
        sanctumRaidChallengeBonus:
          typeof payload.sanctumRaidChallengeBonus === "number"
            ? clamp(payload.sanctumRaidChallengeBonus, 0, 1)
            : item.activities.sanctumRaidChallengeBonus,
        sanctumRaidBoxRemaining:
          typeof payload.sanctumRaidBoxRemaining === "number"
            ? clamp(payload.sanctumRaidBoxRemaining, 0, 2)
            : item.activities.sanctumRaidBoxRemaining,
        sanctumRaidBoxBonus:
          typeof payload.sanctumRaidBoxBonus === "number"
            ? clamp(payload.sanctumRaidBoxBonus, 0, 1)
            : item.activities.sanctumRaidBoxBonus,
        sanctumPurifyChallengeRemaining:
          typeof payload.sanctumPurifyChallengeRemaining === "number"
            ? clamp(payload.sanctumPurifyChallengeRemaining, 0, 4)
            : item.activities.sanctumPurifyChallengeRemaining,
        sanctumPurifyBoxRemaining:
          typeof payload.sanctumPurifyBoxRemaining === "number"
            ? clamp(payload.sanctumPurifyBoxRemaining, 0, 2)
            : item.activities.sanctumPurifyBoxRemaining,
      },
    };
  });

  return {
    accounts: nextAccounts,
    characters: syncAccountSharedStateToCharacters(nextAccounts, nextCharacters),
  };
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
