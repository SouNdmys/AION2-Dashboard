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
  deleteWorkshopItem,
  deleteWorkshopRecipe,
  importWorkshopCatalogFromFile,
  upsertWorkshopItem,
  upsertWorkshopRecipe,
} from "../workshop-store/catalog";
import { extractWorkshopOcrText, importWorkshopOcrPrices } from "../workshop-store/ocr";
import {
  addWorkshopPriceSnapshot,
  deleteWorkshopPriceSnapshot,
  getWorkshopPriceHistory,
  getWorkshopPriceSignals,
  updateWorkshopSignalRule,
} from "../workshop-store/pricing";
import { getWorkshopCraftOptions, simulateWorkshopCraft } from "../workshop-store/simulation";
import { getWorkshopState, seedWorkshopSampleData, upsertWorkshopInventory } from "../workshop-store/store";
import { readObjectPayload, readOptionalObjectPayload, readOptionalNumber, readString } from "./guards";
import { registerIpcHandler } from "./register-handler";

export function registerWorkshopIpcHandlers(): void {
  registerIpcHandler(IPC_CHANNELS.getWorkshopState, () => getWorkshopState());
  registerIpcHandler(IPC_CHANNELS.upsertWorkshopItem, (_event, payload: unknown) =>
    upsertWorkshopItem(readObjectPayload(payload, IPC_CHANNELS.upsertWorkshopItem) as unknown as UpsertWorkshopItemInput),
  );
  registerIpcHandler(IPC_CHANNELS.deleteWorkshopItem, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteWorkshopItem;
    const body = readObjectPayload(payload, channel);
    return deleteWorkshopItem(readString(body, "itemId", channel));
  });
  registerIpcHandler(IPC_CHANNELS.upsertWorkshopRecipe, (_event, payload: unknown) =>
    upsertWorkshopRecipe(readObjectPayload(payload, IPC_CHANNELS.upsertWorkshopRecipe) as unknown as UpsertWorkshopRecipeInput),
  );
  registerIpcHandler(IPC_CHANNELS.deleteWorkshopRecipe, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteWorkshopRecipe;
    const body = readObjectPayload(payload, channel);
    return deleteWorkshopRecipe(readString(body, "recipeId", channel));
  });
  registerIpcHandler(IPC_CHANNELS.addWorkshopPriceSnapshot, (_event, payload: unknown) =>
    addWorkshopPriceSnapshot(
      readObjectPayload(payload, IPC_CHANNELS.addWorkshopPriceSnapshot) as unknown as AddWorkshopPriceSnapshotInput,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.deleteWorkshopPriceSnapshot, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteWorkshopPriceSnapshot;
    const body = readObjectPayload(payload, channel);
    return deleteWorkshopPriceSnapshot(readString(body, "snapshotId", channel));
  });
  registerIpcHandler(IPC_CHANNELS.extractWorkshopOcrText, async (_event, payload: unknown) =>
    extractWorkshopOcrText(
      readObjectPayload(payload, IPC_CHANNELS.extractWorkshopOcrText) as unknown as WorkshopOcrExtractTextInput,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.configureWorkshopOcrHotkey, (_event, payload: unknown) =>
    configureWorkshopOcrHotkey(
      readObjectPayload(payload, IPC_CHANNELS.configureWorkshopOcrHotkey) as unknown as WorkshopOcrHotkeyConfig,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.getWorkshopOcrHotkeyState, () => getWorkshopOcrHotkeyState());
  registerIpcHandler(IPC_CHANNELS.configureWorkshopOcrAutoRun, (_event, payload: unknown) =>
    configureWorkshopOcrAutoRun(
      readObjectPayload(payload, IPC_CHANNELS.configureWorkshopOcrAutoRun) as unknown as WorkshopOcrAutoRunConfig,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.getWorkshopOcrAutoRunState, () => getWorkshopOcrAutoRunState());
  registerIpcHandler(IPC_CHANNELS.triggerWorkshopOcrHotkeyNow, async (_event, payload?: unknown) =>
    triggerWorkshopOcrHotkeyNow(
      readOptionalObjectPayload(payload, IPC_CHANNELS.triggerWorkshopOcrHotkeyNow) as WorkshopScreenCaptureOptions | undefined,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.captureWorkshopScreenPreview, async (_event, payload?: unknown) =>
    captureWorkshopScreenPreview(
      readOptionalObjectPayload(payload, IPC_CHANNELS.captureWorkshopScreenPreview) as WorkshopScreenCaptureOptions | undefined,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.importWorkshopOcrPrices, (_event, payload: unknown) =>
    importWorkshopOcrPrices(
      readObjectPayload(payload, IPC_CHANNELS.importWorkshopOcrPrices) as unknown as WorkshopOcrPriceImportInput,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.importWorkshopCatalogFromFile, (_event, payload: unknown) =>
    importWorkshopCatalogFromFile(
      readObjectPayload(payload, IPC_CHANNELS.importWorkshopCatalogFromFile) as unknown as WorkshopCatalogImportFromFileInput,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.upsertWorkshopInventory, (_event, payload: unknown) =>
    upsertWorkshopInventory(
      readObjectPayload(payload, IPC_CHANNELS.upsertWorkshopInventory) as unknown as UpsertWorkshopInventoryInput,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.simulateWorkshopCraft, (_event, payload: unknown) =>
    simulateWorkshopCraft(
      readObjectPayload(payload, IPC_CHANNELS.simulateWorkshopCraft) as unknown as WorkshopCraftSimulationInput,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.getWorkshopCraftOptions, (_event, payload?: unknown) => {
    const channel = IPC_CHANNELS.getWorkshopCraftOptions;
    const body = readOptionalObjectPayload(payload, channel);
    const taxRate = body ? readOptionalNumber(body, "taxRate", channel) : undefined;
    return getWorkshopCraftOptions({ taxRate });
  });
  registerIpcHandler(IPC_CHANNELS.getWorkshopPriceHistory, (_event, payload: unknown) =>
    getWorkshopPriceHistory(
      readObjectPayload(payload, IPC_CHANNELS.getWorkshopPriceHistory) as unknown as WorkshopPriceHistoryQuery,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.getWorkshopPriceSignals, (_event, payload?: unknown) =>
    getWorkshopPriceSignals(
      readOptionalObjectPayload(payload, IPC_CHANNELS.getWorkshopPriceSignals) as WorkshopPriceSignalQuery | undefined,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.updateWorkshopSignalRule, (_event, payload: unknown) =>
    updateWorkshopSignalRule(
      readObjectPayload(payload, IPC_CHANNELS.updateWorkshopSignalRule) as unknown as Partial<WorkshopPriceSignalRule>,
    ),
  );
  registerIpcHandler(IPC_CHANNELS.seedWorkshopSampleData, () => seedWorkshopSampleData());
}
