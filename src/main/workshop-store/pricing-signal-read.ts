import type {
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
  WorkshopPriceSignalRule,
  WorkshopState,
} from "../../shared/types";
import type { BuildWorkshopPriceSignalRowsDeps, BuildWorkshopPriceSignalRowsInput } from "./pricing-signal-orchestrator";
import type { NormalizedWorkshopPriceSignalQuery } from "./pricing-signal-query";

export interface GetWorkshopPriceSignalsByQueryDeps {
  readState: () => WorkshopState;
  normalizeQuery: (
    rule: WorkshopPriceSignalRule,
    payload: WorkshopPriceSignalQuery | undefined,
  ) => NormalizedWorkshopPriceSignalQuery;
  buildRows: (
    input: BuildWorkshopPriceSignalRowsInput,
    deps: BuildWorkshopPriceSignalRowsDeps,
  ) => Promise<WorkshopPriceSignalRow[]>;
  buildHistoryResult: (state: WorkshopState, payload: WorkshopPriceHistoryQuery) => WorkshopPriceHistoryResult;
  yieldToEventLoop: () => Promise<void>;
  sortRows: (rows: WorkshopPriceSignalRow[]) => void;
  summarizeRows: (rows: WorkshopPriceSignalRow[]) => {
    triggeredCount: number;
    buyZoneCount: number;
    sellZoneCount: number;
  };
  composeResult: (input: {
    generatedAt: string;
    market?: "single" | "server" | "world";
    lookbackDays: number;
    thresholdRatio: number;
    effectiveThresholdRatio: number;
    ruleEnabled: boolean;
    triggeredCount: number;
    buyZoneCount: number;
    sellZoneCount: number;
    rows: WorkshopPriceSignalRow[];
  }) => WorkshopPriceSignalResult;
  minSampleCount: number;
  yieldEvery: number;
  nowIso: () => string;
}

export async function getWorkshopPriceSignalsByQuery(
  payload: WorkshopPriceSignalQuery | undefined,
  deps: GetWorkshopPriceSignalsByQueryDeps,
): Promise<WorkshopPriceSignalResult> {
  const state = deps.readState();
  const { lookbackDays, thresholdRatio, targetMarket, effectiveThresholdRatio } = deps.normalizeQuery(state.signalRule, payload);
  const rows = await deps.buildRows(
    {
      items: state.items,
      lookbackDays,
      targetMarket,
      effectiveThresholdRatio,
      ruleEnabled: state.signalRule.enabled,
      minSampleCount: deps.minSampleCount,
      yieldEvery: deps.yieldEvery,
    },
    {
      buildHistory: (historyPayload) => deps.buildHistoryResult(state, historyPayload),
      yieldToEventLoop: deps.yieldToEventLoop,
    },
  );
  deps.sortRows(rows);
  const { triggeredCount, buyZoneCount, sellZoneCount } = deps.summarizeRows(rows);

  return deps.composeResult({
    generatedAt: deps.nowIso(),
    market: targetMarket,
    lookbackDays,
    thresholdRatio,
    effectiveThresholdRatio,
    ruleEnabled: state.signalRule.enabled,
    triggeredCount,
    buyZoneCount,
    sellZoneCount,
    rows,
  });
}
