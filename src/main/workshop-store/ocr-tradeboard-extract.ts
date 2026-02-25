import type { WorkshopOcrExtractTextResult, WorkshopTradeBoardPreset } from "../../shared/types";
import { buildTradeBoardNameRows as buildTradeBoardNameRowsDefault } from "./ocr-tradeboard-names";
import { resolveTradeBoardPriceRows as resolveTradeBoardPriceRowsDefault } from "./ocr-tradeboard-price-resolution";
import {
  buildTradeBoardPrimaryTextLines as buildTradeBoardPrimaryTextLinesDefault,
  buildTradeBoardRawText as buildTradeBoardRawTextDefault,
  buildTradeRows as buildTradeRowsDefault,
} from "./ocr-tradeboard-orchestration";
import type { OcrTsvWord, PaddleOcrOutcome } from "./ocr-paddle-payload";

type TradePriceRole = "server" | "world";

export interface ExtractTradeBoardOcrTextInput {
  imagePath: string;
  language: string;
  psm: number;
  safeMode: boolean;
  tradeBoardPreset: WorkshopTradeBoardPreset;
  warnings: string[];
}

export interface ExtractTradeBoardOcrTextDeps {
  buildPaddleLanguageCandidates: (language: string) => string[];
  cropImageToTempFile: (imagePath: string, rect: WorkshopTradeBoardPreset["namesRect"], scale?: number) => string;
  cleanupTempFile: (filePath: string | null) => void;
  runPaddleExtract: (imagePath: string, language: string, safeMode?: boolean) => Promise<PaddleOcrOutcome>;
  formatPaddleOcrError: (raw: string | undefined) => string;
  sanitizeOcrLineItemName: (raw: string) => string;
  clamp: (value: number, min: number, max: number) => number;
  detectTradePriceRoleByHeaderText: (rawText: string) => TradePriceRole | null;
  stringifyOcrWords: (words: OcrTsvWord[]) => string;
  nameConfidenceMin: number;
  numericConfidenceMin: number;
  buildTradeBoardNameRows?: typeof buildTradeBoardNameRowsDefault;
  resolveTradeBoardPriceRows?: typeof resolveTradeBoardPriceRowsDefault;
  buildTradeRows?: typeof buildTradeRowsDefault;
  buildTradeBoardPrimaryTextLines?: typeof buildTradeBoardPrimaryTextLinesDefault;
  buildTradeBoardRawText?: typeof buildTradeBoardRawTextDefault;
}

export async function extractTradeBoardOcrText(
  input: ExtractTradeBoardOcrTextInput,
  deps: ExtractTradeBoardOcrTextDeps,
): Promise<WorkshopOcrExtractTextResult> {
  let namesTempPath: string | null = null;
  try {
    const buildTradeBoardNameRows = deps.buildTradeBoardNameRows ?? buildTradeBoardNameRowsDefault;
    const resolveTradeBoardPriceRows = deps.resolveTradeBoardPriceRows ?? resolveTradeBoardPriceRowsDefault;
    const buildTradeRows = deps.buildTradeRows ?? buildTradeRowsDefault;
    const buildTradeBoardPrimaryTextLines = deps.buildTradeBoardPrimaryTextLines ?? buildTradeBoardPrimaryTextLinesDefault;
    const buildTradeBoardRawText = deps.buildTradeBoardRawText ?? buildTradeBoardRawTextDefault;

    const namesLanguage = deps.buildPaddleLanguageCandidates(input.language).join("+");
    const namesScale = 3;
    const pricesScale = 2;
    namesTempPath = deps.cropImageToTempFile(input.imagePath, input.tradeBoardPreset.namesRect, namesScale);
    const namesExtract = await deps.runPaddleExtract(namesTempPath, namesLanguage, input.safeMode);
    if (!namesExtract.ok) {
      throw new Error(`名称区 OCR 失败：${deps.formatPaddleOcrError(namesExtract.errorMessage)}`);
    }

    const { effectiveRowCount, nameRows } = buildTradeBoardNameRows(
      {
        namesWords: namesExtract.words,
        namesRawText: namesExtract.rawText,
        expectedRowCount: input.tradeBoardPreset.rowCount,
        namesRectHeight: input.tradeBoardPreset.namesRect.height,
        namesScale,
        warnings: input.warnings,
      },
      {
        sanitizeOcrLineItemName: deps.sanitizeOcrLineItemName,
        clamp: deps.clamp,
        nameConfidenceMin: deps.nameConfidenceMin,
      },
    );

    const {
      leftValues,
      rightValues,
      rawPriceSection,
      rawPriceTsvSection,
      pricesEngine,
      effectiveLeftRole,
      effectiveRightRole,
    } = await resolveTradeBoardPriceRows(
      {
        imagePath: input.imagePath,
        pricesRect: input.tradeBoardPreset.pricesRect,
        effectiveRowCount,
        pricesScale,
        namesLanguage,
        safeMode: input.safeMode,
        priceMode: input.tradeBoardPreset.priceMode === "dual" ? "dual" : "single",
        priceColumn: input.tradeBoardPreset.priceColumn === "right" ? "right" : "left",
        fallbackLeftRole: input.tradeBoardPreset.leftPriceRole === "world" ? "world" : "server",
        fallbackRightRole: input.tradeBoardPreset.rightPriceRole === "server" ? "server" : "world",
        warnings: input.warnings,
      },
      {
        clamp: deps.clamp,
        numericConfidenceMin: deps.numericConfidenceMin,
        cropImageToTempFile: deps.cropImageToTempFile,
        cleanupTempFile: deps.cleanupTempFile,
        runPaddleExtract: deps.runPaddleExtract,
        stringifyOcrWords: deps.stringifyOcrWords,
        detectTradePriceRoleByHeaderText: deps.detectTradePriceRoleByHeaderText,
      },
    );

    const tradeRows = buildTradeRows({
      effectiveRowCount,
      nameRows,
      leftValues,
      rightValues,
      effectiveLeftRole,
      effectiveRightRole,
    });
    const textLines = buildTradeBoardPrimaryTextLines({
      tradeRows,
      priceColumn: input.tradeBoardPreset.priceColumn,
      effectiveLeftRole,
      effectiveRightRole,
    });
    if (tradeRows.length < effectiveRowCount) {
      input.warnings.push(`识别行不足：有效行 ${tradeRows.length}/${effectiveRowCount}。`);
    }
    const text = textLines.join("\n");

    return {
      rawText: buildTradeBoardRawText({
        namesRawText: namesExtract.rawText,
        rawPriceSection,
        namesWords: namesExtract.words,
        rawPriceTsvSection,
        stringifyOcrWords: deps.stringifyOcrWords,
      }),
      text,
      lineCount: tradeRows.length,
      warnings: input.warnings,
      engine: `onnx-ocr(names=${namesExtract.language || namesLanguage}, prices=${pricesEngine}, psm=${input.psm}, trade-board-roi)`,
      tradeRows,
    };
  } finally {
    deps.cleanupTempFile(namesTempPath);
  }
}
