import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type { AppState, ApplyTaskActionInput } from "../shared/types";

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.getState),
  resetWeeklyStats: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.resetWeeklyStats),
  addCharacter: (name: string): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.addCharacter, { name }),
  renameCharacter: (characterId: string, name: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.renameCharacter, { characterId, name }),
  deleteCharacter: (characterId: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteCharacter, { characterId }),
  selectCharacter: (characterId: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectCharacter, { characterId }),
  applyTaskAction: (input: ApplyTaskActionInput): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.applyTaskAction, input),
  updateArtifactStatus: (
    characterId: string,
    artifactAvailable: number,
    artifactNextAt: string | null,
  ): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateArtifactStatus, {
      characterId,
      artifactAvailable,
      artifactNextAt,
    }),
  updateEnergySegments: (characterId: string, baseCurrent: number, bonusCurrent: number): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateEnergySegments, { characterId, baseCurrent, bonusCurrent }),
  updateRaidCounts: (
    characterId: string,
    payload: {
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
  ): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.updateRaidCounts, { characterId, ...payload }),
};

contextBridge.exposeInMainWorld("aionApi", api);

export type AionApi = typeof api;
