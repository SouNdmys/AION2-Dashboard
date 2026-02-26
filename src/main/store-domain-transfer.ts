import { basename } from "node:path";
import type { AppState, OperationLogEntry } from "../shared/types";
import { createAppStateSnapshot } from "./store-domain-history";
import { normalizeAppState } from "./store-domain-snapshot";

export const IMPORT_EXPORT_SCHEMA_VERSION = 1;

export interface BuildImportedStateInput {
  raw: unknown;
  currentState: AppState;
  sourcePath: string;
  historyLimit: number;
  now?: Date;
  createEntryId?: () => string;
}

function clampHistoryLimit(limit: number): number {
  return Math.max(1, Math.floor(limit));
}

export function buildExportPayload(state: AppState, now = new Date()): Record<string, unknown> {
  return {
    schemaVersion: IMPORT_EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    app: "aion2-dashboard",
    state,
  };
}

export function resolveImportedState(raw: unknown): AppState {
  if (raw && typeof raw === "object" && (raw as { state?: unknown }).state !== undefined) {
    return normalizeAppState((raw as { state: unknown }).state);
  }
  return normalizeAppState(raw);
}

export function parseImportPayload(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("导入文件不是有效的 JSON");
  }
}

export function buildImportedState(input: BuildImportedStateInput): AppState {
  const imported = resolveImportedState(input.raw);
  const before = createAppStateSnapshot(input.currentState);
  const now = input.now ?? new Date();

  const entry: OperationLogEntry = {
    id: input.createEntryId?.() ?? `import-${now.getTime()}`,
    at: now.toISOString(),
    action: "导入数据",
    characterId: null,
    description: basename(input.sourcePath),
    before,
  };

  return normalizeAppState({
    ...imported,
    history: [...imported.history, entry].slice(-clampHistoryLimit(input.historyLimit)),
  });
}
