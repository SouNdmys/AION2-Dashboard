import { describe, expect, it } from "vitest";
import {
  buildTradeBoardPrimaryTextLines,
  buildTradeBoardRawText,
  buildTradeRows,
  resolveDualPriceRolesByHeader,
} from "./ocr-tradeboard-orchestration";

describe("workshop/ocr-tradeboard-orchestration", () => {
  it("resolves dual price roles from recognized header texts", async () => {
    const cleaned: string[] = [];
    const warnings: string[] = [];
    const roles = await resolveDualPriceRolesByHeader(
      {
        imagePath: "capture.png",
        pricesRect: { x: 100, y: 200, width: 200, height: 100 },
        headerLanguage: "ch+en",
        safeMode: true,
        fallbackLeftRole: "world",
        fallbackRightRole: "server",
        warnings,
      },
      {
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
        cropImageToTempFile: (_imagePath, rect) => `${rect.x}`,
        cleanupTempFile: (filePath) => {
          if (filePath) {
            cleaned.push(filePath);
          }
        },
        runPaddleExtract: async (imagePath) => {
          if (imagePath === "100") {
            return { ok: true, language: "ch", rawText: "伺服器", words: [] };
          }
          return { ok: true, language: "ch", rawText: "世界", words: [] };
        },
        detectTradePriceRoleByHeaderText: (rawText) => {
          if (rawText.includes("伺服")) {
            return "server";
          }
          if (rawText.includes("世界")) {
            return "world";
          }
          return null;
        },
      },
    );

    expect(roles).toEqual({ leftRole: "server", rightRole: "world" });
    expect(cleaned).toEqual(["100", "200"]);
    expect(warnings).toEqual([]);
  });

  it("falls back to preset roles when header detection fails", async () => {
    const warnings: string[] = [];
    const roles = await resolveDualPriceRolesByHeader(
      {
        imagePath: "capture.png",
        pricesRect: { x: 0, y: 0, width: 120, height: 120 },
        headerLanguage: "ch",
        safeMode: true,
        fallbackLeftRole: "world",
        fallbackRightRole: "server",
        warnings,
      },
      {
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
        cropImageToTempFile: () => "tmp",
        cleanupTempFile: () => undefined,
        runPaddleExtract: async () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "boom" }),
        detectTradePriceRoleByHeaderText: () => null,
      },
    );

    expect(roles).toEqual({ leftRole: "world", rightRole: "server" });
    expect(warnings.some((entry) => entry.includes("价格表头自动识别失败"))).toBe(true);
  });

  it("builds trade rows with mapped server/world columns", () => {
    const tradeRows = buildTradeRows({
      effectiveRowCount: 3,
      nameRows: ["奥里哈康矿石", "龙族鳞片", null],
      leftValues: [100, 200, 300],
      rightValues: [110, 210, 310],
      effectiveLeftRole: "server",
      effectiveRightRole: "world",
    });

    expect(tradeRows).toEqual([
      { lineNumber: 1, itemName: "奥里哈康矿石", serverPrice: 100, worldPrice: 110 },
      { lineNumber: 2, itemName: "龙族鳞片", serverPrice: 200, worldPrice: 210 },
    ]);
  });

  it("builds primary text lines according to price column and role mapping", () => {
    const rows = [
      { lineNumber: 1, itemName: "A", serverPrice: 100, worldPrice: 110 },
      { lineNumber: 2, itemName: "B", serverPrice: null, worldPrice: 210 },
    ];
    const rightPrimary = buildTradeBoardPrimaryTextLines({
      tradeRows: rows,
      priceColumn: "right",
      effectiveLeftRole: "world",
      effectiveRightRole: "server",
    });
    const leftPrimary = buildTradeBoardPrimaryTextLines({
      tradeRows: rows,
      priceColumn: "left",
      effectiveLeftRole: "world",
      effectiveRightRole: "server",
    });

    expect(rightPrimary).toEqual(["A 100", "B 210"]);
    expect(leftPrimary).toEqual(["A 110", "B 210"]);
  });

  it("builds combined raw text payload with section delimiters", () => {
    const rawText = buildTradeBoardRawText({
      namesRawText: "NAMES",
      rawPriceSection: "PRICES",
      namesWords: [{ text: "A", left: 1, top: 2, width: 3, height: 4, confidence: 99 }],
      rawPriceTsvSection: "PRICE_WORDS",
      stringifyOcrWords: (words) => words.map((entry) => entry.text).join(","),
    });

    expect(rawText).toContain("NAMES");
    expect(rawText).toContain("---PRICE---");
    expect(rawText).toContain("---NAMES_WORDS---");
    expect(rawText).toContain("---PRICES_WORDS---");
  });
});
