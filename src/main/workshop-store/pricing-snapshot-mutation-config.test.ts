import { describe, expect, it, vi } from "vitest";
import type { WorkshopState } from "../../shared/types";
import { createWorkshopPriceSnapshotWithAnomalyDeps } from "./pricing-snapshot-create";
import { createWorkshopPriceSnapshotMutationContext } from "./pricing-snapshot-mutation-config";

const BASE_STATE: WorkshopState = {
  version: 6,
  items: [],
  recipes: [],
  prices: [],
  inventory: [],
  signalRule: {
    enabled: true,
    lookbackDays: 30,
    dropBelowWeekdayAverageRatio: 0.15,
  },
};

describe("workshop/pricing-snapshot-mutation-config", () => {
  it("builds mutation and add deps from one input", () => {
    const readState = vi.fn(() => BASE_STATE);
    const writeState = vi.fn((next: WorkshopState) => next);
    const snapshotCreateDeps = createWorkshopPriceSnapshotWithAnomalyDeps({
      toNonNegativeInt: (raw, fallback) => (typeof raw === "number" ? raw : fallback),
      asIso: (_raw, fallbackIso) => fallbackIso,
    });
    const snapshotItemDeps = { ensureItemExists: vi.fn() };

    const context = createWorkshopPriceSnapshotMutationContext({
      readState,
      writeState,
      stateVersion: 999,
      historyLimit: 120,
      snapshotCreateDeps,
      snapshotItemDeps,
    });

    expect(context.mutationDeps).toEqual({
      readState,
      writeState,
      stateVersion: 999,
    });
    expect(context.addDeps.historyLimit).toBe(120);
    expect(context.addDeps.snapshotCreateDeps).toBe(snapshotCreateDeps);
    expect(context.addDeps.snapshotItemDeps).toBe(snapshotItemDeps);
  });
});
