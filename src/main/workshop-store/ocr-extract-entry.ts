import type { WorkshopOcrExtractTextInput, WorkshopOcrExtractTextResult, WorkshopTradeBoardPreset } from "../../shared/types";
import type { PaddleOcrOutcome } from "./ocr-paddle-payload";
import type { ExtractTradeBoardOcrTextDeps, ExtractTradeBoardOcrTextInput } from "./ocr-tradeboard-extract";

interface BuildPrimaryOcrTextResultInput {
  rawText: string;
  detectedLanguage: string;
  fallbackLanguage: string;
  psm: number;
  warnings: string[];
}

export interface ExtractWorkshopOcrEntryDeps {
  resolveImportFilePath: (rawPath: string) => string;
  sanitizeOcrLanguage: (raw: unknown) => string;
  sanitizeOcrPsm: (raw: unknown) => number;
  sanitizeOcrSafeMode: (raw: unknown) => boolean;
  sanitizeTradeBoardPreset: (raw: unknown) => WorkshopTradeBoardPreset | null;
  runPaddleExtract: (imagePath: string, language: string, safeMode?: boolean) => Promise<PaddleOcrOutcome>;
  formatPaddleOcrError: (raw: string | undefined) => string;
  buildPrimaryOcrTextResult: (input: BuildPrimaryOcrTextResultInput) => WorkshopOcrExtractTextResult;
  extractTradeBoardOcrText: (
    input: ExtractTradeBoardOcrTextInput,
    deps: ExtractTradeBoardOcrTextDeps,
  ) => Promise<WorkshopOcrExtractTextResult>;
  tradeBoardDeps: ExtractTradeBoardOcrTextDeps;
}

export async function extractWorkshopOcrTextEntry(
  payload: WorkshopOcrExtractTextInput,
  deps: ExtractWorkshopOcrEntryDeps,
): Promise<WorkshopOcrExtractTextResult> {
  const imageRawPath = payload.imagePath?.trim();
  if (!imageRawPath) {
    throw new Error("OCR 识别失败：请先填写截图路径。");
  }

  const imagePath = deps.resolveImportFilePath(imageRawPath);
  const language = deps.sanitizeOcrLanguage(payload.language);
  const psm = deps.sanitizeOcrPsm(payload.psm);
  const safeMode = deps.sanitizeOcrSafeMode(payload.safeMode);
  const warnings: string[] = [];
  const tradeBoardPreset = deps.sanitizeTradeBoardPreset(payload.tradeBoardPreset);

  if (tradeBoardPreset) {
    return deps.extractTradeBoardOcrText(
      {
        imagePath,
        language,
        psm,
        safeMode,
        tradeBoardPreset,
        warnings,
      },
      deps.tradeBoardDeps,
    );
  }

  const primary = await deps.runPaddleExtract(imagePath, language, safeMode);
  if (!primary.ok) {
    throw new Error(`ONNX OCR 识别失败：${deps.formatPaddleOcrError(primary.errorMessage)}`);
  }

  return deps.buildPrimaryOcrTextResult({
    rawText: primary.rawText,
    detectedLanguage: primary.language,
    fallbackLanguage: language,
    psm,
    warnings,
  });
}
