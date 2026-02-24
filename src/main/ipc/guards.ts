type PayloadObject = Record<string, unknown>;

function buildPayloadError(channel: string, detail: string): Error {
  return new Error(`[${channel}] invalid payload: ${detail}`);
}

export function readObjectPayload(payload: unknown, channel: string): PayloadObject {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw buildPayloadError(channel, "expected object");
  }
  return payload as PayloadObject;
}

export function readOptionalObjectPayload(payload: unknown, channel: string): PayloadObject | undefined {
  if (payload === undefined || payload === null) {
    return undefined;
  }
  return readObjectPayload(payload, channel);
}

export function readString(payload: PayloadObject, key: string, channel: string): string {
  const value = payload[key];
  if (typeof value !== "string") {
    throw buildPayloadError(channel, `field "${key}" must be string`);
  }
  return value;
}

export function readOptionalString(payload: PayloadObject, key: string, channel: string): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw buildPayloadError(channel, `field "${key}" must be string`);
  }
  return value;
}

export function readOptionalNumber(payload: PayloadObject, key: string, channel: string): number | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw buildPayloadError(channel, `field "${key}" must be finite number`);
  }
  return value;
}

export function readOptionalBoolean(payload: PayloadObject, key: string, channel: string): boolean | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw buildPayloadError(channel, `field "${key}" must be boolean`);
  }
  return value;
}

export function readStringArray(payload: PayloadObject, key: string, channel: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw buildPayloadError(channel, `field "${key}" must be string[]`);
  }
  return value as string[];
}
