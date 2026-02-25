import { contextBridge, ipcRenderer } from "electron";
import { IPC_EVENT_SPECS, IPC_INVOKE_SPECS, createIpcInvokeBridge } from "../shared/ipc-contract";
import { formatIpcErrorMessage, tryParseIpcError } from "../shared/ipc-error";
import type { WorkshopOcrAutoRunState, WorkshopOcrHotkeyRunResult } from "../shared/types";

function readErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return undefined;
}

function normalizeInvokeError(error: unknown): Error {
  const message = readErrorMessage(error);
  const parsed = tryParseIpcError(message);
  if (!parsed) {
    return error instanceof Error ? error : new Error(message ?? "IPC 调用失败");
  }

  const normalized = new Error(formatIpcErrorMessage(parsed)) as Error & {
    channel?: string;
    code?: string;
    occurredAt?: string;
  };
  normalized.name = "AionIpcError";
  normalized.channel = parsed.channel;
  normalized.code = parsed.code;
  normalized.occurredAt = parsed.occurredAt;
  return normalized;
}

const invokeApi = createIpcInvokeBridge((channel, payload) => {
  const run = payload === undefined ? ipcRenderer.invoke(channel) : ipcRenderer.invoke(channel, payload);
  return run.catch((error: unknown) => {
    throw normalizeInvokeError(error);
  });
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
