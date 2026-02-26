import type { WorkshopItem, WorkshopSimulationCraftStep } from "../../shared/types";

export function buildWorkshopSimulationCraftSteps(
  craftRuns: Map<string, number>,
  itemById: Map<string, WorkshopItem>,
): WorkshopSimulationCraftStep[] {
  return Array.from(craftRuns.entries())
    .map(([itemId, runs]) => ({
      itemId,
      itemName: itemById.get(itemId)?.name ?? itemId,
      runs,
    }))
    .sort((left, right) => right.runs - left.runs || left.itemName.localeCompare(right.itemName, "zh-CN"));
}
