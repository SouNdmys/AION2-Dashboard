import type { WorkshopPriceHistoryPoint, WorkshopPriceTrendTag, WorkshopWeekdayAverage } from "../../shared/types";

interface PriceTrendAssessment {
  trendTag: WorkshopPriceTrendTag;
  confidenceScore: number;
  reasons: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatRatioAsPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function resolvePriceTrendAssessment(
  sampleCount: number,
  deviationFromWeekdayAverage: number | null,
  deviationFromMa7: number | null,
  thresholdRatio: number,
  minSampleCount: number,
): PriceTrendAssessment {
  if (sampleCount < minSampleCount) {
    return {
      trendTag: "watch",
      confidenceScore: 20,
      reasons: [`样本不足（${sampleCount}/${minSampleCount}）`],
    };
  }
  if (deviationFromWeekdayAverage === null) {
    return {
      trendTag: "watch",
      confidenceScore: 20,
      reasons: ["缺少同星期均价基线"],
    };
  }
  const ma7Threshold = thresholdRatio * 0.5;
  const buyByWeekday = deviationFromWeekdayAverage <= -thresholdRatio;
  const sellByWeekday = deviationFromWeekdayAverage >= thresholdRatio;
  const buyByMa7 = deviationFromMa7 === null ? true : deviationFromMa7 <= -ma7Threshold;
  const sellByMa7 = deviationFromMa7 === null ? true : deviationFromMa7 >= ma7Threshold;

  const sampleFactor = clamp(sampleCount / 20, 0.35, 1);
  const weekdayStrength = clamp(Math.abs(deviationFromWeekdayAverage) / thresholdRatio, 0, 2.5);
  const ma7Strength =
    deviationFromMa7 === null ? 1 : clamp(Math.abs(deviationFromMa7) / Math.max(ma7Threshold, Number.EPSILON), 0, 2.5);
  const confidenceScore = clamp(Math.round((weekdayStrength * 0.65 + ma7Strength * 0.35) * 42 * sampleFactor), 20, 99);

  if (buyByWeekday && buyByMa7) {
    return {
      trendTag: "buy-zone",
      confidenceScore,
      reasons: [
        `星期偏离 ${formatRatioAsPercent(deviationFromWeekdayAverage)} <= -${formatRatioAsPercent(thresholdRatio)}`,
        deviationFromMa7 === null
          ? "MA7 不可用（按星期偏离判定）"
          : `MA7偏离 ${formatRatioAsPercent(deviationFromMa7)} <= -${formatRatioAsPercent(ma7Threshold)}`,
      ],
    };
  }
  if (sellByWeekday && sellByMa7) {
    return {
      trendTag: "sell-zone",
      confidenceScore,
      reasons: [
        `星期偏离 ${formatRatioAsPercent(deviationFromWeekdayAverage)} >= ${formatRatioAsPercent(thresholdRatio)}`,
        deviationFromMa7 === null
          ? "MA7 不可用（按星期偏离判定）"
          : `MA7偏离 ${formatRatioAsPercent(deviationFromMa7)} >= ${formatRatioAsPercent(ma7Threshold)}`,
      ],
    };
  }
  return {
    trendTag: "watch",
    confidenceScore: clamp(Math.round(confidenceScore * 0.45), 10, 60),
    reasons: [
      `星期偏离 ${formatRatioAsPercent(deviationFromWeekdayAverage)} 未达阈值 ${formatRatioAsPercent(thresholdRatio)}`,
      deviationFromMa7 === null
        ? "MA7 不可用（仅参考星期偏离）"
        : `MA7偏离 ${formatRatioAsPercent(deviationFromMa7)}（确认阈值 ${formatRatioAsPercent(ma7Threshold)}）`,
    ],
  };
}

export function buildWeekdayAverages(points: WorkshopPriceHistoryPoint[]): WorkshopWeekdayAverage[] {
  const aggregates = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  points.forEach((point) => {
    const bucket = aggregates[point.weekday];
    bucket.sum += point.unitPrice;
    bucket.count += 1;
  });
  return aggregates.map((entry, weekday) => ({
    weekday,
    averagePrice: entry.count > 0 ? entry.sum / entry.count : null,
    sampleCount: entry.count,
  }));
}
