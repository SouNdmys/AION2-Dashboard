import { describe, expect, it, vi } from "vitest";
import type { WorkshopState } from "../../shared/types";
import { resolveWorkshopPriceSnapshotItemCategory } from "./pricing-snapshot-item";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [
    {
      id: "item-1",
      name: "item-1",
      category: "equipment",
      createdAt: "2026-02-26T00:00:00.000Z",
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
  ],
  recipes: [],
  prices: [],
  inventory: [],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

describe("workshop/pricing-snapshot-item", () => {
  it("returns existing item category after ensure check", () => {
    const ensureItemExists = vi.fn();
    const category = resolveWorkshopPriceSnapshotItemCategory(BASE_STATE, "item-1", { ensureItemExists });

    expect(ensureItemExists).toHaveBeenCalledWith(BASE_STATE, "item-1");
    expect(category).toBe("equipment");
  });

  it("falls back to other when ensure is noop and item is missing", () => {
    const category = resolveWorkshopPriceSnapshotItemCategory(
      {
        ...BASE_STATE,
        items: [],
      },
      "missing-item",
      { ensureItemExists: () => undefined },
    );

    expect(category).toBe("other");
  });

  it("rethrows ensure validation errors", () => {
    expect(() =>
      resolveWorkshopPriceSnapshotItemCategory(BASE_STATE, "missing-item", {
        ensureItemExists: () => {
          throw new Error("物品不存在。");
        },
      }),
    ).toThrow("物品不存在。");
  });
});
