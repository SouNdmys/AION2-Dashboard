import { randomUUID } from "node:crypto";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopPriceHistoryPoint,
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
  WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS,
  WORKSHOP_PRICE_HISTORY_LIMIT,
  WORKSHOP_PRICE_NOTE_TAG_HARD,
  WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
  WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT,
  WORKSHOP_SIGNAL_YIELD_EVERY,
  WORKSHOP_STATE_VERSION,
  appendNoteTag,
  asIso,
  assessPriceAnomalyWithCategory,
  collectBaselinePricesForItem,
  ensureItemExists,
  formatAnomalyReason,
  normalizePriceMarketForCompare,
  readWorkshopState,
  resolveSnapshotQualityTag,
  sanitizeLookbackDays,
  sanitizePriceMarket,
  sanitizeSignalThresholdRatio,
  toNonNegativeInt,
  writeWorkshopState,
  yieldToEventLoop,
} from "../workshop-store-core";
import { buildWeekdayAverages, resolvePriceTrendAssessment } from "./pricing-analytics";

function parseOptionalIso(raw: unknown): Date | null {
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function resolveHistoryRange(payload: WorkshopPriceHistoryQuery): { from: Date; to: Date } {
  const lookbackDays = sanitizeLookbackDays(payload.days);
  const parsedTo = parseOptionalIso(payload.toAt);
  const parsedFrom = parseOptionalIso(payload.fromAt);
  const now = new Date();
  const to = parsedTo ?? now;
  let from: Date;

  if (payload.fromAt && parsedFrom === null) {
    throw new Error("fromAt 不是有效时间格式。");
  }
  if (payload.toAt && parsedTo === null) {
    throw new Error("toAt 不是有效时间格式。");
  }

  if (parsedFrom) {
    from = parsedFrom;
  } else {
    const fromMs = to.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
    from = new Date(fromMs);
  }

  if (from.getTime() > to.getTime()) {
    throw new Error("时间范围无效：fromAt 不能晚于 toAt。");
  }

  return { from, to };
}

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

  const anomalyWindowMs = WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS * 24 * 60 * 60 * 1000;
  const baselineByMarket = new Map<"server" | "world" | "single", Array<{ ts: number; unitPrice: number }>>();
  const classifiedSnapshots = snapshots.map((entry) => {
    const market = normalizePriceMarketForCompare(entry.market);
    const baseline = baselineByMarket.get(market) ?? [];
    const baselineInWindow = baseline.filter((row) => row.ts >= entry.ts - anomalyWindowMs);
    const qualityTag = resolveSnapshotQualityTag(entry.note);
    const itemCategory = itemById.get(entry.itemId)?.category ?? "other";
    const anomaly = qualityTag.isSuspect
      ? null
      : assessPriceAnomalyWithCategory(entry.unitPrice, baselineInWindow.map((row) => row.unitPrice), itemCategory);
    const isSuspect = qualityTag.isSuspect || (anomaly !== null && anomaly.kind !== "normal");
    const suspectReason = qualityTag.reason ?? (anomaly ? formatAnomalyReason(anomaly) || null : null);
    if (!isSuspect) {
      baselineInWindow.push({
        ts: entry.ts,
        unitPrice: entry.unitPrice,
      });
      baselineByMarket.set(market, baselineInWindow);
    } else {
      baselineByMarket.set(market, baselineInWindow);
    }
    return {
      id: entry.id,
      itemId: entry.itemId,
      unitPrice: entry.unitPrice,
      capturedAt: new Date(entry.ts).toISOString(),
      weekday: new Date(entry.ts).getDay(),
      market,
      note: entry.note,
      isSuspect,
      suspectReason,
    };
  });

  const snapshotsForSeries = includeSuspect ? classifiedSnapshots : classifiedSnapshots.filter((entry) => !entry.isSuspect);
  let rollingSum = 0;
  const rollingWindow: number[] = [];
  const points: WorkshopPriceHistoryPoint[] = snapshotsForSeries.map((entry) => {
    rollingWindow.push(entry.unitPrice);
    rollingSum += entry.unitPrice;
    if (rollingWindow.length > 7) {
      const popped = rollingWindow.shift();
      if (popped !== undefined) {
        rollingSum -= popped;
      }
    }
    const ma7 = rollingWindow.length >= 7 ? rollingSum / rollingWindow.length : null;
    return {
      id: entry.id,
      itemId: entry.itemId,
      unitPrice: entry.unitPrice,
      capturedAt: entry.capturedAt,
      weekday: entry.weekday,
      ma7,
      market: entry.market,
      note: entry.note,
      isSuspect: entry.isSuspect,
      suspectReason: entry.suspectReason ?? undefined,
    };
  });
  const pointById = new Map(points.map((point) => [point.id, point]));
  const suspectPoints: WorkshopPriceHistoryPoint[] = classifiedSnapshots
    .filter((entry) => entry.isSuspect)
    .map((entry) => {
      const inSeries = pointById.get(entry.id);
      if (inSeries) {
        return inSeries;
      }
      return {
        id: entry.id,
        itemId: entry.itemId,
        unitPrice: entry.unitPrice,
        capturedAt: entry.capturedAt,
        weekday: entry.weekday,
        ma7: null,
        market: entry.market,
        note: entry.note,
        isSuspect: true,
        suspectReason: entry.suspectReason ?? undefined,
      };
    });

  const sampleCount = points.length;
  const averagePrice = sampleCount > 0 ? points.reduce((acc, point) => acc + point.unitPrice, 0) / sampleCount : null;
  const latestPoint = points[sampleCount - 1] ?? null;

  return {
    itemId: payload.itemId,
    market: targetMarket,
    fromAt: from.toISOString(),
    toAt: to.toISOString(),
    sampleCount,
    suspectCount: suspectPoints.length,
    latestPrice: latestPoint?.unitPrice ?? null,
    latestCapturedAt: latestPoint?.capturedAt ?? null,
    averagePrice,
    ma7Latest: latestPoint?.ma7 ?? null,
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
    prices: [...state.prices, nextSnapshot].slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
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
