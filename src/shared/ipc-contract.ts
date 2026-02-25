import { IPC_CHANNELS } from "./ipc";
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
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopOcrAutoRunConfig,
  WorkshopOcrAutoRunState,
  WorkshopOcrExtractTextInput,
  WorkshopOcrExtractTextResult,
  WorkshopOcrHotkeyConfig,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRule,
  WorkshopScreenCaptureOptions,
  WorkshopScreenPreviewResult,
  WorkshopState,
  UpsertWorkshopInventoryInput,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
} from "./types";

export interface IpcInvokeSpec<Args extends unknown[], Payload, Result> {
  readonly channel: string;
  readonly toPayload: (...args: Args) => Payload;
  readonly __args?: Args;
  readonly __payload?: Payload;
  readonly __result?: Result;
}

type AnyIpcInvokeSpec = IpcInvokeSpec<any[], unknown, unknown>;
export type IpcInvokeSpecRecord = Record<string, AnyIpcInvokeSpec>;

type InvokeArgs<TSpec extends AnyIpcInvokeSpec> = NonNullable<TSpec["__args"]>;
type InvokeResult<TSpec extends AnyIpcInvokeSpec> = NonNullable<TSpec["__result"]>;

export type IpcInvokeApi<TSpecs extends IpcInvokeSpecRecord> = {
  [K in keyof TSpecs]: (...args: InvokeArgs<TSpecs[K]>) => Promise<InvokeResult<TSpecs[K]>>;
};

function defineInvokeSpec<Args extends unknown[], Payload, Result>(
  channel: string,
  toPayload: (...args: Args) => Payload,
): IpcInvokeSpec<Args, Payload, Result> {
  return { channel, toPayload };
}

function noPayloadSpec<Result>(channel: string): IpcInvokeSpec<[], undefined, Result> {
  return defineInvokeSpec(channel, () => undefined);
}

function passthroughPayloadSpec<Payload, Result>(channel: string): IpcInvokeSpec<[payload: Payload], Payload, Result> {
  return defineInvokeSpec(channel, (payload) => payload);
}

export function createIpcInvokeBridge<TSpecs extends IpcInvokeSpecRecord>(
  invoke: (channel: string, payload?: unknown) => Promise<unknown>,
  specs: TSpecs,
): IpcInvokeApi<TSpecs> {
  const api = {} as IpcInvokeApi<TSpecs>;
  (Object.keys(specs) as Array<keyof TSpecs>).forEach((key) => {
    const spec = specs[key];
    api[key] = ((...args: InvokeArgs<TSpecs[typeof key]>) => {
      const payload = spec.toPayload(...args);
      if (payload === undefined) {
        return invoke(spec.channel) as Promise<InvokeResult<TSpecs[typeof key]>>;
      }
      return invoke(spec.channel, payload) as Promise<InvokeResult<TSpecs[typeof key]>>;
    }) as IpcInvokeApi<TSpecs>[typeof key];
  });
  return api;
}

export const IPC_INVOKE_SPECS = {
  getState: noPayloadSpec<AppState>(IPC_CHANNELS.getState),
  getBuildInfo: noPayloadSpec<AppBuildInfo>(IPC_CHANNELS.getBuildInfo),
  resetWeeklyStats: noPayloadSpec<AppState>(IPC_CHANNELS.resetWeeklyStats),
  undoOperations: defineInvokeSpec<[steps?: number], { steps: number }, AppState>(IPC_CHANNELS.undoOperations, (steps = 1) => ({ steps })),
  clearHistory: noPayloadSpec<AppState>(IPC_CHANNELS.clearHistory),
  updateSettings: defineInvokeSpec<[settings: Partial<AppSettings>], { settings: Partial<AppSettings> }, AppState>(
    IPC_CHANNELS.updateSettings,
    (settings) => ({ settings }),
  ),
  exportData: noPayloadSpec<ExportDataResult>(IPC_CHANNELS.exportData),
  importData: noPayloadSpec<ImportDataResult>(IPC_CHANNELS.importData),
  addAccount: defineInvokeSpec<[name: string, regionTag?: string], { name: string; regionTag?: string }, AppState>(
    IPC_CHANNELS.addAccount,
    (name, regionTag) => ({ name, regionTag }),
  ),
  renameAccount: defineInvokeSpec<
    [accountId: string, name: string, regionTag?: string],
    { accountId: string; name: string; regionTag?: string },
    AppState
  >(IPC_CHANNELS.renameAccount, (accountId, name, regionTag) => ({ accountId, name, regionTag })),
  deleteAccount: defineInvokeSpec<[accountId: string], { accountId: string }, AppState>(IPC_CHANNELS.deleteAccount, (accountId) => ({ accountId })),
  selectAccount: defineInvokeSpec<[accountId: string], { accountId: string }, AppState>(IPC_CHANNELS.selectAccount, (accountId) => ({ accountId })),
  addCharacter: defineInvokeSpec<[name: string, accountId?: string], { name: string; accountId?: string }, AppState>(
    IPC_CHANNELS.addCharacter,
    (name, accountId) => ({ name, accountId }),
  ),
  renameCharacter: defineInvokeSpec<[characterId: string, name: string], { characterId: string; name: string }, AppState>(
    IPC_CHANNELS.renameCharacter,
    (characterId, name) => ({ characterId, name }),
  ),
  deleteCharacter: defineInvokeSpec<[characterId: string], { characterId: string }, AppState>(
    IPC_CHANNELS.deleteCharacter,
    (characterId) => ({ characterId }),
  ),
  selectCharacter: defineInvokeSpec<[characterId: string], { characterId: string }, AppState>(
    IPC_CHANNELS.selectCharacter,
    (characterId) => ({ characterId }),
  ),
  updateCharacterProfile: defineInvokeSpec<
    [characterId: string, payload: { classTag?: string | null; gearScore?: number | null }],
    { characterId: string; classTag?: string | null; gearScore?: number | null },
    AppState
  >(IPC_CHANNELS.updateCharacterProfile, (characterId, payload) => ({ characterId, ...payload })),
  reorderCharacters: defineInvokeSpec<[characterIds: string[]], { characterIds: string[] }, AppState>(
    IPC_CHANNELS.reorderCharacters,
    (characterIds) => ({ characterIds }),
  ),
  applyTaskAction: passthroughPayloadSpec<ApplyTaskActionInput, AppState>(IPC_CHANNELS.applyTaskAction),
  applyCorridorCompletion: defineInvokeSpec<
    [characterId: string, lane: "lower" | "middle", completed: number],
    { characterId: string; lane: "lower" | "middle"; completed: number },
    AppState
  >(IPC_CHANNELS.applyCorridorCompletion, (characterId, lane, completed) => ({ characterId, lane, completed })),
  setCorridorCompleted: defineInvokeSpec<
    [characterId: string, lane: "lower" | "middle", completed: number],
    { characterId: string; lane: "lower" | "middle"; completed: number },
    AppState
  >(IPC_CHANNELS.setCorridorCompleted, (characterId, lane, completed) => ({ characterId, lane, completed })),
  updateArtifactStatus: defineInvokeSpec<
    [
      accountId: string,
      lowerAvailable: number,
      lowerNextAt: string | null,
      middleAvailable: number,
      middleNextAt: string | null,
    ],
    {
      accountId: string;
      lowerAvailable: number;
      lowerNextAt: string | null;
      middleAvailable: number;
      middleNextAt: string | null;
    },
    AppState
  >(IPC_CHANNELS.updateArtifactStatus, (accountId, lowerAvailable, lowerNextAt, middleAvailable, middleNextAt) => ({
    accountId,
    lowerAvailable,
    lowerNextAt,
    middleAvailable,
    middleNextAt,
  })),
  updateEnergySegments: defineInvokeSpec<
    [characterId: string, baseCurrent: number, bonusCurrent: number],
    { characterId: string; baseCurrent: number; bonusCurrent: number },
    AppState
  >(IPC_CHANNELS.updateEnergySegments, (characterId, baseCurrent, bonusCurrent) => ({ characterId, baseCurrent, bonusCurrent })),
  updateRaidCounts: defineInvokeSpec<
    [
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
    ],
    {
      characterId: string;
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
    AppState
  >(IPC_CHANNELS.updateRaidCounts, (characterId, payload) => ({ characterId, ...payload })),
  updateWeeklyCompletions: defineInvokeSpec<
    [characterId: string, payload: { expeditionCompleted?: number; transcendenceCompleted?: number }],
    { characterId: string; expeditionCompleted?: number; transcendenceCompleted?: number },
    AppState
  >(IPC_CHANNELS.updateWeeklyCompletions, (characterId, payload) => ({ characterId, ...payload })),
  updateAodePlan: defineInvokeSpec<
    [
      characterId: string,
      payload: {
        shopAodePurchaseUsed?: number;
        shopDailyDungeonTicketPurchaseUsed?: number;
        transformAodeUsed?: number;
        assignExtra?: boolean;
      },
    ],
    {
      characterId: string;
      shopAodePurchaseUsed?: number;
      shopDailyDungeonTicketPurchaseUsed?: number;
      transformAodeUsed?: number;
      assignExtra?: boolean;
    },
    AppState
  >(IPC_CHANNELS.updateAodePlan, (characterId, payload) => ({ characterId, ...payload })),
  getWorkshopState: noPayloadSpec<WorkshopState>(IPC_CHANNELS.getWorkshopState),
  upsertWorkshopItem: passthroughPayloadSpec<UpsertWorkshopItemInput, WorkshopState>(IPC_CHANNELS.upsertWorkshopItem),
  deleteWorkshopItem: defineInvokeSpec<[itemId: string], { itemId: string }, WorkshopState>(IPC_CHANNELS.deleteWorkshopItem, (itemId) => ({ itemId })),
  upsertWorkshopRecipe: passthroughPayloadSpec<UpsertWorkshopRecipeInput, WorkshopState>(IPC_CHANNELS.upsertWorkshopRecipe),
  deleteWorkshopRecipe: defineInvokeSpec<[recipeId: string], { recipeId: string }, WorkshopState>(
    IPC_CHANNELS.deleteWorkshopRecipe,
    (recipeId) => ({ recipeId }),
  ),
  addWorkshopPriceSnapshot: passthroughPayloadSpec<AddWorkshopPriceSnapshotInput, WorkshopState>(IPC_CHANNELS.addWorkshopPriceSnapshot),
  deleteWorkshopPriceSnapshot: defineInvokeSpec<[snapshotId: string], { snapshotId: string }, WorkshopState>(
    IPC_CHANNELS.deleteWorkshopPriceSnapshot,
    (snapshotId) => ({ snapshotId }),
  ),
  extractWorkshopOcrText: passthroughPayloadSpec<WorkshopOcrExtractTextInput, WorkshopOcrExtractTextResult>(IPC_CHANNELS.extractWorkshopOcrText),
  configureWorkshopOcrHotkey: passthroughPayloadSpec<WorkshopOcrHotkeyConfig, WorkshopOcrHotkeyState>(
    IPC_CHANNELS.configureWorkshopOcrHotkey,
  ),
  getWorkshopOcrHotkeyState: noPayloadSpec<WorkshopOcrHotkeyState>(IPC_CHANNELS.getWorkshopOcrHotkeyState),
  configureWorkshopOcrAutoRun: passthroughPayloadSpec<WorkshopOcrAutoRunConfig, WorkshopOcrAutoRunState>(
    IPC_CHANNELS.configureWorkshopOcrAutoRun,
  ),
  getWorkshopOcrAutoRunState: noPayloadSpec<WorkshopOcrAutoRunState>(IPC_CHANNELS.getWorkshopOcrAutoRunState),
  triggerWorkshopOcrHotkeyNow: defineInvokeSpec<
    [payload?: WorkshopScreenCaptureOptions],
    WorkshopScreenCaptureOptions,
    WorkshopOcrHotkeyRunResult
  >(IPC_CHANNELS.triggerWorkshopOcrHotkeyNow, (payload) => payload ?? {}),
  captureWorkshopScreenPreview: defineInvokeSpec<
    [payload?: WorkshopScreenCaptureOptions],
    WorkshopScreenCaptureOptions,
    WorkshopScreenPreviewResult
  >(IPC_CHANNELS.captureWorkshopScreenPreview, (payload) => payload ?? {}),
  importWorkshopOcrPrices: passthroughPayloadSpec<WorkshopOcrPriceImportInput, WorkshopOcrPriceImportResult>(
    IPC_CHANNELS.importWorkshopOcrPrices,
  ),
  importWorkshopCatalogFromFile: passthroughPayloadSpec<WorkshopCatalogImportFromFileInput, WorkshopCatalogImportResult>(
    IPC_CHANNELS.importWorkshopCatalogFromFile,
  ),
  upsertWorkshopInventory: passthroughPayloadSpec<UpsertWorkshopInventoryInput, WorkshopState>(IPC_CHANNELS.upsertWorkshopInventory),
  simulateWorkshopCraft: passthroughPayloadSpec<WorkshopCraftSimulationInput, WorkshopCraftSimulationResult>(IPC_CHANNELS.simulateWorkshopCraft),
  getWorkshopCraftOptions: defineInvokeSpec<[payload?: { taxRate?: number }], { taxRate?: number }, WorkshopCraftOption[]>(
    IPC_CHANNELS.getWorkshopCraftOptions,
    (payload) => payload ?? {},
  ),
  getWorkshopPriceHistory: passthroughPayloadSpec<WorkshopPriceHistoryQuery, WorkshopPriceHistoryResult>(IPC_CHANNELS.getWorkshopPriceHistory),
  getWorkshopPriceSignals: defineInvokeSpec<[payload?: WorkshopPriceSignalQuery], WorkshopPriceSignalQuery, WorkshopPriceSignalResult>(
    IPC_CHANNELS.getWorkshopPriceSignals,
    (payload) => payload ?? {},
  ),
  updateWorkshopSignalRule: passthroughPayloadSpec<Partial<WorkshopPriceSignalRule>, WorkshopState>(IPC_CHANNELS.updateWorkshopSignalRule),
  seedWorkshopSampleData: noPayloadSpec<WorkshopState>(IPC_CHANNELS.seedWorkshopSampleData),
} as const;

export interface IpcEventSpec<Payload> {
  readonly channel: string;
  readonly __payload?: Payload;
}

function defineEventSpec<Payload>(channel: string): IpcEventSpec<Payload> {
  return { channel };
}

export const IPC_EVENT_SPECS = {
  workshopOcrHotkeyResult: defineEventSpec<WorkshopOcrHotkeyRunResult>(IPC_CHANNELS.workshopOcrHotkeyResult),
  workshopOcrAutoRunState: defineEventSpec<WorkshopOcrAutoRunState>(IPC_CHANNELS.workshopOcrAutoRunState),
} as const;
