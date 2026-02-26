import type { WorkshopPriceSnapshot } from "../../shared/types";

export interface BuildWorkshopSimulationOutputMetricsInput {
  latestPriceByItemId: Map<string, WorkshopPriceSnapshot>;
  outputItemId: string;
  outputQuantity: number;
  runs: number;
  taxRate: number;
  requiredMaterialCost: number | null;
}

export interface WorkshopSimulationOutputMetrics {
  totalOutputQuantity: number;
  outputUnitPrice: number | null;
  grossRevenue: number | null;
  netRevenueAfterTax: number | null;
  estimatedProfit: number | null;
  estimatedProfitRate: number | null;
}

export function buildWorkshopSimulationOutputMetrics(
  input: BuildWorkshopSimulationOutputMetricsInput,
): WorkshopSimulationOutputMetrics {
  const outputUnitPrice = input.latestPriceByItemId.get(input.outputItemId)?.unitPrice ?? null;
  const totalOutputQuantity = input.outputQuantity * input.runs;
  const grossRevenue = outputUnitPrice === null ? null : outputUnitPrice * totalOutputQuantity;
  const netRevenueAfterTax = grossRevenue === null ? null : grossRevenue * (1 - input.taxRate);
  const estimatedProfit =
    netRevenueAfterTax === null || input.requiredMaterialCost === null
      ? null
      : netRevenueAfterTax - input.requiredMaterialCost;
  const estimatedProfitRate =
    estimatedProfit === null || input.requiredMaterialCost === null || input.requiredMaterialCost <= 0
      ? null
      : estimatedProfit / input.requiredMaterialCost;

  return {
    totalOutputQuantity,
    outputUnitPrice,
    grossRevenue,
    netRevenueAfterTax,
    estimatedProfit,
    estimatedProfitRate,
  };
}
