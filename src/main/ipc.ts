import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import { APP_BUILD_INFO } from "../shared/build-meta";
import type { AppSettings, ApplyTaskActionInput } from "../shared/types";
import {
  addAccount,
  addCharacter,
  applyCorridorCompletion,
  applyAction,
  clearHistory,
  deleteAccount,
  deleteCharacter,
  exportDataToFile,
  getAppState,
  importDataFromFile,
  renameAccount,
  renameCharacter,
  resetWeeklyStats,
  selectAccount,
  selectCharacter,
  undoOperations,
  updateSettings,
  updateArtifactStatus,
  updateAodePlan,
  updateEnergySegments,
  updateRaidCounts,
  updateWeeklyCompletions,
} from "./store";

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getState, () => getAppState());
  ipcMain.handle(IPC_CHANNELS.getBuildInfo, () => APP_BUILD_INFO);
  ipcMain.handle(IPC_CHANNELS.resetWeeklyStats, () => resetWeeklyStats());
  ipcMain.handle(IPC_CHANNELS.undoOperations, (_event, payload: { steps?: number }) => undoOperations(payload.steps ?? 1));
  ipcMain.handle(IPC_CHANNELS.clearHistory, () => clearHistory());
  ipcMain.handle(IPC_CHANNELS.updateSettings, (_event, payload: { settings: Partial<AppSettings> }) =>
    updateSettings(payload.settings),
  );
  ipcMain.handle(IPC_CHANNELS.exportData, async () => exportDataToFile());
  ipcMain.handle(IPC_CHANNELS.importData, async () => importDataFromFile());
  ipcMain.handle(IPC_CHANNELS.addAccount, (_event, payload: { name: string; regionTag?: string }) =>
    addAccount(payload.name, payload.regionTag),
  );
  ipcMain.handle(
    IPC_CHANNELS.renameAccount,
    (_event, payload: { accountId: string; name: string; regionTag?: string }) =>
      renameAccount(payload.accountId, payload.name, payload.regionTag),
  );
  ipcMain.handle(IPC_CHANNELS.deleteAccount, (_event, payload: { accountId: string }) => deleteAccount(payload.accountId));
  ipcMain.handle(IPC_CHANNELS.selectAccount, (_event, payload: { accountId: string }) => selectAccount(payload.accountId));
  ipcMain.handle(IPC_CHANNELS.addCharacter, (_event, payload: { name: string; accountId?: string }) =>
    addCharacter(payload.name, payload.accountId),
  );
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
    IPC_CHANNELS.applyCorridorCompletion,
    (_event, payload: { characterId: string; lane: "lower" | "middle"; completed: number }) =>
      applyCorridorCompletion(payload.characterId, payload.lane, payload.completed),
  );
  ipcMain.handle(
    IPC_CHANNELS.updateArtifactStatus,
    (
      _event,
      payload: {
        accountId: string;
        lowerAvailable: number;
        lowerNextAt: string | null;
        middleAvailable: number;
        middleNextAt: string | null;
      },
    ) => updateArtifactStatus(payload),
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
        dailyDungeonRemaining?: number;
        dailyDungeonTicketStored?: number;
        miniGameRemaining?: number;
        miniGameTicketBonus?: number;
        spiritInvasionRemaining?: number;
        sanctumRaidRemaining?: number;
        sanctumBoxRemaining?: number;
      },
    ) =>
      updateRaidCounts(payload.characterId, payload),
  );
  ipcMain.handle(
    IPC_CHANNELS.updateWeeklyCompletions,
    (_event, payload: { characterId: string; expeditionCompleted?: number; transcendenceCompleted?: number }) =>
      updateWeeklyCompletions(payload.characterId, payload),
  );
  ipcMain.handle(
    IPC_CHANNELS.updateAodePlan,
    (
      _event,
      payload: {
        characterId: string;
        shopAodePurchaseUsed?: number;
        shopDailyDungeonTicketPurchaseUsed?: number;
        transformAodeUsed?: number;
        assignExtra?: boolean;
      },
    ) =>
      updateAodePlan(payload.characterId, payload),
  );
}
