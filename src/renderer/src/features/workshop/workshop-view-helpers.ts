import type {
  WorkshopCraftOption,
  WorkshopItemCategory,
  WorkshopPriceHistoryResult,
} from "../../../../shared/types";

const goldFormatter = new Intl.NumberFormat("zh-CN");

export function formatGold(value: number | null): string {
  if (value === null) {
    return "--";
  }
  return goldFormatter.format(Math.floor(value));
}

export function toInt(raw: string): number | null {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function toPercent(value: number | null): string {
  if (value === null) {
    return "--";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function toSignedPercent(value: number | null): string {
  if (value === null) {
    return "--";
  }
  const percent = (value * 100).toFixed(2);
  return `${value > 0 ? "+" : ""}${percent}%`;
}

export function trendTagLabel(tag: "buy-zone" | "sell-zone" | "watch"): string {
  if (tag === "buy-zone") {
    return "进货点";
  }
  if (tag === "sell-zone") {
    return "出货点";
  }
  return "观察";
}

export function weekdayLabel(weekday: number): string {
  if (weekday === 0) return "周日";
  if (weekday === 1) return "周一";
  if (weekday === 2) return "周二";
  if (weekday === 3) return "周三";
  if (weekday === 4) return "周四";
  if (weekday === 5) return "周五";
  return "周六";
}

export function formatDateLabel(raw: string): string {
  return new Date(raw).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(value: string | number | null): string {
  if (value === null) {
    return "--";
  }
  const time = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return "--";
  }
  return new Date(time).toLocaleString("zh-CN");
}

export function formatMarketLabel(market: "single" | "server" | "world" | undefined): string {
  if (market === "server") {
    return "伺服器";
  }
  if (market === "world") {
    return "世界";
  }
  return "单列";
}

export interface HistoryInsightModel {
  latestPoint: WorkshopPriceHistoryResult["points"][number];
  latestWeekdayAverage: number | null;
  deviationFromWeekday: number | null;
}

type DualHistoryChartPointModel = WorkshopPriceHistoryResult["points"][number] & {
  market: "server" | "world";
  ts: number;
  x: number;
  y: number;
  dateKey: string;
};

export interface DualHistoryChartModel {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  serverPricePath: string;
  worldPricePath: string;
  serverPoints: DualHistoryChartPointModel[];
  worldPoints: DualHistoryChartPointModel[];
  yTicks: Array<{ value: number; y: number }>;
  xTicks: Array<{ x: number; label: string }>;
  wednesdayMarkers: Array<{ date: string; x: number }>;
  latestServerPoint: DualHistoryChartPointModel | null;
  latestWorldPoint: DualHistoryChartPointModel | null;
}

interface LatestPriceValue {
  price: number;
  capturedAt: number;
}

export interface LatestPriceMetaByMarket {
  server: LatestPriceValue | null;
  world: LatestPriceValue | null;
  single: LatestPriceValue | null;
}

export interface ReverseCraftSuggestionRow {
  recipeId: string;
  outputItemId: string;
  outputItemName: string;
  relatedByFocusMaterial: boolean;
  focusMaterialRequired: number;
  focusMaterialOwned: number;
  totalMaterialCount: number;
  matchedOwnedMaterialCount: number;
  coverageRatio: number;
  craftableCount: number;
  requiredMaterialCostPerRun: number | null;
  estimatedProfitPerRun: number | null;
  missingRows: WorkshopCraftOption["missingRowsForOneRun"];
  unknownPriceRows: WorkshopCraftOption["missingRowsForOneRun"];
  missingPurchaseCostPerRun: number | null;
  suggestedRunsByBudget: number;
  estimatedBudgetProfit: number | null;
  relevanceScore: number;
}

export type ReverseScoreMode = "balanced" | "coverage" | "profit" | "craftable";

export function buildHistoryInsightModel(historyResult: WorkshopPriceHistoryResult | null): HistoryInsightModel | null {
  if (!historyResult || historyResult.sampleCount <= 0) {
    return null;
  }
  const latestPoint = historyResult.points[historyResult.points.length - 1] ?? null;
  if (!latestPoint) {
    return null;
  }
  const latestWeekdayAverage = historyResult.weekdayAverages.find((entry) => entry.weekday === latestPoint.weekday)?.averagePrice ?? null;
  const deviationFromWeekday =
    historyResult.latestPrice === null || latestWeekdayAverage === null || latestWeekdayAverage === 0
      ? null
      : (historyResult.latestPrice - latestWeekdayAverage) / latestWeekdayAverage;
  return {
    latestPoint,
    latestWeekdayAverage,
    deviationFromWeekday,
  };
}

export function buildDualHistoryChartModel(
  historyServerResult: WorkshopPriceHistoryResult | null,
  historyWorldResult: WorkshopPriceHistoryResult | null,
): DualHistoryChartModel | null {
  const serverRows = (historyServerResult?.points ?? [])
    .map((point) => ({
      ...point,
      market: "server" as const,
      ts: new Date(point.capturedAt).getTime(),
      dateKey: point.capturedAt.slice(0, 10),
    }))
    .filter((point) => Number.isFinite(point.ts))
    .sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id));
  const worldRows = (historyWorldResult?.points ?? [])
    .map((point) => ({
      ...point,
      market: "world" as const,
      ts: new Date(point.capturedAt).getTime(),
      dateKey: point.capturedAt.slice(0, 10),
    }))
    .filter((point) => Number.isFinite(point.ts))
    .sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id));

  const allRows = [...serverRows, ...worldRows];
  if (allRows.length === 0) {
    return null;
  }
  const width = 960;
  const height = 320;
  const left = 56;
  const right = 20;
  const top = 18;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = allRows.map((point) => point.unitPrice);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const times = allRows.map((point) => point.ts);
  const minTs = Math.min(...times);
  const rawMaxTs = Math.max(...times);
  const maxTs = rawMaxTs === minTs ? minTs + 1 : rawMaxTs;

  const valuePadding = minValue === maxValue ? Math.max(1, Math.round(maxValue * 0.06)) : 0;
  const lowerBound = Math.max(0, minValue - valuePadding);
  const upperBound = maxValue + valuePadding;
  const valueSpan = Math.max(1, upperBound - lowerBound);
  const toChartPoint = (point: (typeof allRows)[number]): DualHistoryChartPointModel => {
    const xRatio = (point.ts - minTs) / (maxTs - minTs);
    const x = left + xRatio * plotWidth;
    const y = top + ((upperBound - point.unitPrice) / valueSpan) * plotHeight;
    return {
      ...point,
      x,
      y,
    };
  };
  const serverPoints = serverRows.map(toChartPoint);
  const worldPoints = worldRows.map(toChartPoint);
  const serverPricePath = serverPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const worldPricePath = worldPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = upperBound - ratio * valueSpan;
    const y = top + ratio * plotHeight;
    return {
      value,
      y,
    };
  });
  const xTickTimes = [minTs, Math.floor((minTs + maxTs) / 2), maxTs];
  const xTicks = xTickTimes.map((ts) => ({
    x: left + ((ts - minTs) / (maxTs - minTs)) * plotWidth,
    label: formatDateLabel(new Date(ts).toISOString()),
  }));
  const wednesdayByDate = new Map<string, number>();
  [...serverPoints, ...worldPoints].forEach((point) => {
    if (point.weekday !== 3 || wednesdayByDate.has(point.dateKey)) {
      return;
    }
    wednesdayByDate.set(point.dateKey, point.x);
  });

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    serverPricePath,
    worldPricePath,
    serverPoints,
    worldPoints,
    yTicks,
    xTicks,
    wednesdayMarkers: Array.from(wednesdayByDate.entries()).map(([date, x]) => ({ date, x })),
    latestServerPoint: serverPoints[serverPoints.length - 1] ?? null,
    latestWorldPoint: worldPoints[worldPoints.length - 1] ?? null,
  };
}

export const HISTORY_QUICK_DAY_OPTIONS = [7, 14, 30, 90] as const;
const CATEGORY_SUB_ORDER = [
  "巨劍",
  "長劍",
  "短劍",
  "釘錘",
  "弓",
  "法杖",
  "法書",
  "法珠",
  "臂甲",
  "頭盔",
  "肩甲",
  "上衣",
  "下衣",
  "手套",
  "鞋子",
  "披風",
  "項鍊",
  "耳環",
  "戒指",
  "手鐲",
  "藥水",
  "咒文書",
  "魔石",
  "材料",
] as const;

export function parseItemRawCategory(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/分類:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

export function parseItemSourceTag(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/來源:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

export function parseItemMainCategory(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/大類:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

function normalizeMainCategoryLabel(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (value === "铁匠") {
    return "鐵匠";
  }
  if (value === "手工艺") {
    return "手工藝";
  }
  if (value === "采集材料") {
    return "採集材料";
  }
  if (value === "炼金") {
    return "煉金";
  }
  if (value === "料理") {
    return "料理";
  }
  return value;
}

function inferRecipeMainCategory(sourceTag: string): string {
  const normalized = sourceTag.replace(/\.md$/iu, "").trim();
  if (!normalized) {
    return "未分類";
  }
  const parts = normalized.split(/[、,，\s]+/u).map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

export function inferMainCategoryByContext(
  explicitMainCategory: string,
  sourceTag: string,
  subCategory: string,
  rawCategory: string,
  itemName: string,
): string {
  const normalizedExplicitMainCategory = normalizeMainCategoryLabel(explicitMainCategory);
  if (normalizedExplicitMainCategory) {
    return normalizedExplicitMainCategory;
  }
  const text = `${rawCategory} ${itemName}`;
  if (
    subCategory === "臂甲" ||
    subCategory === "頭盔" ||
    subCategory === "肩甲" ||
    subCategory === "上衣" ||
    subCategory === "下衣" ||
    subCategory === "手套" ||
    subCategory === "鞋子" ||
    subCategory === "披風" ||
    text.includes("防具") ||
    text.includes("盔甲")
  ) {
    return "盔甲";
  }
  if (
    subCategory === "弓" ||
    subCategory === "法杖" ||
    subCategory === "法書" ||
    subCategory === "法珠" ||
    subCategory === "項鍊" ||
    subCategory === "耳環" ||
    subCategory === "戒指" ||
    subCategory === "手鐲" ||
    subCategory === "藥水" ||
    subCategory === "咒文書" ||
    subCategory === "魔石" ||
    text.includes("飾品")
  ) {
    if (subCategory === "藥水" || subCategory === "咒文書" || subCategory === "魔石" || text.includes("消耗品")) {
      return "煉金";
    }
    return "手工藝";
  }
  if (subCategory === "巨劍" || subCategory === "長劍" || subCategory === "短劍" || subCategory === "釘錘") {
    return "鐵匠";
  }
  return inferRecipeMainCategory(sourceTag);
}

export function inferRecipeSubCategory(rawCategory: string, itemName: string, itemCategory: WorkshopItemCategory): string {
  const text = `${rawCategory} ${itemName}`;
  if (text.includes("巨劍") || text.includes("巨剑")) return "巨劍";
  if (text.includes("長劍") || text.includes("长剑")) return "長劍";
  if (text.includes("短劍") || text.includes("短剑")) return "短劍";
  if (text.includes("釘錘") || text.includes("钉锤")) return "釘錘";
  if (text.includes("弓")) return "弓";
  if (text.includes("法杖")) return "法杖";
  if (text.includes("法書") || text.includes("法书")) return "法書";
  if (text.includes("法珠")) return "法珠";
  if (text.includes("臂甲")) return "臂甲";
  if (text.includes("頭盔") || text.includes("头盔")) return "頭盔";
  if (text.includes("肩甲")) return "肩甲";
  if (text.includes("上衣") || text.includes("胸甲")) return "上衣";
  if (text.includes("下衣") || text.includes("腿甲")) return "下衣";
  if (text.includes("手套")) return "手套";
  if (text.includes("鞋子") || text.includes("長靴") || text.includes("长靴") || text.includes("靴")) return "鞋子";
  if (text.includes("披風") || text.includes("披风")) return "披風";
  if (text.includes("項鍊") || text.includes("项链")) return "項鍊";
  if (text.includes("耳環") || text.includes("耳环")) return "耳環";
  if (text.includes("戒指")) return "戒指";
  if (text.includes("手鐲") || text.includes("手镯")) return "手鐲";
  if (text.includes("藥水") || text.includes("药水") || text.includes("祕藥") || text.includes("秘药")) return "藥水";
  if (text.includes("咒文書") || text.includes("咒文书")) return "咒文書";
  if (text.includes("魔石") || text.includes("靈石") || text.includes("灵石")) return "魔石";
  if (
    text.includes("材料") ||
    text.includes("消耗") ||
    text.includes("採集") ||
    text.includes("采集") ||
    itemCategory === "material" ||
    itemCategory === "component"
  ) {
    return "材料";
  }
  return "其他";
}

export function sortCategoryText(left: string, right: string): number {
  const leftIndex = CATEGORY_SUB_ORDER.indexOf(left as (typeof CATEGORY_SUB_ORDER)[number]);
  const rightIndex = CATEGORY_SUB_ORDER.indexOf(right as (typeof CATEGORY_SUB_ORDER)[number]);
  if (leftIndex >= 0 || rightIndex >= 0) {
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  }
  if (left === "其他") return 1;
  if (right === "其他") return -1;
  return left.localeCompare(right, "zh-CN");
}

export function sortMainCategoryText(left: string, right: string): number {
  if (left === "鐵匠" && right !== "鐵匠") return -1;
  if (right === "鐵匠" && left !== "鐵匠") return 1;
  return left.localeCompare(right, "zh-CN");
}

export interface SimulationRecipeOption {
  id: string;
  outputName: string;
  mainCategory: string;
  subCategory: string;
}

export interface ClassifiedItemOption {
  id: string;
  name: string;
  category: WorkshopItemCategory;
  mainCategory: string;
  subCategory: string;
}
