import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type {
  AddWorkshopPriceSnapshotInput,
  AppBuildInfo,
  AppSettings,
  AppState,
  ApplyTaskActionInput,
  ExportDataResult,
  ImportDataResult,
  WorkshopCatalogImportFromFileInput,
  WorkshopCatalogImportResult,
  WorkshopOcrExtractTextInput,
  WorkshopOcrExtractTextResult,
  WorkshopOcrHotkeyConfig,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopScreenCaptureOptions,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
  WorkshopScreenPreviewResult,
  UpsertWorkshopInventoryInput,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRule,
  WorkshopState,
} from "../shared/types";

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.getState),
  getBuildInfo: (): Promise<AppBuildInfo> => ipcRenderer.invoke(IPC_CHANNELS.getBuildInfo),
  resetWeeklyStats: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.resetWeeklyStats),
  undoOperations: (steps = 1): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.undoOperations, { steps }),
  clearHistory: (): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.clearHistory),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateSettings, { settings }),
  exportData: (): Promise<ExportDataResult> => ipcRenderer.invoke(IPC_CHANNELS.exportData),
  importData: (): Promise<ImportDataResult> => ipcRenderer.invoke(IPC_CHANNELS.importData),
  addAccount: (name: string, regionTag?: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.addAccount, { name, regionTag }),
  renameAccount: (accountId: string, name: string, regionTag?: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.renameAccount, { accountId, name, regionTag }),
  deleteAccount: (accountId: string): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.deleteAccount, { accountId }),
  selectAccount: (accountId: string): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.selectAccount, { accountId }),
  addCharacter: (name: string, accountId?: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.addCharacter, { name, accountId }),
  renameCharacter: (characterId: string, name: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.renameCharacter, { characterId, name }),
  deleteCharacter: (characterId: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteCharacter, { characterId }),
  selectCharacter: (characterId: string): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.selectCharacter, { characterId }),
  applyTaskAction: (input: ApplyTaskActionInput): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.applyTaskAction, input),
  applyCorridorCompletion: (characterId: string, lane: "lower" | "middle", completed: number): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.applyCorridorCompletion, { characterId, lane, completed }),
  updateArtifactStatus: (
    accountId: string,
    lowerAvailable: number,
    lowerNextAt: string | null,
    middleAvailable: number,
    middleNextAt: string | null,
  ): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateArtifactStatus, {
      accountId,
      lowerAvailable,
      lowerNextAt,
      middleAvailable,
      middleNextAt,
    }),
  updateEnergySegments: (characterId: string, baseCurrent: number, bonusCurrent: number): Promise<AppState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateEnergySegments, { characterId, baseCurrent, bonusCurrent }),
  updateRaidCounts: (
    characterId: string,
    payload: {
      expeditionRemaining?: number;
      expeditionTicketBonus?: number;
      expeditionBossRemaining?: number;
      transcendenceRemaining?: number;
      transcendenceTicketBonus?: number;
      transcendenceBossRemaining?: number;
      nightmareRemaining?: number;
      nightmareTicketBonus?: number;
      awakeningRemaining?: number;
      awakeningTicketBonus?: number;
      suppressionRemaining?: number;
      suppressionTicketBonus?: number;
      dailyDungeonRemaining?: number;
      dailyDungeonTicketStored?: number;
      miniGameRemaining?: number;
      miniGameTicketBonus?: number;
      spiritInvasionRemaining?: number;
      sanctumRaidRemaining?: number;
      sanctumBoxRemaining?: number;
    },
  ): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.updateRaidCounts, { characterId, ...payload }),
  updateWeeklyCompletions: (
    characterId: string,
    payload: { expeditionCompleted?: number; transcendenceCompleted?: number },
  ): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.updateWeeklyCompletions, { characterId, ...payload }),
  updateAodePlan: (
    characterId: string,
    payload: {
      shopAodePurchaseUsed?: number;
      shopDailyDungeonTicketPurchaseUsed?: number;
      transformAodeUsed?: number;
      assignExtra?: boolean;
    },
  ): Promise<AppState> => ipcRenderer.invoke(IPC_CHANNELS.updateAodePlan, { characterId, ...payload }),
  getWorkshopState: (): Promise<WorkshopState> => ipcRenderer.invoke(IPC_CHANNELS.getWorkshopState),
  upsertWorkshopItem: (payload: UpsertWorkshopItemInput): Promise<WorkshopState> =>
    ipcRenderer.invoke(IPC_CHANNELS.upsertWorkshopItem, payload),
  deleteWorkshopItem: (itemId: string): Promise<WorkshopState> => ipcRenderer.invoke(IPC_CHANNELS.deleteWorkshopItem, { itemId }),
  upsertWorkshopRecipe: (payload: UpsertWorkshopRecipeInput): Promise<WorkshopState> =>
    ipcRenderer.invoke(IPC_CHANNELS.upsertWorkshopRecipe, payload),
  deleteWorkshopRecipe: (recipeId: string): Promise<WorkshopState> =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteWorkshopRecipe, { recipeId }),
  addWorkshopPriceSnapshot: (payload: AddWorkshopPriceSnapshotInput): Promise<WorkshopState> =>
    ipcRenderer.invoke(IPC_CHANNELS.addWorkshopPriceSnapshot, payload),
  deleteWorkshopPriceSnapshot: (snapshotId: string): Promise<WorkshopState> =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteWorkshopPriceSnapshot, { snapshotId }),
  extractWorkshopOcrText: (payload: WorkshopOcrExtractTextInput): Promise<WorkshopOcrExtractTextResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.extractWorkshopOcrText, payload),
  configureWorkshopOcrHotkey: (payload: WorkshopOcrHotkeyConfig): Promise<WorkshopOcrHotkeyState> =>
    ipcRenderer.invoke(IPC_CHANNELS.configureWorkshopOcrHotkey, payload),
  getWorkshopOcrHotkeyState: (): Promise<WorkshopOcrHotkeyState> =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkshopOcrHotkeyState),
  triggerWorkshopOcrHotkeyNow: (payload?: WorkshopScreenCaptureOptions): Promise<WorkshopOcrHotkeyRunResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.triggerWorkshopOcrHotkeyNow, payload ?? {}),
  captureWorkshopScreenPreview: (payload?: WorkshopScreenCaptureOptions): Promise<WorkshopScreenPreviewResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.captureWorkshopScreenPreview, payload ?? {}),
  onWorkshopOcrHotkeyResult: (listener: (result: WorkshopOcrHotkeyRunResult) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: WorkshopOcrHotkeyRunResult) => listener(payload);
    ipcRenderer.on(IPC_CHANNELS.workshopOcrHotkeyResult, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.workshopOcrHotkeyResult, handler);
    };
  },
  importWorkshopOcrPrices: (payload: WorkshopOcrPriceImportInput): Promise<WorkshopOcrPriceImportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.importWorkshopOcrPrices, payload),
  importWorkshopCatalogFromFile: (payload: WorkshopCatalogImportFromFileInput): Promise<WorkshopCatalogImportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.importWorkshopCatalogFromFile, payload),
  upsertWorkshopInventory: (payload: UpsertWorkshopInventoryInput): Promise<WorkshopState> =>
    ipcRenderer.invoke(IPC_CHANNELS.upsertWorkshopInventory, payload),
  simulateWorkshopCraft: (payload: WorkshopCraftSimulationInput): Promise<WorkshopCraftSimulationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.simulateWorkshopCraft, payload),
  getWorkshopCraftOptions: (payload?: { taxRate?: number }): Promise<WorkshopCraftOption[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkshopCraftOptions, payload ?? {}),
  getWorkshopPriceHistory: (payload: WorkshopPriceHistoryQuery): Promise<WorkshopPriceHistoryResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkshopPriceHistory, payload),
  getWorkshopPriceSignals: (payload?: WorkshopPriceSignalQuery): Promise<WorkshopPriceSignalResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.getWorkshopPriceSignals, payload ?? {}),
  updateWorkshopSignalRule: (payload: Partial<WorkshopPriceSignalRule>): Promise<WorkshopState> =>
    ipcRenderer.invoke(IPC_CHANNELS.updateWorkshopSignalRule, payload),
  seedWorkshopSampleData: (): Promise<WorkshopState> => ipcRenderer.invoke(IPC_CHANNELS.seedWorkshopSampleData),
};

contextBridge.exposeInMainWorld("aionApi", api);

export type AionApi = typeof api;
