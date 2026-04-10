import { IPC_CHANNELS } from "../../shared/ipc";
import {
  addCharacter,
  applyAction,
  applyCorridorCompletion,
  deleteCharacter,
  renameCharacter,
  reorderCharacters,
  setCharacterStar,
  selectCharacter,
  setCorridorCompleted,
  updateAodePlan,
  updateArtifactStatus,
  updateCharacterProfile,
  updateEnergySegments,
  updateRaidCounts,
  updateWeeklyCompletions,
} from "../store";
import { readObjectPayload, readOptionalBoolean, readOptionalNumber, readOptionalString, readString, readStringArray } from "./guards";
import { registerIpcHandler } from "./register-handler";

function readLane(payload: Record<string, unknown>, channel: string): "lower" | "middle" {
  const lane = readString(payload, "lane", channel);
  if (lane !== "lower" && lane !== "middle") {
    throw new Error(`[${channel}] invalid payload: field "lane" must be "lower" or "middle"`);
  }
  return lane;
}

function readOptionalNullableString(payload: Record<string, unknown>, key: string, channel: string): string | null | undefined {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`[${channel}] invalid payload: field "${key}" must be string | null`);
  }
  return value;
}

function readOptionalNullableNumber(payload: Record<string, unknown>, key: string, channel: string): number | null | undefined {
  const value = payload[key];
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`[${channel}] invalid payload: field "${key}" must be number | null`);
  }
  return value;
}

export function registerCharacterIpcHandlers(): void {
  registerIpcHandler(IPC_CHANNELS.addCharacter, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.addCharacter;
    const body = readObjectPayload(payload, channel);
    return addCharacter(readString(body, "name", channel), readOptionalString(body, "accountId", channel));
  });
  registerIpcHandler(IPC_CHANNELS.renameCharacter, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.renameCharacter;
    const body = readObjectPayload(payload, channel);
    return renameCharacter(readString(body, "characterId", channel), readString(body, "name", channel));
  });
  registerIpcHandler(IPC_CHANNELS.deleteCharacter, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteCharacter;
    const body = readObjectPayload(payload, channel);
    return deleteCharacter(readString(body, "characterId", channel));
  });
  registerIpcHandler(IPC_CHANNELS.selectCharacter, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.selectCharacter;
    const body = readObjectPayload(payload, channel);
    return selectCharacter(readString(body, "characterId", channel));
  });
  registerIpcHandler(IPC_CHANNELS.setCharacterStar, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.setCharacterStar;
    const body = readObjectPayload(payload, channel);
    const isStarred = readOptionalBoolean(body, "isStarred", channel);
    if (isStarred === undefined) {
      throw new Error(`[${channel}] invalid payload: field "isStarred" is required`);
    }
    return setCharacterStar(readString(body, "characterId", channel), isStarred);
  });
  registerIpcHandler(IPC_CHANNELS.updateCharacterProfile, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateCharacterProfile;
    const body = readObjectPayload(payload, channel);
    return updateCharacterProfile(readString(body, "characterId", channel), {
      classTag: readOptionalNullableString(body, "classTag", channel),
      gearScore: readOptionalNullableNumber(body, "gearScore", channel),
    });
  });
  registerIpcHandler(IPC_CHANNELS.reorderCharacters, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.reorderCharacters;
    const body = readObjectPayload(payload, channel);
    return reorderCharacters(readStringArray(body, "characterIds", channel));
  });
  registerIpcHandler(IPC_CHANNELS.applyTaskAction, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.applyTaskAction;
    return applyAction(readObjectPayload(payload, channel) as unknown as Parameters<typeof applyAction>[0]);
  });
  registerIpcHandler(IPC_CHANNELS.applyCorridorCompletion, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.applyCorridorCompletion;
    const body = readObjectPayload(payload, channel);
    const completed = readOptionalNumber(body, "completed", channel);
    if (completed === undefined) {
      throw new Error(`[${channel}] invalid payload: field "completed" is required`);
    }
    return applyCorridorCompletion(readString(body, "characterId", channel), readLane(body, channel), completed);
  });
  registerIpcHandler(IPC_CHANNELS.setCorridorCompleted, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.setCorridorCompleted;
    const body = readObjectPayload(payload, channel);
    const completed = readOptionalNumber(body, "completed", channel);
    if (completed === undefined) {
      throw new Error(`[${channel}] invalid payload: field "completed" is required`);
    }
    return setCorridorCompleted(readString(body, "characterId", channel), readLane(body, channel), completed);
  });
  registerIpcHandler(IPC_CHANNELS.updateArtifactStatus, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateArtifactStatus;
    const body = readObjectPayload(payload, channel);
    const lowerAvailable = readOptionalNumber(body, "lowerAvailable", channel);
    const middleAvailable = readOptionalNumber(body, "middleAvailable", channel);
    if (lowerAvailable === undefined || middleAvailable === undefined) {
      throw new Error(`[${channel}] invalid payload: lowerAvailable and middleAvailable are required`);
    }
    const lowerNextAt = readOptionalNullableString(body, "lowerNextAt", channel);
    const middleNextAt = readOptionalNullableString(body, "middleNextAt", channel);
    return updateArtifactStatus({
      accountId: readString(body, "accountId", channel),
      lowerAvailable,
      lowerNextAt: lowerNextAt === undefined ? null : lowerNextAt,
      middleAvailable,
      middleNextAt: middleNextAt === undefined ? null : middleNextAt,
    });
  });
  registerIpcHandler(IPC_CHANNELS.updateEnergySegments, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateEnergySegments;
    const body = readObjectPayload(payload, channel);
    const baseCurrent = readOptionalNumber(body, "baseCurrent", channel);
    const bonusCurrent = readOptionalNumber(body, "bonusCurrent", channel);
    if (baseCurrent === undefined || bonusCurrent === undefined) {
      throw new Error(`[${channel}] invalid payload: baseCurrent and bonusCurrent are required`);
    }
    return updateEnergySegments(readString(body, "characterId", channel), baseCurrent, bonusCurrent);
  });
  registerIpcHandler(IPC_CHANNELS.updateRaidCounts, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateRaidCounts;
    const body = readObjectPayload(payload, channel);
    return updateRaidCounts(readString(body, "characterId", channel), {
      expeditionRemaining: readOptionalNumber(body, "expeditionRemaining", channel),
      expeditionTicketBonus: readOptionalNumber(body, "expeditionTicketBonus", channel),
      expeditionBossRemaining: readOptionalNumber(body, "expeditionBossRemaining", channel),
      transcendenceRemaining: readOptionalNumber(body, "transcendenceRemaining", channel),
      transcendenceTicketBonus: readOptionalNumber(body, "transcendenceTicketBonus", channel),
      transcendenceBossRemaining: readOptionalNumber(body, "transcendenceBossRemaining", channel),
      nightmareRemaining: readOptionalNumber(body, "nightmareRemaining", channel),
      nightmareTicketBonus: readOptionalNumber(body, "nightmareTicketBonus", channel),
      awakeningRemaining: readOptionalNumber(body, "awakeningRemaining", channel),
      awakeningTicketBonus: readOptionalNumber(body, "awakeningTicketBonus", channel),
      dailyDungeonRemaining: readOptionalNumber(body, "dailyDungeonRemaining", channel),
      dailyDungeonTicketStored: readOptionalNumber(body, "dailyDungeonTicketStored", channel),
      miniGameRemaining: readOptionalNumber(body, "miniGameRemaining", channel),
      miniGameTicketBonus: readOptionalNumber(body, "miniGameTicketBonus", channel),
      spiritInvasionRemaining: readOptionalNumber(body, "spiritInvasionRemaining", channel),
      sanctumRaidChallengeRemaining: readOptionalNumber(body, "sanctumRaidChallengeRemaining", channel),
      sanctumRaidChallengeBonus: readOptionalNumber(body, "sanctumRaidChallengeBonus", channel),
      sanctumRaidBoxRemaining: readOptionalNumber(body, "sanctumRaidBoxRemaining", channel),
      sanctumRaidBoxBonus: readOptionalNumber(body, "sanctumRaidBoxBonus", channel),
      sanctumPurifyChallengeRemaining: readOptionalNumber(body, "sanctumPurifyChallengeRemaining", channel),
      sanctumPurifyBoxRemaining: readOptionalNumber(body, "sanctumPurifyBoxRemaining", channel),
    });
  });
  registerIpcHandler(IPC_CHANNELS.updateWeeklyCompletions, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateWeeklyCompletions;
    const body = readObjectPayload(payload, channel);
    return updateWeeklyCompletions(readString(body, "characterId", channel), {
      expeditionCompleted: readOptionalNumber(body, "expeditionCompleted", channel),
      transcendenceCompleted: readOptionalNumber(body, "transcendenceCompleted", channel),
    });
  });
  registerIpcHandler(IPC_CHANNELS.updateAodePlan, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateAodePlan;
    const body = readObjectPayload(payload, channel);
    return updateAodePlan(readString(body, "characterId", channel), {
      shopAodePurchaseUsed: readOptionalNumber(body, "shopAodePurchaseUsed", channel),
      shopUnknownChallengeTicketUsed: readOptionalNumber(body, "shopUnknownChallengeTicketUsed", channel),
      shopExpeditionChoiceBoxUsed: readOptionalNumber(body, "shopExpeditionChoiceBoxUsed", channel),
      shopNightmareInstantUsed: readOptionalNumber(body, "shopNightmareInstantUsed", channel),
      shopAbyssReplenishUsed: readOptionalNumber(body, "shopAbyssReplenishUsed", channel),
      transformAodeUsed: readOptionalNumber(body, "transformAodeUsed", channel),
    });
  });
}
