import type { WorkshopPriceSignalRule } from "../../shared/types";
import { sanitizeLookbackDays, sanitizeSignalThresholdRatio } from "./pricing-signal-rule";

export function mergeWorkshopSignalRule(
  current: WorkshopPriceSignalRule,
  patch: Partial<WorkshopPriceSignalRule>,
): WorkshopPriceSignalRule {
  return {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    lookbackDays: patch.lookbackDays === undefined ? current.lookbackDays : sanitizeLookbackDays(patch.lookbackDays),
    dropBelowWeekdayAverageRatio:
      patch.dropBelowWeekdayAverageRatio === undefined
        ? current.dropBelowWeekdayAverageRatio
        : sanitizeSignalThresholdRatio(patch.dropBelowWeekdayAverageRatio),
  };
}
