import type { WorkshopRect } from "../../shared/types";
import { buildPriceRowsFromWords, parseNonEmptyLines, parsePriceFromLine, type TradePriceColumn } from "./ocr-tradeboard-rows";
import type { OcrTsvWord, PaddleOcrOutcome } from "./ocr-paddle-payload";

type ClampFn = (value: number, min: number, max: number) => number;

export interface PriceRowsOcrOutcome {
  values: Array<number | null>;
  rawText: string;
  tsvText: string;
  engine: string;
}

export interface DualPriceRowsOcrOutcome {
  leftValues: Array<number | null>;
  rightValues: Array<number | null>;
  rawText: string;
  tsvText: string;
  engine: string;
}

export interface TradeBoardPriceExtractDeps {
  clamp: ClampFn;
  numericConfidenceMin: number;
  cropImageToTempFile: (imagePath: string, rect: WorkshopRect, scale?: number) => string;
  cleanupTempFile: (filePath: string | null) => void;
  runPaddleExtract: (imagePath: string, language: string, safeMode: boolean) => Promise<PaddleOcrOutcome>;
  stringifyOcrWords: (words: OcrTsvWord[]) => string;
}

export async function extractPriceRowsForRect(
  imagePath: string,
  rect: WorkshopRect,
  rowCount: number,
  scale: number,
  safeMode: boolean,
  column: TradePriceColumn,
  warnings: string[],
  warningPrefix: string,
  deps: TradeBoardPriceExtractDeps,
): Promise<PriceRowsOcrOutcome> {
  const tempPath = deps.cropImageToTempFile(imagePath, rect, scale);
  try {
    const extract = await deps.runPaddleExtract(tempPath, "en", safeMode);
    if (!extract.ok) {
      throw new Error(`${warningPrefix}OCR 失败：${extract.errorMessage ?? "未知错误"}`);
    }
    const rowsFromWordsWarnings: string[] = [];
    const rowsFromWords = buildPriceRowsFromWords(extract.words, rowCount, column, rowsFromWordsWarnings, {
      clamp: deps.clamp,
      numericConfidenceMin: deps.numericConfidenceMin,
    });
    const fallbackWarnings: string[] = [];
    const fallbackRows = parseNonEmptyLines(extract.rawText)
      .slice(0, rowCount)
      .map((line, index) => {
        const parsed = parsePriceFromLine(line, column);
        if (parsed === null) {
          fallbackWarnings.push(`${warningPrefix}第 ${index + 1} 行价格解析失败：${line}`);
          return null;
        }
        return parsed;
      });
    const wordsValid = rowsFromWords.filter((entry): entry is number => entry !== null).length;
    const fallbackValid = fallbackRows.filter((entry): entry is number => entry !== null).length;
    const values = wordsValid >= fallbackValid ? rowsFromWords : fallbackRows;
    if (wordsValid < fallbackValid) {
      warnings.push(`${warningPrefix}词框结果不足，已回退到普通文本行解析。`);
      warnings.push(...fallbackWarnings);
    } else {
      warnings.push(...rowsFromWordsWarnings);
    }
    return {
      values,
      rawText: extract.rawText,
      tsvText: deps.stringifyOcrWords(extract.words),
      engine: `onnx-ocr(${extract.language || "auto"})`,
    };
  } finally {
    deps.cleanupTempFile(tempPath);
  }
}

export async function extractDualPriceRowsForRect(
  imagePath: string,
  rect: WorkshopRect,
  rowCount: number,
  scale: number,
  safeMode: boolean,
  warnings: string[],
  deps: TradeBoardPriceExtractDeps,
): Promise<DualPriceRowsOcrOutcome> {
  let fastModeError: string | null = null;
  const tempPath = deps.cropImageToTempFile(imagePath, rect, scale);
  try {
    const extract = await deps.runPaddleExtract(tempPath, "en", safeMode);
    if (!extract.ok) {
      throw new Error(extract.errorMessage ?? "未知错误");
    }

    const splitX = Math.floor((rect.width * scale) / 2);
    const leftWords = extract.words.filter((word) => word.left + word.width / 2 <= splitX);
    const rightWords = extract.words.filter((word) => word.left + word.width / 2 > splitX);
    const leftWarnings: string[] = [];
    const rightWarnings: string[] = [];
    const leftValues = buildPriceRowsFromWords(leftWords, rowCount, "left", leftWarnings, {
      clamp: deps.clamp,
      numericConfidenceMin: deps.numericConfidenceMin,
    });
    const rightValues = buildPriceRowsFromWords(rightWords, rowCount, "left", rightWarnings, {
      clamp: deps.clamp,
      numericConfidenceMin: deps.numericConfidenceMin,
    });
    const leftValid = leftValues.filter((entry): entry is number => entry !== null).length;
    const rightValid = rightValues.filter((entry): entry is number => entry !== null).length;
    const minValid = Math.max(2, Math.floor(rowCount * 0.5));

    if (leftValid >= minValid && rightValid >= minValid) {
      leftWarnings.forEach((line) => warnings.push(`左列价格：${line}`));
      rightWarnings.forEach((line) => warnings.push(`右列价格：${line}`));
      return {
        leftValues,
        rightValues,
        rawText: extract.rawText,
        tsvText: deps.stringifyOcrWords(extract.words),
        engine: `onnx-ocr(${extract.language || "auto"}, dual-split)`,
      };
    }

    warnings.push("双列价格快速解析不足，已回退到双区块 OCR。");
  } catch (err) {
    fastModeError = err instanceof Error ? err.message : "未知错误";
  } finally {
    deps.cleanupTempFile(tempPath);
  }

  if (fastModeError) {
    warnings.push(`双列价格快速解析失败，已回退到双区块 OCR：${fastModeError}`);
  }

  const leftWidth = Math.max(1, Math.floor(rect.width / 2));
  const rightWidth = Math.max(1, rect.width - leftWidth);
  const leftRect: WorkshopRect = {
    x: rect.x,
    y: rect.y,
    width: leftWidth,
    height: rect.height,
  };
  const rightRect: WorkshopRect = {
    x: rect.x + leftWidth,
    y: rect.y,
    width: rightWidth,
    height: rect.height,
  };
  const [leftOutcome, rightOutcome] = await Promise.all([
    extractPriceRowsForRect(imagePath, leftRect, rowCount, scale, safeMode, "left", warnings, "左列价格：", deps),
    extractPriceRowsForRect(imagePath, rightRect, rowCount, scale, safeMode, "left", warnings, "右列价格：", deps),
  ]);
  return {
    leftValues: leftOutcome.values,
    rightValues: rightOutcome.values,
    rawText: `${leftOutcome.rawText}\n\n---RIGHT_PRICE---\n\n${rightOutcome.rawText}`,
    tsvText: `${leftOutcome.tsvText}\n\n---RIGHT_PRICE_WORDS---\n\n${rightOutcome.tsvText}`,
    engine: `left=${leftOutcome.engine}, right=${rightOutcome.engine}`,
  };
}
