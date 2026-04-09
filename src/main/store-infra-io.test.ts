import { describe, expect, it, vi } from "vitest";
import type { AppState } from "../shared/types";
import { buildDefaultExportPath, getLocalDateKey, maybeCreateDailyAutoBackup } from "./store-infra-io";

function createState(): AppState {
  return {
    version: 6,
    selectedAccountId: null,
    selectedCharacterId: null,
    settings: {
      expeditionGoldPerRun: 1,
      transcendenceGoldPerRun: 1,
      expeditionRunCap: null,
      transcendenceRunCap: null,
      nightmareRunCap: null,
      awakeningRunCap: null,
      expeditionWarnThreshold: 1,
      transcendenceWarnThreshold: 1,
      priorityWeightAode: 1,
      priorityWeightSanctum: 1,
      priorityWeightCorridor: 1,
      priorityWeightDungeon: 1,
      priorityWeightWeekly: 1,
      priorityWeightMission: 1,
      priorityWeightLeisure: 1,
    },
    accounts: [],
    characters: [],
    history: [],
  };
}

describe("store/store-infra-io", () => {
  it("builds export path with sanitized timestamp suffix", () => {
    const outputPath = buildDefaultExportPath(
      () => "D:/docs",
      new Date("2026-02-26T12:34:56.789Z"),
    );

    expect(outputPath).toContain("aion2-dashboard-backup-2026-02-26T12-34-56-789Z.json");
  });

  it("skips auto backup when backup already created today", () => {
    const ensureDirectory = vi.fn();
    const writeTextFile = vi.fn();
    const setLastBackupDate = vi.fn();

    maybeCreateDailyAutoBackup(
      createState(),
      {
        getDocumentsPath: () => "D:/docs",
        getLastBackupDate: () => "2026-02-26",
        setLastBackupDate,
        ensureDirectory,
        writeTextFile,
        buildExportPayload: (state) => ({ state }),
      },
      new Date("2026-02-26T03:00:00.000Z"),
    );

    expect(ensureDirectory).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(setLastBackupDate).not.toHaveBeenCalled();
  });

  it("creates backup file and writes meta date when backup is stale", () => {
    const ensureDirectory = vi.fn();
    const writeTextFile = vi.fn();
    const setLastBackupDate = vi.fn();

    maybeCreateDailyAutoBackup(
      createState(),
      {
        getDocumentsPath: () => "D:/docs",
        getLastBackupDate: () => "2026-02-25",
        setLastBackupDate,
        ensureDirectory,
        writeTextFile,
        buildExportPayload: (state) => ({ app: "aion2-dashboard", state }),
      },
      new Date("2026-02-26T08:09:10.111Z"),
    );

    expect(ensureDirectory).toHaveBeenCalledTimes(1);
    expect(ensureDirectory.mock.calls[0][0]).toContain("aion2-dashboard-auto-backups");
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile.mock.calls[0][0]).toContain("aion2-dashboard-auto-2026-02-26T08-09-10-111Z.json");
    expect(setLastBackupDate).toHaveBeenCalledWith("2026-02-26");
  });

  it("swallows backup errors and delegates to error callback", () => {
    const onAutoBackupError = vi.fn();
    const failure = new Error("disk full");

    maybeCreateDailyAutoBackup(
      createState(),
      {
        getDocumentsPath: () => "D:/docs",
        getLastBackupDate: () => "",
        setLastBackupDate: vi.fn(),
        ensureDirectory: vi.fn(),
        writeTextFile: () => {
          throw failure;
        },
        buildExportPayload: (state) => ({ state }),
        onAutoBackupError,
      },
      new Date("2026-02-26T00:00:00.000Z"),
    );

    expect(onAutoBackupError).toHaveBeenCalledWith(failure);
  });

  it("builds local date key with zero-padded month/day", () => {
    expect(getLocalDateKey(new Date(2026, 2, 4, 12, 34, 56))).toBe("2026-03-04");
  });
});
