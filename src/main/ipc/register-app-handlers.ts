import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc";
import { APP_BUILD_INFO } from "../../shared/build-meta";
import { clearHistory, exportDataToFile, getAppState, importDataFromFile, resetWeeklyStats, undoOperations, updateSettings } from "../store";
import { readObjectPayload, readOptionalNumber } from "./guards";

export function registerAppIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getState, () => getAppState());
  ipcMain.handle(IPC_CHANNELS.getBuildInfo, () => APP_BUILD_INFO);
  ipcMain.handle(IPC_CHANNELS.resetWeeklyStats, () => resetWeeklyStats());
  ipcMain.handle(IPC_CHANNELS.undoOperations, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.undoOperations;
    const body = readObjectPayload(payload, channel);
    return undoOperations(readOptionalNumber(body, "steps", channel) ?? 1);
  });
  ipcMain.handle(IPC_CHANNELS.clearHistory, () => clearHistory());
  ipcMain.handle(IPC_CHANNELS.updateSettings, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateSettings;
    const body = readObjectPayload(payload, channel);
    const settings = readObjectPayload(body.settings, channel);
    return updateSettings(settings);
  });
  ipcMain.handle(IPC_CHANNELS.exportData, async () => exportDataToFile());
  ipcMain.handle(IPC_CHANNELS.importData, async () => importDataFromFile());
}
