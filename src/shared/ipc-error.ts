import { Buffer } from "node:buffer";

export type IpcErrorCode = "INVALID_PAYLOAD" | "BUSINESS_ERROR" | "INTERNAL_ERROR";

export interface IpcErrorPayload {
  version: "aion-ipc-error-v1";
  channel: string;
  code: IpcErrorCode;
  message: string;
  occurredAt: string;
}

const IPC_ERROR_PREFIX = "AION_IPC_ERROR::";
const IPC_ERROR_TOKEN_PATTERN = /AION_IPC_ERROR::([A-Za-z0-9_-]+)/;

export function serializeIpcError(payload: IpcErrorPayload): string {
  const raw = JSON.stringify(payload);
  const token = Buffer.from(raw, "utf8").toString("base64url");
  return `${IPC_ERROR_PREFIX}${token}`;
}

export function tryParseIpcError(raw: string | undefined | null): IpcErrorPayload | null {
  if (!raw) {
    return null;
  }
  const match = raw.match(IPC_ERROR_TOKEN_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  try {
    const decoded = Buffer.from(match[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<IpcErrorPayload>;
    if (
      parsed?.version !== "aion-ipc-error-v1" ||
      typeof parsed.channel !== "string" ||
      typeof parsed.code !== "string" ||
      typeof parsed.message !== "string" ||
      typeof parsed.occurredAt !== "string"
    ) {
      return null;
    }
    if (parsed.code !== "INVALID_PAYLOAD" && parsed.code !== "BUSINESS_ERROR" && parsed.code !== "INTERNAL_ERROR") {
      return null;
    }
    return parsed as IpcErrorPayload;
  } catch {
    return null;
  }
}

export function formatIpcErrorMessage(payload: IpcErrorPayload): string {
  return `[${payload.channel}][${payload.code}] ${payload.message}`;
}
