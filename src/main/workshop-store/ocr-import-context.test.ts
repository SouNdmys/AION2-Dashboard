import { describe, expect, it } from "vitest";
import type { WorkshopItem, WorkshopPriceSnapshot } from "../../shared/types";
import { normalizeLookupName } from "./ocr-name-matching";
import type { SanitizedOcrImportPayload } from "./ocr-import-parser";
import { prepareOcrImportContext } from "./ocr-import-context";

function createSanitized(overrides: Partial<SanitizedOcrImportPayload> = {}): SanitizedOcrImportPayload {
  return {
    source: "import",
    capturedAt: "2026-02-25T00:00:00.000Z",
    dedupeWithinSeconds: 0,
    autoCreateMissingItems: false,
    strictIconMatch: false,
    defaultCategory: "material",
    text: "",
    tradeRows: undefined,
    iconCapture: null,
    iconCaptureWarnings: [],
    ...overrides,
  };
}

describe("workshop/ocr-import-context", () => {
  it("parses plain text lines and prepares default icon-capture outcome", () => {
    const items: WorkshopItem[] = [
      {
        id: "item-a",
        name: "勇者长剑",
        category: "equipment",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ];
    const prices: WorkshopPriceSnapshot[] = [];

    const context = prepareOcrImportContext({
      sanitized: createSanitized({
        text: "勇者长剑 1000000\nbad-line",
        iconCaptureWarnings: ["图标识别已停用，当前仅按名称识别。"],
      }),
      stateItems: items,
      statePrices: prices,
      iconCacheRaw: {
        "勇者长剑": "icon-equipment",
      },
    });

    expect(context.parsedLines).toHaveLength(1);
    expect(context.parsedLines[0]?.itemName).toBe("勇者长剑");
    expect(context.invalidLines).toEqual(["#2 bad-line"]);
    expect(context.items).toEqual(items);
    expect(context.prices).toEqual(prices);
    expect(context.itemByLookupName.get(normalizeLookupName("勇者长剑"))?.id).toBe("item-a");
    expect(context.iconCaptureOutcome.iconCapturedCount).toBe(0);
    expect(context.iconCaptureOutcome.iconSkippedCount).toBe(0);
    expect(context.iconCaptureWarnings).toEqual(["图标识别已停用，当前仅按名称识别。"]);
  });

  it("prefers structured trade rows when present", () => {
    const context = prepareOcrImportContext({
      sanitized: createSanitized({
        text: "不会被解析 123",
        tradeRows: [
          {
            lineNumber: 7,
            itemName: "魔石",
            serverPrice: 50_000,
            worldPrice: null,
          },
        ],
      }),
      stateItems: [],
      statePrices: [],
      iconCacheRaw: null,
    });

    expect(context.parsedLines).toHaveLength(1);
    expect(context.parsedLines[0]).toMatchObject({
      lineNumber: 7,
      itemName: "魔石",
      unitPrice: 50_000,
      market: "server",
    });
    expect(context.invalidLines).toEqual([]);
  });
});
