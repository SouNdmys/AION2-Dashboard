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

function encodeBase64Url(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const firstSix = first >> 2;
    const secondSix = ((first & 0b11) << 4) | ((second ?? 0) >> 4);
    const thirdSix = second === undefined ? 64 : (((second & 0b1111) << 2) | ((third ?? 0) >> 6));
    const fourthSix = third === undefined ? 64 : third & 0b111111;
    base64 += alphabet[firstSix];
    base64 += alphabet[secondSix];
    base64 += thirdSix === 64 ? "=" : alphabet[thirdSix];
    base64 += fourthSix === 64 ? "=" : alphabet[fourthSix];
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(token: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const normalized = base64 + padding;
  if (normalized.length % 4 !== 0) {
    throw new Error("invalid base64 token length");
  }
  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    const c1 = normalized[index];
    const c2 = normalized[index + 1];
    const c3 = normalized[index + 2];
    const c4 = normalized[index + 3];
    const n1 = alphabet.indexOf(c1);
    const n2 = alphabet.indexOf(c2);
    const n3 = c3 === "=" ? 64 : alphabet.indexOf(c3);
    const n4 = c4 === "=" ? 64 : alphabet.indexOf(c4);
    if (n1 < 0 || n2 < 0 || (n3 < 0 && n3 !== 64) || (n4 < 0 && n4 !== 64)) {
      throw new Error("invalid base64 token");
    }
    const first = (n1 << 2) | (n2 >> 4);
    bytes.push(first);
    if (n3 !== 64) {
      const second = ((n2 & 0b1111) << 4) | (n3 >> 2);
      bytes.push(second);
    }
    if (n4 !== 64) {
      const third = ((n3 & 0b11) << 6) | n4;
      bytes.push(third);
    }
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export function serializeIpcError(payload: IpcErrorPayload): string {
  const raw = JSON.stringify(payload);
  const token = encodeBase64Url(raw);
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
    const decoded = decodeBase64Url(match[1]);
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
