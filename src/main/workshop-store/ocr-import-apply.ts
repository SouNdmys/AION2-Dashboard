import { randomUUID } from "node:crypto";
import type {
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopOcrImportedEntry,
  WorkshopPriceMarket,
  WorkshopPriceSnapshot,
} from "../../shared/types";
import type { ParsedOcrPriceLine, SanitizedOcrImportPayload } from "./ocr-import-parser";
import {
  isAmbiguousExactOcrNameMatch,
  isExactOcrNameMatch,
  isQualifiedNameCollapsedToBaseName,
  normalizeLookupName,
  normalizeOcrDomainName,
  resolveItemByOcrName,
  resolveUniqueItemByIcon,
  shouldIgnoreOcrItemName,
  tryCorrectOcrNameByKnownItems,
} from "./ocr-name-matching";
import { isDuplicatePriceSnapshotByWindow, yieldToEventLoop as yieldToEventLoopDefault } from "./ocr-import-runtime";

type PriceAnomalyKind = "normal" | "suspect" | "hard";

interface BasePriceAnomalyAssessment {
  kind: PriceAnomalyKind;
  reason: string | null;
}

export interface ApplyParsedOcrImportLinesInput {
  parsedLines: ParsedOcrPriceLine[];
  sanitized: SanitizedOcrImportPayload;
  items: WorkshopItem[];
  prices: WorkshopPriceSnapshot[];
  iconCache: Map<string, string>;
  iconByLineNumber: Map<number, string>;
  itemByLookupName: Map<string, WorkshopItem>;
}

export interface ApplyParsedOcrImportLinesDeps<TPriceAnomalyAssessment extends BasePriceAnomalyAssessment = BasePriceAnomalyAssessment> {
  resolveItemIconWithCache: (
    iconCache: Map<string, string>,
    name: string,
    category: WorkshopItemCategory,
    preferredIcon?: string,
  ) => string | undefined;
  isCapturedImageIcon: (icon: string | undefined) => boolean;
  collectBaselinePricesForItem: (
    prices: WorkshopPriceSnapshot[],
    itemId: string,
    market: WorkshopPriceMarket | undefined,
    capturedAtIso: string,
  ) => number[];
  assessPriceAnomalyWithCategory: (
    unitPrice: number,
    baselinePrices: number[],
    category: WorkshopItemCategory,
  ) => TPriceAnomalyAssessment;
  formatAnomalyReason: (assessment: TPriceAnomalyAssessment) => string;
  appendNoteTag: (note: string | undefined, tag: string) => string;
  suspectNoteTag: string;
  yieldEvery: number;
  createId?: () => string;
  yieldToEventLoop?: () => Promise<void>;
}

export interface ApplyParsedOcrImportLinesResult {
  importedEntries: WorkshopOcrImportedEntry[];
  importedCount: number;
  duplicateSkippedCount: number;
  createdItemCount: number;
  unknownItemNames: string[];
  nameCorrectionWarnings: string[];
  priceQualityWarnings: string[];
}

const NAME_CORRECTION_WARNING_LIMIT = 20;
const PRICE_QUALITY_WARNING_LIMIT = 40;

export async function applyParsedOcrImportLines<TPriceAnomalyAssessment extends BasePriceAnomalyAssessment>(
  input: ApplyParsedOcrImportLinesInput,
  deps: ApplyParsedOcrImportLinesDeps<TPriceAnomalyAssessment>,
): Promise<ApplyParsedOcrImportLinesResult> {
  const unknownItemNameSet = new Set<string>();
  const importedEntries: WorkshopOcrImportedEntry[] = [];
  const nameCorrectionWarnings: string[] = [];
  const priceQualityWarnings: string[] = [];
  let importedCount = 0;
  let duplicateSkippedCount = 0;
  let createdItemCount = 0;
  const createId = deps.createId ?? randomUUID;
  const yieldToEventLoop = deps.yieldToEventLoop ?? yieldToEventLoopDefault;

  for (let index = 0; index < input.parsedLines.length; index += 1) {
    const line = input.parsedLines[index];
    if (shouldIgnoreOcrItemName(line.itemName)) {
      const ignoredName = normalizeOcrDomainName(line.itemName) || line.itemName;
      if (priceQualityWarnings.length < PRICE_QUALITY_WARNING_LIMIT) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${ignoredName}」已忽略：閃耀前綴道具不納入導入。`);
      }
      continue;
    }
    const correctedLineName = tryCorrectOcrNameByKnownItems(line.itemName, input.items);
    const normalizedLineName = correctedLineName || line.itemName;
    if (normalizedLineName !== line.itemName && nameCorrectionWarnings.length < NAME_CORRECTION_WARNING_LIMIT) {
      nameCorrectionWarnings.push(`名称纠错：${line.itemName} -> ${normalizedLineName}`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
      if (priceQualityWarnings.length < PRICE_QUALITY_WARNING_LIMIT) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：价格无效（${line.unitPrice}）。`);
      }
      continue;
    }
    const key = normalizeLookupName(normalizedLineName);
    const capturedIcon = input.iconByLineNumber.get(line.lineNumber);
    const exactMatchedItem = input.itemByLookupName.get(key);
    let item = exactMatchedItem;
    const matchedByExactName = Boolean(exactMatchedItem);
    if (!item && !input.sanitized.strictIconMatch) {
      item = resolveItemByOcrName(input.itemByLookupName, normalizedLineName);
      if (item) {
        input.itemByLookupName.set(key, item);
      }
    }
    const iconMatchedItem = resolveUniqueItemByIcon(input.items, capturedIcon);
    if (
      item &&
      !matchedByExactName &&
      !iconMatchedItem &&
      isQualifiedNameCollapsedToBaseName(normalizedLineName, item.name)
    ) {
      unknownItemNameSet.add(`${normalizedLineName}（限定词前缀疑似被折叠，已跳过）`);
      continue;
    }

    if (input.sanitized.strictIconMatch) {
      if (!capturedIcon) {
        const canFallbackByExactName =
          item !== undefined && !deps.isCapturedImageIcon(item.icon) && isExactOcrNameMatch(item, normalizedLineName);
        if (!canFallbackByExactName) {
          unknownItemNameSet.add(`${normalizedLineName}（严格模式需开启图标抓取）`);
          continue;
        }
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        input.itemByLookupName.set(key, item);
      }
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${normalizedLineName}（名称与图标冲突）`);
        continue;
      }
      if (item && capturedIcon && deps.isCapturedImageIcon(item.icon) && item.icon !== capturedIcon) {
        unknownItemNameSet.add(`${normalizedLineName}（图标不匹配）`);
        continue;
      }
      if (item && !deps.isCapturedImageIcon(item.icon) && !isExactOcrNameMatch(item, normalizedLineName)) {
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
        input.itemByLookupName.set(key, item);
      }
      if (item && !matchedByExactName && !iconMatchedItem && isAmbiguousExactOcrNameMatch(item, normalizedLineName, input.items)) {
        unknownItemNameSet.add(`${normalizedLineName}（名称歧义，已跳过）`);
        continue;
      }
    }

    let createdItem = false;
    if (!item) {
      if (!input.sanitized.autoCreateMissingItems) {
        unknownItemNameSet.add(normalizedLineName);
        continue;
      }
      const nowIso = new Date().toISOString();
      item = {
        id: createId(),
        name: normalizedLineName,
        category: input.sanitized.defaultCategory,
        icon: deps.resolveItemIconWithCache(
          input.iconCache,
          normalizedLineName,
          input.sanitized.defaultCategory,
          capturedIcon,
        ),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      input.items.push(item);
      input.itemByLookupName.set(key, item);
      createdItemCount += 1;
      createdItem = true;
    } else if (capturedIcon) {
      const currentItem = item;
      if (input.sanitized.strictIconMatch && deps.isCapturedImageIcon(currentItem.icon) && currentItem.icon !== capturedIcon) {
        unknownItemNameSet.add(`${normalizedLineName}（图标不匹配）`);
        continue;
      }
      const canRefreshIcon =
        !input.sanitized.strictIconMatch &&
        (matchedByExactName || (iconMatchedItem !== undefined && iconMatchedItem.id === currentItem.id));
      if (canRefreshIcon) {
        const resolvedIcon = deps.resolveItemIconWithCache(
          input.iconCache,
          currentItem.name,
          currentItem.category,
          capturedIcon,
        );
        if (resolvedIcon !== currentItem.icon) {
          const nextItem: WorkshopItem = {
            ...currentItem,
            icon: resolvedIcon,
            updatedAt: new Date().toISOString(),
          };
          const itemIndex = input.items.findIndex((entry) => entry.id === currentItem.id);
          if (itemIndex >= 0) {
            input.items[itemIndex] = nextItem;
          }
          input.itemByLookupName.set(key, nextItem);
          item = nextItem;
        }
      }
    }

    const anomalyBaseline = deps.collectBaselinePricesForItem(input.prices, item.id, line.market, input.sanitized.capturedAt);
    const anomaly = deps.assessPriceAnomalyWithCategory(line.unitPrice, anomalyBaseline, item.category);
    if (anomaly.kind === "hard") {
      unknownItemNameSet.add(`${normalizedLineName}（价格异常偏离，已自动过滤）`);
      if (priceQualityWarnings.length < PRICE_QUALITY_WARNING_LIMIT) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：${deps.formatAnomalyReason(anomaly)}`);
      }
      continue;
    }

    const duplicated = isDuplicatePriceSnapshotByWindow(
      input.prices,
      item.id,
      line.market,
      line.unitPrice,
      input.sanitized.capturedAt,
      input.sanitized.dedupeWithinSeconds,
    );
    if (duplicated) {
      duplicateSkippedCount += 1;
      continue;
    }
    let note = `ocr-import#${line.market}#line-${line.lineNumber}`;
    if (anomaly.kind === "suspect") {
      note = deps.appendNoteTag(note, deps.suspectNoteTag);
      if (priceQualityWarnings.length < PRICE_QUALITY_WARNING_LIMIT) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」标记可疑：${deps.formatAnomalyReason(anomaly)}`);
      }
    }
    input.prices.push({
      id: createId(),
      itemId: item.id,
      unitPrice: line.unitPrice,
      capturedAt: input.sanitized.capturedAt,
      source: input.sanitized.source,
      market: line.market,
      note,
    });
    importedEntries.push({
      lineNumber: line.lineNumber,
      itemId: item.id,
      itemName: item.name,
      unitPrice: line.unitPrice,
      market: line.market,
      capturedAt: input.sanitized.capturedAt,
      source: input.sanitized.source,
      createdItem,
    });
    importedCount += 1;
    if (deps.yieldEvery > 0 && (index + 1) % deps.yieldEvery === 0) {
      await yieldToEventLoop();
    }
  }

  return {
    importedEntries,
    importedCount,
    duplicateSkippedCount,
    createdItemCount,
    unknownItemNames: Array.from(unknownItemNameSet).sort((left, right) => left.localeCompare(right, "zh-CN")),
    nameCorrectionWarnings,
    priceQualityWarnings,
  };
}
