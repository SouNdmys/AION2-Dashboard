import type { WorkshopItemCategory, WorkshopPriceMarket, WorkshopPriceSnapshot } from "../../shared/types";

export const WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS = 30;
const WORKSHOP_PRICE_ANOMALY_BASELINE_MIN_SAMPLES = 8;
const WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO = 2.2;
const WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO = 0.45;
const WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO = 8;
const WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO = 0.125;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT = 500_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD = 100_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT = 1_000_000_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD = 2_000_000_000;
const WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT = 10_000_000;
const WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD = 100_000_000;
const WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT = 10_000_000;
const WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD = 100_000_000;

export const WORKSHOP_PRICE_NOTE_TAG_SUSPECT = "qa:suspect:auto";
export const WORKSHOP_PRICE_NOTE_TAG_HARD = "qa:hard-outlier:auto";

export type PriceAnomalyKind = "normal" | "suspect" | "hard";

export interface PriceAnomalyAssessment {
  kind: PriceAnomalyKind;
  sampleCount: number;
  median: number | null;
  ratio: number | null;
  reason: string | null;
}

export interface SnapshotQualityTag {
  isSuspect: boolean;
  reason: string | null;
}

export function appendNoteTag(note: string | undefined, tag: string): string {
  const current = note?.trim() ?? "";
  if (!current) {
    return tag;
  }
  const exists = current
    .split(";")
    .map((token) => token.trim())
    .some((token) => token === tag);
  if (exists) {
    return current;
  }
  return `${current};${tag}`;
}

function hasNoteTag(note: string | undefined, prefix: string): boolean {
  if (!note) {
    return false;
  }
  return note
    .split(";")
    .map((token) => token.trim())
    .some((token) => token.startsWith(prefix));
}

export function resolveSnapshotQualityTag(note: string | undefined): SnapshotQualityTag {
  if (hasNoteTag(note, "qa:hard-outlier")) {
    return {
      isSuspect: true,
      reason: "写入时已标记为极端异常价",
    };
  }
  if (hasNoteTag(note, "qa:suspect")) {
    return {
      isSuspect: true,
      reason: "写入时已标记为可疑价",
    };
  }
  return {
    isSuspect: false,
    reason: null,
  };
}

export function normalizePriceMarketForCompare(market: WorkshopPriceMarket | undefined): WorkshopPriceMarket {
  return market ?? "single";
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function assessPriceAnomaly(unitPrice: number, baselinePrices: number[]): PriceAnomalyAssessment {
  if (baselinePrices.length < WORKSHOP_PRICE_ANOMALY_BASELINE_MIN_SAMPLES) {
    return {
      kind: "normal",
      sampleCount: baselinePrices.length,
      median: null,
      ratio: null,
      reason: null,
    };
  }
  const median = computeMedian(baselinePrices);
  if (median === null || median <= 0) {
    return {
      kind: "normal",
      sampleCount: baselinePrices.length,
      median: null,
      ratio: null,
      reason: null,
    };
  }
  const ratio = unitPrice / median;
  if (ratio >= WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO) {
    return {
      kind: "hard",
      sampleCount: baselinePrices.length,
      median,
      ratio,
      reason: null,
    };
  }
  if (ratio >= WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO) {
    return {
      kind: "suspect",
      sampleCount: baselinePrices.length,
      median,
      ratio,
      reason: null,
    };
  }
  return {
    kind: "normal",
    sampleCount: baselinePrices.length,
    median,
    ratio,
    reason: null,
  };
}

function anomalyKindSeverity(kind: PriceAnomalyKind): number {
  if (kind === "hard") {
    return 2;
  }
  if (kind === "suspect") {
    return 1;
  }
  return 0;
}

function assessCategoryPriceAnomaly(unitPrice: number, category: WorkshopItemCategory): PriceAnomalyAssessment {
  const asRule = (kind: PriceAnomalyKind, reason: string): PriceAnomalyAssessment => ({
    kind,
    sampleCount: 0,
    median: null,
    ratio: null,
    reason,
  });

  if (category === "equipment") {
    if (unitPrice < WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD) {
      return asRule("hard", `低于装备最低价护栏（${WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD}）`);
    }
    if (unitPrice < WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT) {
      return asRule("suspect", `低于装备可疑阈值（${WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD) {
      return asRule("hard", `高于装备最高价护栏（${WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT) {
      return asRule("suspect", `高于装备可疑阈值（${WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  if (category === "material") {
    if (unitPrice > WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD) {
      return asRule("hard", `高于材料最高价护栏（${WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT) {
      return asRule("suspect", `高于材料可疑阈值（${WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  if (category === "component") {
    if (unitPrice > WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD) {
      return asRule("hard", `高于製作材料最高价护栏（${WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT) {
      return asRule("suspect", `高于製作材料可疑阈值（${WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  return asRule("normal", "");
}

function mergePriceAnomalyAssessment(
  baseline: PriceAnomalyAssessment,
  categoryRule: PriceAnomalyAssessment,
): PriceAnomalyAssessment {
  const baselineScore = anomalyKindSeverity(baseline.kind);
  const ruleScore = anomalyKindSeverity(categoryRule.kind);
  if (ruleScore > baselineScore) {
    return categoryRule;
  }
  if (ruleScore === baselineScore && ruleScore > 0 && categoryRule.reason && !baseline.reason) {
    return {
      ...baseline,
      reason: categoryRule.reason,
    };
  }
  return baseline;
}

export function assessPriceAnomalyWithCategory(
  unitPrice: number,
  baselinePrices: number[],
  category: WorkshopItemCategory,
): PriceAnomalyAssessment {
  const baseline = assessPriceAnomaly(unitPrice, baselinePrices);
  const categoryRule = assessCategoryPriceAnomaly(unitPrice, category);
  return mergePriceAnomalyAssessment(baseline, categoryRule);
}

export function formatAnomalyReason(assessment: PriceAnomalyAssessment): string {
  if (assessment.kind === "normal") {
    return assessment.reason ?? "";
  }
  if (assessment.reason) {
    return assessment.reason;
  }
  if (assessment.median === null || assessment.ratio === null) {
    return "";
  }
  const ratioText = `${assessment.ratio >= 1 ? "高于" : "低于"}中位数 ${assessment.ratio.toFixed(2)}x`;
  return `${ratioText}（中位数 ${Math.round(assessment.median)}，样本 ${assessment.sampleCount}）`;
}

export function collectBaselinePricesForItem(
  prices: WorkshopPriceSnapshot[],
  itemId: string,
  market: WorkshopPriceMarket | undefined,
  capturedAtIso: string,
): number[] {
  const targetMarket = normalizePriceMarketForCompare(market);
  const capturedAtMs = new Date(capturedAtIso).getTime();
  const hasValidCapturedAt = Number.isFinite(capturedAtMs);
  const lookbackWindowMs = WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS * 24 * 60 * 60 * 1000;

  return prices
    .filter((row) => row.itemId === itemId)
    .filter((row) => normalizePriceMarketForCompare(row.market) === targetMarket)
    .filter((row) => !resolveSnapshotQualityTag(row.note).isSuspect)
    .filter((row) => {
      if (!hasValidCapturedAt) {
        return true;
      }
      const rowMs = new Date(row.capturedAt).getTime();
      if (!Number.isFinite(rowMs)) {
        return false;
      }
      return rowMs <= capturedAtMs && rowMs >= capturedAtMs - lookbackWindowMs;
    })
    .map((row) => row.unitPrice);
}
