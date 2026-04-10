import {
  ABYSS_REPLENISH_TICKET_SERVER_LIMIT,
  AODE_CONVERT_SERVER_LIMIT,
  AODE_SHOP_SERVER_LIMIT,
  EXPEDITION_CHOICE_BOX_SERVER_LIMIT,
  NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT,
  UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT,
} from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";
import { syncAccountSharedStateToCharacters } from "./store-domain-snapshot";

export interface UpdateAodePlanPayload {
  shopAodePurchaseUsed?: number;
  shopUnknownChallengeTicketUsed?: number;
  shopExpeditionChoiceBoxUsed?: number;
  shopNightmareInstantUsed?: number;
  shopAbyssReplenishUsed?: number;
  transformAodeUsed?: number;
}

export interface ApplyAodePlanUpdateInput {
  accounts: AccountState[];
  characters: CharacterState[];
  characterId: string;
  payload: UpdateAodePlanPayload;
}

export interface ApplyAodePlanUpdateResult {
  accounts: AccountState[];
  characters: CharacterState[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveAodeLimitsForCharacter(): { purchaseLimit: number; convertLimit: number } {
  return {
    purchaseLimit: AODE_SHOP_SERVER_LIMIT,
    convertLimit: AODE_CONVERT_SERVER_LIMIT,
  };
}

export function applyAodePlanUpdate(input: ApplyAodePlanUpdateInput): ApplyAodePlanUpdateResult {
  const target = input.characters.find((item) => item.id === input.characterId);
  if (!target) {
    throw new Error("角色不存在");
  }

  const currentAccount = input.accounts.find((account) => account.id === target.accountId);
  const previousShopAbyssReplenishUsed = currentAccount?.breezePlan.shopAbyssReplenishUsed ?? 0;
  const previousAssignedCharacterId = currentAccount?.breezePlan.shopAbyssReplenishAssignedCharacterId ?? null;
  const nextShopAbyssReplenishUsed =
    typeof input.payload.shopAbyssReplenishUsed === "number"
      ? clamp(Math.floor(input.payload.shopAbyssReplenishUsed), 0, ABYSS_REPLENISH_TICKET_SERVER_LIMIT)
      : previousShopAbyssReplenishUsed;
  const nextAssignedCharacterId = nextShopAbyssReplenishUsed > 0 ? input.characterId : null;
  const previousAssignedCharacter =
    previousAssignedCharacterId === null
      ? null
      : input.characters.find((item) => item.accountId === target.accountId && item.id === previousAssignedCharacterId) ?? null;
  const transferRaidChallengeBonus = previousAssignedCharacter?.activities.sanctumRaidChallengeBonus ?? 0;
  const transferRaidBoxBonus = previousAssignedCharacter?.activities.sanctumRaidBoxBonus ?? 0;

  const nextAccounts = input.accounts.map((account) => {
    if (account.id !== target.accountId) {
      return account;
    }
    return {
      ...account,
      breezePlan: {
        shopAodePurchaseUsed:
          typeof input.payload.shopAodePurchaseUsed === "number"
            ? clamp(Math.floor(input.payload.shopAodePurchaseUsed), 0, AODE_SHOP_SERVER_LIMIT)
            : clamp(account.breezePlan.shopAodePurchaseUsed, 0, AODE_SHOP_SERVER_LIMIT),
        shopUnknownChallengeTicketUsed:
          typeof input.payload.shopUnknownChallengeTicketUsed === "number"
            ? clamp(Math.floor(input.payload.shopUnknownChallengeTicketUsed), 0, UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT)
            : clamp(account.breezePlan.shopUnknownChallengeTicketUsed, 0, UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT),
        shopExpeditionChoiceBoxUsed:
          typeof input.payload.shopExpeditionChoiceBoxUsed === "number"
            ? clamp(Math.floor(input.payload.shopExpeditionChoiceBoxUsed), 0, EXPEDITION_CHOICE_BOX_SERVER_LIMIT)
            : clamp(account.breezePlan.shopExpeditionChoiceBoxUsed, 0, EXPEDITION_CHOICE_BOX_SERVER_LIMIT),
        shopNightmareInstantUsed:
          typeof input.payload.shopNightmareInstantUsed === "number"
            ? clamp(Math.floor(input.payload.shopNightmareInstantUsed), 0, NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT)
            : clamp(account.breezePlan.shopNightmareInstantUsed, 0, NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT),
        shopAbyssReplenishUsed: nextShopAbyssReplenishUsed,
        shopAbyssReplenishAssignedCharacterId: nextAssignedCharacterId,
        transformAodeUsed:
          typeof input.payload.transformAodeUsed === "number"
            ? clamp(Math.floor(input.payload.transformAodeUsed), 0, AODE_CONVERT_SERVER_LIMIT)
            : clamp(account.breezePlan.transformAodeUsed, 0, AODE_CONVERT_SERVER_LIMIT),
      },
    };
  });

  const nextCharacters = input.characters.map((character) => {
    if (character.accountId !== target.accountId) {
      return character;
    }

    let sanctumRaidChallengeBonus = character.activities.sanctumRaidChallengeBonus;
    let sanctumRaidBoxBonus = character.activities.sanctumRaidBoxBonus;

    if (previousAssignedCharacterId && character.id === previousAssignedCharacterId && previousAssignedCharacterId !== nextAssignedCharacterId) {
      sanctumRaidChallengeBonus = 0;
      sanctumRaidBoxBonus = 0;
    }

    if (nextShopAbyssReplenishUsed === 0) {
      sanctumRaidChallengeBonus = 0;
      sanctumRaidBoxBonus = 0;
    } else if (character.id === nextAssignedCharacterId) {
      if (previousShopAbyssReplenishUsed === 0) {
        sanctumRaidChallengeBonus = 1;
        sanctumRaidBoxBonus = 1;
      } else if (previousAssignedCharacterId !== nextAssignedCharacterId) {
        sanctumRaidChallengeBonus = transferRaidChallengeBonus;
        sanctumRaidBoxBonus = transferRaidBoxBonus;
      }
    }

    return {
      ...character,
      activities: {
        ...character.activities,
        sanctumRaidChallengeBonus,
        sanctumRaidBoxBonus,
      },
    };
  });

  return {
    accounts: nextAccounts,
    characters: syncAccountSharedStateToCharacters(nextAccounts, nextCharacters),
  };
}
