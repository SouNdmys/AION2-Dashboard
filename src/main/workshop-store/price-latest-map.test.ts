import { describe, expect, it } from "vitest";
import type { WorkshopPriceSnapshot } from "../../shared/types";
import { buildLatestWorkshopPriceSnapshotMap } from "./price-latest-map";

function row(partial: Partial<WorkshopPriceSnapshot> & Pick<WorkshopPriceSnapshot, "id" | "itemId">): WorkshopPriceSnapshot {
  return {
    id: partial.id,
    itemId: partial.itemId,
    unitPrice: partial.unitPrice ?? 100,
    capturedAt: partial.capturedAt ?? "2026-02-26T00:00:00.000Z",
    source: partial.source ?? "manual",
    market: partial.market,
    note: partial.note,
  };
}

describe("workshop/price-latest-map", () => {
  it("keeps latest snapshot by capturedAt for each item", () => {
    const map = buildLatestWorkshopPriceSnapshotMap([
      row({ id: "a1", itemId: "item-a", capturedAt: "2026-02-25T00:00:00.000Z" }),
      row({ id: "a2", itemId: "item-a", capturedAt: "2026-02-26T00:00:00.000Z" }),
      row({ id: "b1", itemId: "item-b", capturedAt: "2026-02-24T00:00:00.000Z" }),
    ]);

    expect(map.get("item-a")?.id).toBe("a2");
    expect(map.get("item-b")?.id).toBe("b1");
  });

  it("uses market priority tie-break when capturedAt is equal", () => {
    const map = buildLatestWorkshopPriceSnapshotMap([
      row({ id: "x-world", itemId: "item-x", market: "world" }),
      row({ id: "x-single", itemId: "item-x", market: "single" }),
      row({ id: "x-server", itemId: "item-x", market: "server" }),
    ]);

    expect(map.get("item-x")?.id).toBe("x-server");
  });
});
