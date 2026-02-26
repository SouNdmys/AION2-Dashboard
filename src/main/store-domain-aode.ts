import {
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  AODE_WEEKLY_EXTRA_CONVERT_MAX,
  AODE_WEEKLY_EXTRA_PURCHASE_MAX,
} from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";

export interface UpdateAodePlanPayload {
  shopAodePurchaseUsed?: number;
  shopDailyDungeonTicketPurchaseUsed?: number;
  transformAodeUsed?: number;
  assignExtra?: boolean;
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

export function resolveAodeLimitsForCharacter(
  accounts: AccountState[],
  character: CharacterState,
): { purchaseLimit: number; convertLimit: number } {
  const account = accounts.find((item) => item.id === character.accountId);
  const isExtra = account?.extraAodeCharacterId === character.id;
  return {
    purchaseLimit: AODE_WEEKLY_BASE_PURCHASE_MAX + (isExtra ? AODE_WEEKLY_EXTRA_PURCHASE_MAX : 0),
    convertLimit: AODE_WEEKLY_BASE_CONVERT_MAX + (isExtra ? AODE_WEEKLY_EXTRA_CONVERT_MAX : 0),
  };
}

function applyAodeExtraAssignment(
  accounts: AccountState[],
  targetAccountId: string,
  characterId: string,
  assignExtra: boolean | undefined,
): AccountState[] {
  if (typeof assignExtra !== "boolean") {
    return accounts;
  }
  return accounts.map((account) => {
    if (account.id !== targetAccountId) {
      return account;
    }
    if (assignExtra) {
      return { ...account, extraAodeCharacterId: characterId };
    }
    if (account.extraAodeCharacterId === characterId) {
      return { ...account, extraAodeCharacterId: undefined };
    }
    return account;
  });
}

export function applyAodePlanUpdate(input: ApplyAodePlanUpdateInput): ApplyAodePlanUpdateResult {
  const target = input.characters.find((item) => item.id === input.characterId);
  if (!target) {
    throw new Error("角色不存在");
  }

  const nextAccounts = applyAodeExtraAssignment(
    input.accounts,
    target.accountId,
    input.characterId,
    input.payload.assignExtra,
  );

  const nextCharacters = input.characters.map((item) => {
    if (item.accountId !== target.accountId) {
      return item;
    }
    const limits = resolveAodeLimitsForCharacter(nextAccounts, item);
    const nextShopAodePurchaseUsed =
      item.id === input.characterId && typeof input.payload.shopAodePurchaseUsed === "number"
        ? clamp(Math.floor(input.payload.shopAodePurchaseUsed), 0, limits.purchaseLimit)
        : clamp(item.aodePlan.shopAodePurchaseUsed, 0, limits.purchaseLimit);
    const nextShopDailyDungeonTicketPurchaseUsed =
      item.id === input.characterId && typeof input.payload.shopDailyDungeonTicketPurchaseUsed === "number"
        ? clamp(Math.floor(input.payload.shopDailyDungeonTicketPurchaseUsed), 0, limits.purchaseLimit)
        : clamp(item.aodePlan.shopDailyDungeonTicketPurchaseUsed, 0, limits.purchaseLimit);
    const nextTransformAodeUsed =
      item.id === input.characterId && typeof input.payload.transformAodeUsed === "number"
        ? clamp(Math.floor(input.payload.transformAodeUsed), 0, limits.convertLimit)
        : clamp(item.aodePlan.transformAodeUsed, 0, limits.convertLimit);
    return {
      ...item,
      aodePlan: {
        shopAodePurchaseUsed: nextShopAodePurchaseUsed,
        shopDailyDungeonTicketPurchaseUsed: nextShopDailyDungeonTicketPurchaseUsed,
        transformAodeUsed: nextTransformAodeUsed,
      },
    };
  });

  return {
    accounts: nextAccounts,
    characters: nextCharacters,
  };
}
