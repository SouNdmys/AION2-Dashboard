import { describe, expect, it } from "vitest";
import {
  buildNameRowsFromWords,
  buildPriceRowsFromWords,
  detectTradePriceRoleByHeaderText,
  normalizeNumericToken,
  parseNonEmptyLines,
  parsePriceFromLine,
  resolveTradeBoardRowCount,
} from "./ocr-tradeboard-rows";
import type { OcrTsvWord } from "./ocr-paddle-payload";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const sanitizeName = (raw: string): string => raw.trim();

describe("workshop/ocr-tradeboard-rows", () => {
  it("normalizes OCR numeric tokens and parses left/right prices", () => {
    expect(normalizeNumericToken("１２３，４５６")).toBe(123456);
    expect(normalizeNumericToken("OIlS")).toBe(115);
    expect(parsePriceFromLine("1,200 / 2,500", "left")).toBe(1200);
    expect(parsePriceFromLine("1,200 / 2,500", "right")).toBe(2500);
  });

  it("parses non-empty lines and resolves row count from words/text fallback", () => {
    const warnings: string[] = [];
    const words: OcrTsvWord[] = [
      { text: "奥德矿石", left: 10, top: 10, width: 40, height: 12, confidence: 90 },
      { text: "副本核心", left: 10, top: 42, width: 40, height: 12, confidence: 90 },
    ];
    expect(parseNonEmptyLines(" a\r\n\r\n b \n")).toEqual(["a", "b"]);
    const resolved = resolveTradeBoardRowCount(0, words, "一行\n二行\n三行", warnings, {
      sanitizeOcrLineItemName: sanitizeName,
      clamp,
    });
    expect(resolved).toBe(3);
    expect(warnings[0]?.includes("交易行可见行数自动识别")).toBe(true);
  });

  it("builds name rows with confidence filtering and fallback", () => {
    const words: OcrTsvWord[] = [
      { text: "噪声", left: 10, top: 10, width: 15, height: 10, confidence: 5 },
      { text: " 奥德矿石 ", left: 35, top: 10, width: 50, height: 10, confidence: 90 },
      { text: " 低置信名称 ", left: 10, top: 60, width: 70, height: 12, confidence: 10 },
    ];
    const rows = buildNameRowsFromWords(words, 2, 120, {
      sanitizeOcrLineItemName: sanitizeName,
      clamp,
      nameConfidenceMin: 35,
    });
    expect(rows).toEqual(["奥德矿石", "低置信名称"]);
  });

  it("builds price rows from numeric words and tracks empty-row warnings", () => {
    const words: OcrTsvWord[] = [
      { text: "100", left: 10, top: 10, width: 20, height: 10, confidence: 90 },
      { text: "200", left: 55, top: 10, width: 20, height: 10, confidence: 90 },
      { text: "300", left: 10, top: 58, width: 20, height: 10, confidence: 90 },
    ];
    const rowWarnings: string[] = [];
    const rightValues = buildPriceRowsFromWords(words, 2, "right", rowWarnings, {
      clamp,
      numericConfidenceMin: 20,
    });
    expect(rightValues).toEqual([200, 300]);
    expect(rowWarnings).toHaveLength(0);
  });

  it("detects trade header roles with ambiguity fallback", () => {
    expect(detectTradePriceRoleByHeaderText("世界价格")).toBe("world");
    expect(detectTradePriceRoleByHeaderText("本服价格")).toBe("server");
    expect(detectTradePriceRoleByHeaderText("世界/服务器")).toBeNull();
  });
});
