import { describe, expect, it, vi } from "vitest";
import type { AddWorkshopPriceSnapshotInput, WorkshopPriceSnapshot, WorkshopState } from "../../shared/types";
import { createWorkshopPriceSnapshotWithAnomalyDeps } from "./pricing-snapshot-create";
import { buildWorkshopPricesWithAddedSnapshot } from "./pricing-snapshot-add";

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

const PAYLOAD: AddWorkshopPriceSnapshotInput = {
  itemId: "item-1",
  unitPrice: 120_000,
};

describe("workshop/pricing-snapshot-add", () => {
  it("orchestrates resolve/build/append calls", () => {
    const snapshot: WorkshopPriceSnapshot = {
      id: "snapshot-1",
      itemId: "item-1",
      unitPrice: 120_000,
      capturedAt: "2026-02-26T00:00:00.000Z",
      source: "manual",
      market: "single",
    };
    const resolveItemCategory = vi.fn(() => "equipment" as const);
    const buildSnapshot = vi.fn(() => snapshot);
    const appendSnapshot = vi.fn(() => [snapshot]);
    const snapshotCreateDeps = createWorkshopPriceSnapshotWithAnomalyDeps({
      toNonNegativeInt: (raw, fallback) => (typeof raw === "number" ? raw : fallback),
      asIso: (_raw, fallbackIso) => fallbackIso,
      nowIso: () => "2026-02-26T00:00:00.000Z",
      createId: () => "snapshot-1",
    });
    const snapshotItemDeps = { ensureItemExists: vi.fn() };

    const result = buildWorkshopPricesWithAddedSnapshot(
      {
        state: BASE_STATE,
        payload: PAYLOAD,
        historyLimit: 100,
        snapshotCreateDeps,
        snapshotItemDeps,
      },
      {
        resolveItemCategory,
        buildSnapshot,
        appendSnapshot,
      },
    );

    expect(resolveItemCategory).toHaveBeenCalledWith(BASE_STATE, "item-1", snapshotItemDeps);
    expect(buildSnapshot).toHaveBeenCalledWith(
      {
        payload: PAYLOAD,
        prices: BASE_STATE.prices,
        itemCategory: "equipment",
      },
      snapshotCreateDeps,
    );
    expect(appendSnapshot).toHaveBeenCalledWith(BASE_STATE.prices, snapshot, 100);
    expect(result).toEqual([snapshot]);
  });

  it("rethrows resolver validation errors", () => {
    expect(() =>
      buildWorkshopPricesWithAddedSnapshot(
        {
          state: BASE_STATE,
          payload: PAYLOAD,
          historyLimit: 100,
          snapshotCreateDeps: createWorkshopPriceSnapshotWithAnomalyDeps({
            toNonNegativeInt: (raw, fallback) => (typeof raw === "number" ? raw : fallback),
            asIso: (_raw, fallbackIso) => fallbackIso,
          }),
          snapshotItemDeps: {
            ensureItemExists: vi.fn(),
          },
        },
        {
          resolveItemCategory: () => {
            throw new Error("物品不存在。");
          },
          buildSnapshot: vi.fn(),
          appendSnapshot: vi.fn(),
        },
      ),
    ).toThrow("物品不存在。");
  });
});
