import { IPC_CHANNELS } from "../../shared/ipc";
import { APP_BUILD_INFO } from "../../shared/build-meta";
import { checkForAppUpdate } from "../app-updater";
import { clearHistory, exportDataToFile, getAppState, importDataFromFile, resetWeeklyStats, undoOperations, updateSettings } from "../store";
import { readObjectPayload, readOptionalNumber } from "./guards";
import { registerIpcHandler } from "./register-handler";

export function registerAppIpcHandlers(): void {
  registerIpcHandler(IPC_CHANNELS.getState, () => getAppState());
  registerIpcHandler(IPC_CHANNELS.getBuildInfo, () => APP_BUILD_INFO);
  registerIpcHandler(IPC_CHANNELS.checkAppUpdate, async () => checkForAppUpdate({ installOnDownload: true, source: "manual" }));
  registerIpcHandler(IPC_CHANNELS.resetWeeklyStats, () => resetWeeklyStats());
  registerIpcHandler(IPC_CHANNELS.undoOperations, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.undoOperations;
    const body = readObjectPayload(payload, channel);
    return undoOperations(readOptionalNumber(body, "steps", channel) ?? 1);
  });
  registerIpcHandler(IPC_CHANNELS.clearHistory, () => clearHistory());
  registerIpcHandler(IPC_CHANNELS.updateSettings, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.updateSettings;
    const body = readObjectPayload(payload, channel);
    const settings = readObjectPayload(body.settings, channel);
    return updateSettings(settings);
  });
  registerIpcHandler(IPC_CHANNELS.exportData, async () => exportDataToFile());
  registerIpcHandler(IPC_CHANNELS.importData, async () => importDataFromFile());
}
