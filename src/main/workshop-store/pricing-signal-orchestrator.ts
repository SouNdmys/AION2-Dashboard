import type {
  WorkshopItem,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceMarket,
  WorkshopPriceSignalRow,
} from "../../shared/types";
import { buildWorkshopPriceSignalRow } from "./pricing-signal-row";

export interface BuildWorkshopPriceSignalRowsInput {
  items: WorkshopItem[];
  lookbackDays: number;
  targetMarket?: WorkshopPriceMarket;
  effectiveThresholdRatio: number;
  ruleEnabled: boolean;
  minSampleCount: number;
  yieldEvery: number;
}

export interface BuildWorkshopPriceSignalRowsDeps {
  buildHistory: (payload: WorkshopPriceHistoryQuery) => WorkshopPriceHistoryResult;
  yieldToEventLoop: () => Promise<void>;
}

export async function buildWorkshopPriceSignalRows(
  input: BuildWorkshopPriceSignalRowsInput,
  deps: BuildWorkshopPriceSignalRowsDeps,
): Promise<WorkshopPriceSignalRow[]> {
  const rows: WorkshopPriceSignalRow[] = [];
  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    const history = deps.buildHistory({
      itemId: item.id,
      days: input.lookbackDays,
      market: input.targetMarket,
    });
    rows.push(
      buildWorkshopPriceSignalRow({
        item,
        history,
        targetMarket: input.targetMarket,
        effectiveThresholdRatio: input.effectiveThresholdRatio,
        ruleEnabled: input.ruleEnabled,
        minSampleCount: input.minSampleCount,
      }),
    );
    if (input.yieldEvery > 0 && (index + 1) % input.yieldEvery === 0) {
      await deps.yieldToEventLoop();
    }
  }
  return rows;
}
