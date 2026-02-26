import { describe, expect, it } from "vitest";
import type { WorkshopItem } from "../../shared/types";
import { buildWorkshopSimulationCraftSteps } from "./simulation-craft-steps";

function item(id: string, name: string): WorkshopItem {
  return {
    id,
    name,
    category: "material",
    createdAt: "2026-02-26T00:00:00.000Z",
    updatedAt: "2026-02-26T00:00:00.000Z",
  };
}

describe("workshop/simulation-craft-steps", () => {
  it("builds and sorts craft steps by runs desc then name", () => {
    const craftRuns = new Map<string, number>([
      ["item-b", 3],
      ["item-a", 3],
      ["item-c", 1],
    ]);
    const itemById = new Map<string, WorkshopItem>([
      ["item-a", item("item-a", "A材料")],
      ["item-b", item("item-b", "B材料")],
    ]);

    const steps = buildWorkshopSimulationCraftSteps(craftRuns, itemById);

    expect(steps.map((entry) => entry.itemId)).toEqual(["item-a", "item-b", "item-c"]);
    expect(steps.find((entry) => entry.itemId === "item-c")?.itemName).toBe("item-c");
  });
});
