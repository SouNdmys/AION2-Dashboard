import { describe, expect, it, vi } from "vitest";
import type { WorkshopRect } from "../../shared/types";
import { extractDualPriceRowsForRect, extractPriceRowsForRect, type TradeBoardPriceExtractDeps } from "./ocr-tradeboard-prices";
import type { OcrTsvWord, PaddleOcrOutcome } from "./ocr-paddle-payload";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function createDeps(overrides?: Partial<TradeBoardPriceExtractDeps>): TradeBoardPriceExtractDeps {
  return {
    clamp,
    numericConfidenceMin: 20,
    cropImageToTempFile: (_imagePath, rect, _scale) => `temp-${rect.x}-${rect.width}`,
    cleanupTempFile: () => undefined,
    runPaddleExtract: async () => ({
      ok: true,
      language: "en",
      rawText: "",
      words: [],
    }),
    stringifyOcrWords: (words) => words.map((word) => word.text).join("\n"),
    ...overrides,
  };
}

const rect: WorkshopRect = { x: 0, y: 0, width: 100, height: 80 };

describe("workshop/ocr-tradeboard-prices", () => {
  it("falls back to plain text row parsing when word rows are insufficient", async () => {
    const cleanupTempFile = vi.fn();
    const deps = createDeps({
      cleanupTempFile,
      runPaddleExtract: async (): Promise<PaddleOcrOutcome> => ({
        ok: true,
        language: "en",
        rawText: "100\n200",
        words: [{ text: "100", left: 10, top: 10, width: 18, height: 10, confidence: 90 }],
      }),
    });
    const warnings: string[] = [];

    const outcome = await extractPriceRowsForRect("image.png", rect, 2, 1, true, "left", warnings, "", deps);
    expect(outcome.values).toEqual([100, 200]);
    expect(warnings.some((line) => line.includes("词框结果不足"))).toBe(true);
    expect(cleanupTempFile).toHaveBeenCalledWith("temp-0-100");
  });

  it("throws with prefix when OCR extraction fails", async () => {
    const cleanupTempFile = vi.fn();
    const deps = createDeps({
      cleanupTempFile,
      runPaddleExtract: async (): Promise<PaddleOcrOutcome> => ({
        ok: false,
        language: "",
        rawText: "",
        words: [],
        errorMessage: "engine down",
      }),
    });
    await expect(
      extractPriceRowsForRect("image.png", rect, 2, 1, true, "left", [], "左列价格：", deps),
    ).rejects.toThrow("左列价格：OCR 失败：engine down");
    expect(cleanupTempFile).toHaveBeenCalledWith("temp-0-100");
  });

  it("uses fast dual-split path when both sides have enough rows", async () => {
    const cleanupTempFile = vi.fn();
    const words: OcrTsvWord[] = [
      { text: "100", left: 10, top: 10, width: 18, height: 10, confidence: 90 },
      { text: "900", left: 70, top: 10, width: 18, height: 10, confidence: 90 },
      { text: "110", left: 10, top: 56, width: 18, height: 10, confidence: 90 },
      { text: "910", left: 70, top: 56, width: 18, height: 10, confidence: 90 },
    ];
    const deps = createDeps({
      cleanupTempFile,
      runPaddleExtract: async (): Promise<PaddleOcrOutcome> => ({
        ok: true,
        language: "en",
        rawText: "fast",
        words,
      }),
    });
    const warnings: string[] = [];

    const outcome = await extractDualPriceRowsForRect("image.png", rect, 2, 1, true, warnings, deps);
    expect(outcome.leftValues).toEqual([100, 110]);
    expect(outcome.rightValues).toEqual([900, 910]);
    expect(outcome.engine).toContain("dual-split");
    expect(cleanupTempFile).toHaveBeenCalledTimes(1);
  });

  it("falls back to left/right block OCR when fast dual-split is insufficient", async () => {
    const cleanupTempFile = vi.fn();
    const runPaddleExtract = vi.fn(async (imagePath: string): Promise<PaddleOcrOutcome> => {
      if (imagePath === "temp-0-100") {
        return {
          ok: true,
          language: "en",
          rawText: "insufficient",
          words: [{ text: "100", left: 10, top: 10, width: 18, height: 10, confidence: 90 }],
        };
      }
      if (imagePath === "temp-0-50") {
        return {
          ok: true,
          language: "en",
          rawText: "101\n102",
          words: [],
        };
      }
      return {
        ok: true,
        language: "en",
        rawText: "201\n202",
        words: [],
      };
    });
    const deps = createDeps({
      cleanupTempFile,
      runPaddleExtract,
    });
    const warnings: string[] = [];

    const outcome = await extractDualPriceRowsForRect("image.png", rect, 2, 1, true, warnings, deps);
    expect(outcome.leftValues).toEqual([101, 102]);
    expect(outcome.rightValues).toEqual([201, 202]);
    expect(outcome.engine).toContain("left=onnx-ocr");
    expect(warnings.some((line) => line.includes("双列价格快速解析不足"))).toBe(true);
    expect(runPaddleExtract).toHaveBeenCalledTimes(3);
    expect(cleanupTempFile).toHaveBeenCalledTimes(3);
  });
});
