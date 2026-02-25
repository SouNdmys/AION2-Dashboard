import { contextBridge, ipcRenderer } from "electron";
import { IPC_EVENT_SPECS, IPC_INVOKE_SPECS, createIpcInvokeBridge } from "../shared/ipc-contract";
import type { WorkshopOcrAutoRunState, WorkshopOcrHotkeyRunResult } from "../shared/types";

const invokeApi = createIpcInvokeBridge((channel, payload) => {
  if (payload === undefined) {
    return ipcRenderer.invoke(channel);
  }
  return ipcRenderer.invoke(channel, payload);
}, IPC_INVOKE_SPECS);

function subscribeToIpcEvent<Payload>(channel: string, listener: (payload: Payload) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: Payload) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api = {
  ...invokeApi,
  onWorkshopOcrHotkeyResult: (listener: (result: WorkshopOcrHotkeyRunResult) => void): (() => void) =>
    subscribeToIpcEvent(IPC_EVENT_SPECS.workshopOcrHotkeyResult.channel, listener),
  onWorkshopOcrAutoRunState: (listener: (state: WorkshopOcrAutoRunState) => void): (() => void) =>
    subscribeToIpcEvent(IPC_EVENT_SPECS.workshopOcrAutoRunState.channel, listener),
};

contextBridge.exposeInMainWorld("aionApi", api);

export type AionApi = typeof api;
