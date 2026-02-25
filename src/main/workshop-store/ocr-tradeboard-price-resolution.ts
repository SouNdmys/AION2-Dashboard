import type { WorkshopRect } from "../../shared/types";
import type { OcrTsvWord, PaddleOcrOutcome } from "./ocr-paddle-payload";
import {
  extractDualPriceRowsForRect as extractDualPriceRowsForRectDefault,
  extractPriceRowsForRect as extractPriceRowsForRectDefault,
  type DualPriceRowsOcrOutcome,
  type PriceRowsOcrOutcome,
  type TradeBoardPriceExtractDeps,
} from "./ocr-tradeboard-prices";
import { resolveDualPriceRolesByHeader as resolveDualPriceRolesByHeaderDefault } from "./ocr-tradeboard-orchestration";

type TradePriceRole = "server" | "world";

interface ResolveTradeBoardPriceRowsInput {
  imagePath: string;
  pricesRect: WorkshopRect;
  effectiveRowCount: number;
  pricesScale: number;
  namesLanguage: string;
  safeMode: boolean;
  priceMode: "single" | "dual";
  priceColumn: "left" | "right";
  fallbackLeftRole: TradePriceRole;
  fallbackRightRole: TradePriceRole;
  warnings: string[];
}

interface ResolveTradeBoardPriceRowsDeps {
  clamp: (value: number, min: number, max: number) => number;
  numericConfidenceMin: number;
  cropImageToTempFile: (imagePath: string, rect: WorkshopRect, scale?: number) => string;
  cleanupTempFile: (filePath: string | null) => void;
  runPaddleExtract: (imagePath: string, language: string, safeMode?: boolean) => Promise<PaddleOcrOutcome>;
  stringifyOcrWords: (words: OcrTsvWord[]) => string;
  detectTradePriceRoleByHeaderText: (rawText: string) => TradePriceRole | null;
  resolveDualPriceRolesByHeader?: typeof resolveDualPriceRolesByHeaderDefault;
  extractDualPriceRowsForRect?: (
    imagePath: string,
    rect: WorkshopRect,
    rowCount: number,
    scale: number,
    safeMode: boolean,
    warnings: string[],
    deps: TradeBoardPriceExtractDeps,
  ) => Promise<DualPriceRowsOcrOutcome>;
  extractPriceRowsForRect?: (
    imagePath: string,
    rect: WorkshopRect,
    rowCount: number,
    scale: number,
    safeMode: boolean,
    column: "left" | "right",
    warnings: string[],
    warningPrefix: string,
    deps: TradeBoardPriceExtractDeps,
  ) => Promise<PriceRowsOcrOutcome>;
}

interface ResolveTradeBoardPriceRowsResult {
  leftValues: Array<number | null>;
  rightValues: Array<number | null>;
  rawPriceSection: string;
  rawPriceTsvSection: string;
  pricesEngine: string;
  effectiveLeftRole: TradePriceRole;
  effectiveRightRole: TradePriceRole;
}

export async function resolveTradeBoardPriceRows(
  input: ResolveTradeBoardPriceRowsInput,
  deps: ResolveTradeBoardPriceRowsDeps,
): Promise<ResolveTradeBoardPriceRowsResult> {
  const tradeBoardPriceExtractDeps: TradeBoardPriceExtractDeps = {
    clamp: deps.clamp,
    numericConfidenceMin: deps.numericConfidenceMin,
    cropImageToTempFile: deps.cropImageToTempFile,
    cleanupTempFile: deps.cleanupTempFile,
    runPaddleExtract: async (imagePath, language, safeMode) => deps.runPaddleExtract(imagePath, language, safeMode),
    stringifyOcrWords: deps.stringifyOcrWords,
  };

  const resolveDualPriceRolesByHeader = deps.resolveDualPriceRolesByHeader ?? resolveDualPriceRolesByHeaderDefault;
  const extractDualPriceRowsForRect = deps.extractDualPriceRowsForRect ?? extractDualPriceRowsForRectDefault;
  const extractPriceRowsForRect = deps.extractPriceRowsForRect ?? extractPriceRowsForRectDefault;

  let leftValues: Array<number | null> = [];
  let rightValues: Array<number | null> = [];
  let rawPriceSection = "";
  let rawPriceTsvSection = "";
  let effectiveLeftRole: TradePriceRole = input.fallbackLeftRole;
  let effectiveRightRole: TradePriceRole = input.fallbackRightRole;
  let pricesEngine = "";

  if (input.priceMode === "dual") {
    const detectedRoles = await resolveDualPriceRolesByHeader(
      {
        imagePath: input.imagePath,
        pricesRect: input.pricesRect,
        headerLanguage: input.namesLanguage,
        safeMode: input.safeMode,
        fallbackLeftRole: effectiveLeftRole,
        fallbackRightRole: effectiveRightRole,
        warnings: input.warnings,
      },
      {
        clamp: deps.clamp,
        cropImageToTempFile: deps.cropImageToTempFile,
        cleanupTempFile: deps.cleanupTempFile,
        runPaddleExtract: async (imagePath, language, safeMode) => deps.runPaddleExtract(imagePath, language, safeMode),
        detectTradePriceRoleByHeaderText: deps.detectTradePriceRoleByHeaderText,
      },
    );
    effectiveLeftRole = detectedRoles.leftRole;
    effectiveRightRole = detectedRoles.rightRole;
    const dualOutcome = await extractDualPriceRowsForRect(
      input.imagePath,
      input.pricesRect,
      input.effectiveRowCount,
      input.pricesScale,
      input.safeMode,
      input.warnings,
      tradeBoardPriceExtractDeps,
    );
    leftValues = dualOutcome.leftValues;
    rightValues = dualOutcome.rightValues;
    rawPriceSection = dualOutcome.rawText;
    rawPriceTsvSection = dualOutcome.tsvText;
    pricesEngine = dualOutcome.engine;
    input.warnings.push(
      `双价格列角色：左列=${effectiveLeftRole === "server" ? "伺服器" : "世界"}，右列=${
        effectiveRightRole === "server" ? "伺服器" : "世界"
      }。`,
    );
  } else {
    const singleOutcome = await extractPriceRowsForRect(
      input.imagePath,
      input.pricesRect,
      input.effectiveRowCount,
      input.pricesScale,
      input.safeMode,
      input.priceColumn,
      input.warnings,
      "",
      tradeBoardPriceExtractDeps,
    );
    if (input.priceColumn === "right") {
      leftValues = Array.from({ length: input.effectiveRowCount }, () => null);
      rightValues = singleOutcome.values;
    } else {
      leftValues = singleOutcome.values;
      rightValues = Array.from({ length: input.effectiveRowCount }, () => null);
    }
    rawPriceSection = singleOutcome.rawText;
    rawPriceTsvSection = singleOutcome.tsvText;
    pricesEngine = singleOutcome.engine;
  }

  return {
    leftValues,
    rightValues,
    rawPriceSection,
    rawPriceTsvSection,
    pricesEngine,
    effectiveLeftRole,
    effectiveRightRole,
  };
}
