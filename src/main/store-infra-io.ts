import { join } from "node:path";
import type { AppState } from "../shared/types";

export const DEFAULT_AUTO_BACKUP_FOLDER_NAME = "aion2-dashboard-auto-backups";

export interface StoreInfraIoDeps {
  getDocumentsPath: () => string;
  getLastBackupDate: () => unknown;
  setLastBackupDate: (value: string) => void;
  ensureDirectory: (path: string) => void;
  writeTextFile: (path: string, content: string) => void;
  buildExportPayload: (state: AppState) => unknown;
  onAutoBackupError?: (error: unknown) => void;
}

export function buildDefaultExportPath(getDocumentsPath: () => string, now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return join(getDocumentsPath(), `aion2-dashboard-backup-${timestamp}.json`);
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function maybeCreateDailyAutoBackup(
  state: AppState,
  deps: StoreInfraIoDeps,
  now = new Date(),
  backupFolderName = DEFAULT_AUTO_BACKUP_FOLDER_NAME,
): void {
  const todayKey = getLocalDateKey(now);
  const lastBackupDate = deps.getLastBackupDate();
  if (typeof lastBackupDate === "string" && lastBackupDate === todayKey) {
    return;
  }

  try {
    const backupDir = join(deps.getDocumentsPath(), backupFolderName);
    deps.ensureDirectory(backupDir);
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const backupPath = join(backupDir, `aion2-dashboard-auto-${timestamp}.json`);
    deps.writeTextFile(backupPath, JSON.stringify(deps.buildExportPayload(state), null, 2));
    deps.setLastBackupDate(todayKey);
  } catch (error) {
    deps.onAutoBackupError?.(error);
  }
}
