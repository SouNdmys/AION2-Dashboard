import { useMemo } from "react";
import type { WorkshopCraftOption, WorkshopItemCategory, WorkshopPriceMarket, WorkshopState } from "../../../../../shared/types";
import {
  type ClassifiedItemOption,
  type LatestPriceMetaByMarket,
  type ReverseCraftSuggestionRow,
  type ReverseScoreMode,
  toInt,
} from "../workshop-view-helpers";

interface ItemMetaLite {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

interface UseWorkshopEconomyModelsParams {
  state: WorkshopState | null;
  craftOptions: WorkshopCraftOption[];
  itemById: Map<string, ItemMetaLite>;
  classifiedItemOptions: ClassifiedItemOption[];
  reverseCraftBudgetInput: string;
  reverseMaterialKeyword: string;
  reverseFocusMaterialId: string;
  reverseScoreMode: ReverseScoreMode;
}

interface WorkshopEconomyModels {
  latestPriceMetaByItemId: Map<string, LatestPriceMetaByMarket>;
  inventoryByItemId: Map<string, number>;
  reverseCraftBudget: number;
  reverseMaterialOptions: ClassifiedItemOption[];
  reverseFocusMaterialName: string | null;
  reverseScoreModeLabel: string;
  reverseCraftSuggestions: ReverseCraftSuggestionRow[];
}

export function useWorkshopEconomyModels(params: UseWorkshopEconomyModelsParams): WorkshopEconomyModels {
  const {
    state,
    craftOptions,
    itemById,
    classifiedItemOptions,
    reverseCraftBudgetInput,
    reverseMaterialKeyword,
    reverseFocusMaterialId,
    reverseScoreMode,
  } = params;

  const latestPriceMetaByItemId = useMemo(() => {
    if (!state) return new Map<string, LatestPriceMetaByMarket>();
    const map = new Map<string, LatestPriceMetaByMarket>();
    state.prices.forEach((snapshot) => {
      const market: WorkshopPriceMarket = snapshot.market ?? "single";
      const ts = new Date(snapshot.capturedAt).getTime();
      if (!Number.isFinite(ts)) {
        return;
      }
      const current = map.get(snapshot.itemId) ?? { server: null, world: null, single: null };
      const prev = current[market];
      if (!prev || ts >= prev.capturedAt) {
        current[market] = { price: snapshot.unitPrice, capturedAt: ts };
        map.set(snapshot.itemId, current);
      }
    });
    return map;
  }, [state]);

  const inventoryByItemId = useMemo(() => {
    if (!state) return new Map<string, number>();
    return new Map(state.inventory.map((row) => [row.itemId, row.quantity]));
  }, [state]);

  const reverseCraftBudget = useMemo(() => {
    const parsed = toInt(reverseCraftBudgetInput);
    if (parsed === null || parsed < 0) {
      return 0;
    }
    return parsed;
  }, [reverseCraftBudgetInput]);

  const reverseMaterialOptions = useMemo(() => {
    const keyword = reverseMaterialKeyword.trim().toLocaleLowerCase();
    const matched = classifiedItemOptions.filter((item) => {
      if (!keyword) {
        return true;
      }
      return item.name.toLocaleLowerCase().includes(keyword);
    });
    matched.sort((left, right) => {
      const leftOwned = inventoryByItemId.get(left.id) ?? 0;
      const rightOwned = inventoryByItemId.get(right.id) ?? 0;
      if (leftOwned !== rightOwned) {
        return rightOwned - leftOwned;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
    if (reverseFocusMaterialId && !matched.some((item) => item.id === reverseFocusMaterialId)) {
      const selected = classifiedItemOptions.find((item) => item.id === reverseFocusMaterialId);
      if (selected) {
        matched.unshift(selected);
      }
    }
    return matched.slice(0, 500);
  }, [classifiedItemOptions, inventoryByItemId, reverseMaterialKeyword, reverseFocusMaterialId]);

  const reverseFocusMaterialName = useMemo(() => {
    if (!reverseFocusMaterialId) {
      return null;
    }
    return itemById.get(reverseFocusMaterialId)?.name ?? reverseFocusMaterialId;
  }, [reverseFocusMaterialId, itemById]);

  const reverseScoreModeLabel = useMemo(() => {
    if (reverseScoreMode === "coverage") {
      return "覆盖率优先";
    }
    if (reverseScoreMode === "profit") {
      return "利润优先";
    }
    if (reverseScoreMode === "craftable") {
      return "可直接制作优先";
    }
    return "平衡模式";
  }, [reverseScoreMode]);

  const reverseCraftSuggestions = useMemo(() => {
    const focusMaterialId = reverseFocusMaterialId || null;
    return craftOptions
      .map((option) => {
        const materialRows = option.materialRowsForOneRun;
        if (materialRows.length === 0) {
          return null;
        }
        const focusRow = focusMaterialId ? materialRows.find((row) => row.itemId === focusMaterialId) ?? null : null;
        if (focusMaterialId && !focusRow) {
          return null;
        }
        const matchedOwnedMaterialCount = materialRows.filter((row) => row.owned > 0).length;
        if (!focusMaterialId && matchedOwnedMaterialCount <= 0 && option.craftableCount <= 0) {
          return null;
        }
        const totalRequired = materialRows.reduce((acc, row) => acc + Math.max(0, row.required), 0);
        const coveredRequired = materialRows.reduce((acc, row) => acc + Math.min(Math.max(0, row.owned), Math.max(0, row.required)), 0);
        const coverageRatio = totalRequired <= 0 ? 0 : coveredRequired / totalRequired;
        const missingRows = materialRows.filter((row) => row.missing > 0);
        const unknownPriceRows = missingRows.filter((row) => row.missingCost === null || row.latestUnitPrice === null);
        const missingPurchaseCostPerRun =
          unknownPriceRows.length > 0 ? null : missingRows.reduce((acc, row) => acc + (row.missingCost ?? 0), 0);
        let suggestedRunsByBudget = 0;
        if (missingPurchaseCostPerRun !== null) {
          if (missingPurchaseCostPerRun <= 0) {
            suggestedRunsByBudget = Math.max(1, option.craftableCount);
          } else {
            suggestedRunsByBudget = Math.max(0, Math.floor(reverseCraftBudget / missingPurchaseCostPerRun));
          }
        }
        const estimatedBudgetProfit =
          option.estimatedProfitPerRun === null || suggestedRunsByBudget <= 0 ? null : option.estimatedProfitPerRun * suggestedRunsByBudget;
        const coverageScore = coverageRatio * 100;
        const ownedScore = matchedOwnedMaterialCount * 3;
        const craftableScore = Math.min(option.craftableCount, 30);
        const focusBoost = focusRow ? 24 : 0;
        const gapPenalty = missingRows.length;
        const perRunProfitPositive = Math.max(0, option.estimatedProfitPerRun ?? 0);
        const budgetProfitPositive = Math.max(0, estimatedBudgetProfit ?? 0);
        let relevanceScore = 0;
        if (reverseScoreMode === "coverage") {
          relevanceScore = coverageScore * 1.35 + ownedScore + focusBoost + craftableScore - gapPenalty;
        } else if (reverseScoreMode === "profit") {
          relevanceScore = perRunProfitPositive / 8000 + budgetProfitPositive / 15000 + coverageScore * 0.45 + focusBoost - gapPenalty;
        } else if (reverseScoreMode === "craftable") {
          relevanceScore = craftableScore * 6 + coverageScore * 0.4 + focusBoost + perRunProfitPositive / 20000 - gapPenalty;
        } else {
          relevanceScore = coverageScore + ownedScore + craftableScore * 2 + focusBoost + perRunProfitPositive / 20000 - gapPenalty;
        }
        return {
          recipeId: option.recipeId,
          outputItemId: option.outputItemId,
          outputItemName: option.outputItemName,
          relatedByFocusMaterial: Boolean(focusRow),
          focusMaterialRequired: focusRow?.required ?? 0,
          focusMaterialOwned: focusRow?.owned ?? 0,
          totalMaterialCount: materialRows.length,
          matchedOwnedMaterialCount,
          coverageRatio,
          craftableCount: option.craftableCount,
          requiredMaterialCostPerRun: option.requiredMaterialCostPerRun,
          estimatedProfitPerRun: option.estimatedProfitPerRun,
          missingRows,
          unknownPriceRows,
          missingPurchaseCostPerRun,
          suggestedRunsByBudget,
          estimatedBudgetProfit,
          relevanceScore,
        } satisfies ReverseCraftSuggestionRow;
      })
      .filter((entry): entry is ReverseCraftSuggestionRow => entry !== null)
      .sort((left, right) => {
        if (right.relevanceScore !== left.relevanceScore) {
          return right.relevanceScore - left.relevanceScore;
        }
        const leftProfit = left.estimatedBudgetProfit ?? Number.NEGATIVE_INFINITY;
        const rightProfit = right.estimatedBudgetProfit ?? Number.NEGATIVE_INFINITY;
        if (rightProfit !== leftProfit) {
          return rightProfit - leftProfit;
        }
        const leftPerRunProfit = left.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
        const rightPerRunProfit = right.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
        if (rightPerRunProfit !== leftPerRunProfit) {
          return rightPerRunProfit - leftPerRunProfit;
        }
        const leftCost = left.missingPurchaseCostPerRun ?? Number.MAX_SAFE_INTEGER;
        const rightCost = right.missingPurchaseCostPerRun ?? Number.MAX_SAFE_INTEGER;
        if (leftCost !== rightCost) {
          return leftCost - rightCost;
        }
        return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
      });
  }, [craftOptions, reverseFocusMaterialId, reverseCraftBudget, reverseScoreMode]);

  return {
    latestPriceMetaByItemId,
    inventoryByItemId,
    reverseCraftBudget,
    reverseMaterialOptions,
    reverseFocusMaterialName,
    reverseScoreModeLabel,
    reverseCraftSuggestions,
  };
}
