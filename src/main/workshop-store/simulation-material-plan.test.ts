import { describe, expect, it } from "vitest";
import type { WorkshopItem, WorkshopRecipe } from "../../shared/types";
import { buildWorkshopSimulationMaterialPlan } from "./simulation-material-plan";

function item(id: string, name: string): WorkshopItem {
  return {
    id,
    name,
    category: "material",
    createdAt: "2026-02-26T00:00:00.000Z",
    updatedAt: "2026-02-26T00:00:00.000Z",
  };
}

function recipe(id: string, outputItemId: string, outputQuantity: number, inputs: WorkshopRecipe["inputs"]): WorkshopRecipe {
  return {
    id,
    outputItemId,
    outputQuantity,
    inputs,
    updatedAt: "2026-02-26T00:00:00.000Z",
  };
}

describe("workshop/simulation-material-plan", () => {
  it("expands nested recipes in expanded mode", () => {
    const rootRecipe = recipe("recipe-sword", "sword", 1, [
      { itemId: "bar", quantity: 2 },
      { itemId: "ore", quantity: 1 },
    ]);
    const recipeByOutput = new Map<string, WorkshopRecipe>([
      [
        "bar",
        recipe("recipe-bar", "bar", 1, [{ itemId: "dust", quantity: 3 }]),
      ],
      [
        "dust",
        recipe("recipe-dust", "dust", 1, [{ itemId: "ore", quantity: 2 }]),
      ],
    ]);

    const plan = buildWorkshopSimulationMaterialPlan({
      recipeByOutput,
      itemById: new Map<string, WorkshopItem>([
        ["sword", item("sword", "勇者剑")],
        ["bar", item("bar", "强化锭")],
        ["dust", item("dust", "研磨粉")],
        ["ore", item("ore", "矿石")],
      ]),
      recipe: rootRecipe,
      runs: 2,
      materialMode: "expanded",
    });

    expect(plan.requiredMaterials.get("ore")).toBe(26);
    expect(plan.requiredMaterials.size).toBe(1);
    expect(plan.craftRuns.get("sword")).toBe(2);
    expect(plan.craftRuns.get("bar")).toBe(4);
    expect(plan.craftRuns.get("dust")).toBe(12);
  });

  it("keeps direct inputs in direct mode", () => {
    const rootRecipe = recipe("recipe-sword", "sword", 1, [
      { itemId: "bar", quantity: 2 },
      { itemId: "ore", quantity: 1 },
    ]);

    const plan = buildWorkshopSimulationMaterialPlan({
      recipeByOutput: new Map<string, WorkshopRecipe>(),
      itemById: new Map<string, WorkshopItem>(),
      recipe: rootRecipe,
      runs: 3,
      materialMode: "direct",
    });

    expect(plan.requiredMaterials.get("bar")).toBe(6);
    expect(plan.requiredMaterials.get("ore")).toBe(3);
    expect(plan.craftRuns.get("sword")).toBe(3);
    expect(plan.craftRuns.size).toBe(1);
  });

  it("throws with named loop path when recipe cycle is detected", () => {
    const recipeA = recipe("recipe-a", "item-a", 1, [{ itemId: "item-b", quantity: 1 }]);
    const recipeB = recipe("recipe-b", "item-b", 1, [{ itemId: "item-a", quantity: 1 }]);

    expect(() =>
      buildWorkshopSimulationMaterialPlan({
        recipeByOutput: new Map<string, WorkshopRecipe>([
          ["item-a", recipeA],
          ["item-b", recipeB],
        ]),
        itemById: new Map<string, WorkshopItem>([
          ["item-a", item("item-a", "物品A")],
          ["item-b", item("item-b", "物品B")],
        ]),
        recipe: recipeA,
        runs: 1,
        materialMode: "expanded",
      }),
    ).toThrow("检测到配方循环引用: 物品B -> 物品A -> 物品B");
  });
});
