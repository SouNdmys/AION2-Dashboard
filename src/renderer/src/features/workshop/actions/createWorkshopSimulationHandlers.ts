import type { WorkshopCraftSimulationResult, WorkshopState } from "../../../../../shared/types";
import type { SimulationRecipeOption } from "../workshop-view-helpers";
import { toInt } from "../workshop-view-helpers";

type WorkshopActions = NonNullable<Window["aionApi"]>;

interface CreateWorkshopSimulationHandlersParams {
  simulateRecipeId: string;
  simulateRuns: string;
  taxRate: number;
  simulation: WorkshopCraftSimulationResult | null;
  simulationRecipeOptions: SimulationRecipeOption[];
  simulationMaterialDraft: Record<string, { unitPrice: string; owned: string }>;
  simulationOutputPriceDraft: string;
  workshopActions: WorkshopActions;
  setBusy: (busy: boolean) => void;
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setState: (state: WorkshopState) => void;
  setSimulation: (result: WorkshopCraftSimulationResult | null) => void;
  setSimulationMaterialDraft: (value: Record<string, { unitPrice: string; owned: string }>) => void;
  setSimulationOutputPriceDraft: (value: string) => void;
  setSimulateMainCategory: (value: string) => void;
  setSimulateSubCategory: (value: "all" | string) => void;
  setSimulateRecipeId: (value: string) => void;
  loadCraftOptions: () => Promise<void>;
  loadSignals: () => Promise<void>;
}

interface WorkshopSimulationHandlers {
  onJumpSimulationRecipe: (recipeId: string) => void;
  onSimulate: () => Promise<void>;
  onApplySimulationMaterialEdits: () => Promise<void>;
}

export function createWorkshopSimulationHandlers(params: CreateWorkshopSimulationHandlersParams): WorkshopSimulationHandlers {
  const {
    simulateRecipeId,
    simulateRuns,
    taxRate,
    simulation,
    simulationRecipeOptions,
    simulationMaterialDraft,
    simulationOutputPriceDraft,
    workshopActions,
    setBusy,
    setError,
    setMessage,
    setState,
    setSimulation,
    setSimulationMaterialDraft,
    setSimulationOutputPriceDraft,
    setSimulateMainCategory,
    setSimulateSubCategory,
    setSimulateRecipeId,
    loadCraftOptions,
    loadSignals,
  } = params;

  function onJumpSimulationRecipe(recipeId: string): void {
    const target = simulationRecipeOptions.find((entry) => entry.id === recipeId);
    if (!target) {
      setError("无法定位该配方。");
      return;
    }
    setSimulateMainCategory(target.mainCategory);
    setSimulateSubCategory(target.subCategory);
    setSimulateRecipeId(target.id);
    setMessage(`已定位到制作模拟器：${target.outputName}`);
  }

  async function onSimulate(): Promise<void> {
    if (!simulateRecipeId) {
      setError("请先选择要模拟的配方。");
      return;
    }
    const runs = toInt(simulateRuns);
    if (runs === null || runs <= 0) {
      setError("制作次数必须是正整数。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await workshopActions.simulateWorkshopCraft({
        recipeId: simulateRecipeId,
        runs,
        taxRate,
        materialMode: "direct",
      });
      setSimulation(result);
      const draftMap: Record<string, { unitPrice: string; owned: string }> = {};
      result.materialRows.forEach((row) => {
        draftMap[row.itemId] = {
          unitPrice: row.latestUnitPrice === null ? "" : String(row.latestUnitPrice),
          owned: String(row.owned),
        };
      });
      setSimulationMaterialDraft(draftMap);
      setSimulationOutputPriceDraft(result.outputUnitPrice === null ? "" : String(result.outputUnitPrice));
      setMessage("模拟完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模拟失败");
    } finally {
      setBusy(false);
    }
  }

  async function onApplySimulationMaterialEdits(): Promise<void> {
    if (!simulation) {
      setError("请先运行一次模拟。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const outputPriceText = simulationOutputPriceDraft.trim();
      if (outputPriceText) {
        const outputUnitPrice = toInt(outputPriceText);
        if (outputUnitPrice === null || outputUnitPrice <= 0) {
          throw new Error(`成品「${simulation.outputItemName}」售价必须是大于 0 的整数。`);
        }
        if (simulation.outputUnitPrice === null || outputUnitPrice !== simulation.outputUnitPrice) {
          await workshopActions.addWorkshopPriceSnapshot({
            itemId: simulation.outputItemId,
            unitPrice: outputUnitPrice,
            source: "manual",
            note: "simulate-output-edit",
          });
        }
      }

      for (const row of simulation.materialRows) {
        const draft = simulationMaterialDraft[row.itemId];
        if (!draft) {
          continue;
        }
        const owned = toInt(draft.owned);
        if (owned === null || owned < 0) {
          throw new Error(`材料「${row.itemName}」库存必须是大于等于 0 的整数。`);
        }
        if (owned !== row.owned) {
          await workshopActions.upsertWorkshopInventory({ itemId: row.itemId, quantity: owned });
        }
        const priceText = draft.unitPrice.trim();
        if (priceText) {
          const unitPrice = toInt(priceText);
          if (unitPrice === null || unitPrice <= 0) {
            throw new Error(`材料「${row.itemName}」单价必须是大于 0 的整数。`);
          }
          if (row.latestUnitPrice === null || unitPrice !== row.latestUnitPrice) {
            await workshopActions.addWorkshopPriceSnapshot({
              itemId: row.itemId,
              unitPrice,
              source: "manual",
              note: "simulate-inline-edit",
            });
          }
        }
      }

      const [nextState, rerun] = await Promise.all([
        workshopActions.getWorkshopState(),
        workshopActions.simulateWorkshopCraft({
          recipeId: simulation.recipeId,
          runs: simulation.runs,
          taxRate,
          materialMode: "direct",
        }),
      ]);
      setState(nextState);
      setSimulation(rerun);
      const nextDraftMap: Record<string, { unitPrice: string; owned: string }> = {};
      rerun.materialRows.forEach((row) => {
        nextDraftMap[row.itemId] = {
          unitPrice: row.latestUnitPrice === null ? "" : String(row.latestUnitPrice),
          owned: String(row.owned),
        };
      });
      setSimulationMaterialDraft(nextDraftMap);
      setSimulationOutputPriceDraft(rerun.outputUnitPrice === null ? "" : String(rerun.outputUnitPrice));
      await Promise.all([loadCraftOptions(), loadSignals()]);
      setMessage("成品/材料价格与库存已保存，并已按最新数据重算。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新材料参数失败");
    } finally {
      setBusy(false);
    }
  }

  return {
    onJumpSimulationRecipe,
    onSimulate,
    onApplySimulationMaterialEdits,
  };
}
