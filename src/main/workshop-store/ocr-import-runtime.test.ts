import { describe, expect, it } from "vitest";
import { isDuplicatePriceSnapshotByWindow, yieldToEventLoop } from "./ocr-import-runtime";

describe("workshop/ocr-import-runtime", () => {
  it("detects duplicate snapshots inside dedupe window", () => {
    const prices = [
      {
        id: "1",
        itemId: "item-a",
        unitPrice: 100,
        capturedAt: "2026-02-25T00:00:00.000Z",
        source: "import" as const,
        market: "single" as const,
      },
    ];

    const duplicated = isDuplicatePriceSnapshotByWindow(
      prices,
      "item-a",
      "single",
      100,
      "2026-02-25T00:00:04.000Z",
      5,
    );
    expect(duplicated).toBe(true);
  });

  it("returns false when outside dedupe window or signature mismatches", () => {
    const prices = [
      {
        id: "1",
        itemId: "item-a",
        unitPrice: 100,
        capturedAt: "2026-02-25T00:00:00.000Z",
        source: "import" as const,
        market: "single" as const,
      },
    ];

    expect(
      isDuplicatePriceSnapshotByWindow(prices, "item-a", "single", 100, "2026-02-25T00:00:10.000Z", 5),
    ).toBe(false);
    expect(
      isDuplicatePriceSnapshotByWindow(prices, "item-a", "world", 100, "2026-02-25T00:00:02.000Z", 5),
    ).toBe(false);
  });

  it("yields to event loop without throwing", async () => {
    await expect(yieldToEventLoop()).resolves.toBeUndefined();
  });
});
