import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nativeImage } from "electron";
import Store from "electron-store";
import OcrNode from "@gutenye/ocr-node";
import { resolveImportFilePath } from "./workshop-store/import-file-path";
import { getBuiltinCatalogSignature, rebuildStateWithBuiltinCatalog } from "./workshop-store/catalog-bootstrap";
import { sanitizeOcrLineItemName } from "./workshop-store/ocr-name-matching";
import {
  buildPaddleLanguageCandidates,
  sanitizeOcrLanguage,
  sanitizeOcrPsm,
  sanitizeOcrSafeMode,
} from "./workshop-store/ocr-extract-config";
import { sanitizeTradeBoardPreset } from "./workshop-store/ocr-tradeboard-preset";
import { detectTradePriceRoleByHeaderText } from "./workshop-store/ocr-tradeboard-rows";
import {
  buildPrimaryOcrTextResult,
  formatPaddleOcrError,
} from "./workshop-store/ocr-extract-output";
import { cleanupTempFile, stringifyOcrWords } from "./workshop-store/ocr-extract-io";
import { runPaddleExtractWithFallback } from "./workshop-store/ocr-extract-runner";
import { extractWorkshopOcrTextEntry } from "./workshop-store/ocr-extract-entry";
import { extractTradeBoardOcrText } from "./workshop-store/ocr-tradeboard-extract";
import { yieldToEventLoop } from "./workshop-store/ocr-import-runtime";
import { prepareOcrImportContext } from "./workshop-store/ocr-import-context";
import { applyParsedOcrImportLines } from "./workshop-store/ocr-import-apply";
import {
  cacheIconByName,
  extractItemAliasesFromNotes,
  isCapturedImageIcon,
  normalizeIconCache,
  resolveItemIconWithCache,
  sanitizeIconToken,
  serializeIconCache,
} from "./workshop-store/icon-cache";
import {
  WORKSHOP_PRICE_NOTE_TAG_HARD,
  WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
  appendNoteTag,
  assessPriceAnomalyWithCategory,
  collectBaselinePricesForItem,
  formatAnomalyReason,
} from "./workshop-store/pricing-anomaly";
import { normalizePriceSnapshot, sanitizePriceMarket } from "./workshop-store/pricing-snapshot-normalize";
import { sanitizeOcrImportPayload } from "./workshop-store/ocr-import-parser";
import { buildOnnxOcrOutcome } from "./workshop-store/ocr-onnx-output";
import { createOnnxOcrRuntime, type OnnxOcrEngine } from "./workshop-store/ocr-onnx-runtime";
import { createPaddleOcrRuntime, PADDLE_OCR_PYTHON_SCRIPT } from "./workshop-store/ocr-paddle-runtime";
import { parsePaddlePayload } from "./workshop-store/ocr-paddle-payload";
import type { PaddleOcrOutcome } from "./workshop-store/ocr-paddle-payload";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopOcrExtractTextInput,
  WorkshopOcrExtractTextResult,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
  WorkshopRect,
  WorkshopInventoryItem,
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopPriceSignalRule,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopRecipeInput,
  WorkshopState,
} from "../shared/types";

export { normalizeIconCache, resolveItemIconWithCache, yieldToEventLoop };
export {
  WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS,
  WORKSHOP_PRICE_NOTE_TAG_HARD,
  WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
  appendNoteTag,
  assessPriceAnomalyWithCategory,
  collectBaselinePricesForItem,
  formatAnomalyReason,
  normalizePriceMarketForCompare,
  resolveSnapshotQualityTag,
} from "./workshop-store/pricing-anomaly";
export { sanitizePriceMarket } from "./workshop-store/pricing-snapshot-normalize";

export const WORKSHOP_STATE_VERSION = 6;
export const WORKSHOP_PRICE_HISTORY_LIMIT = 8_000;
export const WORKSHOP_HISTORY_DEFAULT_DAYS = 30;
export const WORKSHOP_HISTORY_MAX_DAYS = 365;
export const WORKSHOP_SIGNAL_THRESHOLD_DEFAULT = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MIN = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MAX = 0.5;
export const WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT = 5;
export const WORKSHOP_ICON_CACHE_KEY = "iconCache";
const WORKSHOP_OCR_IMPORT_YIELD_EVERY = 40;
export const WORKSHOP_SIGNAL_YIELD_EVERY = 12;
const WORKSHOP_KNOWN_INVALID_ITEM_NAMES = new Set<string>([
  "燦爛的奧里哈康礫石",
  "純淨的奧里哈康磐石",
  "高純度的奧里哈康磐石",
  "新鮮的金盒花",
]);
const OCR_TSV_NAME_CONFIDENCE_MIN = 35;
const OCR_TSV_NUMERIC_CONFIDENCE_MIN = 20;
const OCR_PADDLE_CONFIDENCE_SCALE = 100;
const OCR_ENABLE_PYTHON_FALLBACK = false;

const DEFAULT_WORKSHOP_SIGNAL_RULE: WorkshopPriceSignalRule = {
  enabled: true,
  lookbackDays: WORKSHOP_HISTORY_DEFAULT_DAYS,
  dropBelowWeekdayAverageRatio: WORKSHOP_SIGNAL_THRESHOLD_DEFAULT,
};

export const workshopStore = new Store<Record<string, unknown>>({
  name: "aion2-dashboard-workshop",
  clearInvalidConfig: true,
  defaults: {
    version: WORKSHOP_STATE_VERSION,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
    signalRule: DEFAULT_WORKSHOP_SIGNAL_RULE,
    iconCache: {},
  },
});

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function asIso(raw: unknown, fallbackIso: string): string {
  if (typeof raw !== "string") {
    return fallbackIso;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return fallbackIso;
  }
  return date.toISOString();
}

function sanitizeCategory(raw: unknown): WorkshopItemCategory {
  if (raw === "material" || raw === "equipment" || raw === "component" || raw === "other") {
    return raw;
  }
  return "material";
}

function sanitizeName(raw: unknown, fallback = ""): string {
  if (typeof raw !== "string") {
    return fallback;
  }
  return raw.trim();
}

export function toPositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.floor(raw));
}

export function toNonNegativeInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(0, Math.floor(raw));
}

export function normalizeRecipeInputs(raw: unknown): WorkshopRecipeInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const dedup = new Map<string, number>();
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const itemId = typeof (entry as { itemId?: unknown }).itemId === "string" ? (entry as { itemId: string }).itemId : "";
    const quantity = toPositiveInt((entry as { quantity?: unknown }).quantity, 0);
    if (!itemId || quantity <= 0) {
      return;
    }
    dedup.set(itemId, (dedup.get(itemId) ?? 0) + quantity);
  });

  return Array.from(dedup.entries())
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function normalizeItem(raw: unknown, index: number): WorkshopItem {
  const nowIso = new Date().toISOString();
  const id = typeof (raw as { id?: unknown })?.id === "string" ? ((raw as { id: string }).id ?? randomUUID()) : randomUUID();
  const nameFallback = `物品-${index + 1}`;
  const name = sanitizeName((raw as { name?: unknown })?.name, nameFallback) || nameFallback;
  const createdAt = asIso((raw as { createdAt?: unknown })?.createdAt, nowIso);
  const updatedAt = asIso((raw as { updatedAt?: unknown })?.updatedAt, nowIso);
  const icon = sanitizeIconToken((raw as { icon?: unknown })?.icon);
  const notes = sanitizeName((raw as { notes?: unknown })?.notes) || undefined;

  return {
    id,
    name,
    category: sanitizeCategory((raw as { category?: unknown })?.category),
    icon,
    notes,
    createdAt,
    updatedAt,
  };
}

function normalizeRecipe(raw: unknown): WorkshopRecipe | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : randomUUID();
  const outputItemId =
    typeof (raw as { outputItemId?: unknown }).outputItemId === "string" ? (raw as { outputItemId: string }).outputItemId : "";
  if (!outputItemId) {
    return null;
  }

  const outputQuantity = toPositiveInt((raw as { outputQuantity?: unknown }).outputQuantity, 1);
  const inputs = normalizeRecipeInputs((raw as { inputs?: unknown }).inputs);
  if (inputs.length === 0) {
    return null;
  }

  const updatedAt = asIso((raw as { updatedAt?: unknown }).updatedAt, new Date().toISOString());
  return {
    id,
    outputItemId,
    outputQuantity,
    inputs,
    updatedAt,
  };
}

function normalizeInventoryItem(raw: unknown): WorkshopInventoryItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const itemId = typeof (raw as { itemId?: unknown }).itemId === "string" ? (raw as { itemId: string }).itemId : "";
  if (!itemId) {
    return null;
  }
  const quantity = toNonNegativeInt((raw as { quantity?: unknown }).quantity, -1);
  if (quantity < 0) {
    return null;
  }
  const updatedAt = asIso((raw as { updatedAt?: unknown }).updatedAt, new Date().toISOString());
  return {
    itemId,
    quantity,
    updatedAt,
  };
}

function normalizeWorkshopState(raw: unknown): WorkshopState {
  const entity = raw as Record<string, unknown> | undefined;
  const version = typeof entity?.version === "number" ? Math.floor(entity.version) : 0;
  const signalRule = normalizeSignalRule(entity?.signalRule);
  const iconCache = normalizeIconCache(entity?.[WORKSHOP_ICON_CACHE_KEY]);
  const itemsRaw = Array.isArray(entity?.items) ? entity?.items : [];
  const itemMap = new Map<string, WorkshopItem>();
  itemsRaw.forEach((entry, index) => {
    const item = normalizeItem(entry, index);
    itemMap.set(item.id, item);
  });

  const items = Array.from(itemMap.values()).map((item) => {
    const icon = resolveItemIconWithCache(iconCache, item.name, item.category, item.icon);
    const aliases = extractItemAliasesFromNotes(item.notes);
    aliases.forEach((alias) => cacheIconByName(iconCache, alias, icon));
    return icon === item.icon ? item : { ...item, icon };
  });
  const validItemIds = new Set(items.map((item) => item.id));

  const recipesRaw = Array.isArray(entity?.recipes) ? entity?.recipes : [];
  const recipeMap = new Map<string, WorkshopRecipe>();
  recipesRaw.forEach((entry) => {
    const recipe = normalizeRecipe(entry);
    if (!recipe) {
      return;
    }
    if (!validItemIds.has(recipe.outputItemId)) {
      return;
    }
    if (recipe.inputs.some((input) => !validItemIds.has(input.itemId))) {
      return;
    }
    recipeMap.set(recipe.id, recipe);
  });
  const recipes = Array.from(recipeMap.values());

  const pricesRaw = Array.isArray(entity?.prices) ? entity?.prices : [];
  const prices = pricesRaw
    .map((entry) =>
      normalizePriceSnapshot(entry, {
        asIso,
        toNonNegativeInt,
      }),
    )
    .filter((entry): entry is WorkshopPriceSnapshot => entry !== null)
    .filter((entry) => validItemIds.has(entry.itemId))
    .slice(-WORKSHOP_PRICE_HISTORY_LIMIT);

  const inventoryRaw = Array.isArray(entity?.inventory) ? entity?.inventory : [];
  const inventoryMap = new Map<string, WorkshopInventoryItem>();
  inventoryRaw.forEach((entry) => {
    const row = normalizeInventoryItem(entry);
    if (!row || !validItemIds.has(row.itemId)) {
      return;
    }
    inventoryMap.set(row.itemId, row);
  });

  return {
    version: version > 0 ? WORKSHOP_STATE_VERSION : WORKSHOP_STATE_VERSION,
    items,
    recipes,
    prices,
    inventory: Array.from(inventoryMap.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule,
  };
}

function removeKnownInvalidItems(state: WorkshopState): WorkshopState {
  const invalidItemIds = new Set(
    state.items.filter((item) => WORKSHOP_KNOWN_INVALID_ITEM_NAMES.has(item.name.trim())).map((item) => item.id),
  );
  if (invalidItemIds.size === 0) {
    return state;
  }
  return {
    ...state,
    items: state.items.filter((item) => !invalidItemIds.has(item.id)),
    recipes: state.recipes.filter(
      (recipe) => !invalidItemIds.has(recipe.outputItemId) && !recipe.inputs.some((input) => invalidItemIds.has(input.itemId)),
    ),
    prices: state.prices.filter((row) => !invalidItemIds.has(row.itemId)),
    inventory: state.inventory.filter((row) => !invalidItemIds.has(row.itemId)),
  };
}

function buildWorkshopStateSignature(state: WorkshopState): string {
  return JSON.stringify({
    version: state.version,
    items: state.items,
    recipes: state.recipes,
    prices: state.prices,
    inventory: state.inventory,
    signalRule: state.signalRule,
  });
}

export function writeWorkshopState(next: WorkshopState): WorkshopState {
  const currentState = normalizeWorkshopState(workshopStore.store);
  const currentIconCache = serializeIconCache(normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY)));
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const normalizedItems = next.items.map((item) => {
    const icon = resolveItemIconWithCache(iconCache, item.name, item.category, item.icon);
    const aliases = extractItemAliasesFromNotes(item.notes);
    aliases.forEach((alias) => cacheIconByName(iconCache, alias, icon));
    return icon === item.icon ? item : { ...item, icon };
  });
  const candidateState: WorkshopState = {
    version: next.version,
    items: normalizedItems,
    recipes: next.recipes,
    prices: next.prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
    inventory: [...next.inventory].sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule: normalizeSignalRule(next.signalRule),
  };
  const candidateIconCache = serializeIconCache(iconCache);

  const stateChanged = buildWorkshopStateSignature(currentState) !== buildWorkshopStateSignature(candidateState);
  const iconCacheChanged = JSON.stringify(currentIconCache) !== JSON.stringify(candidateIconCache);
  if (!stateChanged && !iconCacheChanged) {
    return currentState;
  }

  workshopStore.set("version", candidateState.version);
  workshopStore.set("items", candidateState.items);
  workshopStore.set("recipes", candidateState.recipes);
  workshopStore.set("prices", candidateState.prices);
  workshopStore.set("inventory", candidateState.inventory);
  workshopStore.set("signalRule", candidateState.signalRule);
  workshopStore.set(WORKSHOP_ICON_CACHE_KEY, candidateIconCache);
  return normalizeWorkshopState(workshopStore.store);
}

export function readWorkshopState(): WorkshopState {
  const rawVersion = workshopStore.get("version");
  const storedBuiltinCatalogSignature = workshopStore.get("builtinCatalogSignature");
  const normalized = normalizeWorkshopState(workshopStore.store);
  const cleaned = removeKnownInvalidItems(normalized);
  const currentState = cleaned === normalized ? normalized : writeWorkshopState(cleaned);
  const version = typeof rawVersion === "number" ? Math.floor(rawVersion) : 0;
  const currentBuiltinCatalogSignature = getBuiltinCatalogSignature();
  const shouldRebuildForCatalogChange =
    typeof storedBuiltinCatalogSignature !== "string" || storedBuiltinCatalogSignature !== currentBuiltinCatalogSignature;
  const shouldRebuildFromBuiltin =
    version !== WORKSHOP_STATE_VERSION ||
    currentState.items.length === 0 ||
    currentState.recipes.length === 0 ||
    shouldRebuildForCatalogChange;
  if (!shouldRebuildFromBuiltin) {
    return currentState;
  }
  const rebuilt = rebuildStateWithBuiltinCatalog(currentState, {
    stateVersion: WORKSHOP_STATE_VERSION,
    priceHistoryLimit: WORKSHOP_PRICE_HISTORY_LIMIT,
    defaultSignalRule: DEFAULT_WORKSHOP_SIGNAL_RULE,
    normalizeState: normalizeWorkshopState,
    applyDeps: {
      stateVersion: WORKSHOP_STATE_VERSION,
      loadIconCache: () => normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY)),
      resolveItemIconWithCache,
      cacheIconByName,
      normalizeState: normalizeWorkshopState,
    },
  });
  const persisted = writeWorkshopState(rebuilt);
  workshopStore.set("builtinCatalogSignature", currentBuiltinCatalogSignature);
  return persisted;
}

export function ensureItemExists(state: WorkshopState, itemId: string): void {
  if (!state.items.some((item) => item.id === itemId)) {
    throw new Error("物品不存在，请先创建物品。");
  }
}

export function sanitizeLookbackDays(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_HISTORY_DEFAULT_DAYS;
  }
  return clamp(Math.floor(raw), 1, WORKSHOP_HISTORY_MAX_DAYS);
}

export function sanitizeSignalThresholdRatio(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_SIGNAL_THRESHOLD_DEFAULT;
  }
  return clamp(raw, WORKSHOP_SIGNAL_THRESHOLD_MIN, WORKSHOP_SIGNAL_THRESHOLD_MAX);
}

function normalizeSignalRule(raw: unknown): WorkshopPriceSignalRule {
  const entity = raw as Record<string, unknown> | undefined;
  const enabled = typeof entity?.enabled === "boolean" ? entity.enabled : DEFAULT_WORKSHOP_SIGNAL_RULE.enabled;
  return {
    enabled,
    lookbackDays: sanitizeLookbackDays(entity?.lookbackDays),
    dropBelowWeekdayAverageRatio: sanitizeSignalThresholdRatio(entity?.dropBelowWeekdayAverageRatio),
  };
}

const onnxOcrRuntime = createOnnxOcrRuntime({
  confidenceScale: OCR_PADDLE_CONFIDENCE_SCALE,
  createEngine: async () =>
    ((await OcrNode.create({
      onnxOptions: {
        executionMode: "sequential",
        graphOptimizationLevel: "all",
      },
    })) as OnnxOcrEngine),
  buildOnnxOcrOutcome: (lines, language, confidenceScale) =>
    buildOnnxOcrOutcome(lines as Parameters<typeof buildOnnxOcrOutcome>[0], language, confidenceScale),
});
const paddleOcrRuntime = createPaddleOcrRuntime({
  confidenceScale: OCR_PADDLE_CONFIDENCE_SCALE,
});

async function runOnnxExtract(imagePath: string, language: string, safeMode = true): Promise<PaddleOcrOutcome> {
  return onnxOcrRuntime.runExtract(imagePath, language, safeMode);
}

async function runPaddleExtract(imagePath: string, language: string, safeMode = true): Promise<PaddleOcrOutcome> {
  return runPaddleExtractWithFallback(
    {
      imagePath,
      language,
      safeMode,
      enablePythonFallback: OCR_ENABLE_PYTHON_FALLBACK,
      confidenceScale: OCR_PADDLE_CONFIDENCE_SCALE,
    },
    {
      runOnnxExtract,
      buildPaddleLanguageCandidates,
      runPaddleWithWorker: (path, candidates, mode) => paddleOcrRuntime.runWithWorker(path, candidates, mode),
      buildPaddleCommandAttempts: (script, args) => paddleOcrRuntime.buildCommandAttempts(script, args),
      runPaddleWithCommand: (command, args, mode) => paddleOcrRuntime.runWithCommand(command, args, mode),
      parsePaddlePayload,
      pythonScript: PADDLE_OCR_PYTHON_SCRIPT,
    },
  );
}

export function cleanupWorkshopOcrEngineCore(): void {
  onnxOcrRuntime.cleanup();
  if (paddleOcrRuntime.hasActivity()) {
    paddleOcrRuntime.cleanup("应用退出");
  }
}

function cropImageToTempFile(imagePath: string, rect: WorkshopRect, scale = 1): string {
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    throw new Error(`截图无法读取: ${path.basename(imagePath)}`);
  }
  const size = image.getSize();
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > size.width ||
    rect.y + rect.height > size.height
  ) {
    throw new Error(`ROI 越界: (${rect.x},${rect.y},${rect.width},${rect.height})，截图尺寸 ${size.width}x${size.height}`);
  }
  const cropped = image.crop({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
  const resized =
    scale > 1
      ? cropped.resize({
          width: Math.max(1, Math.floor(rect.width * scale)),
          height: Math.max(1, Math.floor(rect.height * scale)),
          quality: "best",
        })
      : cropped;
  const filePath = path.join(os.tmpdir(), `aion2-ocr-roi-${Date.now()}-${randomUUID()}.png`);
  fs.writeFileSync(filePath, resized.toPNG());
  return filePath;
}

export async function extractWorkshopOcrTextCore(
  payload: WorkshopOcrExtractTextInput,
): Promise<WorkshopOcrExtractTextResult> {
  return extractWorkshopOcrTextEntry(payload, {
    resolveImportFilePath,
    sanitizeOcrLanguage,
    sanitizeOcrPsm,
    sanitizeOcrSafeMode,
    sanitizeTradeBoardPreset,
    runPaddleExtract,
    formatPaddleOcrError,
    buildPrimaryOcrTextResult,
    extractTradeBoardOcrText,
    tradeBoardDeps: {
      buildPaddleLanguageCandidates,
      cropImageToTempFile,
      cleanupTempFile,
      runPaddleExtract,
      formatPaddleOcrError,
      sanitizeOcrLineItemName,
      clamp,
      detectTradePriceRoleByHeaderText,
      stringifyOcrWords,
      nameConfidenceMin: OCR_TSV_NAME_CONFIDENCE_MIN,
      numericConfidenceMin: OCR_TSV_NUMERIC_CONFIDENCE_MIN,
    },
  });
}

export function addWorkshopPriceSnapshot(payload: AddWorkshopPriceSnapshotInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  const item = state.items.find((entry) => entry.id === payload.itemId);
  const unitPrice = toNonNegativeInt(payload.unitPrice, -1);
  if (unitPrice <= 0) {
    throw new Error("价格必须是大于 0 的整数。");
  }

  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const source = payload.source === "import" ? "import" : "manual";
  const market = sanitizePriceMarket(payload.market);
  const baselinePrices = collectBaselinePricesForItem(state.prices, payload.itemId, market, capturedAt);
  const anomaly = assessPriceAnomalyWithCategory(unitPrice, baselinePrices, item?.category ?? "other");
  let note = payload.note?.trim() || undefined;
  if (anomaly.kind === "hard") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_HARD);
  } else if (anomaly.kind === "suspect") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
  }
  const nextSnapshot: WorkshopPriceSnapshot = {
    id: randomUUID(),
    itemId: payload.itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note,
  };

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: [...state.prices, nextSnapshot].slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
  });
}

export function deleteWorkshopPriceSnapshot(snapshotId: string): WorkshopState {
  const state = readWorkshopState();
  if (!state.prices.some((entry) => entry.id === snapshotId)) {
    return state;
  }
  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: state.prices.filter((entry) => entry.id !== snapshotId),
  });
}

export async function importWorkshopOcrPricesCore(
  payload: WorkshopOcrPriceImportInput,
): Promise<WorkshopOcrPriceImportResult> {
  const state = readWorkshopState();
  const sanitized = sanitizeOcrImportPayload(payload, {
    asIso,
    clamp,
    sanitizeCategory,
  });
  const hasStructuredTradeRows = Array.isArray(sanitized.tradeRows) && sanitized.tradeRows.length > 0;
  if (!sanitized.text.trim() && !hasStructuredTradeRows) {
    throw new Error("OCR 导入内容为空，请先粘贴文本。");
  }

  const context = prepareOcrImportContext({
    sanitized,
    stateItems: state.items,
    statePrices: state.prices,
    iconCacheRaw: workshopStore.get(WORKSHOP_ICON_CACHE_KEY),
  });
  const {
    parsedLines,
    invalidLines,
    items,
    prices,
    iconCache,
    itemByLookupName,
    iconCaptureOutcome,
    iconCaptureWarnings,
  } = context;
  const applyResult = await applyParsedOcrImportLines(
    {
      parsedLines,
      sanitized,
      items,
      prices,
      iconCache,
      iconByLineNumber: iconCaptureOutcome.iconByLineNumber,
      itemByLookupName,
    },
    {
      resolveItemIconWithCache,
      isCapturedImageIcon,
      collectBaselinePricesForItem,
      assessPriceAnomalyWithCategory,
      formatAnomalyReason,
      appendNoteTag,
      suspectNoteTag: WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
      yieldEvery: WORKSHOP_OCR_IMPORT_YIELD_EVERY,
    },
  );

  const nextState = writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items,
    prices: prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
  });

  return {
    state: nextState,
    importedCount: applyResult.importedCount,
    duplicateSkippedCount: applyResult.duplicateSkippedCount,
    createdItemCount: applyResult.createdItemCount,
    parsedLineCount: parsedLines.length,
    unknownItemNames: applyResult.unknownItemNames,
    invalidLines,
    iconCapturedCount: iconCaptureOutcome.iconCapturedCount,
    iconSkippedCount: iconCaptureOutcome.iconSkippedCount,
    iconCaptureWarnings: [...iconCaptureWarnings, ...applyResult.nameCorrectionWarnings, ...applyResult.priceQualityWarnings],
    importedEntries: applyResult.importedEntries,
  };
}
