import { describe, expect, it } from "vitest";
import { buildWorkshopInventoryAfterUpsert } from "./store-inventory-upsert";

describe("workshop/store-inventory-upsert", () => {
  it("upserts one row and keeps inventory sorted by itemId", () => {
    const next = buildWorkshopInventoryAfterUpsert({
      inventory: [
        { itemId: "b", quantity: 2, updatedAt: "2026-02-25T00:00:00.000Z" },
        { itemId: "a", quantity: 1, updatedAt: "2026-02-25T00:00:00.000Z" },
      ],
      itemId: "c",
      quantity: 8,
      nowIso: "2026-02-26T00:00:00.000Z",
    });

    expect(next.map((row) => row.itemId)).toEqual(["a", "b", "c"]);
    expect(next.find((row) => row.itemId === "c")?.quantity).toBe(8);
  });

  it("removes row when quantity is zero", () => {
    const next = buildWorkshopInventoryAfterUpsert({
      inventory: [
        { itemId: "b", quantity: 2, updatedAt: "2026-02-25T00:00:00.000Z" },
        { itemId: "a", quantity: 1, updatedAt: "2026-02-25T00:00:00.000Z" },
      ],
      itemId: "a",
      quantity: 0,
      nowIso: "2026-02-26T00:00:00.000Z",
    });

    expect(next).toEqual([{ itemId: "b", quantity: 2, updatedAt: "2026-02-25T00:00:00.000Z" }]);
  });
});
