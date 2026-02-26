import type { AppState, AppStateCharacterSnapshotDelta, AppStateSnapshot, AppStateSnapshotDelta, CharacterState } from "../shared/types";

function hasOwnProperty(entity: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(entity, key);
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function estimateSerializedSize(value: unknown): number {
  return JSON.stringify(value).length;
}

function buildCharacterChanges(
  beforeCharacters: CharacterState[],
  afterCharacters: CharacterState[],
): { changes: AppStateCharacterSnapshotDelta[]; order: string[] | undefined } {
  const beforeById = new Map(beforeCharacters.map((item) => [item.id, item]));
  const afterById = new Map(afterCharacters.map((item) => [item.id, item]));
  const changes: AppStateCharacterSnapshotDelta[] = [];

  beforeCharacters.forEach((beforeItem) => {
    const afterItem = afterById.get(beforeItem.id);
    if (!afterItem || !jsonEquals(beforeItem, afterItem)) {
      changes.push({
        id: beforeItem.id,
        before: structuredClone(beforeItem),
      });
    }
  });

  afterCharacters.forEach((afterItem) => {
    if (!beforeById.has(afterItem.id)) {
      changes.push({
        id: afterItem.id,
        before: null,
      });
    }
  });

  const beforeOrder = beforeCharacters.map((item) => item.id);
  const afterOrder = afterCharacters.map((item) => item.id);
  const orderChanged = !jsonEquals(beforeOrder, afterOrder);
  return {
    changes,
    order: orderChanged ? beforeOrder : undefined,
  };
}

function buildSnapshotDelta(before: AppState, after: AppState): AppStateSnapshotDelta | null {
  const delta: AppStateSnapshotDelta = {};
  let hasField = false;

  if (before.selectedAccountId !== after.selectedAccountId) {
    delta.selectedAccountId = before.selectedAccountId;
    hasField = true;
  }

  if (before.selectedCharacterId !== after.selectedCharacterId) {
    delta.selectedCharacterId = before.selectedCharacterId;
    hasField = true;
  }

  if (!jsonEquals(before.settings, after.settings)) {
    delta.settings = structuredClone(before.settings);
    hasField = true;
  }

  if (!jsonEquals(before.accounts, after.accounts)) {
    delta.accounts = structuredClone(before.accounts);
    hasField = true;
  }

  const characterDelta = buildCharacterChanges(before.characters, after.characters);
  if (characterDelta.changes.length > 0) {
    delta.characterChanges = characterDelta.changes;
    hasField = true;
  }
  if (characterDelta.order && characterDelta.order.length > 0) {
    delta.characterOrder = characterDelta.order;
    hasField = true;
  }

  return hasField ? delta : null;
}

function applyCharacterChanges(
  currentCharacters: CharacterState[],
  changes: AppStateCharacterSnapshotDelta[] | undefined,
  order: string[] | undefined,
): CharacterState[] {
  if ((!changes || changes.length === 0) && (!order || order.length === 0)) {
    return currentCharacters;
  }

  const currentById = new Map(currentCharacters.map((item) => [item.id, item]));
  (changes ?? []).forEach((change) => {
    if (change.before === null) {
      currentById.delete(change.id);
      return;
    }
    currentById.set(change.id, structuredClone(change.before));
  });

  if (!order || order.length === 0) {
    const restored = currentCharacters
      .map((item) => currentById.get(item.id))
      .filter((item): item is CharacterState => item !== undefined);
    const existingIds = new Set(restored.map((item) => item.id));
    (changes ?? []).forEach((change) => {
      if (!change.before || existingIds.has(change.id)) {
        return;
      }
      const restoredItem = currentById.get(change.id);
      if (restoredItem) {
        restored.push(restoredItem);
        existingIds.add(change.id);
      }
    });
    return restored;
  }

  const ordered: CharacterState[] = [];
  const visited = new Set<string>();
  order.forEach((id) => {
    const item = currentById.get(id);
    if (!item) {
      return;
    }
    ordered.push(item);
    visited.add(id);
  });

  currentCharacters.forEach((item) => {
    if (visited.has(item.id)) {
      return;
    }
    const restored = currentById.get(item.id);
    if (!restored) {
      return;
    }
    ordered.push(restored);
    visited.add(item.id);
  });

  currentById.forEach((item, id) => {
    if (visited.has(id)) {
      return;
    }
    ordered.push(item);
    visited.add(id);
  });

  return ordered;
}

export function createAppStateSnapshot(state: AppState): AppStateSnapshot {
  return {
    selectedAccountId: state.selectedAccountId,
    selectedCharacterId: state.selectedCharacterId,
    settings: structuredClone(state.settings),
    accounts: structuredClone(state.accounts),
    characters: structuredClone(state.characters),
  };
}

export function buildAppStateMutationSignature(state: AppState): string {
  return JSON.stringify({
    selectedAccountId: state.selectedAccountId,
    selectedCharacterId: state.selectedCharacterId,
    settings: state.settings,
    accounts: state.accounts,
    characters: state.characters,
  });
}

export function createAppStateMutationDraft(state: AppState): AppState {
  return structuredClone({
    ...state,
    history: [],
  });
}

export function buildAppStateRollbackPayload(
  before: AppState,
  after: AppState,
  deltaMaxSizeRatio: number,
): { before?: AppStateSnapshot; beforeDelta?: AppStateSnapshotDelta } {
  const delta = buildSnapshotDelta(before, after);
  if (!delta) {
    return { before: createAppStateSnapshot(before) };
  }

  const beforeSnapshot = createAppStateSnapshot(before);
  const deltaSize = estimateSerializedSize(delta);
  const snapshotSize = estimateSerializedSize(beforeSnapshot);
  if (snapshotSize <= 0) {
    return { beforeDelta: delta };
  }
  if (deltaSize <= Math.floor(snapshotSize * deltaMaxSizeRatio)) {
    return { beforeDelta: delta };
  }
  return { before: beforeSnapshot };
}

export function restoreAppStateByDelta(current: AppState, delta: AppStateSnapshotDelta): AppState {
  const selectedAccountId = hasOwnProperty(delta as Record<string, unknown>, "selectedAccountId")
    ? delta.selectedAccountId ?? null
    : current.selectedAccountId;
  const selectedCharacterId = hasOwnProperty(delta as Record<string, unknown>, "selectedCharacterId")
    ? delta.selectedCharacterId ?? null
    : current.selectedCharacterId;

  return {
    ...current,
    selectedAccountId,
    selectedCharacterId,
    settings: delta.settings ? structuredClone(delta.settings) : current.settings,
    accounts: delta.accounts ? structuredClone(delta.accounts) : current.accounts,
    characters: applyCharacterChanges(current.characters, delta.characterChanges, delta.characterOrder),
  };
}
