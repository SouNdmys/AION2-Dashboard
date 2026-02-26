import { describe, expect, it } from "vitest";
import type { WorkshopPriceSnapshot } from "../../shared/types";
import { buildWorkshopSimulationOutputMetrics } from "./simulation-output-metrics";

function priceSnapshot(itemId: string, unitPrice: number): WorkshopPriceSnapshot {
  return {
    id: `${itemId}-${unitPrice}`,
    itemId,
    unitPrice,
    capturedAt: "2026-02-26T00:00:00.000Z",
    source: "manual",
    market: "server",
  };
}

describe("workshop/simulation-output-metrics", () => {
  it("builds output revenue and profit metrics when price and cost are known", () => {
    const metrics = buildWorkshopSimulationOutputMetrics({
      latestPriceByItemId: new Map([["output-item", priceSnapshot("output-item", 200)]]),
      outputItemId: "output-item",
      outputQuantity: 2,
      runs: 3,
      taxRate: 0.1,
      requiredMaterialCost: 500,
    });

    expect(metrics.totalOutputQuantity).toBe(6);
    expect(metrics.outputUnitPrice).toBe(200);
    expect(metrics.grossRevenue).toBe(1_200);
    expect(metrics.netRevenueAfterTax).toBe(1_080);
    expect(metrics.estimatedProfit).toBe(580);
    expect(metrics.estimatedProfitRate).toBe(1.16);
  });

  it("returns null profit rate when material cost is unknown or non-positive", () => {
    const unknownCostMetrics = buildWorkshopSimulationOutputMetrics({
      latestPriceByItemId: new Map([["output-item", priceSnapshot("output-item", 100)]]),
      outputItemId: "output-item",
      outputQuantity: 1,
      runs: 2,
      taxRate: 0.1,
      requiredMaterialCost: null,
    });
    expect(unknownCostMetrics.estimatedProfit).toBeNull();
    expect(unknownCostMetrics.estimatedProfitRate).toBeNull();

    const zeroCostMetrics = buildWorkshopSimulationOutputMetrics({
      latestPriceByItemId: new Map([["output-item", priceSnapshot("output-item", 100)]]),
      outputItemId: "output-item",
      outputQuantity: 1,
      runs: 2,
      taxRate: 0.1,
      requiredMaterialCost: 0,
    });
    expect(zeroCostMetrics.estimatedProfit).toBe(180);
    expect(zeroCostMetrics.estimatedProfitRate).toBeNull();
  });
});
