import { describe, expect, it } from "vitest";
import { resolveTradeBoardPriceRows } from "./ocr-tradeboard-price-resolution";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

describe("workshop/ocr-tradeboard-price-resolution", () => {
  it("resolves dual mode with detected roles and dual-row extraction outcome", async () => {
    const warnings: string[] = [];
    const result = await resolveTradeBoardPriceRows(
      {
        imagePath: "shot.png",
        pricesRect: { x: 10, y: 20, width: 200, height: 160 },
        effectiveRowCount: 2,
        pricesScale: 2,
        namesLanguage: "ch+en",
        safeMode: true,
        priceMode: "dual",
        priceColumn: "left",
        fallbackLeftRole: "world",
        fallbackRightRole: "server",
        warnings,
      },
      {
        clamp,
        numericConfidenceMin: 20,
        cropImageToTempFile: () => "tmp.png",
        cleanupTempFile: () => undefined,
        runPaddleExtract: async () => ({ ok: true, language: "en", rawText: "", words: [] }),
        stringifyOcrWords: () => "",
        detectTradePriceRoleByHeaderText: () => null,
        resolveDualPriceRolesByHeader: async () => ({ leftRole: "server", rightRole: "world" }),
        extractDualPriceRowsForRect: async () => ({
          leftValues: [100, 200],
          rightValues: [110, 210],
          rawText: "dual-raw",
          tsvText: "dual-tsv",
          engine: "dual-engine",
        }),
      },
    );

    expect(result.leftValues).toEqual([100, 200]);
    expect(result.rightValues).toEqual([110, 210]);
    expect(result.effectiveLeftRole).toBe("server");
    expect(result.effectiveRightRole).toBe("world");
    expect(result.pricesEngine).toBe("dual-engine");
    expect(warnings.some((entry) => entry.includes("双价格列角色"))).toBe(true);
  });

  it("resolves single-right mode into right column values only", async () => {
    const warnings: string[] = [];
    const result = await resolveTradeBoardPriceRows(
      {
        imagePath: "shot.png",
        pricesRect: { x: 0, y: 0, width: 100, height: 80 },
        effectiveRowCount: 3,
        pricesScale: 2,
        namesLanguage: "ch",
        safeMode: true,
        priceMode: "single",
        priceColumn: "right",
        fallbackLeftRole: "server",
        fallbackRightRole: "world",
        warnings,
      },
      {
        clamp,
        numericConfidenceMin: 20,
        cropImageToTempFile: () => "tmp.png",
        cleanupTempFile: () => undefined,
        runPaddleExtract: async () => ({ ok: true, language: "en", rawText: "", words: [] }),
        stringifyOcrWords: () => "",
        detectTradePriceRoleByHeaderText: () => null,
        extractPriceRowsForRect: async () => ({
          values: [11, null, 33],
          rawText: "single-raw",
          tsvText: "single-tsv",
          engine: "single-engine",
        }),
      },
    );

    expect(result.leftValues).toEqual([null, null, null]);
    expect(result.rightValues).toEqual([11, null, 33]);
    expect(result.effectiveLeftRole).toBe("server");
    expect(result.effectiveRightRole).toBe("world");
    expect(result.rawPriceSection).toBe("single-raw");
    expect(result.rawPriceTsvSection).toBe("single-tsv");
  });
});
