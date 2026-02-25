import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopState } from "../../shared/types";

const {
  mockReadWorkshopState,
  mockWriteWorkshopState,
  mockEnsureItemExists,
  mockToNonNegativeInt,
  mockNormalizeRecipeInputs,
} = vi.hoisted(() => ({
  mockReadWorkshopState: vi.fn(),
  mockWriteWorkshopState: vi.fn(),
  mockEnsureItemExists: vi.fn(),
  mockToNonNegativeInt: vi.fn(),
  mockNormalizeRecipeInputs: vi.fn((inputs) => inputs),
}));

vi.mock("../workshop-store-core", () => ({
  WORKSHOP_STATE_VERSION: 6,
  WORKSHOP_PRICE_HISTORY_LIMIT: 8_000,
  readWorkshopState: mockReadWorkshopState,
  writeWorkshopState: mockWriteWorkshopState,
  ensureItemExists: mockEnsureItemExists,
  toNonNegativeInt: mockToNonNegativeInt,
  normalizeRecipeInputs: mockNormalizeRecipeInputs,
}));

import { getWorkshopState, seedWorkshopSampleData, upsertWorkshopInventory } from "./store";

function createState(): WorkshopState {
  return {
    version: 6,
    items: [{ id: "a", name: "A", category: "material", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    recipes: [],
    prices: [],
    inventory: [
      { itemId: "b", quantity: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
      { itemId: "a", quantity: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    signalRule: { enabled: true, lookbackDays: 30, dropBelowWeekdayAverageRatio: 0.15 },
  };
}

describe("workshop/store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteWorkshopState.mockImplementation((next) => next);
    mockToNonNegativeInt.mockImplementation((value: number) => Math.floor(value));
  });

  it("getWorkshopState reads state from core", () => {
    const state = createState();
    mockReadWorkshopState.mockReturnValue(state);

    const result = getWorkshopState();

    expect(result).toBe(state);
    expect(mockReadWorkshopState).toHaveBeenCalledTimes(1);
  });

  it("upsertWorkshopInventory writes sorted inventory by itemId", () => {
    mockReadWorkshopState.mockReturnValue(createState());

    const next = upsertWorkshopInventory({ itemId: "c", quantity: 8 });

    expect(next.inventory.map((row) => row.itemId)).toEqual(["a", "b", "c"]);
    expect(next.inventory.find((row) => row.itemId === "c")?.quantity).toBe(8);
  });

  it("seedWorkshopSampleData writes deterministic sample seed", () => {
    mockReadWorkshopState.mockReturnValue(createState());

    const result = seedWorkshopSampleData();

    expect(mockWriteWorkshopState).toHaveBeenCalledTimes(1);
    expect(result.items.some((item) => item.name === "样例-勇者长剑")).toBe(true);
    expect(result.recipes.some((recipe) => recipe.outputQuantity > 0)).toBe(true);
    expect(result.prices.some((price) => price.note === "phase1.1-sample-seed")).toBe(true);
    expect(result.inventory.some((row) => row.quantity >= 0)).toBe(true);
  });
});
