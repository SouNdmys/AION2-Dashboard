import { describe, expect, it } from "vitest";
import type { WorkshopPriceSnapshot } from "../../shared/types";
import { selectPriceSnapshotsForHistoryQuery } from "./pricing-history-query";

function row(partial: Partial<WorkshopPriceSnapshot> & Pick<WorkshopPriceSnapshot, "id">): WorkshopPriceSnapshot {
  return {
    id: partial.id,
    itemId: partial.itemId ?? "item-1",
    unitPrice: partial.unitPrice ?? 100,
    capturedAt: partial.capturedAt ?? "2026-02-01T00:00:00.000Z",
    source: partial.source ?? "import",
    market: partial.market,
    note: partial.note,
  };
}

describe("workshop/pricing-history-query", () => {
  it("filters by item, range, and market with normalized market compare", () => {
    const prices: WorkshopPriceSnapshot[] = [
      row({ id: "a", market: "server", capturedAt: "2026-02-01T00:00:00.000Z" }),
      row({ id: "b", market: undefined, capturedAt: "2026-02-02T00:00:00.000Z" }),
      row({ id: "c", market: "world", capturedAt: "2026-02-03T00:00:00.000Z" }),
      row({ id: "d", itemId: "item-2", market: "server", capturedAt: "2026-02-01T00:00:00.000Z" }),
    ];
    const from = new Date("2026-02-01T00:00:00.000Z");
    const to = new Date("2026-02-03T00:00:00.000Z");

    const serverRows = selectPriceSnapshotsForHistoryQuery(prices, "item-1", from, to, "server");
    expect(serverRows.map((entry) => entry.id)).toEqual(["a"]);

    const singleRows = selectPriceSnapshotsForHistoryQuery(prices, "item-1", from, to, "single");
    expect(singleRows.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("skips invalid timestamps and sorts by ts then id", () => {
    const prices: WorkshopPriceSnapshot[] = [
      row({ id: "b", capturedAt: "2026-02-01T00:00:00.000Z" }),
      row({ id: "a", capturedAt: "2026-02-01T00:00:00.000Z" }),
      row({ id: "x", capturedAt: "invalid-date" }),
    ];
    const from = new Date("2026-01-31T00:00:00.000Z");
    const to = new Date("2026-02-02T00:00:00.000Z");
    const rows = selectPriceSnapshotsForHistoryQuery(prices, "item-1", from, to);
    expect(rows.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(rows.some((entry) => entry.id === "x")).toBe(false);
  });
});
