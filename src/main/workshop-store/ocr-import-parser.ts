import type { WorkshopItemCategory, WorkshopOcrPriceImportInput, WorkshopOcrIconCaptureConfig, WorkshopPriceMarket } from "../../shared/types";

export interface ParsedOcrPriceLine {
  lineNumber: number;
  raw: string;
  itemName: string;
  unitPrice: number;
  market: WorkshopPriceMarket;
}

export interface SanitizedOcrImportPayload {
  source: "manual" | "import";
  capturedAt: string;
  dedupeWithinSeconds: number;
  autoCreateMissingItems: boolean;
  strictIconMatch: boolean;
  defaultCategory: WorkshopItemCategory;
  text: string;
  tradeRows: WorkshopOcrPriceImportInput["tradeRows"];
  iconCapture: WorkshopOcrIconCaptureConfig | null;
  iconCaptureWarnings: string[];
}

interface OcrImportSanitizerDeps {
  asIso: (raw: unknown, fallbackIso: string) => string;
  clamp: (value: number, min: number, max: number) => number;
  sanitizeCategory: (raw: unknown) => WorkshopItemCategory;
}

interface OcrLineParserDeps {
  sanitizeOcrLineItemName: (raw: string) => string;
  normalizeNumericToken: (raw: string) => number | null;
}

function parseIntLike(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  return Math.floor(raw);
}

export function sanitizeOcrImportPayload(
  payload: WorkshopOcrPriceImportInput,
  deps: OcrImportSanitizerDeps,
): SanitizedOcrImportPayload {
  const source = payload.source === "manual" ? "manual" : "import";
  const capturedAt = payload.capturedAt ? deps.asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const dedupeWithinSecondsRaw = parseIntLike(payload.dedupeWithinSeconds);
  const dedupeWithinSeconds = dedupeWithinSecondsRaw === null ? 0 : deps.clamp(dedupeWithinSecondsRaw, 0, 600);
  const autoCreateMissingItems = payload.autoCreateMissingItems ?? false;
  const strictIconMatch = false;
  const defaultCategory = deps.sanitizeCategory(payload.defaultCategory);
  const iconCaptureWarnings: string[] = [];
  if (payload.strictIconMatch === true || payload.iconCapture !== undefined) {
    iconCaptureWarnings.push("图标识别已停用，当前仅按名称识别。");
  }
  return {
    source,
    capturedAt,
    dedupeWithinSeconds,
    autoCreateMissingItems,
    strictIconMatch,
    defaultCategory,
    text: typeof payload.text === "string" ? payload.text : "",
    tradeRows: Array.isArray(payload.tradeRows) ? payload.tradeRows : undefined,
    iconCapture: null,
    iconCaptureWarnings,
  };
}

export function parseOcrPriceLines(rawText: string, deps: OcrLineParserDeps): { parsedLines: ParsedOcrPriceLine[]; invalidLines: string[] } {
  const parsedLines: ParsedOcrPriceLine[] = [];
  const invalidLines: string[] = [];
  const lines = rawText.split(/\r?\n/);

  lines.forEach((origin, index) => {
    const lineNumber = index + 1;
    const raw = origin.trim();
    if (!raw) {
      return;
    }
    const normalizedLine = raw
      .replace(/[|丨]/g, " ")
      .replace(/[，]/g, ",")
      .replace(/[：]/g, ":")
      .replace(/\s+/g, " ");
    const match = normalizedLine.match(/(-?[0-9oOlI|sSbB][0-9oOlI|sSbB,\.\s]*)$/);
    if (!match || match.index === undefined) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    let itemName = normalizedLine.slice(0, match.index).trim();
    itemName = itemName
      .replace(/[:=\-–—|]\s*$/g, "")
      .replace(/^\d+\s*[.)、:：\-]\s*/, "")
      .trim();
    itemName = deps.sanitizeOcrLineItemName(itemName);
    const unitPrice = deps.normalizeNumericToken(match[1]);
    if (!itemName || unitPrice === null) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    parsedLines.push({
      lineNumber,
      raw,
      itemName,
      unitPrice,
      market: "single",
    });
  });

  return {
    parsedLines,
    invalidLines,
  };
}

export function parseOcrTradeRows(
  tradeRows: WorkshopOcrPriceImportInput["tradeRows"],
  deps: OcrLineParserDeps,
): { parsedLines: ParsedOcrPriceLine[]; invalidLines: string[] } {
  if (!Array.isArray(tradeRows) || tradeRows.length === 0) {
    return {
      parsedLines: [],
      invalidLines: [],
    };
  }
  const parsedLines: ParsedOcrPriceLine[] = [];
  const invalidLines: string[] = [];

  tradeRows.forEach((row, index) => {
    const lineNumber = Number.isFinite(row.lineNumber) ? Math.max(1, Math.floor(row.lineNumber)) : index + 1;
    const rawName = typeof row.itemName === "string" ? row.itemName : "";
    const itemName = deps.sanitizeOcrLineItemName(rawName);
    const serverPriceRaw = String(row.serverPrice ?? "").trim();
    const worldPriceRaw = String(row.worldPrice ?? "").trim();
    const parsedServerPrice = deps.normalizeNumericToken(serverPriceRaw);
    const parsedWorldPrice = deps.normalizeNumericToken(worldPriceRaw);
    const serverPrice = parsedServerPrice !== null && parsedServerPrice > 0 ? parsedServerPrice : null;
    const worldPrice = parsedWorldPrice !== null && parsedWorldPrice > 0 ? parsedWorldPrice : null;
    if (!itemName) {
      invalidLines.push(`#${lineNumber} ${rawName || "<空名称>"}`);
      return;
    }
    if (serverPriceRaw && parsedServerPrice === null) {
      invalidLines.push(`#${lineNumber} ${itemName} <伺服器价格无效: ${serverPriceRaw}>`);
    } else if (serverPriceRaw && parsedServerPrice !== null && parsedServerPrice <= 0) {
      invalidLines.push(`#${lineNumber} ${itemName} <伺服器价格无效(<=0): ${serverPriceRaw}>`);
    }
    if (worldPriceRaw && parsedWorldPrice === null) {
      invalidLines.push(`#${lineNumber} ${itemName} <世界价格无效: ${worldPriceRaw}>`);
    } else if (worldPriceRaw && parsedWorldPrice !== null && parsedWorldPrice <= 0) {
      invalidLines.push(`#${lineNumber} ${itemName} <世界价格无效(<=0): ${worldPriceRaw}>`);
    }
    if (serverPrice === null && worldPrice === null) {
      if (!serverPriceRaw && !worldPriceRaw) {
        invalidLines.push(`#${lineNumber} ${itemName} <双价格均为空>`);
      }
      return;
    }
    if (serverPrice !== null) {
      parsedLines.push({
        lineNumber,
        raw: `${itemName} server=${serverPrice}`,
        itemName,
        unitPrice: serverPrice,
        market: "server",
      });
    }
    if (worldPrice !== null) {
      parsedLines.push({
        lineNumber,
        raw: `${itemName} world=${worldPrice}`,
        itemName,
        unitPrice: worldPrice,
        market: "world",
      });
    }
  });

  return {
    parsedLines,
    invalidLines,
  };
}
