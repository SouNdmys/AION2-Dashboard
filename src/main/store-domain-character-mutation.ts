import type { AccountState, CharacterState } from "../shared/types";

export type CorridorLane = "lower" | "middle";

export interface UpdateCharacterProfilePayload {
  classTag?: string | null;
  gearScore?: number | null;
}

export interface UpdateArtifactStatusPayload {
  accountId: string;
  lowerAvailable: number;
  lowerNextAt: string | null;
  middleAvailable: number;
  middleNextAt: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function updateCharacterProfileInList(
  characters: CharacterState[],
  characterId: string,
  payload: UpdateCharacterProfilePayload,
  maxThreshold: number,
): CharacterState[] {
  const index = characters.findIndex((item) => item.id === characterId);
  if (index < 0) {
    throw new Error("角色不存在");
  }
  const target = characters[index];
  const classTag =
    payload.classTag === undefined
      ? target.classTag
      : typeof payload.classTag === "string" && payload.classTag.trim()
        ? payload.classTag.trim()
        : undefined;
  const gearScore =
    payload.gearScore === undefined
      ? target.gearScore
      : typeof payload.gearScore === "number" && Number.isFinite(payload.gearScore)
        ? clamp(Math.floor(payload.gearScore), 0, maxThreshold)
        : undefined;

  const next = [...characters];
  next[index] = {
    ...target,
    classTag,
    gearScore,
  };
  return next;
}

export function reorderCharactersByIds(characters: CharacterState[], characterIds: string[]): CharacterState[] {
  if (characterIds.length !== characters.length) {
    throw new Error("排序数据与角色数量不一致");
  }
  const idSet = new Set(characterIds);
  if (idSet.size !== characterIds.length) {
    throw new Error("排序数据存在重复角色");
  }
  const byId = new Map(characters.map((item) => [item.id, item]));
  return characterIds.map((id) => {
    const found = byId.get(id);
    if (!found) {
      throw new Error("排序数据包含未知角色");
    }
    return found;
  });
}

export function updateArtifactStatusForAccount(
  accounts: AccountState[],
  characters: CharacterState[],
  payload: UpdateArtifactStatusPayload,
): CharacterState[] {
  if (!accounts.some((item) => item.id === payload.accountId)) {
    throw new Error("账号不存在");
  }
  return characters.map((item) => {
    if (item.accountId !== payload.accountId) {
      return item;
    }
    return {
      ...item,
      activities: {
        ...item.activities,
        corridorLowerAvailable: clamp(payload.lowerAvailable, 0, 3),
        corridorLowerNextAt: payload.lowerNextAt,
        corridorMiddleAvailable: clamp(payload.middleAvailable, 0, 3),
        corridorMiddleNextAt: payload.middleNextAt,
      },
    };
  });
}

export function applyCorridorCompletionToCharacter(
  characters: CharacterState[],
  characterId: string,
  lane: CorridorLane,
  completed: number,
): CharacterState[] {
  const amount = clamp(Math.floor(completed), 0, 999);
  return characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }
    return {
      ...item,
      activities: {
        ...item.activities,
        corridorLowerAvailable:
          lane === "lower" ? clamp(item.activities.corridorLowerAvailable - amount, 0, 3) : item.activities.corridorLowerAvailable,
        corridorMiddleAvailable:
          lane === "middle"
            ? clamp(item.activities.corridorMiddleAvailable - amount, 0, 3)
            : item.activities.corridorMiddleAvailable,
      },
    };
  });
}

export function setCorridorCompletedForCharacter(
  characters: CharacterState[],
  characterId: string,
  lane: CorridorLane,
  completed: number,
): CharacterState[] {
  const safeCompleted = clamp(Math.floor(completed), 0, 3);
  const nextAvailable = clamp(3 - safeCompleted, 0, 3);
  return characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }
    return {
      ...item,
      activities: {
        ...item.activities,
        corridorLowerAvailable: lane === "lower" ? nextAvailable : item.activities.corridorLowerAvailable,
        corridorMiddleAvailable: lane === "middle" ? nextAvailable : item.activities.corridorMiddleAvailable,
      },
    };
  });
}

export function updateEnergySegmentsForCharacter(
  characters: CharacterState[],
  characterId: string,
  baseCurrent: number,
  bonusCurrent: number,
): CharacterState[] {
  return characters.map((item) => {
    if (item.id !== characterId) {
      return item;
    }
    return {
      ...item,
      energy: {
        ...item.energy,
        baseCurrent: clamp(baseCurrent, 0, item.energy.baseCap),
        bonusCurrent: clamp(bonusCurrent, 0, item.energy.bonusCap),
      },
    };
  });
}
