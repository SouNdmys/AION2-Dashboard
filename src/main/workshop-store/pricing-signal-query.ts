import type { WorkshopPriceSignalQuery, WorkshopPriceSignalRule, WorkshopPriceMarket } from "../../shared/types";
import { sanitizeLookbackDays, sanitizeSignalThresholdRatio } from "./pricing-signal-rule";
import { sanitizePriceMarket } from "./pricing-snapshot-normalize";

export interface NormalizedWorkshopPriceSignalQuery {
  lookbackDays: number;
  thresholdRatio: number;
  effectiveThresholdRatio: number;
  targetMarket?: WorkshopPriceMarket;
}

export function normalizeWorkshopPriceSignalQuery(
  rule: WorkshopPriceSignalRule,
  payload?: WorkshopPriceSignalQuery,
): NormalizedWorkshopPriceSignalQuery {
  const lookbackDays = payload?.lookbackDays === undefined ? rule.lookbackDays : sanitizeLookbackDays(payload.lookbackDays);
  const thresholdRatio =
    payload?.thresholdRatio === undefined
      ? rule.dropBelowWeekdayAverageRatio
      : sanitizeSignalThresholdRatio(payload.thresholdRatio);
  const targetMarket = payload?.market === undefined ? undefined : sanitizePriceMarket(payload.market);
  const effectiveThresholdRatio = sanitizeSignalThresholdRatio(thresholdRatio);
  return {
    lookbackDays,
    thresholdRatio,
    effectiveThresholdRatio,
    targetMarket,
  };
}
