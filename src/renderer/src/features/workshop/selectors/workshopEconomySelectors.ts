import type { WorkshopCraftOption, WorkshopItemCategory, WorkshopPriceMarket, WorkshopState } from "../../../../../shared/types";
import {
  type ClassifiedItemOption,
  type LatestPriceMetaByMarket,
  type ReverseCraftSuggestionRow,
  type ReverseScoreMode,
  toInt,
} from "../workshop-view-helpers";
import { memoizeSelector } from "./memoizeSelector";

interface ItemMetaLite {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

export function createWorkshopEconomySelectors(): {
  selectLatestPriceMetaByItemId: (state: WorkshopState | null) => Map<string, LatestPriceMetaByMarket>;
  selectInventoryByItemId: (state: WorkshopState | null) => Map<string, number>;
  selectReverseCraftBudget: (reverseCraftBudgetInput: string) => number;
  selectReverseMaterialOptions: (
    classifiedItemOptions: ClassifiedItemOption[],
    inventoryByItemId: Map<string, number>,
    reverseMaterialKeyword: string,
    reverseFocusMaterialId: string,
  ) => ClassifiedItemOption[];
  selectReverseFocusMaterialName: (reverseFocusMaterialId: string, itemById: Map<string, ItemMetaLite>) => string | null;
  selectReverseScoreModeLabel: (reverseScoreMode: ReverseScoreMode) => string;
  selectReverseCraftSuggestions: (
    craftOptions: WorkshopCraftOption[],
    reverseFocusMaterialId: string,
    reverseCraftBudget: number,
    reverseScoreMode: ReverseScoreMode,
  ) => ReverseCraftSuggestionRow[];
} {
  const selectLatestPriceMetaByItemId = memoizeSelector((state: WorkshopState | null): Map<string, LatestPriceMetaByMarket> => {
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
  });

  const selectInventoryByItemId = memoizeSelector((state: WorkshopState | null): Map<string, number> => {
    if (!state) return new Map<string, number>();
    return new Map(state.inventory.map((row) => [row.itemId, row.quantity]));
  });

  const selectReverseCraftBudget = memoizeSelector((reverseCraftBudgetInput: string): number => {
    const parsed = toInt(reverseCraftBudgetInput);
    if (parsed === null || parsed < 0) {
      return 0;
    }
    return parsed;
  });

  const selectReverseMaterialOptions = memoizeSelector(
    (
      classifiedItemOptions: ClassifiedItemOption[],
      inventoryByItemId: Map<string, number>,
      reverseMaterialKeyword: string,
      reverseFocusMaterialId: string,
    ): ClassifiedItemOption[] => {
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
    },
  );

  const selectReverseFocusMaterialName = memoizeSelector(
    (reverseFocusMaterialId: string, itemById: Map<string, ItemMetaLite>): string | null => {
      if (!reverseFocusMaterialId) {
        return null;
      }
      return itemById.get(reverseFocusMaterialId)?.name ?? reverseFocusMaterialId;
    },
  );

  const selectReverseScoreModeLabel = memoizeSelector((reverseScoreMode: ReverseScoreMode): string => {
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
  });

  const selectReverseCraftSuggestions = memoizeSelector(
    (
      craftOptions: WorkshopCraftOption[],
      reverseFocusMaterialId: string,
      reverseCraftBudget: number,
      reverseScoreMode: ReverseScoreMode,
    ): ReverseCraftSuggestionRow[] => {
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
          const coveredRequired = materialRows.reduce(
            (acc, row) => acc + Math.min(Math.max(0, row.owned), Math.max(0, row.required)),
            0,
          );
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
            option.estimatedProfitPerRun === null || suggestedRunsByBudget <= 0
              ? null
              : option.estimatedProfitPerRun * suggestedRunsByBudget;
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
    },
  );

  return {
    selectLatestPriceMetaByItemId,
    selectInventoryByItemId,
    selectReverseCraftBudget,
    selectReverseMaterialOptions,
    selectReverseFocusMaterialName,
    selectReverseScoreModeLabel,
    selectReverseCraftSuggestions,
  };
}
