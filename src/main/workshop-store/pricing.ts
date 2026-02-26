import { randomUUID } from "node:crypto";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
  WorkshopPriceSignalRule,
  WorkshopPriceSnapshot,
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
  sanitizePriceMarket,
  toNonNegativeInt,
  writeWorkshopState,
  yieldToEventLoop,
} from "../workshop-store-core";
import { buildWeekdayAverages, resolvePriceTrendAssessment } from "./pricing-analytics";
import {
  WORKSHOP_PRICE_NOTE_TAG_HARD,
  WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
  appendNoteTag,
  assessPriceAnomalyWithCategory,
  collectBaselinePricesForItem,
  normalizePriceMarketForCompare,
} from "./pricing-anomaly";
import { classifyPriceHistorySnapshotsByQuality } from "./pricing-history-classify";
import { appendWorkshopPriceSnapshot } from "./pricing-history-window";
import { resolveHistoryRange } from "./pricing-history-range";
import { buildPriceHistorySeries } from "./pricing-history-series";
import { sanitizeLookbackDays, sanitizeSignalThresholdRatio } from "./pricing-signal-rule";

function buildWorkshopPriceHistoryResult(state: WorkshopState, payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const { from, to } = resolveHistoryRange(payload);
  const includeSuspect = payload.includeSuspect === true;
  const targetMarket = payload.market === undefined ? undefined : sanitizePriceMarket(payload.market);
  const itemById = new Map(state.items.map((item) => [item.id, item] as const));
  const snapshots = state.prices
    .filter((entry) => entry.itemId === payload.itemId)
    .filter((entry) =>
      targetMarket === undefined ? true : normalizePriceMarketForCompare(entry.market) === normalizePriceMarketForCompare(targetMarket),
    )
    .map((entry) => ({
      ...entry,
      ts: new Date(entry.capturedAt).getTime(),
    }))
    .filter((entry) => Number.isFinite(entry.ts))
    .filter((entry) => entry.ts >= from.getTime() && entry.ts <= to.getTime())
    .sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id));

  const classifiedSnapshots = classifyPriceHistorySnapshotsByQuality(snapshots, itemById);

  const { points, suspectPoints, sampleCount, suspectCount, latestPrice, latestCapturedAt, averagePrice, ma7Latest } =
    buildPriceHistorySeries(classifiedSnapshots, includeSuspect);

  return {
    itemId: payload.itemId,
    market: targetMarket,
    fromAt: from.toISOString(),
    toAt: to.toISOString(),
    sampleCount,
    suspectCount,
    latestPrice,
    latestCapturedAt,
    averagePrice,
    ma7Latest,
    points,
    suspectPoints,
    weekdayAverages: buildWeekdayAverages(points),
  };
}

export function addWorkshopPriceSnapshot(payload: AddWorkshopPriceSnapshotInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  const item = state.items.find((entry) => entry.id === payload.itemId);
  const unitPrice = toNonNegativeInt(payload.unitPrice, -1);
  if (unitPrice <= 0) {
    throw new Error("价格必须是大于 0 的整数。");
  }

  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const source = payload.source === "import" ? "import" : "manual";
  const market = sanitizePriceMarket(payload.market);
  const baselinePrices = collectBaselinePricesForItem(state.prices, payload.itemId, market, capturedAt);
  const anomaly = assessPriceAnomalyWithCategory(unitPrice, baselinePrices, item?.category ?? "other");
  let note = payload.note?.trim() || undefined;
  if (anomaly.kind === "hard") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_HARD);
  } else if (anomaly.kind === "suspect") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
  }
  const nextSnapshot: WorkshopPriceSnapshot = {
    id: randomUUID(),
    itemId: payload.itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note,
  };

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: appendWorkshopPriceSnapshot(state.prices, nextSnapshot, WORKSHOP_PRICE_HISTORY_LIMIT),
  });
}

export function deleteWorkshopPriceSnapshot(snapshotId: string): WorkshopState {
  const state = readWorkshopState();
  if (!state.prices.some((entry) => entry.id === snapshotId)) {
    return state;
  }
  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: state.prices.filter((entry) => entry.id !== snapshotId),
  });
}

export function getWorkshopPriceHistory(payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  return buildWorkshopPriceHistoryResult(state, payload);
}

export function updateWorkshopSignalRule(payload: Partial<WorkshopPriceSignalRule>): WorkshopState {
  const state = readWorkshopState();
  const nextRule: WorkshopPriceSignalRule = {
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : state.signalRule.enabled,
    lookbackDays:
      payload.lookbackDays === undefined ? state.signalRule.lookbackDays : sanitizeLookbackDays(payload.lookbackDays),
    dropBelowWeekdayAverageRatio:
      payload.dropBelowWeekdayAverageRatio === undefined
        ? state.signalRule.dropBelowWeekdayAverageRatio
        : sanitizeSignalThresholdRatio(payload.dropBelowWeekdayAverageRatio),
  };

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    signalRule: nextRule,
  });
}

export async function getWorkshopPriceSignals(payload?: WorkshopPriceSignalQuery): Promise<WorkshopPriceSignalResult> {
  const state = readWorkshopState();
  const lookbackDays = payload?.lookbackDays === undefined ? state.signalRule.lookbackDays : sanitizeLookbackDays(payload.lookbackDays);
  const thresholdRatio =
    payload?.thresholdRatio === undefined
      ? state.signalRule.dropBelowWeekdayAverageRatio
      : sanitizeSignalThresholdRatio(payload.thresholdRatio);
  const targetMarket = payload?.market === undefined ? undefined : sanitizePriceMarket(payload.market);
  const effectiveThresholdRatio = sanitizeSignalThresholdRatio(thresholdRatio);
  const rows: WorkshopPriceSignalRow[] = [];
  for (let index = 0; index < state.items.length; index += 1) {
    const item = state.items[index];
    const history = buildWorkshopPriceHistoryResult(state, {
      itemId: item.id,
      days: lookbackDays,
      market: targetMarket,
    });
    const latestPoint = history.points[history.points.length - 1] ?? null;
    const latestWeekday = latestPoint?.weekday ?? null;
    const weekdayAveragePrice =
      latestWeekday === null ? null : history.weekdayAverages.find((entry) => entry.weekday === latestWeekday)?.averagePrice ?? null;
    const deviationRatioFromWeekdayAverage =
      history.latestPrice === null || weekdayAveragePrice === null || weekdayAveragePrice <= 0
        ? null
        : (history.latestPrice - weekdayAveragePrice) / weekdayAveragePrice;
    const deviationRatioFromMa7 =
      history.latestPrice === null || history.ma7Latest === null || history.ma7Latest <= 0
        ? null
        : (history.latestPrice - history.ma7Latest) / history.ma7Latest;
    const assessment = resolvePriceTrendAssessment(
      history.sampleCount,
      deviationRatioFromWeekdayAverage,
      deviationRatioFromMa7,
      effectiveThresholdRatio,
      WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT,
    );
    const triggered = state.signalRule.enabled && assessment.trendTag === "buy-zone";

    rows.push({
      itemId: item.id,
      itemName: item.name,
      market: targetMarket,
      latestPrice: history.latestPrice,
      latestCapturedAt: history.latestCapturedAt,
      latestWeekday,
      weekdayAveragePrice,
      deviationRatioFromWeekdayAverage,
      ma7Price: history.ma7Latest,
      deviationRatioFromMa7,
      effectiveThresholdRatio,
      trendTag: assessment.trendTag,
      confidenceScore: assessment.confidenceScore,
      reasons: assessment.reasons,
      sampleCount: history.sampleCount,
      triggered,
    });
    if ((index + 1) % WORKSHOP_SIGNAL_YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }

  rows.sort((left, right) => {
    if (left.triggered !== right.triggered) {
      return left.triggered ? -1 : 1;
    }
    const leftTrendRank = left.trendTag === "buy-zone" ? 0 : left.trendTag === "sell-zone" ? 1 : 2;
    const rightTrendRank = right.trendTag === "buy-zone" ? 0 : right.trendTag === "sell-zone" ? 1 : 2;
    if (leftTrendRank !== rightTrendRank) {
      return leftTrendRank - rightTrendRank;
    }
    if (left.confidenceScore !== right.confidenceScore) {
      return right.confidenceScore - left.confidenceScore;
    }
    const leftDeviation = left.deviationRatioFromWeekdayAverage;
    const rightDeviation = right.deviationRatioFromWeekdayAverage;
    if (leftDeviation !== null && rightDeviation !== null && leftDeviation !== rightDeviation) {
      if (left.trendTag === "sell-zone" && right.trendTag === "sell-zone") {
        return rightDeviation - leftDeviation;
      }
      return leftDeviation - rightDeviation;
    }
    if (leftDeviation === null && rightDeviation !== null) {
      return 1;
    }
    if (leftDeviation !== null && rightDeviation === null) {
      return -1;
    }
    if (right.sampleCount !== left.sampleCount) {
      return right.sampleCount - left.sampleCount;
    }
    return left.itemName.localeCompare(right.itemName, "zh-CN");
  });

  let triggeredCount = 0;
  let buyZoneCount = 0;
  let sellZoneCount = 0;
  for (const row of rows) {
    if (row.triggered) {
      triggeredCount += 1;
    }
    if (row.trendTag === "buy-zone") {
      buyZoneCount += 1;
    }
    if (row.trendTag === "sell-zone") {
      sellZoneCount += 1;
    }
  }

  return {
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
  };
}
