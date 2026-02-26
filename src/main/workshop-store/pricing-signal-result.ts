import type { WorkshopPriceMarket, WorkshopPriceSignalResult, WorkshopPriceSignalRow } from "../../shared/types";

export interface ComposeWorkshopPriceSignalResultInput {
  generatedAt: string;
  market?: WorkshopPriceMarket;
  lookbackDays: number;
  thresholdRatio: number;
  effectiveThresholdRatio: number;
  ruleEnabled: boolean;
  triggeredCount: number;
  buyZoneCount: number;
  sellZoneCount: number;
  rows: WorkshopPriceSignalRow[];
}

export function composeWorkshopPriceSignalResult(input: ComposeWorkshopPriceSignalResultInput): WorkshopPriceSignalResult {
  return {
    generatedAt: input.generatedAt,
    market: input.market,
    lookbackDays: input.lookbackDays,
    thresholdRatio: input.thresholdRatio,
    effectiveThresholdRatio: input.effectiveThresholdRatio,
    ruleEnabled: input.ruleEnabled,
    triggeredCount: input.triggeredCount,
    buyZoneCount: input.buyZoneCount,
    sellZoneCount: input.sellZoneCount,
    rows: input.rows,
  };
}
