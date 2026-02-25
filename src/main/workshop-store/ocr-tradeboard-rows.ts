import { estimateOcrRowCount, groupOcrWordsByRow } from "./ocr-row-grouping";
import type { OcrTsvWord } from "./ocr-paddle-payload";

type ClampFn = (value: number, min: number, max: number) => number;
type SanitizeNameFn = (raw: string) => string;

export interface ResolveTradeBoardRowCountDeps {
  sanitizeOcrLineItemName: SanitizeNameFn;
  clamp: ClampFn;
}

export interface BuildNameRowsDeps extends ResolveTradeBoardRowCountDeps {
  nameConfidenceMin: number;
}

export interface BuildPriceRowsDeps {
  clamp: ClampFn;
  numericConfidenceMin: number;
}

export type TradePriceColumn = "left" | "right";

export function normalizeNumericToken(raw: string): number | null {
  const normalized = raw
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[，、]/g, ",")
    .replace(/[。．]/g, ".")
    .replace(/[,\.\s]/g, "")
    .replace(/[oO〇○]/g, "0")
    .replace(/[lI|!]/g, "1")
    .replace(/[zZ]/g, "2")
    .replace(/[sS$]/g, "5")
    .replace(/[gG]/g, "6")
    .replace(/[bB]/g, "8")
    .replace(/[qQ]/g, "9")
    .replace(/[^0-9]/g, "");
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.floor(num);
}

export function parsePriceFromLine(line: string, column: TradePriceColumn): number | null {
  const matches = Array.from(line.matchAll(/([0-9０-９oOlI|!sSbB$zZgGqQ〇○][0-9０-９oOlI|!sSbB$zZgGqQ〇○,\.\s，。．、]*)/g)).map(
    (entry) => entry[1] ?? "",
  );
  if (matches.length === 0) {
    return null;
  }
  const picked = column === "right" ? matches[matches.length - 1] : matches[0];
  return normalizeNumericToken(picked);
}

export function parseNonEmptyLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function resolveTradeBoardRowCount(
  configuredRowCount: number,
  nameWords: OcrTsvWord[],
  nameRawText: string,
  warnings: string[],
  deps: ResolveTradeBoardRowCountDeps,
): number {
  if (configuredRowCount > 0) {
    return configuredRowCount;
  }
  const fromWords = estimateOcrRowCount(nameWords, {
    sanitizeName: deps.sanitizeOcrLineItemName,
    clamp: deps.clamp,
  });
  const fallbackLineCount = deps.clamp(parseNonEmptyLines(nameRawText).length, 0, 30);
  const candidates: number[] = [];
  if (fromWords !== null && fromWords > 0) {
    candidates.push(fromWords);
  }
  if (fallbackLineCount > 0) {
    candidates.push(fallbackLineCount);
  }
  const resolved = candidates.length > 0 ? deps.clamp(Math.max(...candidates), 1, 30) : 7;
  warnings.push(`交易行可见行数自动识别：${resolved} 行（词框=${fromWords ?? "--"}，文本行=${fallbackLineCount || "--"}）。`);
  return resolved;
}

export function buildNameRowsFromWords(
  words: OcrTsvWord[],
  rowCount: number,
  totalHeight: number,
  deps: BuildNameRowsDeps,
): Array<string | null> {
  const rows = groupOcrWordsByRow(words, rowCount, totalHeight, deps.clamp);
  return rows.map((row) => {
    const confidentWords = row.filter((word) => word.confidence < 0 || word.confidence >= deps.nameConfidenceMin);
    const effectiveWords = confidentWords.length > 0 ? confidentWords : row;
    const text = effectiveWords
      .map((word) => deps.sanitizeOcrLineItemName(word.text).replace(/\s+/g, ""))
      .filter(Boolean)
      .join("")
      .trim();
    return text || null;
  });
}

export function buildPriceRowsFromWords(
  words: OcrTsvWord[],
  rowCount: number,
  column: TradePriceColumn,
  rowWarnings: string[],
  deps: BuildPriceRowsDeps,
): Array<number | null> {
  const numericWordsRaw = words
    .map((word) => ({
      ...word,
      value: normalizeNumericToken(word.text),
    }))
    .filter((entry): entry is OcrTsvWord & { value: number } => entry.value !== null);
  const confidentNumericWords = numericWordsRaw.filter(
    (entry) => entry.confidence < 0 || entry.confidence >= deps.numericConfidenceMin,
  );
  const numericWords = confidentNumericWords.length > 0 ? confidentNumericWords : numericWordsRaw;
  if (numericWords.length === 0) {
    return Array.from({ length: rowCount }, (_, index) => {
      rowWarnings.push(`第 ${index + 1} 行价格解析失败（词框无数字词）。`);
      return null;
    });
  }

  let minTop = Number.POSITIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;
  numericWords.forEach((word) => {
    minTop = Math.min(minTop, word.top);
    maxBottom = Math.max(maxBottom, word.top + word.height);
  });
  const distributionHeight = Math.max(1, maxBottom - minTop);
  const rowSpanPadding = Math.floor(distributionHeight * 0.06);
  const spanTop = Math.max(0, minTop - rowSpanPadding);
  const spanBottom = maxBottom + rowSpanPadding;
  const rows = groupOcrWordsByRow(numericWords, rowCount, Math.max(1, spanBottom - spanTop), deps.clamp, spanTop);
  return rows.map((row, index) => {
    if (row.length === 0) {
      rowWarnings.push(`第 ${index + 1} 行价格解析失败（词框无数字词）。`);
      return null;
    }
    row.sort((left, right) => left.left - right.left);
    const picked = column === "right" ? row[row.length - 1] : row[0];
    return picked.value;
  });
}

export function detectTradePriceRoleByHeaderText(rawText: string): "server" | "world" | null {
  const normalized = rawText
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .toLocaleLowerCase();
  if (!normalized) {
    return null;
  }
  const worldHints = ["世界", "world"];
  const serverHints = ["伺服器", "服务器", "本服", "server"];
  const worldHit = worldHints.some((hint) => normalized.includes(hint));
  const serverHit = serverHints.some((hint) => normalized.includes(hint));

  if (worldHit && serverHit) {
    return null;
  }
  if (worldHit) {
    return "world";
  }
  if (serverHit) {
    return "server";
  }
  return null;
}
