import { describe, expect, it } from "vitest";
import {
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  AODE_WEEKLY_EXTRA_CONVERT_MAX,
  AODE_WEEKLY_EXTRA_PURCHASE_MAX,
  createDefaultCharacter,
} from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";
import { applyAodePlanUpdate, resolveAodeLimitsForCharacter } from "./store-domain-aode";

function character(id: string, accountId: string): CharacterState {
  const created = createDefaultCharacter(`角色-${id}`, "2026-02-26T00:00:00.000Z", id, accountId);
  return {
    ...created,
    aodePlan: {
      shopAodePurchaseUsed: 999,
      shopDailyDungeonTicketPurchaseUsed: 999,
      transformAodeUsed: 999,
    },
  };
}

describe("store/store-domain-aode", () => {
  it("updates target character payload and re-clamps account peers by limits", () => {
    const accounts: AccountState[] = [{ id: "acc-1", name: "账号1" }];
    const characters = [character("char-a", "acc-1"), character("char-b", "acc-1")];

    const result = applyAodePlanUpdate({
      accounts,
      characters,
      characterId: "char-a",
      payload: {
        shopAodePurchaseUsed: 1_000,
        shopDailyDungeonTicketPurchaseUsed: 50,
        transformAodeUsed: 1_000,
        assignExtra: true,
      },
    });

    expect(result.accounts[0].extraAodeCharacterId).toBe("char-a");
    const target = result.characters.find((item) => item.id === "char-a");
    const peer = result.characters.find((item) => item.id === "char-b");
    expect(target?.aodePlan.shopAodePurchaseUsed).toBe(AODE_WEEKLY_BASE_PURCHASE_MAX + AODE_WEEKLY_EXTRA_PURCHASE_MAX);
    expect(target?.aodePlan.shopDailyDungeonTicketPurchaseUsed).toBe(
      AODE_WEEKLY_BASE_PURCHASE_MAX + AODE_WEEKLY_EXTRA_PURCHASE_MAX,
    );
    expect(target?.aodePlan.transformAodeUsed).toBe(AODE_WEEKLY_BASE_CONVERT_MAX + AODE_WEEKLY_EXTRA_CONVERT_MAX);
    expect(peer?.aodePlan.shopAodePurchaseUsed).toBe(AODE_WEEKLY_BASE_PURCHASE_MAX);
    expect(peer?.aodePlan.transformAodeUsed).toBe(AODE_WEEKLY_BASE_CONVERT_MAX);
  });

  it("removes extra assignment only when target was current extra", () => {
    const accounts: AccountState[] = [{ id: "acc-1", name: "账号1", extraAodeCharacterId: "char-a" }];
    const characters = [character("char-a", "acc-1"), character("char-b", "acc-1")];

    const result = applyAodePlanUpdate({
      accounts,
      characters,
      characterId: "char-a",
      payload: { assignExtra: false },
    });

    expect(result.accounts[0].extraAodeCharacterId).toBeUndefined();
    const limits = resolveAodeLimitsForCharacter(result.accounts, result.characters[0]);
    expect(limits.purchaseLimit).toBe(AODE_WEEKLY_BASE_PURCHASE_MAX);
    expect(limits.convertLimit).toBe(AODE_WEEKLY_BASE_CONVERT_MAX);
  });
});
