import { describe, expect, it } from "vitest";
import { buildTradeBoardNameRows } from "./ocr-tradeboard-names";

const sanitizeName = (raw: string): string => raw.replace(/\s+/g, "").trim();
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

describe("workshop/ocr-tradeboard-names", () => {
  it("builds name rows from tsv words when enough confident rows exist", () => {
    const warnings: string[] = [];
    const result = buildTradeBoardNameRows(
      {
        namesWords: [
          { text: "奥里哈康", left: 10, top: 10, width: 30, height: 16, confidence: 95 },
          { text: "矿石", left: 45, top: 10, width: 20, height: 16, confidence: 95 },
          { text: "龙族", left: 10, top: 62, width: 24, height: 16, confidence: 95 },
          { text: "鳞片", left: 40, top: 62, width: 24, height: 16, confidence: 95 },
        ],
        namesRawText: "x\ny",
        expectedRowCount: 2,
        namesRectHeight: 100,
        namesScale: 1,
        warnings,
      },
      {
        sanitizeOcrLineItemName: sanitizeName,
        clamp,
        nameConfidenceMin: 35,
      },
    );

    expect(result.effectiveRowCount).toBe(2);
    expect(result.nameRows).toEqual(["奥里哈康矿石", "龙族鳞片"]);
    expect(warnings).toEqual([]);
  });

  it("falls back to text lines when tsv rows are insufficient", () => {
    const warnings: string[] = [];
    const result = buildTradeBoardNameRows(
      {
        namesWords: [],
        namesRawText: "A\nB",
        expectedRowCount: 2,
        namesRectHeight: 100,
        namesScale: 1,
        warnings,
      },
      {
        sanitizeOcrLineItemName: sanitizeName,
        clamp,
        nameConfidenceMin: 35,
      },
    );

    expect(result.nameRows).toEqual(["A", "B"]);
  });

  it("auto-detects row count when configured count is zero", () => {
    const warnings: string[] = [];
    const result = buildTradeBoardNameRows(
      {
        namesWords: [],
        namesRawText: "A\nB\nC",
        expectedRowCount: 0,
        namesRectHeight: 120,
        namesScale: 1,
        warnings,
      },
      {
        sanitizeOcrLineItemName: sanitizeName,
        clamp,
        nameConfidenceMin: 35,
      },
    );

    expect(result.effectiveRowCount).toBe(3);
    expect(warnings.some((entry) => entry.includes("自动识别"))).toBe(true);
  });
});
