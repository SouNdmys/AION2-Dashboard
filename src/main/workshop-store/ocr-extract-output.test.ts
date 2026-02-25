import { describe, expect, it } from "vitest";
import { buildPrimaryOcrTextResult, formatPaddleOcrError, normalizeOcrText } from "./ocr-extract-output";

describe("workshop/ocr-extract-output", () => {
  it("normalizes OCR raw text lines by trimming empty entries", () => {
    const normalized = normalizeOcrText("  A  \r\n\r\n B \n   \nC");
    expect(normalized).toBe("A\nB\nC");
  });

  it("formats known ONNX failure patterns with actionable hints", () => {
    const inference = formatPaddleOcrError("onnx runtime init failed");
    const model = formatPaddleOcrError("no model source is available");

    expect(inference).toContain("ONNX Runtime");
    expect(model).toContain("安装包完整性");
  });

  it("builds standard OCR result and appends empty-output warning", () => {
    const warnings: string[] = [];
    const emptyResult = buildPrimaryOcrTextResult({
      rawText: " \n ",
      detectedLanguage: "",
      fallbackLanguage: "ch",
      psm: 6,
      warnings,
    });
    expect(emptyResult.lineCount).toBe(0);
    expect(emptyResult.engine).toBe("onnx-ocr(ch, psm=6)");
    expect(warnings).toContain("OCR 返回为空，请检查截图裁切范围、清晰度或语言包。");

    const nonEmptyWarnings: string[] = [];
    const normalResult = buildPrimaryOcrTextResult({
      rawText: "A\nB",
      detectedLanguage: "en",
      fallbackLanguage: "ch",
      psm: 5,
      warnings: nonEmptyWarnings,
    });
    expect(normalResult.lineCount).toBe(2);
    expect(normalResult.text).toBe("A\nB");
    expect(nonEmptyWarnings).toEqual([]);
  });
});
