import { createEmptyWeeklyStats } from "../shared/constants";
import { applyTaskAction } from "../shared/engine";
import type { AccountState, AppSettings, ApplyTaskActionInput, CharacterState } from "../shared/types";
import { syncAccountSharedStateToCharacters } from "./store-domain-snapshot";

export function buildTaskActionDescription(input: ApplyTaskActionInput): string {
  return `${input.taskId} x${Math.max(1, Math.floor(input.amount ?? 1))}`;
}

export function applyTaskActionToState(
  accounts: AccountState[],
  characters: CharacterState[],
  settings: AppSettings,
  input: ApplyTaskActionInput,
): { accounts: AccountState[]; characters: CharacterState[] } {
  const index = characters.findIndex((item) => item.id === input.characterId);
  if (index < 0) {
    throw new Error("角色不存在");
  }

  const result = applyTaskAction(characters[index], settings, input);
  if (!result.success) {
    throw new Error(result.message);
  }

  let nextAccounts = accounts;
  const nextCharacters = [...characters];
  nextCharacters[index] = result.next;

  if (
    input.taskId === "daily_dungeon" ||
    input.taskId === "weekly_order" ||
    input.taskId === "abyss_lower" ||
    input.taskId === "abyss_middle"
  ) {
    nextAccounts = accounts.map((account) => {
      if (account.id !== result.next.accountId) {
        return account;
      }
      return {
        ...account,
        sharedActivities: {
          ...account.sharedActivities,
          dailyDungeonRemaining:
            input.taskId === "daily_dungeon" ? result.next.activities.dailyDungeonRemaining : account.sharedActivities.dailyDungeonRemaining,
          dailyDungeonTicketStored:
            input.taskId === "daily_dungeon" ? result.next.activities.dailyDungeonTicketStored : account.sharedActivities.dailyDungeonTicketStored,
          weeklyRemaining:
            input.taskId === "weekly_order" ? result.next.missions.weeklyRemaining : account.sharedActivities.weeklyRemaining,
          abyssLowerRemaining:
            input.taskId === "abyss_lower" ? result.next.missions.abyssLowerRemaining : account.sharedActivities.abyssLowerRemaining,
          abyssMiddleRemaining:
            input.taskId === "abyss_middle" ? result.next.missions.abyssMiddleRemaining : account.sharedActivities.abyssMiddleRemaining,
        },
      };
    });
    return {
      accounts: nextAccounts,
      characters: syncAccountSharedStateToCharacters(nextAccounts, nextCharacters),
    };
  }

  return {
    accounts: nextAccounts,
    characters: nextCharacters,
  };
}

export function resetWeeklyStatsForCharacters(characters: CharacterState[], nowIso: string): CharacterState[] {
  return characters.map((item) => ({
    ...item,
    stats: createEmptyWeeklyStats(nowIso),
  }));
}
