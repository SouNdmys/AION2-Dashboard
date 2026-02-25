import type { WorkshopItem, WorkshopPriceSnapshot } from "../../shared/types";
import { isCapturedImageIcon, normalizeIconCache } from "./icon-cache";
import { buildExpectedIconByLineNumber, captureOcrLineIcons } from "./ocr-icon-capture";
import {
  parseOcrPriceLines,
  parseOcrTradeRows,
  type ParsedOcrPriceLine,
  type SanitizedOcrImportPayload,
} from "./ocr-import-parser";
import { normalizeLookupName, resolveItemByOcrName, sanitizeOcrLineItemName } from "./ocr-name-matching";
import { normalizeNumericToken } from "./ocr-tradeboard-rows";

export interface OcrImportIconCaptureOutcome {
  iconByLineNumber: Map<number, string>;
  iconCapturedCount: number;
  iconSkippedCount: number;
  warnings: string[];
}

export interface PrepareOcrImportContextInput {
  sanitized: SanitizedOcrImportPayload;
  stateItems: WorkshopItem[];
  statePrices: WorkshopPriceSnapshot[];
  iconCacheRaw: unknown;
}

export interface PrepareOcrImportContextResult {
  parsedLines: ParsedOcrPriceLine[];
  invalidLines: string[];
  items: WorkshopItem[];
  prices: WorkshopPriceSnapshot[];
  iconCache: Map<string, string>;
  itemByLookupName: Map<string, WorkshopItem>;
  iconCaptureOutcome: OcrImportIconCaptureOutcome;
  iconCaptureWarnings: string[];
}

export function prepareOcrImportContext(input: PrepareOcrImportContextInput): PrepareOcrImportContextResult {
  const hasStructuredTradeRows = Array.isArray(input.sanitized.tradeRows) && input.sanitized.tradeRows.length > 0;
  const tradeRowsParsed = parseOcrTradeRows(input.sanitized.tradeRows, {
    sanitizeOcrLineItemName,
    normalizeNumericToken,
  });
  const parsedFromTradeRows = hasStructuredTradeRows;
  const { parsedLines, invalidLines } = parsedFromTradeRows
    ? tradeRowsParsed
    : parseOcrPriceLines(input.sanitized.text, {
        sanitizeOcrLineItemName,
        normalizeNumericToken,
      });

  const items = [...input.stateItems];
  const prices = [...input.statePrices];
  const iconCache = normalizeIconCache(input.iconCacheRaw);
  const itemByLookupName = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookupName.set(normalizeLookupName(item.name), item);
  });
  const expectedIconByLineNumber = input.sanitized.iconCapture
    ? buildExpectedIconByLineNumber(parsedLines, itemByLookupName, {
        normalizeLookupName,
        resolveItemByOcrName,
        isCapturedImageIcon,
      })
    : undefined;
  const iconCaptureOutcome = input.sanitized.iconCapture
    ? captureOcrLineIcons(parsedLines, input.sanitized.iconCapture, expectedIconByLineNumber)
    : {
        iconByLineNumber: new Map<number, string>(),
        iconCapturedCount: 0,
        iconSkippedCount: 0,
        warnings: [] as string[],
      };
  const iconCaptureWarnings = [...input.sanitized.iconCaptureWarnings, ...iconCaptureOutcome.warnings];

  return {
    parsedLines,
    invalidLines,
    items,
    prices,
    iconCache,
    itemByLookupName,
    iconCaptureOutcome,
    iconCaptureWarnings,
  };
}
