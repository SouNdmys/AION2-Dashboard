import { describe, expect, it } from "vitest";
import {
  AODE_CONVERT_SERVER_LIMIT,
  AODE_SHOP_SERVER_LIMIT,
  ABYSS_REPLENISH_TICKET_SERVER_LIMIT,
  EXPEDITION_CHOICE_BOX_SERVER_LIMIT,
  NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT,
  UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT,
  createDefaultAccount,
  createDefaultCharacter,
} from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";
import { applyAodePlanUpdate, resolveAodeLimitsForCharacter } from "./store-domain-aode";

function account(id: string): AccountState {
  return createDefaultAccount(`账号-${id}`, id);
}

function character(id: string, accountId: string): CharacterState {
  return createDefaultCharacter(`角色-${id}`, "2026-02-26T00:00:00.000Z", id, accountId);
}

describe("store/store-domain-aode", () => {
  it("updates shared breeze plan for the whole account and syncs to characters", () => {
    const accounts = [account("acc-1")];
    const characters = [character("char-a", "acc-1"), character("char-b", "acc-1")];

    const result = applyAodePlanUpdate({
      accounts,
      characters,
      characterId: "char-a",
      payload: {
        shopAodePurchaseUsed: 999,
        shopUnknownChallengeTicketUsed: 999,
        shopExpeditionChoiceBoxUsed: 999,
        shopNightmareInstantUsed: 999,
        shopAbyssReplenishUsed: 999,
        transformAodeUsed: 999,
      },
    });

    expect(result.accounts[0].breezePlan.shopAodePurchaseUsed).toBe(AODE_SHOP_SERVER_LIMIT);
    expect(result.accounts[0].breezePlan.shopUnknownChallengeTicketUsed).toBe(UNKNOWN_CHALLENGE_TICKET_SERVER_LIMIT);
    expect(result.accounts[0].breezePlan.shopExpeditionChoiceBoxUsed).toBe(EXPEDITION_CHOICE_BOX_SERVER_LIMIT);
    expect(result.accounts[0].breezePlan.shopNightmareInstantUsed).toBe(NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT);
    expect(result.accounts[0].breezePlan.shopAbyssReplenishUsed).toBe(ABYSS_REPLENISH_TICKET_SERVER_LIMIT);
    expect(result.accounts[0].breezePlan.shopAbyssReplenishAssignedCharacterId).toBe("char-a");
    expect(result.accounts[0].breezePlan.transformAodeUsed).toBe(AODE_CONVERT_SERVER_LIMIT);
    expect(result.characters[0].aodePlan.shopExpeditionChoiceBoxUsed).toBe(EXPEDITION_CHOICE_BOX_SERVER_LIMIT);
    expect(result.characters[1].aodePlan.shopNightmareInstantUsed).toBe(NIGHTMARE_INSTANT_TICKET_SERVER_LIMIT);
    expect(result.characters[0].activities.sanctumRaidChallengeBonus).toBe(1);
    expect(result.characters[0].activities.sanctumRaidBoxBonus).toBe(1);
    expect(result.characters[1].activities.sanctumRaidChallengeBonus).toBe(0);
  });

  it("resolves unified server limits", () => {
    const limits = resolveAodeLimitsForCharacter();
    expect(limits.purchaseLimit).toBe(AODE_SHOP_SERVER_LIMIT);
    expect(limits.convertLimit).toBe(AODE_CONVERT_SERVER_LIMIT);
  });
});
