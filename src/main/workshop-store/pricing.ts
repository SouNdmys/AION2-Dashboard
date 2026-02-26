import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
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
import { getWorkshopPriceHistoryByQuery } from "./pricing-history-read";
import { buildWorkshopPricesWithAddedSnapshot } from "./pricing-snapshot-add";
import { buildWorkshopPricesWithDeletedSnapshot } from "./pricing-snapshot-delete";
import { createWorkshopPriceSnapshotMutationContext } from "./pricing-snapshot-mutation-config";
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
import { getWorkshopPriceSignalsByQuery } from "./pricing-signal-read";
import { runWorkshopSignalRuleMutation } from "./pricing-signal-rule-mutation";
import { mergeWorkshopSignalRule } from "./pricing-signal-rule-update";
import { normalizeWorkshopPriceSignalQuery } from "./pricing-signal-query";
import { composeWorkshopPriceSignalResult } from "./pricing-signal-result";

const WORKSHOP_PRICE_SNAPSHOT_CREATE_DEPS = createWorkshopPriceSnapshotWithAnomalyDeps({
  toNonNegativeInt,
  asIso,
});
const WORKSHOP_PRICE_SNAPSHOT_MUTATION_CONTEXT = createWorkshopPriceSnapshotMutationContext({
  readState: readWorkshopState,
  writeState: writeWorkshopState,
  stateVersion: WORKSHOP_STATE_VERSION,
  historyLimit: WORKSHOP_PRICE_HISTORY_LIMIT,
  snapshotCreateDeps: WORKSHOP_PRICE_SNAPSHOT_CREATE_DEPS,
  snapshotItemDeps: {
    ensureItemExists,
  },
});
const WORKSHOP_PRICE_HISTORY_QUERY_DEPS = {
  readState: readWorkshopState,
  ensureItemExists,
  buildHistoryResult: buildWorkshopPriceHistoryResult,
};
const WORKSHOP_SIGNAL_RULE_MUTATION_DEPS = {
  readState: readWorkshopState,
  writeState: writeWorkshopState,
  stateVersion: WORKSHOP_STATE_VERSION,
  mergeRule: mergeWorkshopSignalRule,
};
const WORKSHOP_PRICE_SIGNALS_QUERY_DEPS = {
  readState: readWorkshopState,
  normalizeQuery: normalizeWorkshopPriceSignalQuery,
  buildRows: buildWorkshopPriceSignalRows,
  buildHistoryResult: buildWorkshopPriceHistoryResult,
  yieldToEventLoop,
  sortRows: sortWorkshopPriceSignalRows,
  summarizeRows: summarizeWorkshopPriceSignalRows,
  composeResult: composeWorkshopPriceSignalResult,
  minSampleCount: WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT,
  yieldEvery: WORKSHOP_SIGNAL_YIELD_EVERY,
  nowIso: () => new Date().toISOString(),
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
        historyLimit: WORKSHOP_PRICE_SNAPSHOT_MUTATION_CONTEXT.addDeps.historyLimit,
        snapshotCreateDeps: WORKSHOP_PRICE_SNAPSHOT_MUTATION_CONTEXT.addDeps.snapshotCreateDeps,
        snapshotItemDeps: WORKSHOP_PRICE_SNAPSHOT_MUTATION_CONTEXT.addDeps.snapshotItemDeps,
      });
    },
    WORKSHOP_PRICE_SNAPSHOT_MUTATION_CONTEXT.mutationDeps,
  );
}

export function deleteWorkshopPriceSnapshot(snapshotId: string): WorkshopState {
  return runWorkshopPriceMutation(
    (state) => buildWorkshopPricesWithDeletedSnapshot(state.prices, snapshotId),
    WORKSHOP_PRICE_SNAPSHOT_MUTATION_CONTEXT.mutationDeps,
  );
}

export function getWorkshopPriceHistory(payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  return getWorkshopPriceHistoryByQuery(payload, WORKSHOP_PRICE_HISTORY_QUERY_DEPS);
}

export function updateWorkshopSignalRule(payload: Partial<WorkshopPriceSignalRule>): WorkshopState {
  return runWorkshopSignalRuleMutation(payload, WORKSHOP_SIGNAL_RULE_MUTATION_DEPS);
}

export async function getWorkshopPriceSignals(payload?: WorkshopPriceSignalQuery): Promise<WorkshopPriceSignalResult> {
  return getWorkshopPriceSignalsByQuery(payload, WORKSHOP_PRICE_SIGNALS_QUERY_DEPS);
}
