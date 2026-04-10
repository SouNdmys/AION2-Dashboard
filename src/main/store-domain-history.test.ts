import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, createDefaultAccount } from "../shared/constants";
import type { AppState, CharacterState } from "../shared/types";
import {
  buildAppStateMutationSignature,
  buildAppStateRollbackPayload,
  createAppStateMutationDraft,
  restoreAppStateByDelta,
} from "./store-domain-history";

function character(id: string, name: string, accountId = "acc-1"): CharacterState {
  return {
    id,
    accountId,
    name,
    isStarred: false,
    avatarSeed: "seed",
    energy: { baseCurrent: 100, bonusCurrent: 0, baseCap: 1000, bonusCap: 2000 },
    aodePlan: {
      shopAodePurchaseUsed: 0,
      shopUnknownChallengeTicketUsed: 0,
      shopExpeditionChoiceBoxUsed: 0,
      shopNightmareInstantUsed: 0,
      shopAbyssReplenishUsed: 0,
      transformAodeUsed: 0,
    },
    missions: { dailyRemaining: 5, weeklyRemaining: 12, abyssLowerRemaining: 20, abyssMiddleRemaining: 5 },
    activities: {
      nightmareRemaining: 14,
      nightmareTicketBonus: 0,
      awakeningRemaining: 3,
      awakeningTicketBonus: 0,
      dailyDungeonRemaining: 14,
      dailyDungeonTicketStored: 0,
      expeditionRemaining: 14,
      expeditionTicketBonus: 0,
      expeditionBossRemaining: 35,
      transcendenceRemaining: 7,
      transcendenceTicketBonus: 0,
      transcendenceBossRemaining: 28,
      sanctumRaidChallengeRemaining: 4,
      sanctumRaidChallengeBonus: 0,
      sanctumRaidBoxRemaining: 2,
      sanctumRaidBoxBonus: 0,
      sanctumPurifyChallengeRemaining: 4,
      sanctumPurifyBoxRemaining: 2,
      miniGameRemaining: 14,
      miniGameTicketBonus: 0,
      spiritInvasionRemaining: 7,
      corridorLowerAvailable: 0,
      corridorLowerCap: 3,
      corridorLowerNextAt: null,
      corridorMiddleAvailable: 0,
      corridorMiddleCap: 3,
      corridorMiddleNextAt: null,
    },
    stats: {
      cycleStartedAt: "2026-02-26T00:00:00.000Z",
      goldEarned: 0,
      completions: {
        expedition: 0,
        transcendence: 0,
        mini_game: 0,
        spirit_invasion: 0,
        sanctum_box: 0,
        sanctum_purify_box: 0,
        daily_mission: 0,
        weekly_order: 0,
        abyss_lower: 0,
        abyss_middle: 0,
        nightmare: 0,
        awakening: 0,
        daily_dungeon: 0,
        sanctum_raid: 0,
        sanctum_purify_raid: 0,
      },
    },
    meta: { lastSyncedAt: "2026-02-26T00:00:00.000Z" },
  };
}

function appState(characters: CharacterState[]): AppState {
  return {
    version: 8,
    selectedAccountId: "acc-1",
    selectedCharacterId: characters[0]?.id ?? null,
    settings: DEFAULT_SETTINGS,
    accounts: [createDefaultAccount("账号1", "acc-1")],
    characters,
    history: [],
  };
}

describe("store/store-domain-history", () => {
  it("builds rollback payload using delta or snapshot by ratio", () => {
    const before = appState([character("char-a", "A")]);
    const after = { ...before, selectedCharacterId: null };

    const asDelta = buildAppStateRollbackPayload(before, after, 1);
    expect(asDelta.beforeDelta?.selectedCharacterId).toBe("char-a");
    expect(asDelta.before).toBeUndefined();

    const asSnapshot = buildAppStateRollbackPayload(before, after, 0);
    expect(asSnapshot.before?.selectedCharacterId).toBe("char-a");
    expect(asSnapshot.beforeDelta).toBeUndefined();
  });

  it("restores state by delta including character changes and order", () => {
    const current = appState([character("char-a", "A-new"), character("char-b", "B-new")]);
    const restored = restoreAppStateByDelta(current, {
      selectedCharacterId: "char-c",
      characterChanges: [
        { id: "char-a", before: character("char-a", "A-old") },
        { id: "char-b", before: null },
        { id: "char-c", before: character("char-c", "C-old") },
      ],
      characterOrder: ["char-c", "char-a"],
    });

    expect(restored.selectedCharacterId).toBe("char-c");
    expect(restored.characters.map((item) => item.id)).toEqual(["char-c", "char-a"]);
    expect(restored.characters[1].name).toBe("A-old");
  });

  it("creates lean mutation draft and stable mutation signature", () => {
    const state = appState([character("char-a", "A")]);
    state.history = [{ id: "h1", at: "2026-02-26T00:00:00.000Z", action: "x", characterId: null, before: undefined }];

    const draft = createAppStateMutationDraft(state);
    expect(draft.history).toEqual([]);
    expect(draft.characters).not.toBe(state.characters);

    const left = buildAppStateMutationSignature(state);
    const right = buildAppStateMutationSignature({ ...state, history: [] });
    expect(left).toBe(right);
  });
});
