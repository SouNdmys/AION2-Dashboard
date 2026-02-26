import type {
  WorkshopItem,
  WorkshopPriceHistoryResult,
  WorkshopPriceMarket,
  WorkshopPriceSignalRow,
} from "../../shared/types";
import { resolvePriceTrendAssessment } from "./pricing-analytics";

export interface BuildWorkshopPriceSignalRowInput {
  item: WorkshopItem;
  history: WorkshopPriceHistoryResult;
  targetMarket?: WorkshopPriceMarket;
  effectiveThresholdRatio: number;
  ruleEnabled: boolean;
  minSampleCount: number;
}

export interface WorkshopPriceSignalSummary {
  triggeredCount: number;
  buyZoneCount: number;
  sellZoneCount: number;
}

export function buildWorkshopPriceSignalRow(input: BuildWorkshopPriceSignalRowInput): WorkshopPriceSignalRow {
  const latestPoint = input.history.points[input.history.points.length - 1] ?? null;
  const latestWeekday = latestPoint?.weekday ?? null;
  const weekdayAveragePrice =
    latestWeekday === null
      ? null
      : input.history.weekdayAverages.find((entry) => entry.weekday === latestWeekday)?.averagePrice ?? null;
  const deviationRatioFromWeekdayAverage =
    input.history.latestPrice === null || weekdayAveragePrice === null || weekdayAveragePrice <= 0
      ? null
      : (input.history.latestPrice - weekdayAveragePrice) / weekdayAveragePrice;
  const deviationRatioFromMa7 =
    input.history.latestPrice === null || input.history.ma7Latest === null || input.history.ma7Latest <= 0
      ? null
      : (input.history.latestPrice - input.history.ma7Latest) / input.history.ma7Latest;
  const assessment = resolvePriceTrendAssessment(
    input.history.sampleCount,
    deviationRatioFromWeekdayAverage,
    deviationRatioFromMa7,
    input.effectiveThresholdRatio,
    input.minSampleCount,
  );
  const triggered = input.ruleEnabled && assessment.trendTag === "buy-zone";

  return {
    itemId: input.item.id,
    itemName: input.item.name,
    market: input.targetMarket,
    latestPrice: input.history.latestPrice,
    latestCapturedAt: input.history.latestCapturedAt,
    latestWeekday,
    weekdayAveragePrice,
    deviationRatioFromWeekdayAverage,
    ma7Price: input.history.ma7Latest,
    deviationRatioFromMa7,
    effectiveThresholdRatio: input.effectiveThresholdRatio,
    trendTag: assessment.trendTag,
    confidenceScore: assessment.confidenceScore,
    reasons: assessment.reasons,
    sampleCount: input.history.sampleCount,
    triggered,
  };
}

export function sortWorkshopPriceSignalRows(rows: WorkshopPriceSignalRow[]): void {
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
}

export function summarizeWorkshopPriceSignalRows(rows: WorkshopPriceSignalRow[]): WorkshopPriceSignalSummary {
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
    triggeredCount,
    buyZoneCount,
    sellZoneCount,
  };
}
