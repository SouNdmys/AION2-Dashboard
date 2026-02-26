import { createEmptyWeeklyStats } from "../shared/constants";
import { applyTaskAction } from "../shared/engine";
import type { AppSettings, ApplyTaskActionInput, CharacterState } from "../shared/types";

export function buildTaskActionDescription(input: ApplyTaskActionInput): string {
  return `${input.taskId} x${Math.max(1, Math.floor(input.amount ?? 1))}`;
}

export function applyTaskActionToCharacters(
  characters: CharacterState[],
  settings: AppSettings,
  input: ApplyTaskActionInput,
): CharacterState[] {
  const index = characters.findIndex((item) => item.id === input.characterId);
  if (index < 0) {
    throw new Error("角色不存在");
  }

  const result = applyTaskAction(characters[index], settings, input);
  if (!result.success) {
    throw new Error(result.message);
  }

  const next = [...characters];
  next[index] = result.next;
  return next;
}

export function resetWeeklyStatsForCharacters(characters: CharacterState[], nowIso: string): CharacterState[] {
  return characters.map((item) => ({
    ...item,
    stats: createEmptyWeeklyStats(nowIso),
  }));
}
