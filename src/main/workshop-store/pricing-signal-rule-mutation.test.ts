import { describe, expect, it, vi } from "vitest";
import type { WorkshopPriceSignalRule, WorkshopState } from "../../shared/types";
import { runWorkshopSignalRuleMutation } from "./pricing-signal-rule-mutation";

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

describe("workshop/pricing-signal-rule-mutation", () => {
  it("reads state, merges rule and writes with forced version", () => {
    const payload: Partial<WorkshopPriceSignalRule> = {
      lookbackDays: 45,
    };
    const nextRule: WorkshopPriceSignalRule = {
      enabled: true,
      lookbackDays: 45,
      dropBelowWeekdayAverageRatio: 0.22,
    };
    const readState = vi.fn(() => BASE_STATE);
    const writeState = vi.fn((next: WorkshopState) => next);
    const mergeRule = vi.fn(() => nextRule);

    const result = runWorkshopSignalRuleMutation(payload, {
      readState,
      writeState,
      stateVersion: 999,
      mergeRule,
    });

    expect(readState).toHaveBeenCalledTimes(1);
    expect(mergeRule).toHaveBeenCalledWith(BASE_STATE.signalRule, payload);
    expect(writeState).toHaveBeenCalledWith({
      ...BASE_STATE,
      version: 999,
      signalRule: nextRule,
    });
    expect(result.version).toBe(999);
    expect(result.signalRule).toBe(nextRule);
  });
});
