import { describe, expect, it } from "vitest";
import { extractTradeBoardOcrText } from "./ocr-tradeboard-extract";

const preset = {
  enabled: true,
  rowCount: 2,
  namesRect: { x: 1, y: 2, width: 100, height: 80 },
  pricesRect: { x: 1, y: 90, width: 100, height: 80 },
  priceMode: "dual" as const,
  priceColumn: "left" as const,
  leftPriceRole: "server" as const,
  rightPriceRole: "world" as const,
};

describe("workshop/ocr-tradeboard-extract", () => {
  it("throws formatted error when names OCR extraction fails", async () => {
    const cleaned: Array<string | null> = [];
    await expect(
      extractTradeBoardOcrText(
        {
          imagePath: "capture.png",
          language: "ch",
          psm: 6,
          safeMode: true,
          tradeBoardPreset: preset,
          warnings: [],
        },
        {
          buildPaddleLanguageCandidates: () => ["ch"],
          cropImageToTempFile: () => "tmp.png",
          cleanupTempFile: (filePath) => cleaned.push(filePath),
          runPaddleExtract: async () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "boom" }),
          formatPaddleOcrError: () => "格式化错误",
          sanitizeOcrLineItemName: (raw) => raw.trim(),
          clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
          detectTradePriceRoleByHeaderText: () => null,
          stringifyOcrWords: () => "",
          nameConfidenceMin: 35,
          numericConfidenceMin: 20,
        },
      ),
    ).rejects.toThrow("名称区 OCR 失败：格式化错误");
    expect(cleaned).toEqual(["tmp.png"]);
  });

  it("builds trade-board OCR result from orchestrated helper outputs", async () => {
    const warnings: string[] = [];
    const result = await extractTradeBoardOcrText(
      {
        imagePath: "capture.png",
        language: "ch",
        psm: 6,
        safeMode: true,
        tradeBoardPreset: preset,
        warnings,
      },
      {
        buildPaddleLanguageCandidates: () => ["ch", "en"],
        cropImageToTempFile: () => "tmp.png",
        cleanupTempFile: () => undefined,
        runPaddleExtract: async () => ({ ok: true, language: "ch", rawText: "name-raw", words: [] }),
        formatPaddleOcrError: (raw) => raw ?? "",
        sanitizeOcrLineItemName: (raw) => raw.trim(),
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
        detectTradePriceRoleByHeaderText: () => null,
        stringifyOcrWords: () => "WORDS",
        nameConfidenceMin: 35,
        numericConfidenceMin: 20,
        buildTradeBoardNameRows: () => ({ effectiveRowCount: 2, nameRows: ["A", "B"] }),
        resolveTradeBoardPriceRows: async () => ({
          leftValues: [100, 200],
          rightValues: [110, 210],
          rawPriceSection: "price-raw",
          rawPriceTsvSection: "price-tsv",
          pricesEngine: "price-engine",
          effectiveLeftRole: "server",
          effectiveRightRole: "world",
        }),
        buildTradeRows: () => [
          { lineNumber: 1, itemName: "A", serverPrice: 100, worldPrice: 110 },
          { lineNumber: 2, itemName: "B", serverPrice: 200, worldPrice: 210 },
        ],
        buildTradeBoardPrimaryTextLines: () => ["A 100", "B 200"],
        buildTradeBoardRawText: () => "RAW-PAYLOAD",
      },
    );

    expect(result.rawText).toBe("RAW-PAYLOAD");
    expect(result.text).toBe("A 100\nB 200");
    expect(result.lineCount).toBe(2);
    expect(result.engine).toContain("trade-board-roi");
    expect(result.tradeRows?.length).toBe(2);
  });
});
