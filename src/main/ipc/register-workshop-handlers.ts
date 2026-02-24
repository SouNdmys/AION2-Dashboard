import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopCatalogImportFromFileInput,
  WorkshopOcrAutoRunConfig,
  WorkshopOcrExtractTextInput,
  WorkshopOcrHotkeyConfig,
  WorkshopScreenCaptureOptions,
  WorkshopOcrPriceImportInput,
  UpsertWorkshopInventoryInput,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
  WorkshopCraftSimulationInput,
  WorkshopPriceHistoryQuery,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalRule,
} from "../../shared/types";
import {
  captureWorkshopScreenPreview,
  configureWorkshopOcrAutoRun,
  configureWorkshopOcrHotkey,
  getWorkshopOcrAutoRunState,
  getWorkshopOcrHotkeyState,
  triggerWorkshopOcrHotkeyNow,
} from "../workshop-automation";
import {
  addWorkshopPriceSnapshot,
  deleteWorkshopPriceSnapshot,
  deleteWorkshopItem,
  deleteWorkshopRecipe,
  extractWorkshopOcrText,
  getWorkshopCraftOptions,
  getWorkshopPriceHistory,
  getWorkshopPriceSignals,
  getWorkshopState,
  importWorkshopCatalogFromFile,
  importWorkshopOcrPrices,
  seedWorkshopSampleData,
  simulateWorkshopCraft,
  updateWorkshopSignalRule,
  upsertWorkshopInventory,
  upsertWorkshopItem,
  upsertWorkshopRecipe,
} from "../workshop-store";
import { readObjectPayload, readOptionalObjectPayload, readOptionalNumber, readString } from "./guards";

export function registerWorkshopIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getWorkshopState, () => getWorkshopState());
  ipcMain.handle(IPC_CHANNELS.upsertWorkshopItem, (_event, payload: unknown) =>
    upsertWorkshopItem(readObjectPayload(payload, IPC_CHANNELS.upsertWorkshopItem) as unknown as UpsertWorkshopItemInput),
  );
  ipcMain.handle(IPC_CHANNELS.deleteWorkshopItem, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteWorkshopItem;
    const body = readObjectPayload(payload, channel);
    return deleteWorkshopItem(readString(body, "itemId", channel));
  });
  ipcMain.handle(IPC_CHANNELS.upsertWorkshopRecipe, (_event, payload: unknown) =>
    upsertWorkshopRecipe(readObjectPayload(payload, IPC_CHANNELS.upsertWorkshopRecipe) as unknown as UpsertWorkshopRecipeInput),
  );
  ipcMain.handle(IPC_CHANNELS.deleteWorkshopRecipe, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteWorkshopRecipe;
    const body = readObjectPayload(payload, channel);
    return deleteWorkshopRecipe(readString(body, "recipeId", channel));
  });
  ipcMain.handle(IPC_CHANNELS.addWorkshopPriceSnapshot, (_event, payload: unknown) =>
    addWorkshopPriceSnapshot(
      readObjectPayload(payload, IPC_CHANNELS.addWorkshopPriceSnapshot) as unknown as AddWorkshopPriceSnapshotInput,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.deleteWorkshopPriceSnapshot, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteWorkshopPriceSnapshot;
    const body = readObjectPayload(payload, channel);
    return deleteWorkshopPriceSnapshot(readString(body, "snapshotId", channel));
  });
  ipcMain.handle(IPC_CHANNELS.extractWorkshopOcrText, async (_event, payload: unknown) =>
    extractWorkshopOcrText(
      readObjectPayload(payload, IPC_CHANNELS.extractWorkshopOcrText) as unknown as WorkshopOcrExtractTextInput,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.configureWorkshopOcrHotkey, (_event, payload: unknown) =>
    configureWorkshopOcrHotkey(
      readObjectPayload(payload, IPC_CHANNELS.configureWorkshopOcrHotkey) as unknown as WorkshopOcrHotkeyConfig,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.getWorkshopOcrHotkeyState, () => getWorkshopOcrHotkeyState());
  ipcMain.handle(IPC_CHANNELS.configureWorkshopOcrAutoRun, (_event, payload: unknown) =>
    configureWorkshopOcrAutoRun(
      readObjectPayload(payload, IPC_CHANNELS.configureWorkshopOcrAutoRun) as unknown as WorkshopOcrAutoRunConfig,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.getWorkshopOcrAutoRunState, () => getWorkshopOcrAutoRunState());
  ipcMain.handle(IPC_CHANNELS.triggerWorkshopOcrHotkeyNow, async (_event, payload?: unknown) =>
    triggerWorkshopOcrHotkeyNow(
      readOptionalObjectPayload(payload, IPC_CHANNELS.triggerWorkshopOcrHotkeyNow) as WorkshopScreenCaptureOptions | undefined,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.captureWorkshopScreenPreview, async (_event, payload?: unknown) =>
    captureWorkshopScreenPreview(
      readOptionalObjectPayload(payload, IPC_CHANNELS.captureWorkshopScreenPreview) as WorkshopScreenCaptureOptions | undefined,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.importWorkshopOcrPrices, (_event, payload: unknown) =>
    importWorkshopOcrPrices(
      readObjectPayload(payload, IPC_CHANNELS.importWorkshopOcrPrices) as unknown as WorkshopOcrPriceImportInput,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.importWorkshopCatalogFromFile, (_event, payload: unknown) =>
    importWorkshopCatalogFromFile(
      readObjectPayload(payload, IPC_CHANNELS.importWorkshopCatalogFromFile) as unknown as WorkshopCatalogImportFromFileInput,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.upsertWorkshopInventory, (_event, payload: unknown) =>
    upsertWorkshopInventory(
      readObjectPayload(payload, IPC_CHANNELS.upsertWorkshopInventory) as unknown as UpsertWorkshopInventoryInput,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.simulateWorkshopCraft, (_event, payload: unknown) =>
    simulateWorkshopCraft(
      readObjectPayload(payload, IPC_CHANNELS.simulateWorkshopCraft) as unknown as WorkshopCraftSimulationInput,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.getWorkshopCraftOptions, (_event, payload?: unknown) => {
    const channel = IPC_CHANNELS.getWorkshopCraftOptions;
    const body = readOptionalObjectPayload(payload, channel);
    const taxRate = body ? readOptionalNumber(body, "taxRate", channel) : undefined;
    return getWorkshopCraftOptions({ taxRate });
  });
  ipcMain.handle(IPC_CHANNELS.getWorkshopPriceHistory, (_event, payload: unknown) =>
    getWorkshopPriceHistory(
      readObjectPayload(payload, IPC_CHANNELS.getWorkshopPriceHistory) as unknown as WorkshopPriceHistoryQuery,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.getWorkshopPriceSignals, (_event, payload?: unknown) =>
    getWorkshopPriceSignals(
      readOptionalObjectPayload(payload, IPC_CHANNELS.getWorkshopPriceSignals) as WorkshopPriceSignalQuery | undefined,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.updateWorkshopSignalRule, (_event, payload: unknown) =>
    updateWorkshopSignalRule(
      readObjectPayload(payload, IPC_CHANNELS.updateWorkshopSignalRule) as unknown as Partial<WorkshopPriceSignalRule>,
    ),
  );
  ipcMain.handle(IPC_CHANNELS.seedWorkshopSampleData, () => seedWorkshopSampleData());
}
