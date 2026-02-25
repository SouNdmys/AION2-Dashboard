import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { serializeIpcError, type IpcErrorCode } from "../../shared/ipc-error";

type IpcInvokeHandler = (event: IpcMainInvokeEvent, payload: unknown) => unknown | Promise<unknown>;

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "未知错误";
}

function inferErrorCode(error: unknown, fallback: IpcErrorCode): IpcErrorCode {
  const message = readErrorMessage(error).toLowerCase();
  if (message.includes("invalid payload")) {
    return "INVALID_PAYLOAD";
  }
  if (!(error instanceof Error)) {
    return "INTERNAL_ERROR";
  }
  return fallback;
}

export function registerIpcHandler(
  channel: string,
  handler: IpcInvokeHandler,
  fallbackCode: IpcErrorCode = "BUSINESS_ERROR",
): void {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      return await handler(event, payload);
    } catch (error) {
      const wrapped = serializeIpcError({
        version: "aion-ipc-error-v1",
        channel,
        code: inferErrorCode(error, fallbackCode),
        message: readErrorMessage(error),
        occurredAt: new Date().toISOString(),
      });
      throw new Error(wrapped);
    }
  });
}
