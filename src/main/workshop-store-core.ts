import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nativeImage } from "electron";
import Store from "electron-store";
import OcrNode from "@gutenye/ocr-node";
import { resolveImportFilePath } from "./workshop-store/import-file-path";
import { getBuiltinCatalogSignature, rebuildStateWithBuiltinCatalog } from "./workshop-store/catalog-bootstrap";
import {
  isAmbiguousExactOcrNameMatch,
  isExactOcrNameMatch,
  isQualifiedNameCollapsedToBaseName,
  normalizeLookupName,
  normalizeOcrDomainName,
  resolveItemByOcrName,
  resolveUniqueItemByIcon,
  sanitizeOcrLineItemName,
  shouldIgnoreOcrItemName,
  tryCorrectOcrNameByKnownItems,
} from "./workshop-store/ocr-name-matching";
import {
  buildPaddleLanguageCandidates,
  sanitizeOcrLanguage,
  sanitizeOcrPsm,
  sanitizeOcrSafeMode,
} from "./workshop-store/ocr-extract-config";
import { buildExpectedIconByLineNumber, captureOcrLineIcons } from "./workshop-store/ocr-icon-capture";
import { sanitizeTradeBoardPreset } from "./workshop-store/ocr-tradeboard-preset";
import {
  detectTradePriceRoleByHeaderText,
  normalizeNumericToken,
} from "./workshop-store/ocr-tradeboard-rows";
import {
  buildPrimaryOcrTextResult,
  formatPaddleOcrError,
} from "./workshop-store/ocr-extract-output";
import { cleanupTempFile, stringifyOcrWords } from "./workshop-store/ocr-extract-io";
import { runPaddleExtractWithFallback } from "./workshop-store/ocr-extract-runner";
import { extractWorkshopOcrTextEntry } from "./workshop-store/ocr-extract-entry";
import { extractTradeBoardOcrText } from "./workshop-store/ocr-tradeboard-extract";
import {
  parseOcrPriceLines,
  parseOcrTradeRows,
  sanitizeOcrImportPayload,
} from "./workshop-store/ocr-import-parser";
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
  WorkshopPriceMarket,
  WorkshopPriceSignalRule,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopRecipeInput,
  WorkshopState,
} from "../shared/types";

export const WORKSHOP_STATE_VERSION = 6;
export const WORKSHOP_PRICE_HISTORY_LIMIT = 8_000;
export const WORKSHOP_HISTORY_DEFAULT_DAYS = 30;
export const WORKSHOP_HISTORY_MAX_DAYS = 365;
export const WORKSHOP_SIGNAL_THRESHOLD_DEFAULT = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MIN = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MAX = 0.5;
export const WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT = 5;
export const WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS = 30;
const WORKSHOP_PRICE_ANOMALY_BASELINE_MIN_SAMPLES = 8;
const WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO = 2.2;
const WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO = 0.45;
const WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO = 8;
const WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO = 0.125;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT = 500_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD = 100_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT = 1_000_000_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD = 2_000_000_000;
const WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT = 10_000_000;
const WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD = 100_000_000;
const WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT = 10_000_000;
const WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD = 100_000_000;
export const WORKSHOP_PRICE_NOTE_TAG_SUSPECT = "qa:suspect:auto";
export const WORKSHOP_PRICE_NOTE_TAG_HARD = "qa:hard-outlier:auto";
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

export function sanitizePriceMarket(raw: unknown): WorkshopPriceMarket {
  if (raw === "server" || raw === "world" || raw === "single") {
    return raw;
  }
  return "single";
}

function sanitizeName(raw: unknown, fallback = ""): string {
  if (typeof raw !== "string") {
    return fallback;
  }
  return raw.trim();
}

type PriceAnomalyKind = "normal" | "suspect" | "hard";

interface PriceAnomalyAssessment {
  kind: PriceAnomalyKind;
  sampleCount: number;
  median: number | null;
  ratio: number | null;
  reason: string | null;
}

interface SnapshotQualityTag {
  isSuspect: boolean;
  reason: string | null;
}

export function appendNoteTag(note: string | undefined, tag: string): string {
  const current = note?.trim() ?? "";
  if (!current) {
    return tag;
  }
  const exists = current
    .split(";")
    .map((token) => token.trim())
    .some((token) => token === tag);
  if (exists) {
    return current;
  }
  return `${current};${tag}`;
}

function hasNoteTag(note: string | undefined, prefix: string): boolean {
  if (!note) {
    return false;
  }
  return note
    .split(";")
    .map((token) => token.trim())
    .some((token) => token.startsWith(prefix));
}

export function resolveSnapshotQualityTag(note: string | undefined): SnapshotQualityTag {
  if (hasNoteTag(note, "qa:hard-outlier")) {
    return {
      isSuspect: true,
      reason: "写入时已标记为极端异常价",
    };
  }
  if (hasNoteTag(note, "qa:suspect")) {
    return {
      isSuspect: true,
      reason: "写入时已标记为可疑价",
    };
  }
  return {
    isSuspect: false,
    reason: null,
  };
}

export function normalizePriceMarketForCompare(market: WorkshopPriceMarket | undefined): WorkshopPriceMarket {
  return market ?? "single";
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function assessPriceAnomaly(unitPrice: number, baselinePrices: number[]): PriceAnomalyAssessment {
  if (baselinePrices.length < WORKSHOP_PRICE_ANOMALY_BASELINE_MIN_SAMPLES) {
    return {
      kind: "normal",
      sampleCount: baselinePrices.length,
      median: null,
      ratio: null,
      reason: null,
    };
  }
  const median = computeMedian(baselinePrices);
  if (median === null || median <= 0) {
    return {
      kind: "normal",
      sampleCount: baselinePrices.length,
      median: null,
      ratio: null,
      reason: null,
    };
  }
  const ratio = unitPrice / median;
  if (ratio >= WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO) {
    return {
      kind: "hard",
      sampleCount: baselinePrices.length,
      median,
      ratio,
      reason: null,
    };
  }
  if (ratio >= WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO) {
    return {
      kind: "suspect",
      sampleCount: baselinePrices.length,
      median,
      ratio,
      reason: null,
    };
  }
  return {
    kind: "normal",
    sampleCount: baselinePrices.length,
    median,
    ratio,
    reason: null,
  };
}

function anomalyKindSeverity(kind: PriceAnomalyKind): number {
  if (kind === "hard") {
    return 2;
  }
  if (kind === "suspect") {
    return 1;
  }
  return 0;
}

function assessCategoryPriceAnomaly(unitPrice: number, category: WorkshopItemCategory): PriceAnomalyAssessment {
  const asRule = (kind: PriceAnomalyKind, reason: string): PriceAnomalyAssessment => ({
    kind,
    sampleCount: 0,
    median: null,
    ratio: null,
    reason,
  });

  if (category === "equipment") {
    if (unitPrice < WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD) {
      return asRule("hard", `低于装备最低价护栏（${WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD}）`);
    }
    if (unitPrice < WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT) {
      return asRule("suspect", `低于装备可疑阈值（${WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD) {
      return asRule("hard", `高于装备最高价护栏（${WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT) {
      return asRule("suspect", `高于装备可疑阈值（${WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  if (category === "material") {
    if (unitPrice > WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD) {
      return asRule("hard", `高于材料最高价护栏（${WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT) {
      return asRule("suspect", `高于材料可疑阈值（${WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  if (category === "component") {
    if (unitPrice > WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD) {
      return asRule("hard", `高于製作材料最高价护栏（${WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT) {
      return asRule("suspect", `高于製作材料可疑阈值（${WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  return asRule("normal", "");
}

function mergePriceAnomalyAssessment(
  baseline: PriceAnomalyAssessment,
  categoryRule: PriceAnomalyAssessment,
): PriceAnomalyAssessment {
  const baselineScore = anomalyKindSeverity(baseline.kind);
  const ruleScore = anomalyKindSeverity(categoryRule.kind);
  if (ruleScore > baselineScore) {
    return categoryRule;
  }
  if (ruleScore === baselineScore && ruleScore > 0 && categoryRule.reason && !baseline.reason) {
    return {
      ...baseline,
      reason: categoryRule.reason,
    };
  }
  return baseline;
}

export function assessPriceAnomalyWithCategory(
  unitPrice: number,
  baselinePrices: number[],
  category: WorkshopItemCategory,
): PriceAnomalyAssessment {
  const baseline = assessPriceAnomaly(unitPrice, baselinePrices);
  const categoryRule = assessCategoryPriceAnomaly(unitPrice, category);
  return mergePriceAnomalyAssessment(baseline, categoryRule);
}

export function formatAnomalyReason(assessment: PriceAnomalyAssessment): string {
  if (assessment.kind === "normal") {
    return assessment.reason ?? "";
  }
  if (assessment.reason) {
    return assessment.reason;
  }
  if (assessment.median === null || assessment.ratio === null) {
    return "";
  }
  const ratioText = `${assessment.ratio >= 1 ? "高于" : "低于"}中位数 ${assessment.ratio.toFixed(2)}x`;
  return `${ratioText}（中位数 ${Math.round(assessment.median)}，样本 ${assessment.sampleCount}）`;
}

export function collectBaselinePricesForItem(
  prices: WorkshopPriceSnapshot[],
  itemId: string,
  market: WorkshopPriceMarket | undefined,
  capturedAtIso: string,
): number[] {
  const targetMarket = normalizePriceMarketForCompare(market);
  const capturedAtMs = new Date(capturedAtIso).getTime();
  const hasValidCapturedAt = Number.isFinite(capturedAtMs);
  const lookbackWindowMs = WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS * 24 * 60 * 60 * 1000;

  return prices
    .filter((row) => row.itemId === itemId)
    .filter((row) => normalizePriceMarketForCompare(row.market) === targetMarket)
    .filter((row) => !resolveSnapshotQualityTag(row.note).isSuspect)
    .filter((row) => {
      if (!hasValidCapturedAt) {
        return true;
      }
      const rowMs = new Date(row.capturedAt).getTime();
      if (!Number.isFinite(rowMs)) {
        return false;
      }
      return rowMs <= capturedAtMs && rowMs >= capturedAtMs - lookbackWindowMs;
    })
    .map((row) => row.unitPrice);
}

function sanitizeIconToken(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const icon = raw.trim();
  return icon || undefined;
}

function isCapturedImageIcon(icon: string | undefined): boolean {
  return typeof icon === "string" && icon.startsWith("icon-img-");
}

function inferItemIcon(name: string, category: WorkshopItemCategory): string | undefined {
  if (category === "equipment") {
    return "icon-equipment";
  }
  if (category === "component") {
    return "icon-component";
  }
  const normalized = name.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("矿") || normalized.includes("礦") || normalized.includes("结晶") || normalized.includes("結晶") || normalized.includes("石")) {
    return "icon-material-ore";
  }
  if (normalized.includes("粉") || normalized.includes("碎片") || normalized.includes("核心")) {
    return "icon-material-fragment";
  }
  return category === "material" ? "icon-material" : "icon-other";
}

export function normalizeIconCache(raw: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || typeof raw !== "object") {
    return map;
  }
  Object.entries(raw as Record<string, unknown>).forEach(([rawKey, rawIcon]) => {
    const key = normalizeLookupName(rawKey);
    const icon = sanitizeIconToken(rawIcon);
    if (!key || !icon) {
      return;
    }
    map.set(key, icon);
  });
  return map;
}

function serializeIconCache(iconCache: Map<string, string>): Record<string, string> {
  const pairs = Array.from(iconCache.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  return Object.fromEntries(pairs);
}

function cacheIconByName(iconCache: Map<string, string>, name: string, icon: string | undefined): void {
  if (!icon) {
    return;
  }
  const key = normalizeLookupName(name);
  if (!key) {
    return;
  }
  iconCache.set(key, icon);
}

function extractItemAliasesFromNotes(notes?: string): string[] {
  if (!notes) {
    return [];
  }
  const match = notes.match(/別名:\s*([^;]+)/u);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(/[、,，/]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveItemIconWithCache(
  iconCache: Map<string, string>,
  name: string,
  category: WorkshopItemCategory,
  preferredIcon?: string,
): string | undefined {
  const explicitIcon = sanitizeIconToken(preferredIcon);
  if (explicitIcon) {
    cacheIconByName(iconCache, name, explicitIcon);
    return explicitIcon;
  }
  const lookup = normalizeLookupName(name);
  if (lookup) {
    const cached = iconCache.get(lookup);
    if (cached) {
      return cached;
    }
  }
  const inferred = inferItemIcon(name, category);
  cacheIconByName(iconCache, name, inferred);
  return inferred;
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

function normalizePriceSnapshot(raw: unknown): WorkshopPriceSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : randomUUID();
  const itemId = typeof (raw as { itemId?: unknown }).itemId === "string" ? (raw as { itemId: string }).itemId : "";
  if (!itemId) {
    return null;
  }

  const unitPrice = toNonNegativeInt((raw as { unitPrice?: unknown }).unitPrice, -1);
  if (unitPrice <= 0) {
    return null;
  }

  const sourceRaw = (raw as { source?: unknown }).source;
  const source = sourceRaw === "import" ? "import" : "manual";
  const market = sanitizePriceMarket((raw as { market?: unknown }).market);
  const capturedAt = asIso((raw as { capturedAt?: unknown }).capturedAt, new Date().toISOString());
  const note = sanitizeName((raw as { note?: unknown }).note) || undefined;

  return {
    id,
    itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note,
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
    .map((entry) => normalizePriceSnapshot(entry))
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

function isDuplicatePriceSnapshotByWindow(
  prices: WorkshopPriceSnapshot[],
  itemId: string,
  market: WorkshopPriceMarket | undefined,
  unitPrice: number,
  capturedAtIso: string,
  dedupeWithinSeconds: number,
): boolean {
  if (dedupeWithinSeconds <= 0) {
    return false;
  }
  const capturedAtMs = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(capturedAtMs)) {
    return false;
  }
  const dedupeWindowMs = dedupeWithinSeconds * 1000;
  for (let index = prices.length - 1; index >= 0; index -= 1) {
    const row = prices[index];
    if (row.itemId !== itemId) {
      continue;
    }
    if ((row.market ?? "single") !== (market ?? "single")) {
      continue;
    }
    if (row.unitPrice !== unitPrice) {
      continue;
    }
    const rowMs = new Date(row.capturedAt).getTime();
    if (!Number.isFinite(rowMs)) {
      continue;
    }
    if (Math.abs(capturedAtMs - rowMs) <= dedupeWindowMs) {
      return true;
    }
  }
  return false;
}

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
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

  const tradeRowsParsed = parseOcrTradeRows(sanitized.tradeRows, {
    sanitizeOcrLineItemName,
    normalizeNumericToken,
  });
  const parsedFromTradeRows = hasStructuredTradeRows;
  const { parsedLines, invalidLines } = parsedFromTradeRows
    ? tradeRowsParsed
    : parseOcrPriceLines(sanitized.text, {
        sanitizeOcrLineItemName,
        normalizeNumericToken,
      });
  const items = [...state.items];
  const prices = [...state.prices];
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const itemByLookupName = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookupName.set(normalizeLookupName(item.name), item);
  });
  const expectedIconByLineNumber = sanitized.iconCapture
    ? buildExpectedIconByLineNumber(parsedLines, itemByLookupName, {
        normalizeLookupName,
        resolveItemByOcrName,
        isCapturedImageIcon,
      })
    : undefined;
  const iconCaptureOutcome = sanitized.iconCapture
    ? captureOcrLineIcons(parsedLines, sanitized.iconCapture, expectedIconByLineNumber)
    : {
        iconByLineNumber: new Map<number, string>(),
        iconCapturedCount: 0,
        iconSkippedCount: 0,
        warnings: [] as string[],
      };
  const iconCaptureWarnings = [...sanitized.iconCaptureWarnings, ...iconCaptureOutcome.warnings];

  const unknownItemNameSet = new Set<string>();
  const importedEntries: WorkshopOcrPriceImportResult["importedEntries"] = [];
  const nameCorrectionWarnings: string[] = [];
  const priceQualityWarnings: string[] = [];
  let importedCount = 0;
  let duplicateSkippedCount = 0;
  let createdItemCount = 0;

  for (let index = 0; index < parsedLines.length; index += 1) {
    const line = parsedLines[index];
    if (shouldIgnoreOcrItemName(line.itemName)) {
      const ignoredName = normalizeOcrDomainName(line.itemName) || line.itemName;
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${ignoredName}」已忽略：閃耀前綴道具不納入導入。`);
      }
      continue;
    }
    const correctedLineName = tryCorrectOcrNameByKnownItems(line.itemName, items);
    const normalizedLineName = correctedLineName || line.itemName;
    if (normalizedLineName !== line.itemName && nameCorrectionWarnings.length < 20) {
      nameCorrectionWarnings.push(`名称纠错：${line.itemName} -> ${normalizedLineName}`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：价格无效（${line.unitPrice}）。`);
      }
      continue;
    }
    const key = normalizeLookupName(normalizedLineName);
    const capturedIcon = iconCaptureOutcome.iconByLineNumber.get(line.lineNumber);
    const exactMatchedItem = itemByLookupName.get(key);
    let item = exactMatchedItem;
    let matchedByExactName = Boolean(exactMatchedItem);
    if (!item && !sanitized.strictIconMatch) {
      item = resolveItemByOcrName(itemByLookupName, normalizedLineName);
      if (item) {
        itemByLookupName.set(key, item);
      }
    }
    const iconMatchedItem = resolveUniqueItemByIcon(items, capturedIcon);
    if (item && !matchedByExactName && !iconMatchedItem && isQualifiedNameCollapsedToBaseName(normalizedLineName, item.name)) {
      unknownItemNameSet.add(`${normalizedLineName}（限定词前缀疑似被折叠，已跳过）`);
      continue;
    }

    if (sanitized.strictIconMatch) {
      if (!capturedIcon) {
        const canFallbackByExactName =
          item !== undefined && !isCapturedImageIcon(item.icon) && isExactOcrNameMatch(item, normalizedLineName);
        if (!canFallbackByExactName) {
          unknownItemNameSet.add(`${normalizedLineName}（严格模式需开启图标抓取）`);
          continue;
        }
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${normalizedLineName}（名称与图标冲突）`);
        continue;
      }
      if (item && capturedIcon && isCapturedImageIcon(item.icon) && item.icon !== capturedIcon) {
        unknownItemNameSet.add(`${normalizedLineName}（图标不匹配）`);
        continue;
      }
      if (item && !isCapturedImageIcon(item.icon) && !isExactOcrNameMatch(item, normalizedLineName)) {
        unknownItemNameSet.add(`${normalizedLineName}（严格模式缺少图标基线）`);
        continue;
      }
      if (item && !isExactOcrNameMatch(item, normalizedLineName) && !iconMatchedItem) {
        unknownItemNameSet.add(`${normalizedLineName}（严格模式下名称不精确）`);
        continue;
      }
    } else {
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${normalizedLineName}（名称与图标冲突）`);
        continue;
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      // Only block fuzzy/heuristic matches; exact key matches should be trusted.
      if (item && !matchedByExactName && !iconMatchedItem && isAmbiguousExactOcrNameMatch(item, normalizedLineName, items)) {
        unknownItemNameSet.add(`${normalizedLineName}（名称歧义，已跳过）`);
        continue;
      }
    }

    let createdItem = false;
    if (!item) {
      if (!sanitized.autoCreateMissingItems) {
        unknownItemNameSet.add(normalizedLineName);
        continue;
      }
      const nowIso = new Date().toISOString();
      item = {
        id: randomUUID(),
        name: normalizedLineName,
        category: sanitized.defaultCategory,
        icon: resolveItemIconWithCache(iconCache, normalizedLineName, sanitized.defaultCategory, capturedIcon),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      items.push(item);
      itemByLookupName.set(key, item);
      createdItemCount += 1;
      createdItem = true;
    } else if (capturedIcon && item) {
      const currentItem = item;
      if (sanitized.strictIconMatch && isCapturedImageIcon(currentItem.icon) && currentItem.icon !== capturedIcon) {
        unknownItemNameSet.add(`${normalizedLineName}（图标不匹配）`);
        continue;
      }
      const canRefreshIcon =
        !sanitized.strictIconMatch && (matchedByExactName || (iconMatchedItem !== undefined && iconMatchedItem.id === currentItem.id));
      if (canRefreshIcon) {
        const resolvedIcon = resolveItemIconWithCache(iconCache, currentItem.name, currentItem.category, capturedIcon);
        if (resolvedIcon !== currentItem.icon) {
          const nextItem: WorkshopItem = {
            ...currentItem,
            icon: resolvedIcon,
            updatedAt: new Date().toISOString(),
          };
          const index = items.findIndex((entry) => entry.id === currentItem.id);
          if (index >= 0) {
            items[index] = nextItem;
          }
          itemByLookupName.set(key, nextItem);
          item = nextItem;
        }
      }
    }

    const anomalyBaseline = collectBaselinePricesForItem(prices, item.id, line.market, sanitized.capturedAt);
    const anomaly = assessPriceAnomalyWithCategory(line.unitPrice, anomalyBaseline, item.category);
    if (anomaly.kind === "hard") {
      unknownItemNameSet.add(`${normalizedLineName}（价格异常偏离，已自动过滤）`);
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：${formatAnomalyReason(anomaly)}`);
      }
      continue;
    }

    const duplicated = isDuplicatePriceSnapshotByWindow(
      prices,
      item.id,
      line.market,
      line.unitPrice,
      sanitized.capturedAt,
      sanitized.dedupeWithinSeconds,
    );
    if (duplicated) {
      duplicateSkippedCount += 1;
      continue;
    }
    let note = `ocr-import#${line.market}#line-${line.lineNumber}`;
    if (anomaly.kind === "suspect") {
      note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」标记可疑：${formatAnomalyReason(anomaly)}`);
      }
    }
    prices.push({
      id: randomUUID(),
      itemId: item.id,
      unitPrice: line.unitPrice,
      capturedAt: sanitized.capturedAt,
      source: sanitized.source,
      market: line.market,
      note,
    });
    importedEntries.push({
      lineNumber: line.lineNumber,
      itemId: item.id,
      itemName: item.name,
      unitPrice: line.unitPrice,
      market: line.market,
      capturedAt: sanitized.capturedAt,
      source: sanitized.source,
      createdItem,
    });
    importedCount += 1;
    if ((index + 1) % WORKSHOP_OCR_IMPORT_YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }

  const nextState = writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items,
    prices: prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
  });

  return {
    state: nextState,
    importedCount,
    duplicateSkippedCount,
    createdItemCount,
    parsedLineCount: parsedLines.length,
    unknownItemNames: Array.from(unknownItemNameSet).sort((left, right) => left.localeCompare(right, "zh-CN")),
    invalidLines,
    iconCapturedCount: iconCaptureOutcome.iconCapturedCount,
    iconSkippedCount: iconCaptureOutcome.iconSkippedCount,
    iconCaptureWarnings: [...iconCaptureWarnings, ...nameCorrectionWarnings, ...priceQualityWarnings],
    importedEntries,
  };
}
