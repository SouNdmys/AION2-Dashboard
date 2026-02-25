import { describe, expect, it } from "vitest";
import { parseOcrPriceLines, parseOcrTradeRows, sanitizeOcrImportPayload } from "./ocr-import-parser";

describe("workshop/ocr-import-parser sanitizeOcrImportPayload", () => {
  it("normalizes defaults and clamps dedupe window", () => {
    const result = sanitizeOcrImportPayload(
      {
        text: "abc",
        capturedAt: "2026-02-25T12:00:00.000Z",
        dedupeWithinSeconds: 999,
        strictIconMatch: true,
      },
      {
        asIso: () => "2026-02-25T00:00:00.000Z",
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
        sanitizeCategory: () => "material",
      },
    );

    expect(result.source).toBe("import");
    expect(result.capturedAt).toBe("2026-02-25T00:00:00.000Z");
    expect(result.dedupeWithinSeconds).toBe(600);
    expect(result.iconCaptureWarnings.length).toBe(1);
    expect(result.defaultCategory).toBe("material");
  });
});

describe("workshop/ocr-import-parser line parsing", () => {
  const deps = {
    sanitizeOcrLineItemName: (raw: string) => raw.trim(),
    normalizeNumericToken: (raw: string) => {
      const digits = raw.replace(/[^\d]/g, "");
      return digits ? Number(digits) : null;
    },
  };

  it("parses plain OCR text lines into single-market rows", () => {
    const { parsedLines, invalidLines } = parseOcrPriceLines("奥德矿石 1,200\n无效行", deps);
    expect(parsedLines).toHaveLength(1);
    expect(parsedLines[0]).toMatchObject({
      lineNumber: 1,
      itemName: "奥德矿石",
      unitPrice: 1200,
      market: "single",
    });
    expect(invalidLines).toHaveLength(1);
  });

  it("parses structured trade rows into server/world rows", () => {
    const { parsedLines, invalidLines } = parseOcrTradeRows(
      [
        { lineNumber: 1, itemName: "奥德矿石", serverPrice: 1000, worldPrice: 900 },
        { lineNumber: 2, itemName: "副本核心", serverPrice: null, worldPrice: Number.NaN },
      ],
      deps,
    );
    expect(parsedLines).toHaveLength(2);
    expect(parsedLines.map((row) => row.market)).toEqual(["server", "world"]);
    expect(invalidLines.some((line) => line.includes("世界价格无效"))).toBe(true);
  });
});
