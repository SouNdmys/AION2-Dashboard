import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
  WorkshopPriceSignalRule,
  WorkshopState,
} from "../../shared/types";
import {
  WORKSHOP_PRICE_HISTORY_LIMIT,
  WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT,
  WORKSHOP_SIGNAL_YIELD_EVERY,
  WORKSHOP_STATE_VERSION,
  asIso,
  ensureItemExists,
  readWorkshopState,
  toNonNegativeInt,
  writeWorkshopState,
  yieldToEventLoop,
} from "../workshop-store-core";
import { buildWeekdayAverages } from "./pricing-analytics";
import { classifyPriceHistorySnapshotsByQuality } from "./pricing-history-classify";
import { composeWorkshopPriceHistoryResult } from "./pricing-history-composer";
import { buildWorkshopPricesWithAddedSnapshot } from "./pricing-snapshot-add";
import { buildWorkshopPricesWithDeletedSnapshot } from "./pricing-snapshot-delete";
import { resolveHistoryRange } from "./pricing-history-range";
import { selectPriceSnapshotsForHistoryQuery } from "./pricing-history-query";
import { buildPriceHistorySeries } from "./pricing-history-series";
import {
  createWorkshopPriceSnapshotWithAnomalyDeps,
} from "./pricing-snapshot-create";
import { sanitizePriceMarket } from "./pricing-snapshot-normalize";
import { runWorkshopPriceMutation } from "./pricing-snapshot-mutation";
import {
  sortWorkshopPriceSignalRows,
  summarizeWorkshopPriceSignalRows,
} from "./pricing-signal-row";
import { buildWorkshopPriceSignalRows } from "./pricing-signal-orchestrator";
import { mergeWorkshopSignalRule } from "./pricing-signal-rule-update";
import { normalizeWorkshopPriceSignalQuery } from "./pricing-signal-query";
import { composeWorkshopPriceSignalResult } from "./pricing-signal-result";

const WORKSHOP_PRICE_SNAPSHOT_CREATE_DEPS = createWorkshopPriceSnapshotWithAnomalyDeps({
  toNonNegativeInt,
  asIso,
});
const WORKSHOP_PRICE_SNAPSHOT_ITEM_DEPS = {
  ensureItemExists,
};

function buildWorkshopPriceHistoryResult(state: WorkshopState, payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const { from, to } = resolveHistoryRange(payload);
  const includeSuspect = payload.includeSuspect === true;
  const targetMarket = payload.market === undefined ? undefined : sanitizePriceMarket(payload.market);
  const itemById = new Map(state.items.map((item) => [item.id, item] as const));
  const snapshots = selectPriceSnapshotsForHistoryQuery(state.prices, payload.itemId, from, to, targetMarket);

  const classifiedSnapshots = classifyPriceHistorySnapshotsByQuality(snapshots, itemById);

  const { points, suspectPoints, sampleCount, suspectCount, latestPrice, latestCapturedAt, averagePrice, ma7Latest } =
    buildPriceHistorySeries(classifiedSnapshots, includeSuspect);
  return composeWorkshopPriceHistoryResult({
    payload,
    targetMarket,
    from,
    to,
    sampleCount,
    suspectCount,
    latestPrice,
    latestCapturedAt,
    averagePrice,
    ma7Latest,
    points,
    suspectPoints,
    weekdayAverages: buildWeekdayAverages(points),
  });
}

export function addWorkshopPriceSnapshot(payload: AddWorkshopPriceSnapshotInput): WorkshopState {
  return runWorkshopPriceMutation(
    (state) => {
      return buildWorkshopPricesWithAddedSnapshot({
        state,
        payload,
        historyLimit: WORKSHOP_PRICE_HISTORY_LIMIT,
        snapshotCreateDeps: WORKSHOP_PRICE_SNAPSHOT_CREATE_DEPS,
        snapshotItemDeps: WORKSHOP_PRICE_SNAPSHOT_ITEM_DEPS,
      });
    },
    {
      readState: readWorkshopState,
      writeState: writeWorkshopState,
      stateVersion: WORKSHOP_STATE_VERSION,
    },
  );
}

export function deleteWorkshopPriceSnapshot(snapshotId: string): WorkshopState {
  return runWorkshopPriceMutation(
    (state) => buildWorkshopPricesWithDeletedSnapshot(state.prices, snapshotId),
    {
      readState: readWorkshopState,
      writeState: writeWorkshopState,
      stateVersion: WORKSHOP_STATE_VERSION,
    },
  );
}

export function getWorkshopPriceHistory(payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  return buildWorkshopPriceHistoryResult(state, payload);
}

export function updateWorkshopSignalRule(payload: Partial<WorkshopPriceSignalRule>): WorkshopState {
  const state = readWorkshopState();
  const nextRule = mergeWorkshopSignalRule(state.signalRule, payload);

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    signalRule: nextRule,
  });
}

export async function getWorkshopPriceSignals(payload?: WorkshopPriceSignalQuery): Promise<WorkshopPriceSignalResult> {
  const state = readWorkshopState();
  const { lookbackDays, thresholdRatio, targetMarket, effectiveThresholdRatio } = normalizeWorkshopPriceSignalQuery(
    state.signalRule,
    payload,
  );
  const rows: WorkshopPriceSignalRow[] = await buildWorkshopPriceSignalRows(
    {
      items: state.items,
      lookbackDays,
      targetMarket,
      effectiveThresholdRatio,
      ruleEnabled: state.signalRule.enabled,
      minSampleCount: WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT,
      yieldEvery: WORKSHOP_SIGNAL_YIELD_EVERY,
    },
    {
      buildHistory: (historyPayload) => buildWorkshopPriceHistoryResult(state, historyPayload),
      yieldToEventLoop,
    },
  );

  sortWorkshopPriceSignalRows(rows);
  const { triggeredCount, buyZoneCount, sellZoneCount } = summarizeWorkshopPriceSignalRows(rows);

  return composeWorkshopPriceSignalResult({
    generatedAt: new Date().toISOString(),
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
