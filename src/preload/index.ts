import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type { AppSettings, AppState, ApplyTaskActionInput, ExportDataResult, ImportDataResult } from "../shared/types";

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.getState),
  resetWeeklyStats: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.resetWeeklyStats),
  undoOperations: (steps = 1): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.undoOperations, { steps }),
  clearHistory: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.clearHistory),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateSettings, { settings }),
  exportData: (): Promise<ExportDataResult> => ipcRenderer.invoke(IPC_CHANNELS.exportData),
  importData: (): Promise<ImportDataResult> => ipcRenderer.invoke(IPC_CHANNELS.importData),
  addAccount: (name: string, regionTag?: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.addAccount, { name, regionTag }),
  renameAccount: (accountId: string, name: string, regionTag?: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.renameAccount, { accountId, name, regionTag }),
  deleteAccount: (accountId: string): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.deleteAccount, { accountId }),
  selectAccount: (accountId: string): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.selectAccount, { accountId }),
  addCharacter: (name: string, accountId?: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.addCharacter, { name, accountId }),
  renameCharacter: (characterId: string, name: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.renameCharacter, { characterId, name }),
  deleteCharacter: (characterId: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteCharacter, { characterId }),
  selectCharacter: (characterId: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectCharacter, { characterId }),
  applyTaskAction: (input: ApplyTaskActionInput): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.applyTaskAction, input),
  applyCorridorCompletion: (characterId: string, lane: "lower" | "middle", completed: number): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.applyCorridorCompletion, { characterId, lane, completed }),
  updateArtifactStatus: (
    accountId: string,
    lowerAvailable: number,
    lowerNextAt: string | null,
    middleAvailable: number,
    middleNextAt: string | null,
  ): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateArtifactStatus, {
      accountId,
      lowerAvailable,
      lowerNextAt,
      middleAvailable,
      middleNextAt,
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
      dailyDungeonRemaining?: number;
      dailyDungeonTicketStored?: number;
      miniGameRemaining?: number;
      miniGameTicketBonus?: number;
      spiritInvasionRemaining?: number;
      sanctumRaidRemaining?: number;
      sanctumBoxRemaining?: number;
    },
  ): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.updateRaidCounts, { characterId, ...payload }),
  updateWeeklyCompletions: (
    characterId: string,
    payload: { expeditionCompleted?: number; transcendenceCompleted?: number },
  ): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.updateWeeklyCompletions, { characterId, ...payload }),
  updateAodePlan: (
    characterId: string,
    payload: { weeklyPurchaseUsed?: number; weeklyConvertUsed?: number; assignExtra?: boolean },
  ): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.updateAodePlan, { characterId, ...payload }),
};

contextBridge.exposeInMainWorld("aionApi", api);

export type AionApi = typeof api;
