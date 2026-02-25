import { describe, expect, it, vi } from "vitest";

const {
  mockCleanupWorkshopOcrEngineCore,
  mockExtractWorkshopOcrTextCore,
  mockImportWorkshopOcrPricesCore,
} = vi.hoisted(() => ({
  mockCleanupWorkshopOcrEngineCore: vi.fn(),
  mockExtractWorkshopOcrTextCore: vi.fn(),
  mockImportWorkshopOcrPricesCore: vi.fn(),
}));

vi.mock("../workshop-store-core", () => ({
  cleanupWorkshopOcrEngineCore: mockCleanupWorkshopOcrEngineCore,
  extractWorkshopOcrTextCore: mockExtractWorkshopOcrTextCore,
  importWorkshopOcrPricesCore: mockImportWorkshopOcrPricesCore,
}));

import { cleanupWorkshopOcrEngine, extractWorkshopOcrText, importWorkshopOcrPrices } from "./ocr";

describe("workshop/ocr", () => {
  it("forwards cleanup call to core", () => {
    cleanupWorkshopOcrEngine();
    expect(mockCleanupWorkshopOcrEngineCore).toHaveBeenCalledTimes(1);
  });

  it("forwards extract call and returns core result", async () => {
    const expected = { rawText: "x", text: "x", lineCount: 1, warnings: [], engine: "onnx" };
    mockExtractWorkshopOcrTextCore.mockResolvedValue(expected);

    const payload = { imagePath: "x.png" };
    const result = await extractWorkshopOcrText(payload);

    expect(mockExtractWorkshopOcrTextCore).toHaveBeenCalledWith(payload);
    expect(result).toBe(expected);
  });

  it("forwards import call and returns core result", async () => {
    const expected = {
      state: { version: 6, items: [], recipes: [], prices: [], inventory: [], signalRule: { enabled: true, lookbackDays: 30, dropBelowWeekdayAverageRatio: 0.15 } },
      importedCount: 0,
      duplicateSkippedCount: 0,
      createdItemCount: 0,
      parsedLineCount: 0,
      unknownItemNames: [],
      invalidLines: [],
      iconCapturedCount: 0,
      iconSkippedCount: 0,
      iconCaptureWarnings: [],
      importedEntries: [],
    };
    mockImportWorkshopOcrPricesCore.mockResolvedValue(expected);

    const payload = { text: "", source: "manual" as const };
    const result = await importWorkshopOcrPrices(payload);

    expect(mockImportWorkshopOcrPricesCore).toHaveBeenCalledWith(payload);
    expect(result).toBe(expected);
  });
});
