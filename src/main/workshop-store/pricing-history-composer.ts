import type {
  WorkshopPriceHistoryPoint,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceMarket,
  WorkshopWeekdayAverage,
} from "../../shared/types";

export interface ComposeWorkshopPriceHistoryResultInput {
  payload: WorkshopPriceHistoryQuery;
  targetMarket?: WorkshopPriceMarket;
  from: Date;
  to: Date;
  sampleCount: number;
  suspectCount: number;
  latestPrice: number | null;
  latestCapturedAt: string | null;
  averagePrice: number | null;
  ma7Latest: number | null;
  points: WorkshopPriceHistoryPoint[];
  suspectPoints: WorkshopPriceHistoryPoint[];
  weekdayAverages: WorkshopWeekdayAverage[];
}

export function composeWorkshopPriceHistoryResult(
  input: ComposeWorkshopPriceHistoryResultInput,
): WorkshopPriceHistoryResult {
  return {
    itemId: input.payload.itemId,
    market: input.targetMarket,
    fromAt: input.from.toISOString(),
    toAt: input.to.toISOString(),
    sampleCount: input.sampleCount,
    suspectCount: input.suspectCount,
    latestPrice: input.latestPrice,
    latestCapturedAt: input.latestCapturedAt,
    averagePrice: input.averagePrice,
    ma7Latest: input.ma7Latest,
    points: input.points,
    suspectPoints: input.suspectPoints,
    weekdayAverages: input.weekdayAverages,
  };
}
