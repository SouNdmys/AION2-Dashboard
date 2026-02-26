import { describe, expect, it } from "vitest";
import type { WorkshopRecipeInput, WorkshopState } from "../../shared/types";
import { buildWorkshopSampleSeedState } from "./store-sample-seed";

function createState(overrides?: Partial<WorkshopState>): WorkshopState {
  return {
    version: 6,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
    signalRule: { enabled: true, lookbackDays: 30, dropBelowWeekdayAverageRatio: 0.15 },
    ...overrides,
  };
}

describe("workshop/store-sample-seed", () => {
  it("builds complete sample seed payload from empty state", () => {
    let idCounter = 0;
    const normalizeRecipeInputs = (raw: unknown): WorkshopRecipeInput[] => raw as WorkshopRecipeInput[];
    const seeded = buildWorkshopSampleSeedState(createState(), "2026-02-26T00:00:00.000Z", {
      createId: () => `id-${idCounter++}`,
      normalizeRecipeInputs,
      priceHistoryLimit: 8_000,
    });

    expect(seeded.items.length).toBe(5);
    expect(seeded.recipes.length).toBe(3);
    expect(seeded.prices.length).toBe(5);
    expect(seeded.inventory.length).toBe(5);
    expect(seeded.items.some((item) => item.name === "样例-勇者长剑")).toBe(true);
    expect(seeded.prices.every((entry) => entry.note === "phase1.1-sample-seed")).toBe(true);
  });

  it("does not append duplicate price snapshot when latest unit price already matches", () => {
    const state = createState({
      items: [
        {
          id: "ore-id",
          name: "样例-奥德矿石",
          category: "material",
          createdAt: "2026-02-25T00:00:00.000Z",
          updatedAt: "2026-02-25T00:00:00.000Z",
        },
      ],
      prices: [
        {
          id: "ore-price-old",
          itemId: "ore-id",
          unitPrice: 80,
          capturedAt: "2026-02-25T00:00:00.000Z",
          source: "manual",
          market: "single",
        },
      ],
    });

    let idCounter = 0;
    const seeded = buildWorkshopSampleSeedState(state, "2026-02-26T00:00:00.000Z", {
      createId: () => `id-${idCounter++}`,
      normalizeRecipeInputs: (raw: unknown) => raw as WorkshopRecipeInput[],
      priceHistoryLimit: 8_000,
    });

    expect(seeded.prices.filter((entry) => entry.itemId === "ore-id")).toHaveLength(1);
  });
});
