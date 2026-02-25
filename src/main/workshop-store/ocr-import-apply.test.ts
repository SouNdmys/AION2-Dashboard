import { describe, expect, it, vi } from "vitest";
import type { WorkshopItem, WorkshopPriceSnapshot } from "../../shared/types";
import { normalizeLookupName } from "./ocr-name-matching";
import type { ParsedOcrPriceLine, SanitizedOcrImportPayload } from "./ocr-import-parser";
import { applyParsedOcrImportLines, type ApplyParsedOcrImportLinesDeps } from "./ocr-import-apply";

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

function createDeps(overrides: Partial<ApplyParsedOcrImportLinesDeps> = {}): ApplyParsedOcrImportLinesDeps {
  let id = 0;
  return {
    resolveItemIconWithCache: (_iconCache, _name, _category, preferredIcon) => preferredIcon ?? "icon-default",
    isCapturedImageIcon: (icon) => typeof icon === "string" && icon.startsWith("capture:"),
    collectBaselinePricesForItem: () => [],
    assessPriceAnomalyWithCategory: () => ({
      kind: "normal",
      reason: null,
    }),
    formatAnomalyReason: () => "异常价格",
    appendNoteTag: (note, tag) => (note ? `${note};${tag}` : tag),
    suspectNoteTag: "qa:suspect:auto",
    yieldEvery: 40,
    createId: () => `id-${++id}`,
    yieldToEventLoop: async () => {},
    ...overrides,
  };
}

function buildLookup(items: WorkshopItem[]): Map<string, WorkshopItem> {
  const lookup = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    lookup.set(normalizeLookupName(item.name), item);
  });
  return lookup;
}

describe("workshop/ocr-import-apply", () => {
  it("imports exact-matched line and marks suspect price note", async () => {
    const item: WorkshopItem = {
      id: "item-a",
      name: "勇者长剑",
      category: "equipment",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    const items = [item];
    const prices: WorkshopPriceSnapshot[] = [];
    const parsedLines: ParsedOcrPriceLine[] = [
      {
        lineNumber: 1,
        raw: "勇者长剑 1000000",
        itemName: "勇者长剑",
        unitPrice: 1_000_000,
        market: "single",
      },
    ];
    const deps = createDeps({
      assessPriceAnomalyWithCategory: () => ({
        kind: "suspect",
        reason: "偏离中位数",
      }),
      formatAnomalyReason: () => "偏离中位数",
    });

    const result = await applyParsedOcrImportLines(
      {
        parsedLines,
        sanitized: createSanitized(),
        items,
        prices,
        iconCache: new Map<string, string>(),
        iconByLineNumber: new Map<number, string>(),
        itemByLookupName: buildLookup(items),
      },
      deps,
    );

    expect(result.importedCount).toBe(1);
    expect(result.createdItemCount).toBe(0);
    expect(result.duplicateSkippedCount).toBe(0);
    expect(result.unknownItemNames).toEqual([]);
    expect(result.priceQualityWarnings).toEqual([`第 1 行「勇者长剑」标记可疑：偏离中位数`]);
    expect(prices).toHaveLength(1);
    expect(prices[0]?.note).toBe("ocr-import#single#line-1;qa:suspect:auto");
    expect(result.importedEntries[0]?.createdItem).toBe(false);
  });

  it("filters hard anomaly then skips duplicate within dedupe window", async () => {
    const item: WorkshopItem = {
      id: "item-a",
      name: "勇者长剑",
      category: "equipment",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    const items = [item];
    const prices: WorkshopPriceSnapshot[] = [
      {
        id: "seed-1",
        itemId: "item-a",
        unitPrice: 888_888,
        capturedAt: "2026-02-25T00:00:00.000Z",
        source: "import",
        market: "single",
      },
    ];
    const parsedLines: ParsedOcrPriceLine[] = [
      {
        lineNumber: 1,
        raw: "勇者长剑 999999999",
        itemName: "勇者长剑",
        unitPrice: 999_999_999,
        market: "single",
      },
      {
        lineNumber: 2,
        raw: "勇者长剑 888888",
        itemName: "勇者长剑",
        unitPrice: 888_888,
        market: "single",
      },
    ];

    const result = await applyParsedOcrImportLines(
      {
        parsedLines,
        sanitized: createSanitized({ dedupeWithinSeconds: 5 }),
        items,
        prices,
        iconCache: new Map<string, string>(),
        iconByLineNumber: new Map<number, string>(),
        itemByLookupName: buildLookup(items),
      },
      createDeps({
        assessPriceAnomalyWithCategory: (unitPrice) => ({
          kind: unitPrice > 100_000_000 ? "hard" : "normal",
          reason: "极端异常",
        }),
        formatAnomalyReason: () => "极端异常",
      }),
    );

    expect(result.importedCount).toBe(0);
    expect(result.duplicateSkippedCount).toBe(1);
    expect(result.createdItemCount).toBe(0);
    expect(result.unknownItemNames).toEqual(["勇者长剑（价格异常偏离，已自动过滤）"]);
    expect(result.priceQualityWarnings).toEqual([`第 1 行「勇者长剑」已跳过：极端异常`]);
    expect(prices).toHaveLength(1);
  });

  it("auto-creates missing item and imports snapshot", async () => {
    const items: WorkshopItem[] = [];
    const prices: WorkshopPriceSnapshot[] = [];
    const parsedLines: ParsedOcrPriceLine[] = [
      {
        lineNumber: 5,
        raw: "未知材料 12345",
        itemName: "未知材料",
        unitPrice: 12_345,
        market: "single",
      },
    ];
    const iconSpy = vi.fn((_iconCache: Map<string, string>, _name: string, _category: string, preferredIcon?: string) => {
      return preferredIcon ?? "icon-new-item";
    });

    const result = await applyParsedOcrImportLines(
      {
        parsedLines,
        sanitized: createSanitized({ autoCreateMissingItems: true, defaultCategory: "component" }),
        items,
        prices,
        iconCache: new Map<string, string>(),
        iconByLineNumber: new Map<number, string>(),
        itemByLookupName: new Map<string, WorkshopItem>(),
      },
      createDeps({
        resolveItemIconWithCache: iconSpy,
      }),
    );

    expect(result.createdItemCount).toBe(1);
    expect(result.importedCount).toBe(1);
    expect(result.duplicateSkippedCount).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("未知材料");
    expect(items[0]?.category).toBe("component");
    expect(items[0]?.icon).toBe("icon-new-item");
    expect(result.importedEntries[0]?.createdItem).toBe(true);
    expect(iconSpy).toHaveBeenCalledTimes(1);
  });
});
