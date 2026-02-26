import { describe, expect, it, vi } from "vitest";
import type { WorkshopState } from "../../shared/types";
import { runWorkshopPriceMutation } from "./pricing-snapshot-mutation";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [],
  recipes: [],
  prices: [
    {
      id: "p1",
      itemId: "item-1",
      unitPrice: 100,
      capturedAt: "2026-02-26T00:00:00.000Z",
      source: "manual",
      market: "single",
    },
  ],
  inventory: [],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

describe("workshop/pricing-snapshot-mutation", () => {
  it("writes mutated prices with forced state version", () => {
    const writeState = vi.fn((next: WorkshopState) => next);
    const result = runWorkshopPriceMutation(
      () => [],
      {
        readState: () => BASE_STATE,
        writeState,
        stateVersion: 999,
      },
    );

    expect(writeState).toHaveBeenCalledTimes(1);
    expect(result.version).toBe(999);
    expect(result.prices).toEqual([]);
  });

  it("returns current state without writing when mutation is noop", () => {
    const writeState = vi.fn((next: WorkshopState) => next);
    const result = runWorkshopPriceMutation(
      () => null,
      {
        readState: () => BASE_STATE,
        writeState,
        stateVersion: 999,
      },
    );

    expect(writeState).not.toHaveBeenCalled();
    expect(result).toBe(BASE_STATE);
  });
});
