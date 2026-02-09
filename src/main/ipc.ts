import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type { ApplyTaskActionInput } from "../shared/types";
import {
  addCharacter,
  applyAction,
  deleteCharacter,
  getAppState,
  renameCharacter,
  resetWeeklyStats,
  selectCharacter,
  updateArtifactStatus,
  updateEnergySegments,
  updateRaidCounts,
} from "./store";

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getState, () => getAppState());
  ipcMain.handle(IPC_CHANNELS.resetWeeklyStats, () => resetWeeklyStats());
  ipcMain.handle(IPC_CHANNELS.addCharacter, (_event, payload: { name: string }) => addCharacter(payload.name));
  ipcMain.handle(IPC_CHANNELS.renameCharacter, (_event, payload: { characterId: string; name: string }) =>
    renameCharacter(payload.characterId, payload.name),
  );
  ipcMain.handle(IPC_CHANNELS.deleteCharacter, (_event, payload: { characterId: string }) =>
    deleteCharacter(payload.characterId),
  );
  ipcMain.handle(IPC_CHANNELS.selectCharacter, (_event, payload: { characterId: string }) =>
    selectCharacter(payload.characterId),
  );
  ipcMain.handle(IPC_CHANNELS.applyTaskAction, (_event, payload: ApplyTaskActionInput) => applyAction(payload));
  ipcMain.handle(
    IPC_CHANNELS.updateArtifactStatus,
    (_event, payload: { characterId: string; artifactAvailable: number; artifactNextAt: string | null }) =>
      updateArtifactStatus(payload.characterId, payload.artifactAvailable, payload.artifactNextAt),
  );
  ipcMain.handle(
    IPC_CHANNELS.updateEnergySegments,
    (_event, payload: { characterId: string; baseCurrent: number; bonusCurrent: number }) =>
      updateEnergySegments(payload.characterId, payload.baseCurrent, payload.bonusCurrent),
  );
  ipcMain.handle(
    IPC_CHANNELS.updateRaidCounts,
    (
      _event,
      payload: {
        characterId: string;
        expeditionRemaining?: number;
        expeditionTicketBonus?: number;
        expeditionBossRemaining?: number;
        transcendenceRemaining?: number;
        transcendenceTicketBonus?: number;
        transcendenceBossRemaining?: number;
        nightmareRemaining?: number;
        nightmareTicketBonus?: number;
        awakeningRemaining?: number;
        awakeningTicketBonus?: number;
        suppressionRemaining?: number;
        suppressionTicketBonus?: number;
        sanctumRaidRemaining?: number;
        sanctumBoxRemaining?: number;
      },
    ) =>
      updateRaidCounts(payload.characterId, payload),
  );
}
