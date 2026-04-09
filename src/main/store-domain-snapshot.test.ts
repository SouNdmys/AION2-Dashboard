import { describe, expect, it } from "vitest";
import { normalizeAppState } from "./store-domain-snapshot";

describe("store/store-domain-snapshot", () => {
  it("creates fallback account when raw data has characters but no accounts", () => {
    const state = normalizeAppState({
      version: 6,
      settings: {},
      accounts: [],
      characters: [{ id: "char-1", name: "角色1", accountId: "missing-account" }],
      history: [],
    });

    expect(state.accounts).toHaveLength(1);
    expect(state.characters).toHaveLength(1);
    expect(state.characters[0].accountId).toBe(state.accounts[0].id);
    expect(state.selectedCharacterId).toBe("char-1");
    expect(state.selectedAccountId).toBe(state.accounts[0].id);
  });

  it("applies daily-dungeon legacy migration for pre-v4 source version", () => {
    const state = normalizeAppState({
      version: 3,
      settings: {},
      accounts: [{ id: "acc-1", name: "账号1" }],
      characters: [
        {
          id: "char-1",
          accountId: "acc-1",
          name: "角色1",
          activities: {
            dailyDungeonRemaining: 10,
            dailyDungeonTicketStored: 3,
          },
        },
      ],
      history: [],
    });

    expect(state.characters[0].activities.dailyDungeonRemaining).toBe(7);
    expect(state.characters[0].activities.dailyDungeonTicketStored).toBe(3);
  });

  it("derives shared weekly mission pools from character snapshot and mirrors them back", () => {
    const state = normalizeAppState({
      version: 8,
      settings: {},
      accounts: [{ id: "acc-1", name: "账号1" }],
      characters: [
        {
          id: "char-1",
          accountId: "acc-1",
          name: "角色1",
          missions: {
            dailyRemaining: 5,
            weeklyRemaining: 9,
            abyssLowerRemaining: 13,
            abyssMiddleRemaining: 4,
          },
        },
        {
          id: "char-2",
          accountId: "acc-1",
          name: "角色2",
        },
      ],
      history: [],
    });

    expect(state.accounts[0].sharedActivities.weeklyRemaining).toBe(9);
    expect(state.accounts[0].sharedActivities.abyssLowerRemaining).toBe(13);
    expect(state.accounts[0].sharedActivities.abyssMiddleRemaining).toBe(4);
    expect(state.characters[0].missions.weeklyRemaining).toBe(9);
    expect(state.characters[1].missions.weeklyRemaining).toBe(9);
    expect(state.characters[1].missions.abyssLowerRemaining).toBe(13);
    expect(state.characters[1].missions.abyssMiddleRemaining).toBe(4);
  });

  it("keeps only valid history entries with before or beforeDelta", () => {
    const state = normalizeAppState({
      version: 6,
      settings: {},
      accounts: [{ id: "acc-1", name: "账号1" }],
      characters: [{ id: "char-1", accountId: "acc-1", name: "角色1" }],
      history: [
        { id: "bad-1", action: "无效历史" },
        {
          id: "ok-1",
          action: "有效历史",
          before: {
            selectedAccountId: "acc-1",
            selectedCharacterId: "char-1",
            settings: {},
            accounts: [{ id: "acc-1", name: "账号1" }],
            characters: [{ id: "char-1", accountId: "acc-1", name: "角色1" }],
          },
        },
        {
          id: "ok-2",
          action: "有效delta",
          beforeDelta: { selectedAccountId: null },
        },
      ],
    });

    expect(state.history).toHaveLength(2);
    expect(state.history.some((entry) => entry.id === "ok-1")).toBe(true);
    expect(state.history.some((entry) => entry.id === "ok-2")).toBe(true);
  });
});
