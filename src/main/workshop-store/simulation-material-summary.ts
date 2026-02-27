import type { WorkshopItem, WorkshopPriceSnapshot, WorkshopSimulationMaterialRow } from "../../shared/types";

export interface BuildWorkshopSimulationMaterialSummaryInput {
  requiredMaterials: Map<string, number>;
  itemById: Map<string, WorkshopItem>;
  inventoryByItemId: Map<string, number>;
  latestPriceByItemId: Map<string, WorkshopPriceSnapshot>;
}

export interface WorkshopSimulationMaterialSummary {
  materialRows: WorkshopSimulationMaterialRow[];
  unknownPriceItemIds: string[];
  requiredMaterialCost: number | null;
  missingPurchaseCost: number | null;
}

export function buildWorkshopSimulationMaterialSummary(
  input: BuildWorkshopSimulationMaterialSummaryInput,
): WorkshopSimulationMaterialSummary {
  const materialRows = Array.from(input.requiredMaterials.entries())
    .map(([itemId, required]) => {
      const requiredQty = Math.max(0, Math.floor(required));
      const owned = Math.max(0, Math.floor(input.inventoryByItemId.get(itemId) ?? 0));
      const missing = Math.max(0, requiredQty - owned);
      const latestPrice = input.latestPriceByItemId.get(itemId) ?? null;
      const latestUnitPrice = latestPrice?.unitPrice ?? null;
      const requiredCost = latestUnitPrice === null ? null : latestUnitPrice * requiredQty;
      const missingCost = latestUnitPrice === null ? null : latestUnitPrice * missing;
      return {
        itemId,
        itemName: input.itemById.get(itemId)?.name ?? itemId,
        required: requiredQty,
        owned,
        missing,
        latestUnitPrice,
        latestPriceMarket: latestPrice?.market,
        requiredCost,
        missingCost,
      };
    })
    .sort((left, right) => right.missing - left.missing || left.itemName.localeCompare(right.itemName, "zh-CN"));

  const unknownPriceItemIds = materialRows.filter((row) => row.latestUnitPrice === null).map((row) => row.itemId);
  const requiredMaterialCost =
    unknownPriceItemIds.length > 0 ? null : materialRows.reduce((acc, row) => acc + (row.requiredCost ?? 0), 0);
  const missingPurchaseCost =
    unknownPriceItemIds.length > 0 ? null : materialRows.reduce((acc, row) => acc + (row.missingCost ?? 0), 0);

  return {
    materialRows,
    unknownPriceItemIds,
    requiredMaterialCost,
    missingPurchaseCost,
  };
}
