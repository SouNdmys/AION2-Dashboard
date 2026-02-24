import type { DragEvent } from "react";
import type { AppState } from "../../../../../shared/types";

type AppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;

interface StartOverviewCardDragParams {
  overviewSortKey: "manual" | "ready" | "account" | "region";
  busy: boolean;
  characterId: string;
  onDraggingCharacterChange: (characterId: string | null) => void;
  onDragOverCharacterChange: (characterId: string | null) => void;
}

export function startOverviewCardDragAction(params: StartOverviewCardDragParams): void {
  const { overviewSortKey, busy, characterId, onDraggingCharacterChange, onDragOverCharacterChange } = params;
  if (overviewSortKey !== "manual" || busy) return;
  onDraggingCharacterChange(characterId);
  onDragOverCharacterChange(characterId);
}

interface OverviewCardDragOverParams {
  event: DragEvent<HTMLElement>;
  overviewSortKey: "manual" | "ready" | "account" | "region";
  draggingCharacterId: string | null;
  characterId: string;
  dragOverCharacterId: string | null;
  onDragOverCharacterChange: (characterId: string) => void;
}

export function overviewCardDragOverAction(params: OverviewCardDragOverParams): void {
  const { event, overviewSortKey, draggingCharacterId, characterId, dragOverCharacterId, onDragOverCharacterChange } = params;
  if (overviewSortKey !== "manual" || !draggingCharacterId || draggingCharacterId === characterId) {
    return;
  }
  event.preventDefault();
  if (dragOverCharacterId !== characterId) {
    onDragOverCharacterChange(characterId);
  }
}

interface OverviewCardDropParams {
  event: DragEvent<HTMLElement>;
  overviewSortKey: "manual" | "ready" | "account" | "region";
  state: AppState | null;
  draggingCharacterId: string | null;
  targetCharacterId: string;
  appActions: AppActions;
  sync: SyncRunner;
  onDragStateReset: () => void;
}

export function overviewCardDropAction(params: OverviewCardDropParams): void {
  const { event, overviewSortKey, state, draggingCharacterId, targetCharacterId, appActions, sync, onDragStateReset } = params;
  event.preventDefault();
  if (overviewSortKey !== "manual" || !state || !draggingCharacterId) {
    onDragStateReset();
    return;
  }
  if (draggingCharacterId === targetCharacterId) {
    onDragStateReset();
    return;
  }
  const ids = state.characters.map((item) => item.id);
  const fromIndex = ids.indexOf(draggingCharacterId);
  const toIndex = ids.indexOf(targetCharacterId);
  if (fromIndex < 0 || toIndex < 0) {
    onDragStateReset();
    return;
  }
  const [moved] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, moved);
  onDragStateReset();
  void sync(appActions.reorderCharacters(ids), "角色卡片排序已更新");
}

interface EndOverviewCardDragParams {
  onDragStateReset: () => void;
}

export function endOverviewCardDragAction(params: EndOverviewCardDragParams): void {
  const { onDragStateReset } = params;
  onDragStateReset();
}
