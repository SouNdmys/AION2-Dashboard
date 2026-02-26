import { describe, expect, it } from "vitest";
import type { WorkshopItem } from "../../shared/types";
import { WORKSHOP_PRICE_NOTE_TAG_SUSPECT } from "./pricing-anomaly";
import { classifyPriceHistorySnapshotsByQuality, type PriceSnapshotWithTimestamp } from "./pricing-history-classify";

function buildSnapshot(
  id: string,
  iso: string,
  unitPrice: number,
  note?: string,
): PriceSnapshotWithTimestamp {
  return {
    id,
    itemId: "item-1",
    unitPrice,
    capturedAt: iso,
    ts: new Date(iso).getTime(),
    source: "import",
    market: "server",
    note,
  };
}

describe("workshop/pricing-history-classify", () => {
  it("keeps explicit quality-tagged snapshots as suspect with preset reason", () => {
    const snapshots = [
      buildSnapshot("1", "2026-02-01T00:00:00.000Z", 100, WORKSHOP_PRICE_NOTE_TAG_SUSPECT),
    ];
    const itemById = new Map<string, WorkshopItem>([
      [
        "item-1",
        {
          id: "item-1",
          name: "测试物品",
          category: "material",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    ]);

    const classified = classifyPriceHistorySnapshotsByQuality(snapshots, itemById);
    expect(classified).toHaveLength(1);
    expect(classified[0]?.isSuspect).toBe(true);
    expect(classified[0]?.suspectReason).toContain("写入时已标记为可疑价");
  });

  it("flags outlier by baseline and keeps baseline excluding suspect rows", () => {
    const baseDates = Array.from({ length: 8 }, (_, index) => `2026-02-0${index + 1}T00:00:00.000Z`);
    const snapshots: PriceSnapshotWithTimestamp[] = [
      ...baseDates.map((iso, index) => buildSnapshot(`${index + 1}`, iso, 100)),
      buildSnapshot("9", "2026-02-09T00:00:00.000Z", 300),
      buildSnapshot("10", "2026-02-10T00:00:00.000Z", 100),
    ];
    const itemById = new Map<string, WorkshopItem>([
      [
        "item-1",
        {
          id: "item-1",
          name: "测试物品",
          category: "other",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    ]);

    const classified = classifyPriceHistorySnapshotsByQuality(snapshots, itemById);
    expect(classified[8]?.isSuspect).toBe(true);
    expect(classified[8]?.suspectReason).toContain("高于中位数");
    expect(classified[9]?.isSuspect).toBe(false);
  });
});
