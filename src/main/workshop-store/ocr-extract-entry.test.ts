import { describe, expect, it } from "vitest";
import { extractWorkshopOcrTextEntry, type ExtractWorkshopOcrEntryDeps } from "./ocr-extract-entry";
import type { WorkshopOcrExtractTextInput } from "../../shared/types";

function createBaseDeps(): ExtractWorkshopOcrEntryDeps {
  return {
    resolveImportFilePath: (rawPath) => `/abs/${rawPath}`,
    sanitizeOcrLanguage: () => "ch",
    sanitizeOcrPsm: () => 6,
    sanitizeOcrSafeMode: () => true,
    sanitizeTradeBoardPreset: () => null,
    runPaddleExtract: async () => ({ ok: true, language: "ch", rawText: "line", words: [] }),
    formatPaddleOcrError: (raw) => raw ?? "未知错误",
    buildPrimaryOcrTextResult: ({ rawText, detectedLanguage, fallbackLanguage, psm, warnings }) => ({
      rawText,
      text: rawText,
      lineCount: rawText ? 1 : 0,
      warnings,
      engine: `onnx-ocr(${detectedLanguage || fallbackLanguage}, psm=${psm})`,
    }),
    extractTradeBoardOcrText: async () => ({ rawText: "", text: "", lineCount: 0, warnings: [], engine: "x", tradeRows: [] }),
    tradeBoardDeps: {
      buildPaddleLanguageCandidates: () => ["ch"],
      cropImageToTempFile: () => "tmp",
      cleanupTempFile: () => undefined,
      runPaddleExtract: async () => ({ ok: true, language: "ch", rawText: "", words: [] }),
      formatPaddleOcrError: () => "",
      sanitizeOcrLineItemName: (raw) => raw.trim(),
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      detectTradePriceRoleByHeaderText: () => null,
      stringifyOcrWords: () => "",
      nameConfidenceMin: 35,
      numericConfidenceMin: 20,
    },
  };
}

describe("workshop/ocr-extract-entry", () => {
  it("throws when imagePath is missing", async () => {
    const deps = createBaseDeps();
    const payload = { imagePath: "   " } as WorkshopOcrExtractTextInput;
    await expect(extractWorkshopOcrTextEntry(payload, deps)).rejects.toThrow("请先填写截图路径");
  });

  it("routes to trade-board extractor when preset is enabled", async () => {
    const deps = createBaseDeps();
    deps.sanitizeTradeBoardPreset = () => ({
      enabled: true,
      rowCount: 1,
      namesRect: { x: 0, y: 0, width: 10, height: 10 },
      pricesRect: { x: 0, y: 10, width: 10, height: 10 },
      priceMode: "single",
      priceColumn: "left",
      leftPriceRole: "server",
      rightPriceRole: "world",
    });
    deps.extractTradeBoardOcrText = async (input) => ({
      rawText: input.imagePath,
      text: "trade",
      lineCount: 1,
      warnings: input.warnings,
      engine: "trade-engine",
      tradeRows: [],
    });

    const result = await extractWorkshopOcrTextEntry({ imagePath: "shot.png" } as WorkshopOcrExtractTextInput, deps);
    expect(result.engine).toBe("trade-engine");
    expect(result.rawText).toBe("/abs/shot.png");
  });

  it("uses primary OCR result path when trade-board preset is absent", async () => {
    const deps = createBaseDeps();
    deps.runPaddleExtract = async () => ({ ok: true, language: "en", rawText: "hello", words: [] });

    const result = await extractWorkshopOcrTextEntry({ imagePath: "shot.png" } as WorkshopOcrExtractTextInput, deps);
    expect(result.rawText).toBe("hello");
    expect(result.engine).toContain("en");
  });

  it("formats and throws OCR error when primary extraction fails", async () => {
    const deps = createBaseDeps();
    deps.runPaddleExtract = async () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "raw-fail" });
    deps.formatPaddleOcrError = () => "格式化失败";

    await expect(extractWorkshopOcrTextEntry({ imagePath: "shot.png" } as WorkshopOcrExtractTextInput, deps)).rejects.toThrow(
      "ONNX OCR 识别失败：格式化失败",
    );
  });
});
