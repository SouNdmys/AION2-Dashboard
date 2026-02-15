import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import type {
  WorkshopCraftOption,
  WorkshopCraftSimulationResult,
  WorkshopItemCategory,
  WorkshopOcrExtractTextResult,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopOcrIconCaptureTemplate,
  WorkshopOcrPriceImportResult,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalResult,
  WorkshopScreenPreviewResult,
  WorkshopState,
} from "../../shared/types";

const goldFormatter = new Intl.NumberFormat("zh-CN");

function formatGold(value: number | null): string {
  if (value === null) {
    return "--";
  }
  return goldFormatter.format(Math.floor(value));
}

function toInt(raw: string): number | null {
  const value = Math.floor(Number(raw));
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function toPercent(value: number | null): string {
  if (value === null) {
    return "--";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function toSignedPercent(value: number | null): string {
  if (value === null) {
    return "--";
  }
  const percent = (value * 100).toFixed(2);
  return `${value > 0 ? "+" : ""}${percent}%`;
}

function trendTagLabel(tag: "buy-zone" | "sell-zone" | "watch"): string {
  if (tag === "buy-zone") {
    return "进货点";
  }
  if (tag === "sell-zone") {
    return "出货点";
  }
  return "观察";
}

function weekdayLabel(weekday: number): string {
  if (weekday === 0) return "周日";
  if (weekday === 1) return "周一";
  if (weekday === 2) return "周二";
  if (weekday === 3) return "周三";
  if (weekday === 4) return "周四";
  if (weekday === 5) return "周五";
  return "周六";
}

function formatDateLabel(raw: string): string {
  return new Date(raw).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: string | number | null): string {
  if (value === null) {
    return "--";
  }
  const time = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return "--";
  }
  return new Date(time).toLocaleString("zh-CN");
}

function formatMarketLabel(market: "single" | "server" | "world" | undefined): string {
  if (market === "server") {
    return "伺服器";
  }
  if (market === "world") {
    return "世界";
  }
  return "单列";
}

function buildNullableLinePath(points: Array<{ x: number; y: number | null }>): string {
  let path = "";
  let drawing = false;
  points.forEach((point) => {
    if (point.y === null) {
      drawing = false;
      return;
    }
    const command = drawing ? "L" : "M";
    path += `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
    drawing = true;
  });
  return path.trim();
}

const HISTORY_QUICK_DAY_OPTIONS = [7, 14, 30, 90] as const;
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

const OCR_ICON_CAPTURE_PRESETS = {
  custom: null,
  trade_1080p: {
    firstRowTop: "339",
    rowHeight: "135",
    nameAnchorX: "530",
    iconOffsetX: "-85",
    iconTopOffset: "0",
    iconWidth: "85",
    iconHeight: "85",
  },
  trade_1440p: {
    firstRowTop: "339",
    rowHeight: "135",
    nameAnchorX: "530",
    iconOffsetX: "-85",
    iconTopOffset: "0",
    iconWidth: "85",
    iconHeight: "85",
  },
} as const;

const DEFAULT_TRADE_BOARD_PRESET = {
  rowCount: "7",
  namesX: "426",
  namesY: "310",
  namesWidth: "900",
  namesHeight: "960",
  pricesX: "1900",
  pricesY: "240",
  pricesWidth: "580",
  pricesHeight: "1030",
  priceMode: "dual" as "single" | "dual",
  priceColumn: "left" as "left" | "right",
  leftPriceRole: "server" as "server" | "world",
  rightPriceRole: "world" as "server" | "world",
};

function parseItemRawCategory(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/分類:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

function parseItemSourceTag(notes?: string): string {
  if (!notes) {
    return "";
  }
  const match = notes.match(/來源:\s*([^;]+)/u);
  return match?.[1]?.trim() ?? "";
}

function parseItemMainCategory(notes?: string): string {
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

function inferMainCategoryByContext(
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

function inferRecipeSubCategory(rawCategory: string, itemName: string, itemCategory: WorkshopItemCategory): string {
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

function sortCategoryText(left: string, right: string): number {
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

function sortMainCategoryText(left: string, right: string): number {
  if (left === "鐵匠" && right !== "鐵匠") return -1;
  if (right === "鐵匠" && left !== "鐵匠") return 1;
  return left.localeCompare(right, "zh-CN");
}

interface SimulationRecipeOption {
  id: string;
  outputName: string;
  mainCategory: string;
  subCategory: string;
}

interface ClassifiedItemOption {
  id: string;
  name: string;
  category: WorkshopItemCategory;
  mainCategory: string;
  subCategory: string;
}

export function WorkshopView(): JSX.Element {
  const [state, setState] = useState<WorkshopState | null>(null);
  const [craftOptions, setCraftOptions] = useState<WorkshopCraftOption[]>([]);
  const [simulation, setSimulation] = useState<WorkshopCraftSimulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [itemMainCategory, setItemMainCategory] = useState("鐵匠");
  const [itemSubCategory, setItemSubCategory] = useState<"all" | string>("all");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemPrice, setSelectedItemPrice] = useState("0");
  const [selectedItemInventory, setSelectedItemInventory] = useState("0");

  const [simulateRecipeId, setSimulateRecipeId] = useState("");
  const [simulateMainCategory, setSimulateMainCategory] = useState("鐵匠");
  const [simulateSubCategory, setSimulateSubCategory] = useState<"all" | string>("all");
  const [simulateRuns, setSimulateRuns] = useState("1");
  const [taxMode, setTaxMode] = useState<"0.1" | "0.2">("0.1");
  const [nearCraftBudgetInput, setNearCraftBudgetInput] = useState("50000");
  const [nearCraftSortMode, setNearCraftSortMode] = useState<"max_budget_profit" | "min_gap_cost">("max_budget_profit");
  const [historyItemId, setHistoryItemId] = useState("");
  const [historyMainCategory, setHistoryMainCategory] = useState("鐵匠");
  const [historySubCategory, setHistorySubCategory] = useState<"all" | string>("all");
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyDaysInput, setHistoryDaysInput] = useState("30");
  const [historyResult, setHistoryResult] = useState<WorkshopPriceHistoryResult | null>(null);
  const [signalRuleEnabled, setSignalRuleEnabled] = useState(true);
  const [signalLookbackDaysInput, setSignalLookbackDaysInput] = useState("30");
  const [signalThresholdPercentInput, setSignalThresholdPercentInput] = useState("8");
  const [signalResult, setSignalResult] = useState<WorkshopPriceSignalResult | null>(null);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrImagePath, setOcrImagePath] = useState("");
  const [ocrLanguage, setOcrLanguage] = useState("chi_tra+eng");
  const [ocrPsm, setOcrPsm] = useState("6");
  const [ocrExtractResult, setOcrExtractResult] = useState<WorkshopOcrExtractTextResult | null>(null);
  const [ocrHotkeyShortcut, setOcrHotkeyShortcut] = useState(
    navigator.userAgent.includes("Windows") ? "Shift+F8" : "CommandOrControl+Shift+F8",
  );
  const [ocrHotkeyState, setOcrHotkeyState] = useState<WorkshopOcrHotkeyState | null>(null);
  const [ocrHotkeyLastResult, setOcrHotkeyLastResult] = useState<WorkshopOcrHotkeyRunResult | null>(null);
  const [ocrScreenPreview, setOcrScreenPreview] = useState<WorkshopScreenPreviewResult | null>(null);
  const [ocrCaptureDelayMs, setOcrCaptureDelayMs] = useState("1200");
  const [ocrHideAppBeforeCapture, setOcrHideAppBeforeCapture] = useState(true);
  const [ocrAutoCreateMissing, setOcrAutoCreateMissing] = useState(false);
  const [ocrImportResult, setOcrImportResult] = useState<WorkshopOcrPriceImportResult | null>(null);
  const [ocrIconCaptureEnabled, setOcrIconCaptureEnabled] = useState(false);
  const [ocrIconPreset, setOcrIconPreset] = useState<keyof typeof OCR_ICON_CAPTURE_PRESETS>("trade_1080p");
  const [ocrScreenshotPath, setOcrScreenshotPath] = useState("");
  const [ocrFirstRowTop, setOcrFirstRowTop] = useState("339");
  const [ocrRowHeight, setOcrRowHeight] = useState("135");
  const [ocrNameAnchorX, setOcrNameAnchorX] = useState("530");
  const [ocrIconOffsetX, setOcrIconOffsetX] = useState("-85");
  const [ocrIconTopOffset, setOcrIconTopOffset] = useState("0");
  const [ocrIconWidth, setOcrIconWidth] = useState("85");
  const [ocrIconHeight, setOcrIconHeight] = useState("85");
  const [ocrTradeRowCount, setOcrTradeRowCount] = useState(DEFAULT_TRADE_BOARD_PRESET.rowCount);
  const [ocrTradeNamesX, setOcrTradeNamesX] = useState(DEFAULT_TRADE_BOARD_PRESET.namesX);
  const [ocrTradeNamesY, setOcrTradeNamesY] = useState(DEFAULT_TRADE_BOARD_PRESET.namesY);
  const [ocrTradeNamesWidth, setOcrTradeNamesWidth] = useState(DEFAULT_TRADE_BOARD_PRESET.namesWidth);
  const [ocrTradeNamesHeight, setOcrTradeNamesHeight] = useState(DEFAULT_TRADE_BOARD_PRESET.namesHeight);
  const [ocrTradePricesX, setOcrTradePricesX] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesX);
  const [ocrTradePricesY, setOcrTradePricesY] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesY);
  const [ocrTradePricesWidth, setOcrTradePricesWidth] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesWidth);
  const [ocrTradePricesHeight, setOcrTradePricesHeight] = useState(DEFAULT_TRADE_BOARD_PRESET.pricesHeight);
  const [ocrTradePriceMode, setOcrTradePriceMode] = useState<"single" | "dual">(DEFAULT_TRADE_BOARD_PRESET.priceMode);
  const [ocrTradePriceColumn, setOcrTradePriceColumn] = useState<"left" | "right">(DEFAULT_TRADE_BOARD_PRESET.priceColumn);
  const [ocrTradeLeftPriceRole, setOcrTradeLeftPriceRole] = useState<"server" | "world">(DEFAULT_TRADE_BOARD_PRESET.leftPriceRole);
  const [ocrTradeRightPriceRole, setOcrTradeRightPriceRole] = useState<"server" | "world">(DEFAULT_TRADE_BOARD_PRESET.rightPriceRole);
  const [ocrStrictIconMatch, setOcrStrictIconMatch] = useState(false);
  const [ocrCalibrationTarget, setOcrCalibrationTarget] = useState<"names" | "prices" | "icon">("names");
  const [ocrDragStart, setOcrDragStart] = useState<{ x: number; y: number } | null>(null);
  const [ocrDragRect, setOcrDragRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [simulationMaterialDraft, setSimulationMaterialDraft] = useState<Record<string, { unitPrice: string; owned: string }>>({});

  const taxRate = Number(taxMode);

  const itemById = useMemo(() => {
    if (!state) return new Map<string, { name: string; category: WorkshopItemCategory; notes?: string }>();
    return new Map(state.items.map((item) => [item.id, { name: item.name, category: item.category, notes: item.notes }]));
  }, [state]);

  const classifiedItemOptions = useMemo<ClassifiedItemOption[]>(() => {
    if (!state) {
      return [];
    }
    return state.items
      .map((item) => {
        const rawCategory = parseItemRawCategory(item.notes);
        const sourceTag = parseItemSourceTag(item.notes);
        const explicitMainCategory = parseItemMainCategory(item.notes);
        const subCategory = inferRecipeSubCategory(rawCategory, item.name, item.category);
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          mainCategory: inferMainCategoryByContext(explicitMainCategory, sourceTag, subCategory, rawCategory, item.name),
          subCategory,
        };
      });
  }, [state]);

  const itemMainCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(classifiedItemOptions.map((entry) => entry.mainCategory).filter(Boolean)));
    if (unique.length === 0) {
      return ["鐵匠"];
    }
    return unique.sort(sortMainCategoryText);
  }, [classifiedItemOptions]);

  const itemsByMainCategory = useMemo(() => {
    return classifiedItemOptions.filter((entry) => {
      if (itemMainCategory && entry.mainCategory !== itemMainCategory) {
        return false;
      }
      return true;
    });
  }, [classifiedItemOptions, itemMainCategory]);

  const filteredItems = useMemo(() => {
    return itemsByMainCategory.filter((entry) => {
      if (itemSubCategory !== "all" && entry.subCategory !== itemSubCategory) {
        return false;
      }
      return true;
    });
  }, [itemsByMainCategory, itemSubCategory]);

  const itemSubCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(itemsByMainCategory.map((entry) => entry.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  }, [itemsByMainCategory]);

  const historyMainCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(classifiedItemOptions.map((entry) => entry.mainCategory).filter(Boolean)));
    if (unique.length === 0) {
      return ["鐵匠"];
    }
    return unique.sort(sortMainCategoryText);
  }, [classifiedItemOptions]);

  const historyItemsByMainCategory = useMemo(() => {
    return classifiedItemOptions.filter((entry) => {
      if (historyMainCategory && entry.mainCategory !== historyMainCategory) {
        return false;
      }
      return true;
    });
  }, [classifiedItemOptions, historyMainCategory]);

  const historySubCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(historyItemsByMainCategory.map((entry) => entry.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  }, [historyItemsByMainCategory]);

  const filteredHistoryItems = useMemo(() => {
    const keyword = historyKeyword.trim();
    return historyItemsByMainCategory.filter((entry) => {
      if (historySubCategory !== "all" && entry.subCategory !== historySubCategory) {
        return false;
      }
      if (keyword && !entry.name.includes(keyword)) {
        return false;
      }
      return true;
    });
  }, [historyItemsByMainCategory, historySubCategory, historyKeyword]);

  const simulationRecipeOptions = useMemo<SimulationRecipeOption[]>(() => {
    if (!state) {
      return [];
    }
    return state.recipes
      .map((recipe) => {
        const outputItem = itemById.get(recipe.outputItemId);
        const outputName = outputItem?.name ?? recipe.outputItemId;
        const rawCategory = parseItemRawCategory(outputItem?.notes);
        const sourceTag = parseItemSourceTag(outputItem?.notes);
        const explicitMainCategory = parseItemMainCategory(outputItem?.notes);
        const subCategory = inferRecipeSubCategory(rawCategory, outputName, outputItem?.category ?? "other");
        return {
          id: recipe.id,
          outputName,
          mainCategory: inferMainCategoryByContext(explicitMainCategory, sourceTag, subCategory, rawCategory, outputName),
          subCategory,
        };
      });
  }, [state, itemById]);

  const simulationMainCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(simulationRecipeOptions.map((entry) => entry.mainCategory).filter(Boolean)));
    if (unique.length === 0) {
      return ["鐵匠"];
    }
    return unique.sort(sortMainCategoryText);
  }, [simulationRecipeOptions]);

  const simulationRecipesByMainCategory = useMemo(() => {
    return simulationRecipeOptions.filter((entry) => {
      if (simulateMainCategory && entry.mainCategory !== simulateMainCategory) {
        return false;
      }
      return true;
    });
  }, [simulationRecipeOptions, simulateMainCategory]);

  const filteredSimulationRecipes = useMemo(() => {
    return simulationRecipesByMainCategory.filter((entry) => {
      if (simulateSubCategory !== "all" && entry.subCategory !== simulateSubCategory) {
        return false;
      }
      return true;
    });
  }, [simulationRecipesByMainCategory, simulateSubCategory]);

  const simulationSubCategoryOptions = useMemo(() => {
    const unique = Array.from(new Set(simulationRecipesByMainCategory.map((entry) => entry.subCategory).filter(Boolean)));
    return unique.sort(sortCategoryText);
  }, [simulationRecipesByMainCategory]);

  const latestPriceMetaByItemId = useMemo(() => {
    if (!state) return new Map<string, { price: number; capturedAt: number }>();
    const map = new Map<string, { price: number; capturedAt: number }>();
    state.prices.forEach((snapshot) => {
      const ts = new Date(snapshot.capturedAt).getTime();
      const prev = map.get(snapshot.itemId);
      if (!prev || ts >= prev.capturedAt) {
        map.set(snapshot.itemId, { price: snapshot.unitPrice, capturedAt: ts });
      }
    });
    return map;
  }, [state]);

  const latestPriceByItemId = useMemo(() => {
    return new Map(Array.from(latestPriceMetaByItemId.entries()).map(([itemId, value]) => [itemId, value.price]));
  }, [latestPriceMetaByItemId]);

  const inventoryByItemId = useMemo(() => {
    if (!state) return new Map<string, number>();
    return new Map(state.inventory.map((row) => [row.itemId, row.quantity]));
  }, [state]);

  const nearCraftBudget = useMemo(() => {
    const parsed = toInt(nearCraftBudgetInput);
    if (parsed === null || parsed < 0) {
      return 0;
    }
    return parsed;
  }, [nearCraftBudgetInput]);

  const nearCraftSuggestions = useMemo(() => {
    return craftOptions
      .map((option) => {
        const missingRows = option.missingRowsForOneRun.filter((row) => row.missing > 0);
        if (missingRows.length === 0) {
          return null;
        }
        const unknownPriceRows = missingRows.filter((row) => row.missingCost === null || row.latestUnitPrice === null);
        const missingPurchaseCostPerRun =
          unknownPriceRows.length > 0 ? null : missingRows.reduce((acc, row) => acc + (row.missingCost ?? 0), 0);
        const affordableRuns =
          missingPurchaseCostPerRun === null || missingPurchaseCostPerRun <= 0
            ? 0
            : Math.max(0, Math.floor(nearCraftBudget / missingPurchaseCostPerRun));
        const estimatedProfitPerRun = option.estimatedProfitPerRun;
        const estimatedBudgetProfit =
          estimatedProfitPerRun === null || affordableRuns <= 0 ? null : estimatedProfitPerRun * affordableRuns;
        return {
          ...option,
          missingRows,
          missingPurchaseCostPerRun,
          affordableRuns,
          estimatedBudgetProfit,
          unknownPriceRows,
        };
      })
      .filter((entry) => entry !== null)
      .filter((entry) => entry.affordableRuns > 0 || entry.unknownPriceRows.length > 0)
      .sort((left, right) => {
        const leftCost = left.missingPurchaseCostPerRun ?? Number.MAX_SAFE_INTEGER;
        const rightCost = right.missingPurchaseCostPerRun ?? Number.MAX_SAFE_INTEGER;
        const leftProfit = left.estimatedBudgetProfit ?? Number.NEGATIVE_INFINITY;
        const rightProfit = right.estimatedBudgetProfit ?? Number.NEGATIVE_INFINITY;
        const leftPerRunProfit = left.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
        const rightPerRunProfit = right.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;

        if (nearCraftSortMode === "min_gap_cost") {
          if (leftCost !== rightCost) {
            return leftCost - rightCost;
          }
          if (right.affordableRuns !== left.affordableRuns) {
            return right.affordableRuns - left.affordableRuns;
          }
          if (rightProfit !== leftProfit) {
            return rightProfit - leftProfit;
          }
          if (rightPerRunProfit !== leftPerRunProfit) {
            return rightPerRunProfit - leftPerRunProfit;
          }
          return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
        }

        if (rightProfit !== leftProfit) {
          return rightProfit - leftProfit;
        }
        if (rightPerRunProfit !== leftPerRunProfit) {
          return rightPerRunProfit - leftPerRunProfit;
        }
        if (leftCost !== rightCost) {
          return leftCost - rightCost;
        }
        return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
      });
  }, [craftOptions, nearCraftBudget, nearCraftSortMode]);

  const activeHistoryQuickDays = useMemo(() => {
    const current = toInt(historyDaysInput);
    if (current === null) {
      return null;
    }
    return HISTORY_QUICK_DAY_OPTIONS.find((days) => days === current) ?? null;
  }, [historyDaysInput]);

  const historyInsight = useMemo(() => {
    if (!historyResult || historyResult.sampleCount <= 0) {
      return null;
    }
    const latestPoint = historyResult.points[historyResult.points.length - 1] ?? null;
    if (!latestPoint) {
      return null;
    }
    const latestWeekdayAverage =
      historyResult.weekdayAverages.find((entry) => entry.weekday === latestPoint.weekday)?.averagePrice ?? null;
    const deviationFromWeekday =
      historyResult.latestPrice === null || latestWeekdayAverage === null || latestWeekdayAverage === 0
        ? null
        : (historyResult.latestPrice - latestWeekdayAverage) / latestWeekdayAverage;

    return {
      latestPoint,
      latestWeekdayAverage,
      deviationFromWeekday,
    };
  }, [historyResult]);

  const triggeredSignalRows = useMemo(() => {
    if (!signalResult) {
      return [];
    }
    return signalResult.rows.filter((row) => row.triggered);
  }, [signalResult]);

  const recentOcrImportedEntries = useMemo(() => {
    const fromHotkey = ocrHotkeyLastResult?.importedEntries ?? [];
    const fromManual = ocrImportResult?.importedEntries ?? [];
    const merged = [...fromHotkey, ...fromManual];
    return merged
      .sort((left, right) => {
        const tsDiff = new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime();
        if (tsDiff !== 0) {
          return tsDiff;
        }
        return left.lineNumber - right.lineNumber;
      })
      .slice(0, 20);
  }, [ocrHotkeyLastResult, ocrImportResult]);

  const buyZoneRows = useMemo(() => {
    if (!signalResult) {
      return [];
    }
    return [...signalResult.rows]
      .filter((row) => row.trendTag === "buy-zone")
      .sort((left, right) => {
        const leftDeviation = left.deviationRatioFromWeekdayAverage ?? Number.POSITIVE_INFINITY;
        const rightDeviation = right.deviationRatioFromWeekdayAverage ?? Number.POSITIVE_INFINITY;
        if (leftDeviation !== rightDeviation) {
          return leftDeviation - rightDeviation;
        }
        return right.sampleCount - left.sampleCount;
      });
  }, [signalResult]);

  const sellZoneRows = useMemo(() => {
    if (!signalResult) {
      return [];
    }
    return [...signalResult.rows]
      .filter((row) => row.trendTag === "sell-zone")
      .sort((left, right) => {
        const leftDeviation = left.deviationRatioFromWeekdayAverage ?? Number.NEGATIVE_INFINITY;
        const rightDeviation = right.deviationRatioFromWeekdayAverage ?? Number.NEGATIVE_INFINITY;
        if (leftDeviation !== rightDeviation) {
          return rightDeviation - leftDeviation;
        }
        return right.sampleCount - left.sampleCount;
      });
  }, [signalResult]);

  const historyChartModel = useMemo(() => {
    if (!historyResult || historyResult.points.length === 0) {
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
    const values = historyResult.points.map((point) => point.unitPrice);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const valuePadding = minValue === maxValue ? Math.max(1, Math.round(maxValue * 0.06)) : 0;
    const lowerBound = Math.max(0, minValue - valuePadding);
    const upperBound = maxValue + valuePadding;
    const valueSpan = Math.max(1, upperBound - lowerBound);

    const points = historyResult.points.map((point, index) => {
      const xRatio = historyResult.points.length <= 1 ? 0.5 : index / (historyResult.points.length - 1);
      const x = left + xRatio * plotWidth;
      const y = top + ((upperBound - point.unitPrice) / valueSpan) * plotHeight;
      const ma7Y = point.ma7 === null ? null : top + ((upperBound - point.ma7) / valueSpan) * plotHeight;
      return {
        ...point,
        x,
        y,
        ma7Y,
        dateKey: point.capturedAt.slice(0, 10),
      };
    });

    const pricePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    const ma7Path = buildNullableLinePath(points.map((point) => ({ x: point.x, y: point.ma7Y })));
    const yTicks = Array.from({ length: 4 }, (_, index) => {
      const ratio = index / 3;
      const value = upperBound - ratio * valueSpan;
      const y = top + ratio * plotHeight;
      return {
        value,
        y,
      };
    });
    const xTickIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])).sort(
      (leftIndex, rightIndex) => leftIndex - rightIndex,
    );
    const xTicks = xTickIndexes.map((index) => ({
      x: points[index].x,
      label: formatDateLabel(points[index].capturedAt),
    }));
    const wednesdayByDate = new Map<string, number>();
    points.forEach((point) => {
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
      pricePath,
      ma7Path,
      points,
      yTicks,
      xTicks,
      wednesdayMarkers: Array.from(wednesdayByDate.entries()).map(([date, x]) => ({ date, x })),
      latestPoint: points[points.length - 1] ?? null,
    };
  }, [historyResult]);

  const ocrIconPreviewRows = useMemo(() => {
    const firstRowTop = toInt(ocrFirstRowTop);
    const rowHeight = toInt(ocrRowHeight);
    const rowCount = toInt(ocrTradeRowCount);
    const nameAnchorX = toInt(ocrNameAnchorX);
    const iconOffsetX = toInt(ocrIconOffsetX);
    const iconTopOffset = toInt(ocrIconTopOffset);
    const iconWidth = toInt(ocrIconWidth);
    const iconHeight = toInt(ocrIconHeight);
    if (
      firstRowTop === null ||
      rowHeight === null ||
      rowCount === null ||
      nameAnchorX === null ||
      iconOffsetX === null ||
      iconTopOffset === null ||
      iconWidth === null ||
      iconHeight === null
    ) {
      return [];
    }
    if (iconWidth <= 0 || iconHeight <= 0 || rowHeight <= 0 || rowCount <= 0) {
      return [];
    }
    const left = nameAnchorX + iconOffsetX;
    const top = firstRowTop + iconTopOffset;
    return Array.from({ length: rowCount }, (_, index) => ({
      index,
      left,
      top: top + index * rowHeight,
      width: iconWidth,
      height: iconHeight,
    }));
  }, [ocrFirstRowTop, ocrRowHeight, ocrTradeRowCount, ocrNameAnchorX, ocrIconOffsetX, ocrIconTopOffset, ocrIconWidth, ocrIconHeight]);

  const ocrTradeNamesRect = useMemo(() => {
    const x = toInt(ocrTradeNamesX);
    const y = toInt(ocrTradeNamesY);
    const width = toInt(ocrTradeNamesWidth);
    const height = toInt(ocrTradeNamesHeight);
    if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
      return null;
    }
    return { x, y, width, height };
  }, [ocrTradeNamesX, ocrTradeNamesY, ocrTradeNamesWidth, ocrTradeNamesHeight]);

  const ocrTradePricesRect = useMemo(() => {
    const x = toInt(ocrTradePricesX);
    const y = toInt(ocrTradePricesY);
    const width = toInt(ocrTradePricesWidth);
    const height = toInt(ocrTradePricesHeight);
    if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
      return null;
    }
    return { x, y, width, height };
  }, [ocrTradePricesX, ocrTradePricesY, ocrTradePricesWidth, ocrTradePricesHeight]);

  async function loadState(): Promise<void> {
    const next = await window.aionApi.getWorkshopState();
    setState(next);
  }

  async function loadCraftOptions(): Promise<void> {
    const next = await window.aionApi.getWorkshopCraftOptions({ taxRate });
    setCraftOptions(next);
  }

  async function loadSignals(): Promise<void> {
    const next = await window.aionApi.getWorkshopPriceSignals();
    setSignalResult(next);
  }

  async function loadOcrHotkeyState(): Promise<void> {
    const next = await window.aionApi.getWorkshopOcrHotkeyState();
    setOcrHotkeyState(next);
    setOcrHotkeyShortcut(next.shortcut);
    setOcrAutoCreateMissing(next.autoCreateMissingItems);
    setOcrStrictIconMatch(next.strictIconMatch);
    setOcrHotkeyLastResult(next.lastResult);
  }

  async function bootstrap(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await Promise.all([loadState(), loadCraftOptions(), loadSignals(), loadOcrHotkeyState()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "工坊初始化失败");
    } finally {
      setBusy(false);
    }
  }

  async function commit(action: () => Promise<WorkshopState>, successText: string): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await action();
      setState(next);
      setMessage(successText);
      await Promise.all([loadCraftOptions(), loadSignals()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "工坊操作失败");
    } finally {
      setBusy(false);
    }
  }

  function parseIconCaptureTemplateOrError(): {
    template: WorkshopOcrIconCaptureTemplate | null;
    error: string | null;
  } {
    if (!ocrIconCaptureEnabled) {
      return { template: null, error: null };
    }
    const firstRowTop = toInt(ocrFirstRowTop);
    const rowHeight = toInt(ocrRowHeight);
    const nameAnchorX = toInt(ocrNameAnchorX);
    const iconOffsetX = toInt(ocrIconOffsetX);
    const iconTopOffset = toInt(ocrIconTopOffset);
    const iconWidth = toInt(ocrIconWidth);
    const iconHeight = toInt(ocrIconHeight);
    if (firstRowTop === null || firstRowTop < 0) {
      return { template: null, error: "图标抓取参数错误：首行 Y 必须是 >= 0 的整数。" };
    }
    if (rowHeight === null || rowHeight <= 0) {
      return { template: null, error: "图标抓取参数错误：行高必须是正整数。" };
    }
    if (nameAnchorX === null || nameAnchorX < 0) {
      return { template: null, error: "图标抓取参数错误：名称锚点 X 必须是 >= 0 的整数。" };
    }
    if (iconOffsetX === null) {
      return { template: null, error: "图标抓取参数错误：左偏移必须是整数。" };
    }
    if (iconTopOffset === null) {
      return { template: null, error: "图标抓取参数错误：上偏移必须是整数。" };
    }
    if (iconWidth === null || iconWidth <= 0 || iconHeight === null || iconHeight <= 0) {
      return { template: null, error: "图标抓取参数错误：图标宽高必须是正整数。" };
    }
    return {
      template: {
        firstRowTop,
        rowHeight,
        nameAnchorX,
        iconOffsetX,
        iconTopOffset,
        iconWidth,
        iconHeight,
      },
      error: null,
    };
  }

  function parseTradeBoardPresetOrError(): {
    preset: {
      enabled: boolean;
      rowCount: number;
      namesRect: { x: number; y: number; width: number; height: number };
      pricesRect: { x: number; y: number; width: number; height: number };
      priceMode: "single" | "dual";
      priceColumn: "left" | "right";
      leftPriceRole: "server" | "world";
      rightPriceRole: "server" | "world";
    } | null;
    error: string | null;
  } {
    const rowCount = toInt(ocrTradeRowCount);
    const namesX = toInt(ocrTradeNamesX);
    const namesY = toInt(ocrTradeNamesY);
    const namesWidth = toInt(ocrTradeNamesWidth);
    const namesHeight = toInt(ocrTradeNamesHeight);
    const pricesX = toInt(ocrTradePricesX);
    const pricesY = toInt(ocrTradePricesY);
    const pricesWidth = toInt(ocrTradePricesWidth);
    const pricesHeight = toInt(ocrTradePricesHeight);
    if (
      rowCount === null ||
      rowCount <= 0 ||
      namesX === null ||
      namesY === null ||
      namesWidth === null ||
      namesHeight === null ||
      pricesX === null ||
      pricesY === null ||
      pricesWidth === null ||
      pricesHeight === null
    ) {
      return { preset: null, error: "交易行框选参数必须为整数。" };
    }
    if (namesX < 0 || namesY < 0 || namesWidth <= 0 || namesHeight <= 0) {
      return { preset: null, error: "名称框参数无效（坐标需 >=0，宽高需 >0）。" };
    }
    if (pricesX < 0 || pricesY < 0 || pricesWidth <= 0 || pricesHeight <= 0) {
      return { preset: null, error: "价格框参数无效（坐标需 >=0，宽高需 >0）。" };
    }
    return {
      preset: {
        enabled: true,
        rowCount,
        namesRect: { x: namesX, y: namesY, width: namesWidth, height: namesHeight },
        pricesRect: { x: pricesX, y: pricesY, width: pricesWidth, height: pricesHeight },
        priceMode: ocrTradePriceMode,
        priceColumn: ocrTradePriceColumn,
        leftPriceRole: ocrTradeLeftPriceRole,
        rightPriceRole: ocrTradeRightPriceRole,
      },
      error: null,
    };
  }

  function parseScreenCaptureOptionsOrError(): {
    options: { delayMs: number; hideAppBeforeCapture: boolean } | null;
    error: string | null;
  } {
    const delayMs = toInt(ocrCaptureDelayMs);
    if (delayMs === null || delayMs < 0) {
      return { options: null, error: "截屏延迟必须是 >=0 的整数毫秒。" };
    }
    return {
      options: {
        delayMs,
        hideAppBeforeCapture: ocrHideAppBeforeCapture,
      },
      error: null,
    };
  }

  function applyCalibrationRectToTarget(rect: { x: number; y: number; width: number; height: number }): void {
    if (ocrCalibrationTarget === "names") {
      setOcrTradeNamesX(String(rect.x));
      setOcrTradeNamesY(String(rect.y));
      setOcrTradeNamesWidth(String(rect.width));
      setOcrTradeNamesHeight(String(rect.height));
      return;
    }
    if (ocrCalibrationTarget === "prices") {
      setOcrTradePricesX(String(rect.x));
      setOcrTradePricesY(String(rect.y));
      setOcrTradePricesWidth(String(rect.width));
      setOcrTradePricesHeight(String(rect.height));
      return;
    }
    setOcrFirstRowTop(String(rect.y));
    setOcrRowHeight("135");
    setOcrNameAnchorX(String(rect.x + 85));
    setOcrIconOffsetX("-85");
    setOcrIconTopOffset("0");
    setOcrIconWidth("85");
    setOcrIconHeight("85");
  }

  function pointInPreview(event: ReactMouseEvent<HTMLDivElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.floor(event.clientX - rect.left)),
      y: Math.max(0, Math.floor(event.clientY - rect.top)),
    };
  }

  function onPreviewMouseDown(event: ReactMouseEvent<HTMLDivElement>): void {
    const point = pointInPreview(event);
    setOcrDragStart(point);
    setOcrDragRect({ x: point.x, y: point.y, width: 1, height: 1 });
  }

  function onPreviewMouseMove(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!ocrDragStart) {
      return;
    }
    const point = pointInPreview(event);
    const left = Math.min(ocrDragStart.x, point.x);
    const top = Math.min(ocrDragStart.y, point.y);
    const width = Math.max(1, Math.abs(point.x - ocrDragStart.x));
    const height = Math.max(1, Math.abs(point.y - ocrDragStart.y));
    setOcrDragRect({ x: left, y: top, width, height });
  }

  function onPreviewMouseUp(): void {
    if (ocrDragRect) {
      applyCalibrationRectToTarget(ocrDragRect);
    }
    setOcrDragStart(null);
    setOcrDragRect(null);
  }

  async function onApplyOcrHotkeyConfig(nextEnabled: boolean): Promise<void> {
    const iconCaptureParsed = parseIconCaptureTemplateOrError();
    if (iconCaptureParsed.error) {
      setError(iconCaptureParsed.error);
      return;
    }
    const tradePresetParsed = parseTradeBoardPresetOrError();
    if (tradePresetParsed.error) {
      setError(tradePresetParsed.error);
      return;
    }
    const psm = toInt(ocrPsm);
    if (psm === null || psm <= 0) {
      setError("OCR 参数错误：PSM 必须是正整数。");
      return;
    }
    const shortcut = ocrHotkeyShortcut.trim();
    if (!shortcut) {
      setError("请先填写快捷键组合。");
      return;
    }
    const captureParsed = parseScreenCaptureOptionsOrError();
    if (captureParsed.error) {
      setError(captureParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await window.aionApi.configureWorkshopOcrHotkey({
        enabled: nextEnabled,
        shortcut,
        language: ocrLanguage.trim() || "chi_tra+eng",
        psm,
        captureDelayMs: captureParsed.options?.delayMs,
        hideAppBeforeCapture: captureParsed.options?.hideAppBeforeCapture,
        autoCreateMissingItems: ocrAutoCreateMissing,
        defaultCategory: "material",
        iconCapture: iconCaptureParsed.template,
        strictIconMatch: ocrStrictIconMatch,
        tradeBoardPreset: tradePresetParsed.preset,
      });
      setOcrHotkeyState(next);
      setOcrHotkeyShortcut(next.shortcut);
      setOcrHotkeyLastResult(next.lastResult);
      if (next.enabled && !next.registered) {
        setError(`快捷键未注册成功：${next.shortcut}。建议改用 Ctrl+Shift+F8 或避免与游戏内热键冲突。`);
      } else {
        setMessage(next.enabled ? `快捷抓价已启用（${next.shortcut}）` : "快捷抓价已关闭");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "快捷抓价配置失败");
    } finally {
      setBusy(false);
    }
  }

  async function onTriggerOcrHotkeyNow(): Promise<void> {
    const captureParsed = parseScreenCaptureOptionsOrError();
    if (captureParsed.error) {
      setError(captureParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await window.aionApi.triggerWorkshopOcrHotkeyNow(captureParsed.options ?? undefined);
      setOcrHotkeyLastResult(result);
      await Promise.all([loadState(), loadCraftOptions(), loadSignals()]);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "手动触发快捷抓价失败");
    } finally {
      setBusy(false);
    }
  }

  async function onCaptureOcrScreenPreview(): Promise<void> {
    const captureParsed = parseScreenCaptureOptionsOrError();
    if (captureParsed.error) {
      setError(captureParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const preview = await window.aionApi.captureWorkshopScreenPreview(captureParsed.options ?? undefined);
      setOcrScreenPreview(preview);
      setMessage(`校准图已捕获：${preview.width}x${preview.height}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "捕获校准图失败");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    const off = window.aionApi.onWorkshopOcrHotkeyResult((result) => {
      setOcrHotkeyLastResult(result);
      setMessage(result.message);
      if (!result.success) {
        setError(result.message);
      }
      void Promise.all([loadState(), loadCraftOptions(), loadSignals()]);
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!itemMainCategoryOptions.includes(itemMainCategory)) {
      setItemMainCategory(itemMainCategoryOptions[0] ?? "鐵匠");
      return;
    }
    if (itemSubCategory !== "all" && !itemSubCategoryOptions.includes(itemSubCategory)) {
      setItemSubCategory("all");
      return;
    }
    const exists = selectedItemId && filteredItems.some((item) => item.id === selectedItemId);
    if (!exists) {
      const fallback = filteredItems[0]?.id ?? "";
      setSelectedItemId(fallback);
    }
  }, [itemMainCategory, itemMainCategoryOptions, itemSubCategory, itemSubCategoryOptions, selectedItemId, filteredItems]);

  useEffect(() => {
    if (!historyMainCategoryOptions.includes(historyMainCategory)) {
      setHistoryMainCategory(historyMainCategoryOptions[0] ?? "鐵匠");
      return;
    }
    if (historySubCategory !== "all" && !historySubCategoryOptions.includes(historySubCategory)) {
      setHistorySubCategory("all");
      return;
    }
    const exists = historyItemId && filteredHistoryItems.some((item) => item.id === historyItemId);
    if (!exists) {
      const fallback = filteredHistoryItems[0]?.id ?? "";
      setHistoryItemId(fallback);
      setHistoryResult(null);
    }
  }, [
    historyMainCategory,
    historyMainCategoryOptions,
    historySubCategory,
    historySubCategoryOptions,
    historyItemId,
    filteredHistoryItems,
  ]);

  useEffect(() => {
    if (!simulationMainCategoryOptions.includes(simulateMainCategory)) {
      setSimulateMainCategory(simulationMainCategoryOptions[0] ?? "鐵匠");
      return;
    }
    if (simulateSubCategory !== "all" && !simulationSubCategoryOptions.includes(simulateSubCategory)) {
      setSimulateSubCategory("all");
      return;
    }
    const exists = simulateRecipeId && filteredSimulationRecipes.some((recipe) => recipe.id === simulateRecipeId);
    if (!exists) {
      const fallback = filteredSimulationRecipes[0]?.id ?? "";
      setSimulateRecipeId(fallback);
      setSimulation(null);
    }
  }, [
    simulateMainCategory,
    simulationMainCategoryOptions,
    simulateSubCategory,
    simulationSubCategoryOptions,
    simulateRecipeId,
    filteredSimulationRecipes,
  ]);

  useEffect(() => {
    if (!state) {
      return;
    }
    setSignalRuleEnabled(state.signalRule.enabled);
    setSignalLookbackDaysInput(String(state.signalRule.lookbackDays));
    setSignalThresholdPercentInput(String(Math.round(state.signalRule.dropBelowWeekdayAverageRatio * 10000) / 100));
  }, [state?.signalRule.enabled, state?.signalRule.lookbackDays, state?.signalRule.dropBelowWeekdayAverageRatio]);

  useEffect(() => {
    if (!selectedItemId) return;
    const price = latestPriceByItemId.get(selectedItemId) ?? 0;
    const inventory = inventoryByItemId.get(selectedItemId) ?? 0;
    setSelectedItemPrice(String(price));
    setSelectedItemInventory(String(inventory));
  }, [selectedItemId, latestPriceByItemId, inventoryByItemId]);

  useEffect(() => {
    if (!state) return;
    void loadCraftOptions();
  }, [taxMode]);

  useEffect(() => {
    const preset = OCR_ICON_CAPTURE_PRESETS[ocrIconPreset];
    if (!preset) {
      return;
    }
    setOcrFirstRowTop(preset.firstRowTop);
    setOcrRowHeight(preset.rowHeight);
    setOcrNameAnchorX(preset.nameAnchorX);
    setOcrIconOffsetX(preset.iconOffsetX);
    setOcrIconTopOffset(preset.iconTopOffset);
    setOcrIconWidth(preset.iconWidth);
    setOcrIconHeight(preset.iconHeight);
  }, [ocrIconPreset]);

  function onSaveSelectedPrice(): void {
    if (!selectedItemId) {
      setError("请先选择物品。");
      return;
    }
    const unitPrice = toInt(selectedItemPrice);
    if (unitPrice === null || unitPrice < 0) {
      setError("价格必须是大于等于 0 的整数。");
      return;
    }
    void commit(
      () =>
        window.aionApi.addWorkshopPriceSnapshot({
          itemId: selectedItemId,
          unitPrice,
          source: "manual",
        }),
      "已记录价格快照",
    );
  }

  function onSaveSelectedInventory(): void {
    if (!selectedItemId) {
      setError("请先选择物品。");
      return;
    }
    const quantity = toInt(selectedItemInventory);
    if (quantity === null || quantity < 0) {
      setError("库存必须是大于等于 0 的整数。");
      return;
    }
    void commit(() => window.aionApi.upsertWorkshopInventory({ itemId: selectedItemId, quantity }), "已更新库存");
  }

  function onPickItemForCorrection(itemId: string): void {
    setSelectedItemId(itemId);
    const price = latestPriceByItemId.get(itemId) ?? 0;
    const inventory = inventoryByItemId.get(itemId) ?? 0;
    setSelectedItemPrice(String(price));
    setSelectedItemInventory(String(inventory));
  }

  async function onSimulate(): Promise<void> {
    if (!simulateRecipeId) {
      setError("请先选择要模拟的配方。");
      return;
    }
    const runs = toInt(simulateRuns);
    if (runs === null || runs <= 0) {
      setError("制作次数必须是正整数。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await window.aionApi.simulateWorkshopCraft({
        recipeId: simulateRecipeId,
        runs,
        taxRate,
        materialMode: "direct",
      });
      setSimulation(result);
      const draftMap: Record<string, { unitPrice: string; owned: string }> = {};
      result.materialRows.forEach((row) => {
        draftMap[row.itemId] = {
          unitPrice: row.latestUnitPrice === null ? "" : String(row.latestUnitPrice),
          owned: String(row.owned),
        };
      });
      setSimulationMaterialDraft(draftMap);
      setMessage("模拟完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "模拟失败");
    } finally {
      setBusy(false);
    }
  }

  async function onApplySimulationMaterialEdits(): Promise<void> {
    if (!simulation) {
      setError("请先运行一次模拟。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      for (const row of simulation.materialRows) {
        const draft = simulationMaterialDraft[row.itemId];
        if (!draft) {
          continue;
        }
        const owned = toInt(draft.owned);
        if (owned === null || owned < 0) {
          throw new Error(`材料「${row.itemName}」库存必须是大于等于 0 的整数。`);
        }
        if (owned !== row.owned) {
          await window.aionApi.upsertWorkshopInventory({ itemId: row.itemId, quantity: owned });
        }
        const priceText = draft.unitPrice.trim();
        if (priceText) {
          const unitPrice = toInt(priceText);
          if (unitPrice === null || unitPrice < 0) {
            throw new Error(`材料「${row.itemName}」单价必须是大于等于 0 的整数。`);
          }
          if (row.latestUnitPrice === null || unitPrice !== row.latestUnitPrice) {
            await window.aionApi.addWorkshopPriceSnapshot({
              itemId: row.itemId,
              unitPrice,
              source: "manual",
              note: "simulate-inline-edit",
            });
          }
        }
      }

      const [nextState, rerun] = await Promise.all([
        window.aionApi.getWorkshopState(),
        window.aionApi.simulateWorkshopCraft({
          recipeId: simulation.recipeId,
          runs: simulation.runs,
          taxRate,
          materialMode: "direct",
        }),
      ]);
      setState(nextState);
      setSimulation(rerun);
      const nextDraftMap: Record<string, { unitPrice: string; owned: string }> = {};
      rerun.materialRows.forEach((row) => {
        nextDraftMap[row.itemId] = {
          unitPrice: row.latestUnitPrice === null ? "" : String(row.latestUnitPrice),
          owned: String(row.owned),
        };
      });
      setSimulationMaterialDraft(nextDraftMap);
      await Promise.all([loadCraftOptions(), loadSignals()]);
      setMessage("材料单价/库存已保存，并已按最新数据重算。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新材料参数失败");
    } finally {
      setBusy(false);
    }
  }

  async function onLoadPriceHistory(daysOverride?: number): Promise<void> {
    if (!historyItemId) {
      setError("请先选择要查询的物品。");
      return;
    }
    const days = daysOverride ?? toInt(historyDaysInput);
    if (days === null || days <= 0) {
      setError("查询天数必须是正整数。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await window.aionApi.getWorkshopPriceHistory({
        itemId: historyItemId,
        days,
      });
      setHistoryResult(result);
      setMessage("价格历史已刷新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "价格历史查询失败");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveSignalRule(): Promise<void> {
    const lookbackDays = toInt(signalLookbackDaysInput);
    if (lookbackDays === null || lookbackDays <= 0) {
      setError("Phase 2.3 规则配置失败：回看天数必须是正整数。");
      return;
    }
    const thresholdPercent = Number(signalThresholdPercentInput);
    if (!Number.isFinite(thresholdPercent) || thresholdPercent <= 0) {
      setError("Phase 2.3 规则配置失败：阈值必须是大于 0 的数字。");
      return;
    }

    await commit(
      () =>
        window.aionApi.updateWorkshopSignalRule({
          enabled: signalRuleEnabled,
          lookbackDays,
          dropBelowWeekdayAverageRatio: thresholdPercent / 100,
        }),
      "Phase 2.3 周期波动提示规则已保存",
    );
  }

  async function onRefreshSignals(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await loadSignals();
      setMessage("Phase 2.3 信号已刷新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Phase 2.3 信号刷新失败");
    } finally {
      setBusy(false);
    }
  }

  async function onImportOcrPrices(): Promise<void> {
    if (!ocrRawText.trim()) {
      setError("请先粘贴 OCR 识别文本。");
      return;
    }
    const iconCaptureParsed = parseIconCaptureTemplateOrError();
    if (iconCaptureParsed.error) {
      setError(iconCaptureParsed.error);
      return;
    }
    let iconCapture:
      | {
          screenshotPath: string;
          firstRowTop: number;
          rowHeight: number;
          nameAnchorX: number;
          iconOffsetX: number;
          iconTopOffset: number;
          iconWidth: number;
          iconHeight: number;
        }
      | undefined;
    if (ocrIconCaptureEnabled) {
      const screenshotPath = ocrScreenshotPath.trim();
      if (!screenshotPath) {
        setError("请填写截图路径（用于图标抓取）。");
        return;
      }
      const template = iconCaptureParsed.template;
      if (!template) {
        setError("图标抓取参数错误。");
        return;
      }
      iconCapture = {
        screenshotPath,
        firstRowTop: template.firstRowTop,
        rowHeight: template.rowHeight,
        nameAnchorX: template.nameAnchorX,
        iconOffsetX: template.iconOffsetX,
        iconTopOffset: template.iconTopOffset,
        iconWidth: template.iconWidth,
        iconHeight: template.iconHeight,
      };
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const structuredTradeRows =
        ocrExtractResult && ocrExtractResult.text.trim() === ocrRawText.trim() ? ocrExtractResult.tradeRows : undefined;
      const result = await window.aionApi.importWorkshopOcrPrices({
        text: ocrRawText,
        tradeRows: structuredTradeRows,
        source: "import",
        autoCreateMissingItems: ocrAutoCreateMissing,
        defaultCategory: "material",
        strictIconMatch: ocrStrictIconMatch,
        iconCapture,
      });
      setState(result.state);
      setOcrImportResult(result);
      await Promise.all([loadCraftOptions(), loadSignals()]);
      setMessage(
        `OCR 导入完成：成功 ${result.importedCount} 条，新增物品 ${result.createdItemCount} 个，图标抓取 ${result.iconCapturedCount} 条，无法匹配 ${result.unknownItemNames.length} 行，异常 ${result.invalidLines.length} 行。`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR 导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function onExtractOcrText(): Promise<void> {
    const imagePath = ocrImagePath.trim();
    if (!imagePath) {
      setError("请先填写交易行截图路径。");
      return;
    }
    const psm = toInt(ocrPsm);
    if (psm === null || psm <= 0) {
      setError("OCR 参数错误：PSM 必须是正整数。");
      return;
    }
    const tradePresetParsed = parseTradeBoardPresetOrError();
    if (tradePresetParsed.error) {
      setError(tradePresetParsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await window.aionApi.extractWorkshopOcrText({
        imagePath,
        language: ocrLanguage.trim() || "chi_tra+eng",
        psm,
        tradeBoardPreset: tradePresetParsed.preset,
      });
      setOcrExtractResult(result);
      setOcrRawText(result.text);
      setMessage(`OCR 识别完成：${result.lineCount} 行（引擎 ${result.engine}）。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "截图 OCR 识别失败");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <p className="text-sm text-slate-300">工坊模块加载中...</p>
      </article>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">工坊（内置配方库）</h3>
        </div>
        <p className="mt-2 text-xs text-slate-300">当前已支持: 内置材料/配方库，价格与库存维护，制作模拟，背包可制作推荐。</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div className="data-pill">物品数: {state.items.length}</div>
          <div className="data-pill">配方数: {state.recipes.length}</div>
          <div className="data-pill">价格快照: {state.prices.length}</div>
          <div className="data-pill">库存记录: {state.inventory.length}</div>
        </div>
        {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      </article>

      <article className="order-1 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <h4 className="text-sm font-semibold">1) 市场工作台：OCR 抓价导入</h4>
        <p className="mt-2 text-xs text-slate-300">支持“截图 OCR 识别到文本导入”闭环，也支持手动粘贴“物品名 + 价格”文本（每行一条，价格写在行尾）。</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.5fr)_auto]">
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
            value={ocrImagePath}
            onChange={(event) => setOcrImagePath(event.target.value)}
            disabled={busy}
            placeholder="交易行截图路径（绝对路径或项目内相对路径）"
          />
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
            value={ocrLanguage}
            onChange={(event) => setOcrLanguage(event.target.value)}
            disabled={busy}
            placeholder="OCR 语言（默认 chi_tra+eng）"
          />
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
            value={ocrPsm}
            onChange={(event) => setOcrPsm(event.target.value)}
            disabled={busy}
            placeholder="PSM"
          />
          <button className="pill-btn" onClick={() => void onExtractOcrText()} disabled={busy || !ocrImagePath.trim()}>
            从截图识别文本
          </button>
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
          <p className="text-[11px] text-slate-300">交易行 OCR 框选（按你给定坐标默认填充，可直接改）：</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeRowCount}
              onChange={(event) => setOcrTradeRowCount(event.target.value)}
              disabled={busy}
              placeholder="行数（默认 7）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeNamesX}
              onChange={(event) => setOcrTradeNamesX(event.target.value)}
              disabled={busy}
              placeholder="名称框 X（426）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeNamesY}
              onChange={(event) => setOcrTradeNamesY(event.target.value)}
              disabled={busy}
              placeholder="名称框 Y（310）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeNamesWidth}
              onChange={(event) => setOcrTradeNamesWidth(event.target.value)}
              disabled={busy}
              placeholder="名称框 W（900）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeNamesHeight}
              onChange={(event) => setOcrTradeNamesHeight(event.target.value)}
              disabled={busy}
              placeholder="名称框 H（960）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradePricesX}
              onChange={(event) => setOcrTradePricesX(event.target.value)}
              disabled={busy}
              placeholder="价格框 X（1900）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradePricesY}
              onChange={(event) => setOcrTradePricesY(event.target.value)}
              disabled={busy}
              placeholder="价格框 Y（240）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradePricesWidth}
              onChange={(event) => setOcrTradePricesWidth(event.target.value)}
              disabled={busy}
              placeholder="价格框 W（580）"
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradePricesHeight}
              onChange={(event) => setOcrTradePricesHeight(event.target.value)}
              disabled={busy}
              placeholder="价格框 H（1030）"
            />
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradePriceMode}
              onChange={(event) => setOcrTradePriceMode(event.target.value as "single" | "dual")}
              disabled={busy}
            >
              <option value="dual">价格模式：双列（伺服器 + 世界）</option>
              <option value="single">价格模式：单列</option>
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradePriceColumn}
              onChange={(event) => setOcrTradePriceColumn(event.target.value as "left" | "right")}
              disabled={busy}
            >
              <option value="left">单列时主价格列：左侧</option>
              <option value="right">单列时主价格列：右侧</option>
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeLeftPriceRole}
              onChange={(event) => setOcrTradeLeftPriceRole(event.target.value as "server" | "world")}
              disabled={busy}
            >
              <option value="server">左列角色：伺服器价格</option>
              <option value="world">左列角色：世界价格</option>
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrTradeRightPriceRole}
              onChange={(event) => setOcrTradeRightPriceRole(event.target.value as "server" | "world")}
              disabled={busy}
            >
              <option value="world">右列角色：世界价格</option>
              <option value="server">右列角色：伺服器价格</option>
            </select>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            双列模式会先尝试识别表头自动判断“左/右列属于伺服器或世界”；识别失败时才回退到上面手动预设。
          </p>
        </div>
        {ocrExtractResult ? (
          <div className="mt-2 space-y-1 text-xs">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <div className="data-pill">识别行数: {ocrExtractResult.lineCount}</div>
              <div className="data-pill">引擎: {ocrExtractResult.engine}</div>
              <div className="data-pill">警告: {ocrExtractResult.warnings.length}</div>
            </div>
            {ocrExtractResult.warnings.length > 0 ? (
              <div className="max-h-24 overflow-auto rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
                {ocrExtractResult.warnings.slice(0, 20).map((line) => (
                  <p key={`ocr-extract-warning-${line}`}>{line}</p>
                ))}
              </div>
            ) : null}
            <details className="rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
              <summary className="cursor-pointer text-[11px] text-cyan-300">查看 OCR 原始输出（调试）</summary>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-[10px]">{ocrExtractResult.rawText.slice(0, 12000)}</pre>
            </details>
          </div>
        ) : null}
        <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-2 text-xs">
          <p className="text-cyan-200">快捷抓价（全局热键：自动截屏并完成 OCR 与导入）</p>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.6fr)_minmax(0,0.6fr)_auto]">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrCaptureDelayMs}
              onChange={(event) => setOcrCaptureDelayMs(event.target.value)}
              disabled={busy}
              placeholder="截屏延迟毫秒（建议 1200~2500）"
            />
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrHideAppBeforeCapture ? "on" : "off"}
              onChange={(event) => setOcrHideAppBeforeCapture(event.target.value === "on")}
              disabled={busy}
            >
              <option value="on">截屏前自动隐藏程序</option>
              <option value="off">截屏前不隐藏程序</option>
            </select>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
              value={ocrHotkeyShortcut}
              onChange={(event) => setOcrHotkeyShortcut(event.target.value)}
              disabled={busy}
              placeholder="快捷键（Windows 建议 Shift+F8）"
            />
            <button className="pill-btn" onClick={() => void onApplyOcrHotkeyConfig(true)} disabled={busy}>
              启用热键
            </button>
            <button className="pill-btn" onClick={() => void onApplyOcrHotkeyConfig(false)} disabled={busy}>
              关闭热键
            </button>
            <button className="task-btn px-4" onClick={() => void onTriggerOcrHotkeyNow()} disabled={busy}>
              立即抓取一次
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-9">
            <div className="data-pill">状态: {ocrHotkeyState?.enabled ? (ocrHotkeyState.registered ? "已启用" : "注册失败") : "未启用"}</div>
            <div className="data-pill">快捷键: {ocrHotkeyState?.shortcut ?? "--"}</div>
            <div className="data-pill">校验: {ocrStrictIconMatch ? "名称+图标严格" : "名称优先"}</div>
            <div className="data-pill">上次识别: {ocrHotkeyLastResult?.extractedLineCount ?? 0}</div>
            <div className="data-pill">上次导入: {ocrHotkeyLastResult?.importedCount ?? 0}</div>
            <div className="data-pill">未匹配: {ocrHotkeyLastResult?.unknownItemCount ?? 0}</div>
            <div className="data-pill">异常行: {ocrHotkeyLastResult?.invalidLineCount ?? 0}</div>
            <div className="data-pill">上次图标: {ocrHotkeyLastResult?.iconCapturedCount ?? 0}</div>
            <div className="data-pill">警告: {ocrHotkeyLastResult?.warnings.length ?? 0}</div>
          </div>
          {ocrHotkeyLastResult ? (
            <p className={`mt-2 ${ocrHotkeyLastResult.success ? "text-emerald-300" : "text-rose-300"}`}>{ocrHotkeyLastResult.message}</p>
          ) : null}
          {ocrHotkeyLastResult && ocrHotkeyLastResult.warnings.length > 0 ? (
            <details className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
              <summary className="cursor-pointer text-[11px] text-cyan-300">查看快捷抓价警告（调试）</summary>
              <div className="mt-2 max-h-32 overflow-auto text-[11px]">
                {ocrHotkeyLastResult.warnings.slice(0, 30).map((line, index) => (
                  <p key={`ocr-hotkey-warning-${index}`}>{line}</p>
                ))}
              </div>
            </details>
          ) : null}
          {ocrHotkeyLastResult && ocrHotkeyLastResult.importedEntries.length > 0 ? (
            <details className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300" open>
              <summary className="cursor-pointer text-[11px] text-cyan-300">查看本次抓价明细（物品/价格）</summary>
              <div className="mt-2 max-h-44 overflow-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-2 py-1">行</th>
                      <th className="px-2 py-1">物品</th>
                      <th className="px-2 py-1">价格</th>
                      <th className="px-2 py-1">市场</th>
                      <th className="px-2 py-1">时间</th>
                      <th className="px-2 py-1">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocrHotkeyLastResult.importedEntries.map((entry, index) => (
                      <tr key={`ocr-hotkey-entry-${entry.itemId}-${entry.lineNumber}-${index}`} className="border-t border-white/10">
                        <td className="px-2 py-1">{entry.lineNumber}</td>
                        <td className="px-2 py-1">{entry.itemName}</td>
                        <td className="px-2 py-1">{formatGold(entry.unitPrice)}</td>
                        <td className="px-2 py-1">{formatMarketLabel(entry.market)}</td>
                        <td className="px-2 py-1">{formatDateTime(entry.capturedAt)}</td>
                        <td className={`px-2 py-1 ${entry.createdItem ? "text-amber-300" : "text-slate-300"}`}>
                          {entry.createdItem ? "新增物品" : "已存在物品"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </div>
        <textarea
          className="mt-3 min-h-[136px] w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={ocrRawText}
          onChange={(event) => setOcrRawText(event.target.value)}
          disabled={busy}
          placeholder={"奥德矿石 1280\n副本核心 9600\n强化锭 23500"}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={ocrAutoCreateMissing ? "on" : "off"}
            onChange={(event) => setOcrAutoCreateMissing(event.target.value === "on")}
            disabled={busy}
          >
            <option value="off">缺失物品: 仅跳过并提示</option>
            <option value="on">缺失物品: 自动创建(材料)</option>
          </select>
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={ocrIconCaptureEnabled ? "on" : "off"}
            onChange={(event) => setOcrIconCaptureEnabled(event.target.value === "on")}
            disabled={busy}
          >
            <option value="off">图标抓取: 关闭</option>
            <option value="on">图标抓取: 开启（按行窗口）</option>
          </select>
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={ocrStrictIconMatch ? "on" : "off"}
            onChange={(event) => setOcrStrictIconMatch(event.target.value === "on")}
            disabled={busy}
          >
            <option value="off">写入规则: 名称优先（含纠错）</option>
            <option value="on">写入规则: 名称+图标严格同时通过</option>
          </select>
          <button className="task-btn px-4" onClick={() => void onImportOcrPrices()} disabled={busy || !ocrRawText.trim()}>
            执行 OCR 导入
          </button>
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-black/25 p-2">
          <p className="text-[11px] text-slate-300">
            可视化校准：拖拽可直接校准“名称框 / 价格框 / 图标框”。图标抓取规则为“名称锚点 X 向左偏移 + 固定窗口宽高”。
          </p>
          <p className="mt-1 text-[11px] text-slate-400">图标框已固定为 85x85、顶点步进 135（等效图标间隔 50）；拖拽图标框时仅更新首行坐标。</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <select
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrIconPreset}
                onChange={(event) => setOcrIconPreset(event.target.value as keyof typeof OCR_ICON_CAPTURE_PRESETS)}
                disabled={busy}
              >
                <option value="trade_1080p">参数预设: 交易行 1080p</option>
                <option value="trade_1440p">参数预设: 交易行 1440p</option>
                <option value="custom">参数预设: 自定义</option>
              </select>
              <select
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrCalibrationTarget}
                onChange={(event) => setOcrCalibrationTarget(event.target.value as "names" | "prices" | "icon")}
                disabled={busy}
              >
                <option value="names">拖拽校准目标: 名称框</option>
                <option value="prices">拖拽校准目标: 价格框</option>
                <option value="icon">拖拽校准目标: 图标框</option>
              </select>
              <button className="pill-btn" onClick={() => void onCaptureOcrScreenPreview()} disabled={busy}>
                捕获校准图
              </button>
            </div>
            {ocrScreenPreview ? (
              <div className="mt-2 overflow-auto rounded-lg border border-white/10 bg-black/20 p-2">
                <div
                  className="relative"
                  style={{
                    width: `${ocrScreenPreview.width}px`,
                    height: `${ocrScreenPreview.height}px`,
                  }}
                  onMouseDown={onPreviewMouseDown}
                  onMouseMove={onPreviewMouseMove}
                  onMouseUp={onPreviewMouseUp}
                  onMouseLeave={onPreviewMouseUp}
                >
                  <img
                    src={ocrScreenPreview.dataUrl}
                    alt="ocr-screen-preview"
                    className="absolute left-0 top-0 h-full w-full object-contain"
                  />
                  {(ocrIconCaptureEnabled || ocrCalibrationTarget === "icon") && ocrIconPreviewRows.length > 0
                    ? ocrIconPreviewRows.map((rect) => (
                        <div
                          key={`ocr-icon-preview-row-${rect.index}`}
                          className={`absolute border-2 ${rect.index === 0 ? "border-emerald-300" : "border-emerald-300/60 border-dashed"}`}
                          style={{
                            left: `${rect.left}px`,
                            top: `${rect.top}px`,
                            width: `${rect.width}px`,
                            height: `${rect.height}px`,
                          }}
                        />
                      ))
                    : null}
                  {ocrTradeNamesRect ? (
                    <div
                      className="absolute border-2 border-cyan-300"
                      style={{
                        left: `${ocrTradeNamesRect.x}px`,
                        top: `${ocrTradeNamesRect.y}px`,
                        width: `${ocrTradeNamesRect.width}px`,
                        height: `${ocrTradeNamesRect.height}px`,
                      }}
                    />
                  ) : null}
                  {ocrTradePricesRect ? (
                    <div
                      className="absolute border-2 border-amber-300"
                      style={{
                        left: `${ocrTradePricesRect.x}px`,
                        top: `${ocrTradePricesRect.y}px`,
                        width: `${ocrTradePricesRect.width}px`,
                        height: `${ocrTradePricesRect.height}px`,
                      }}
                    />
                  ) : null}
                  {ocrDragRect ? (
                    <div
                      className="absolute border-2 border-dashed border-fuchsia-300"
                      style={{
                        left: `${ocrDragRect.x}px`,
                        top: `${ocrDragRect.y}px`,
                        width: `${ocrDragRect.width}px`,
                        height: `${ocrDragRect.height}px`,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-4">
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrScreenshotPath}
                onChange={(event) => setOcrScreenshotPath(event.target.value)}
                disabled={busy}
                placeholder="截图路径（绝对路径或项目内相对路径）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrFirstRowTop}
                onChange={(event) => setOcrFirstRowTop(event.target.value)}
                disabled={busy}
                placeholder="首行 Y（如 339）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrRowHeight}
                onChange={(event) => setOcrRowHeight(event.target.value)}
                disabled={busy}
                placeholder="行步距（如 135）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrNameAnchorX}
                onChange={(event) => setOcrNameAnchorX(event.target.value)}
                disabled={busy}
                placeholder="名称锚点 X（如 530）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrIconOffsetX}
                onChange={(event) => setOcrIconOffsetX(event.target.value)}
                disabled={busy}
                placeholder="左偏移（如 -86）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrIconTopOffset}
                onChange={(event) => setOcrIconTopOffset(event.target.value)}
                disabled={busy}
                placeholder="上偏移（如 0）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrIconWidth}
                onChange={(event) => setOcrIconWidth(event.target.value)}
                disabled={busy}
                placeholder="图标宽（如 40）"
              />
              <input
                className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={ocrIconHeight}
                onChange={(event) => setOcrIconHeight(event.target.value)}
                disabled={busy}
                placeholder="图标高（如 40）"
              />
            </div>
        </div>

        {ocrImportResult ? (
          <div className="mt-3 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
              <div className="data-pill">解析行数: {ocrImportResult.parsedLineCount}</div>
              <div className="data-pill">导入成功: {ocrImportResult.importedCount}</div>
              <div className="data-pill">新增物品: {ocrImportResult.createdItemCount}</div>
              <div className="data-pill">图标抓取: {ocrImportResult.iconCapturedCount}</div>
              <div className="data-pill">图标跳过: {ocrImportResult.iconSkippedCount}</div>
              <div className="data-pill">未匹配: {ocrImportResult.unknownItemNames.length}</div>
              <div className="data-pill">异常行: {ocrImportResult.invalidLines.length}</div>
            </div>
            {ocrImportResult.unknownItemNames.length > 0 ? (
              <p className="text-amber-300">未匹配物品: {ocrImportResult.unknownItemNames.join("、")}</p>
            ) : null}
            {ocrImportResult.iconCaptureWarnings.length > 0 ? (
              <div className="max-h-24 overflow-auto rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
                <p className="mb-1 text-amber-300">图标抓取提示:</p>
                {ocrImportResult.iconCaptureWarnings.slice(0, 20).map((line) => (
                  <p key={`ocr-icon-warning-${line}`}>{line}</p>
                ))}
              </div>
            ) : null}
            {ocrImportResult.invalidLines.length > 0 ? (
              <div className="max-h-28 overflow-auto rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
                <p className="mb-1 text-rose-300">异常行（请修正后重试）:</p>
                {ocrImportResult.invalidLines.slice(0, 20).map((line) => (
                  <p key={`ocr-invalid-${line}`}>{line}</p>
                ))}
              </div>
            ) : null}
            {ocrImportResult.importedEntries.length > 0 ? (
              <details className="rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300" open>
                <summary className="cursor-pointer text-[11px] text-cyan-300">查看导入明细（物品/价格）</summary>
                <div className="mt-2 max-h-44 overflow-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-2 py-1">行</th>
                        <th className="px-2 py-1">物品</th>
                        <th className="px-2 py-1">价格</th>
                        <th className="px-2 py-1">市场</th>
                        <th className="px-2 py-1">时间</th>
                        <th className="px-2 py-1">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocrImportResult.importedEntries.map((entry, index) => (
                        <tr key={`ocr-import-entry-${entry.itemId}-${entry.lineNumber}-${index}`} className="border-t border-white/10">
                          <td className="px-2 py-1">{entry.lineNumber}</td>
                          <td className="px-2 py-1">{entry.itemName}</td>
                          <td className="px-2 py-1">{formatGold(entry.unitPrice)}</td>
                          <td className="px-2 py-1">{formatMarketLabel(entry.market)}</td>
                          <td className="px-2 py-1">{formatDateTime(entry.capturedAt)}</td>
                          <td className={`px-2 py-1 ${entry.createdItem ? "text-amber-300" : "text-slate-300"}`}>
                            {entry.createdItem ? "新增物品" : "已存在物品"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </article>

      <article className="order-2 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <h4 className="text-sm font-semibold">1) 市场工作台：行情中心与波动信号</h4>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={historyMainCategory}
            onChange={(event) => setHistoryMainCategory(event.target.value)}
            disabled={busy || historyMainCategoryOptions.length === 0}
          >
            {historyMainCategoryOptions.map((category) => (
              <option key={`history-main-category-${category}`} value={category}>
                大类: {category}
              </option>
            ))}
          </select>
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={historySubCategory}
            onChange={(event) => setHistorySubCategory(event.target.value)}
            disabled={busy}
          >
            <option value="all">下级分类: 全部</option>
            {historySubCategoryOptions.map((category) => (
              <option key={`history-sub-category-${category}`} value={category}>
                下级分类: {category}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={historyKeyword}
            onChange={(event) => setHistoryKeyword(event.target.value)}
            disabled={busy}
            placeholder="搜索物品（可选）"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_auto]">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={historyItemId}
            onChange={(event) => setHistoryItemId(event.target.value)}
            disabled={busy || filteredHistoryItems.length === 0}
          >
            {filteredHistoryItems.map((item) => (
              <option key={`history-item-${item.id}`} value={item.id}>
                [{item.subCategory}] {item.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={historyDaysInput}
            onChange={(event) => setHistoryDaysInput(event.target.value)}
            disabled={busy}
            placeholder="查询天数（如 30）"
          />
          <button className="task-btn px-4" onClick={() => void onLoadPriceHistory()} disabled={busy || !historyItemId}>
            查询历史
          </button>
        </div>
        {filteredHistoryItems.length === 0 ? <p className="mt-2 text-xs text-amber-300">当前筛选下没有可查询物品。</p> : null}

        <div className="mt-2 flex flex-wrap gap-2">
          {HISTORY_QUICK_DAY_OPTIONS.map((days) => {
            const active = activeHistoryQuickDays === days;
            return (
              <button
                key={`history-quick-${days}`}
                className={`pill-btn ${active ? "!border-cyan-300/60 !bg-cyan-300/20 !text-cyan-100" : ""}`}
                onClick={() => {
                  setHistoryDaysInput(String(days));
                  void onLoadPriceHistory(days);
                }}
                disabled={busy || !historyItemId}
              >
                {days} 天
              </button>
            );
          })}
        </div>
        {recentOcrImportedEntries.length > 0 ? (
          <div className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-2 text-xs">
            <p className="text-cyan-200">最近抓价更新（最新 20 条）</p>
            <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-white/10 bg-black/20">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-2 py-1">物品</th>
                    <th className="px-2 py-1">价格</th>
                    <th className="px-2 py-1">时间</th>
                    <th className="px-2 py-1">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOcrImportedEntries.map((entry, index) => (
                    <tr key={`recent-ocr-import-${entry.itemId}-${entry.lineNumber}-${index}`} className="border-t border-white/10">
                      <td className="px-2 py-1">{entry.itemName}</td>
                      <td className="px-2 py-1">{formatGold(entry.unitPrice)}</td>
                      <td className="px-2 py-1">{formatDateTime(entry.capturedAt)}</td>
                      <td className={`px-2 py-1 ${entry.createdItem ? "text-amber-300" : "text-emerald-300"}`}>
                        {entry.createdItem ? "新增物品" : "已更新"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {historyResult ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
              <div className="data-pill">样本数: {historyResult.sampleCount}</div>
              <div className="data-pill">最新价: {formatGold(historyResult.latestPrice)}</div>
              <div className="data-pill">区间均价: {formatGold(historyResult.averagePrice)}</div>
              <div className="data-pill">MA7(最新): {formatGold(historyResult.ma7Latest)}</div>
              <div
                className={`data-pill ${
                  historyInsight?.deviationFromWeekday !== null && historyInsight?.deviationFromWeekday !== undefined
                    ? historyInsight.deviationFromWeekday <= 0
                      ? "text-emerald-300"
                      : "text-rose-300"
                    : ""
                }`}
              >
                周内均价偏离: {toSignedPercent(historyInsight?.deviationFromWeekday ?? null)}
              </div>
              <div className="data-pill">
                最新时间: {historyResult.latestCapturedAt ? new Date(historyResult.latestCapturedAt).toLocaleString() : "--"}
              </div>
            </div>

            {historyChartModel ? (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/25 p-3">
                <svg viewBox={`0 0 ${historyChartModel.width} ${historyChartModel.height}`} className="h-[280px] w-full min-w-[760px]">
                  {historyChartModel.yTicks.map((tick) => (
                    <g key={`history-y-${tick.y}`}>
                      <line
                        x1={historyChartModel.left}
                        y1={tick.y}
                        x2={historyChartModel.width - historyChartModel.right}
                        y2={tick.y}
                        stroke="rgba(148,163,184,0.2)"
                        strokeWidth="1"
                      />
                      <text x={historyChartModel.left - 8} y={tick.y + 4} textAnchor="end" fill="#cbd5e1" fontSize="11">
                        {formatGold(tick.value)}
                      </text>
                    </g>
                  ))}

                  {historyChartModel.wednesdayMarkers.map((marker) => (
                    <line
                      key={`history-wed-${marker.date}`}
                      x1={marker.x}
                      y1={historyChartModel.top}
                      x2={marker.x}
                      y2={historyChartModel.height - historyChartModel.bottom}
                      stroke="rgba(251,191,36,0.4)"
                      strokeDasharray="5 5"
                      strokeWidth="1"
                    />
                  ))}

                  <line
                    x1={historyChartModel.left}
                    y1={historyChartModel.height - historyChartModel.bottom}
                    x2={historyChartModel.width - historyChartModel.right}
                    y2={historyChartModel.height - historyChartModel.bottom}
                    stroke="rgba(148,163,184,0.55)"
                    strokeWidth="1.1"
                  />

                  {historyChartModel.pricePath ? (
                    <path d={historyChartModel.pricePath} fill="none" stroke="#22d3ee" strokeWidth="2.4" />
                  ) : null}
                  {historyChartModel.ma7Path ? (
                    <path d={historyChartModel.ma7Path} fill="none" stroke="#fbbf24" strokeWidth="2.1" />
                  ) : null}

                  {historyChartModel.latestPoint ? (
                    <circle
                      cx={historyChartModel.latestPoint.x}
                      cy={historyChartModel.latestPoint.y}
                      r="4.2"
                      fill="#22d3ee"
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth="1.2"
                    />
                  ) : null}

                  {historyChartModel.xTicks.map((tick) => (
                    <text
                      key={`history-x-${tick.x}`}
                      x={tick.x}
                      y={historyChartModel.height - 8}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="11"
                    >
                      {tick.label}
                    </text>
                  ))}
                </svg>

                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-300">
                  <span>青线: 实际价格</span>
                  <span>黄线: MA7</span>
                  <span>黄虚线: 周三重置日</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-300">当前区间没有价格样本，无法绘制曲线。</p>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-7">
              {historyResult.weekdayAverages.map((entry) => (
                <div key={`weekday-avg-${entry.weekday}`} className="data-pill">
                  {weekdayLabel(entry.weekday)}: {formatGold(entry.averagePrice)} ({entry.sampleCount})
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
              <p className="text-slate-200">Phase 2.3 周期性波动提示（按星期）</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto_auto]">
                <select
                  className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={signalRuleEnabled ? "on" : "off"}
                  onChange={(event) => setSignalRuleEnabled(event.target.value === "on")}
                  disabled={busy}
                >
                  <option value="on">规则开启</option>
                  <option value="off">规则关闭</option>
                </select>
                <input
                  className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={signalLookbackDaysInput}
                  onChange={(event) => setSignalLookbackDaysInput(event.target.value)}
                  disabled={busy}
                  placeholder="回看天数（如 30）"
                />
                <input
                  className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={signalThresholdPercentInput}
                  onChange={(event) => setSignalThresholdPercentInput(event.target.value)}
                  disabled={busy}
                  placeholder="触发阈值%（如 8）"
                />
                <button className="task-btn px-4" onClick={() => void onSaveSignalRule()} disabled={busy}>
                  保存规则
                </button>
                <button className="pill-btn" onClick={() => void onRefreshSignals()} disabled={busy}>
                  刷新信号
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
                <div className="data-pill">规则状态: {signalResult?.ruleEnabled ? "开启" : "关闭"}</div>
                <div className="data-pill">分析天数: {signalResult?.lookbackDays ?? "--"}</div>
                <div className="data-pill">阈值: {toPercent(signalResult ? signalResult.thresholdRatio : null)}</div>
                <div className="data-pill">触发数: {signalResult?.triggeredCount ?? 0}</div>
                <div className="data-pill text-emerald-300">进货点: {signalResult?.buyZoneCount ?? 0}</div>
                <div className="data-pill text-amber-300">出货点: {signalResult?.sellZoneCount ?? 0}</div>
              </div>

              {signalResult ? (
                triggeredSignalRows.length > 0 ? (
                  <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/30 p-2">
                    {triggeredSignalRows.slice(0, 20).map((row) => (
                      <div key={`signal-${row.itemId}`} className="mb-2 rounded-lg border border-emerald-200/30 bg-emerald-500/10 p-2">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                          <div className="data-pill">物品: {row.itemName}</div>
                          <div className="data-pill text-emerald-300">{trendTagLabel(row.trendTag)}</div>
                          <div className="data-pill">最新价: {formatGold(row.latestPrice)}</div>
                          <div className="data-pill">
                            {row.latestWeekday === null ? "同星期均价: --" : `同星期均价(${weekdayLabel(row.latestWeekday)}): ${formatGold(row.weekdayAveragePrice)}`}
                          </div>
                          <div className="data-pill">MA7: {formatGold(row.ma7Price)}</div>
                          <div className="data-pill text-emerald-300">
                            星期偏离: {toSignedPercent(row.deviationRatioFromWeekdayAverage)}
                          </div>
                          <div className="data-pill text-cyan-300">
                            MA7偏离: {toSignedPercent(row.deviationRatioFromMa7)}
                          </div>
                        </div>
                        <p className="mt-2 text-slate-300">
                          最新采样: {row.latestCapturedAt ? new Date(row.latestCapturedAt).toLocaleString() : "--"}，样本数:{" "}
                          {row.sampleCount}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-slate-300">
                    {signalResult.ruleEnabled ? "当前没有达到阈值的周期波动提示。" : "规则当前已关闭，已暂停触发提示。"}
                  </p>
                )
              ) : (
                <p className="mt-2 text-slate-300">尚未生成信号结果。</p>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
              <p className="text-slate-200">Phase 4 趋势建议（进货点 / 出货点）</p>
              {signalResult ? (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 p-2">
                    <p className="text-emerald-200">进货点（低于同星期均价）</p>
                    {buyZoneRows.length > 0 ? (
                      <div className="mt-2 max-h-56 overflow-auto space-y-2">
                        {buyZoneRows.slice(0, 16).map((row) => (
                          <div key={`buy-zone-${row.itemId}`} className="rounded-lg border border-emerald-200/20 bg-black/25 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>{row.itemName}</span>
                              <span>{formatGold(row.latestPrice)}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-300">
                              <span>星期偏离 {toSignedPercent(row.deviationRatioFromWeekdayAverage)}</span>
                              <span>MA7偏离 {toSignedPercent(row.deviationRatioFromMa7)}</span>
                              <span>样本 {row.sampleCount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-slate-300">当前没有满足进货点条件的物品。</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 p-2">
                    <p className="text-amber-200">出货点（高于同星期均价）</p>
                    {sellZoneRows.length > 0 ? (
                      <div className="mt-2 max-h-56 overflow-auto space-y-2">
                        {sellZoneRows.slice(0, 16).map((row) => (
                          <div key={`sell-zone-${row.itemId}`} className="rounded-lg border border-amber-200/20 bg-black/25 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>{row.itemName}</span>
                              <span>{formatGold(row.latestPrice)}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-300">
                              <span>星期偏离 {toSignedPercent(row.deviationRatioFromWeekdayAverage)}</span>
                              <span>MA7偏离 {toSignedPercent(row.deviationRatioFromMa7)}</span>
                              <span>样本 {row.sampleCount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-slate-300">当前没有满足出货点条件的物品。</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-slate-300">尚未生成趋势建议，请先刷新信号。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-300">还没有查询结果。先选物品和天数后点击“查询历史”。</p>
        )}
      </article>

      <article className="order-3 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">2) 制作模拟器（单配方）+ 机会分析</h4>
          {simulation ? (
            <button className="pill-btn" onClick={() => void onApplySimulationMaterialEdits()} disabled={busy}>
              保存单价/库存并重算
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateMainCategory}
            onChange={(event) => setSimulateMainCategory(event.target.value)}
            disabled={busy || simulationMainCategoryOptions.length === 0}
          >
            {simulationMainCategoryOptions.map((category) => (
              <option key={`sim-main-category-${category}`} value={category}>
                大类: {category}
              </option>
            ))}
          </select>
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateSubCategory}
            onChange={(event) => setSimulateSubCategory(event.target.value)}
            disabled={busy}
          >
            <option value="all">下级分类: 全部</option>
            {simulationSubCategoryOptions.map((category) => (
              <option key={`sim-sub-category-${category}`} value={category}>
                下级分类: {category}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_auto]">
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateRecipeId}
            onChange={(event) => setSimulateRecipeId(event.target.value)}
            disabled={busy || filteredSimulationRecipes.length === 0}
          >
            {filteredSimulationRecipes.map((recipe) => (
              <option key={`sim-recipe-${recipe.id}`} value={recipe.id}>
                [{recipe.subCategory}] {recipe.outputName}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={simulateRuns}
            onChange={(event) => setSimulateRuns(event.target.value)}
            disabled={busy}
            placeholder="制作次数"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={taxMode}
            onChange={(event) => setTaxMode(event.target.value as "0.1" | "0.2")}
            disabled={busy}
          >
            <option value="0.1">服务器拍卖行税 10%</option>
            <option value="0.2">世界交易行税 20%</option>
          </select>
          <button className="task-btn px-4" onClick={() => void onSimulate()} disabled={busy || !simulateRecipeId}>
            运行模拟
          </button>
        </div>
        {filteredSimulationRecipes.length === 0 ? (
          <p className="mt-2 text-xs text-amber-300">当前分类下没有可模拟的配方。</p>
        ) : null}

        {simulation ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="data-pill">产物: {simulation.outputItemName}</div>
              <div className="data-pill">总产量: {simulation.totalOutputQuantity}</div>
              <div className="data-pill">材料成本: {formatGold(simulation.requiredMaterialCost)}</div>
              <div className="data-pill">净利润: {formatGold(simulation.estimatedProfit)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="data-pill">税后收入: {formatGold(simulation.netRevenueAfterTax)}</div>
              <div className="data-pill">利润率: {toPercent(simulation.estimatedProfitRate)}</div>
              <div className="data-pill">缺口补齐成本: {formatGold(simulation.missingPurchaseCost)}</div>
              <div className="data-pill">{simulation.craftableNow ? "库存可直接制作" : "库存不足，需补材料"}</div>
            </div>
            {simulation.unknownPriceItemIds.length > 0 ? (
              <p className="mt-2 text-amber-300">
                以下材料缺少价格，利润结果不完整:
                {simulation.unknownPriceItemIds
                  .map((itemId) => itemById.get(itemId)?.name ?? itemId)
                  .join("、")}
              </p>
            ) : null}
            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-2 py-1">材料</th>
                    <th className="px-2 py-1">需求</th>
                    <th className="px-2 py-1">库存(可改)</th>
                    <th className="px-2 py-1">缺口</th>
                    <th className="px-2 py-1">单价(可改)</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.materialRows.map((row) => (
                    <tr key={`sim-material-${row.itemId}`} className="border-t border-white/10">
                      <td className="px-2 py-1">{row.itemName}</td>
                      <td className="px-2 py-1">{row.required}</td>
                      <td className="px-2 py-1">
                        <input
                          className="w-24 rounded border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                          value={simulationMaterialDraft[row.itemId]?.owned ?? String(row.owned)}
                          onChange={(event) =>
                            setSimulationMaterialDraft((prev) => ({
                              ...prev,
                              [row.itemId]: {
                                unitPrice: prev[row.itemId]?.unitPrice ?? (row.latestUnitPrice === null ? "" : String(row.latestUnitPrice)),
                                owned: event.target.value,
                              },
                            }))
                          }
                          disabled={busy}
                        />
                      </td>
                      <td className={`px-2 py-1 ${row.missing > 0 ? "text-rose-300" : "text-emerald-300"}`}>{row.missing}</td>
                      <td className="px-2 py-1">
                        <input
                          className="w-28 rounded border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                          value={simulationMaterialDraft[row.itemId]?.unitPrice ?? (row.latestUnitPrice === null ? "" : String(row.latestUnitPrice))}
                          onChange={(event) =>
                            setSimulationMaterialDraft((prev) => ({
                              ...prev,
                              [row.itemId]: {
                                unitPrice: event.target.value,
                                owned: prev[row.itemId]?.owned ?? String(row.owned),
                              },
                            }))
                          }
                          disabled={busy}
                          placeholder="留空=不改"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </article>

      <article className="order-4 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">3) 背包与补差工作台（库存驱动）</h4>
          <button className="pill-btn" onClick={() => void loadCraftOptions()} disabled={busy}>
            刷新建议
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <h5 className="text-xs font-semibold text-slate-200">3.1 价格/库存修正（全局）</h5>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemMainCategory}
              onChange={(event) => setItemMainCategory(event.target.value)}
              disabled={busy || itemMainCategoryOptions.length === 0}
            >
              {itemMainCategoryOptions.map((category) => (
                <option key={`item-main-category-${category}`} value={category}>
                  大类: {category}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={itemSubCategory}
              onChange={(event) => setItemSubCategory(event.target.value)}
              disabled={busy}
            >
              <option value="all">下级分类: 全部</option>
              {itemSubCategoryOptions.map((category) => (
                <option key={`item-sub-category-${category}`} value={category}>
                  下级分类: {category}
                </option>
              ))}
            </select>
            <select
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
              disabled={busy || filteredItems.length === 0}
            >
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.subCategory}] {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="最新单价"
              value={selectedItemPrice}
              onChange={(event) => setSelectedItemPrice(event.target.value)}
              disabled={busy || !selectedItemId}
            />
            <input
              className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="库存数量"
              value={selectedItemInventory}
              onChange={(event) => setSelectedItemInventory(event.target.value)}
              disabled={busy || !selectedItemId}
            />
            <div className="flex gap-2">
              <button className="task-btn px-3" onClick={onSaveSelectedPrice} disabled={busy || !selectedItemId}>
                记价格
              </button>
              <button className="task-btn px-3" onClick={onSaveSelectedInventory} disabled={busy || !selectedItemId}>
                记库存
              </button>
            </div>
          </div>
          {selectedItemId ? (
            <p className="mt-2 text-xs text-slate-300">
              当前值: 单价 {formatGold(latestPriceByItemId.get(selectedItemId) ?? null)} / 库存 {inventoryByItemId.get(selectedItemId) ?? 0} / 最新时间{" "}
              {formatDateTime(latestPriceMetaByItemId.get(selectedItemId)?.capturedAt ?? null)}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-300">当前分类下没有物品。</p>
          )}
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/30">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-2 py-1">物品</th>
                  <th className="px-2 py-1">分类</th>
                  <th className="px-2 py-1">最新价格</th>
                  <th className="px-2 py-1">最新时间</th>
                  <th className="px-2 py-1">库存</th>
                  <th className="px-2 py-1">修正</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="px-2 py-1">{item.name}</td>
                    <td className="px-2 py-1">{`${item.mainCategory} / ${item.subCategory}`}</td>
                    <td className="px-2 py-1">{formatGold(latestPriceByItemId.get(item.id) ?? null)}</td>
                    <td className="px-2 py-1">{formatDateTime(latestPriceMetaByItemId.get(item.id)?.capturedAt ?? null)}</td>
                    <td className="px-2 py-1">{inventoryByItemId.get(item.id) ?? 0}</td>
                    <td className="px-2 py-1">
                      <button className="pill-btn" onClick={() => onPickItemForCorrection(item.id)} disabled={busy}>
                        选择
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h5 className="mt-4 text-xs font-semibold text-slate-200">3.2 背包逆向推导（可制作什么）</h5>
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 text-xs">
          {craftOptions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">暂无可分析配方。</p>
          ) : (
            craftOptions.slice(0, 30).map((option) => (
              <div key={`option-${option.recipeId}`} className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="data-pill">成品: {option.outputItemName}</div>
                  <div className="data-pill">可做次数: {option.craftableCount}</div>
                  <div className="data-pill">单次成本: {formatGold(option.requiredMaterialCostPerRun)}</div>
                  <div
                    className={`data-pill ${
                      option.estimatedProfitPerRun !== null && option.estimatedProfitPerRun >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    单次利润: {formatGold(option.estimatedProfitPerRun)}
                  </div>
                </div>
                {option.missingRowsForOneRun.length > 0 ? (
                  <p className="mt-2 text-slate-300">
                    缺口:
                    {option.missingRowsForOneRun.map((row) => `${row.itemName}(${row.missing})`).join("、")}
                  </p>
                ) : (
                  <p className="mt-2 text-emerald-300">当前库存已满足单次制作。</p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4">
          <h5 className="text-xs font-semibold text-slate-200">3.3 差一点可做（补差预算）</h5>
        <p className="mt-2 text-xs text-slate-300">输入可补差预算，系统会推算“补一点材料即可开做”的目标与预算内潜在利润。</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
          <input
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={nearCraftBudgetInput}
            onChange={(event) => setNearCraftBudgetInput(event.target.value)}
            disabled={busy}
            placeholder="补差预算（金币）"
          />
          <select
            className="min-w-0 rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
            value={nearCraftSortMode}
            onChange={(event) => setNearCraftSortMode(event.target.value as "max_budget_profit" | "min_gap_cost")}
            disabled={busy}
          >
            <option value="max_budget_profit">排序: 最高预算利润优先</option>
            <option value="min_gap_cost">排序: 最低补差成本优先</option>
          </select>
          <button className="task-btn px-4" onClick={() => void loadCraftOptions()} disabled={busy}>
            按预算刷新
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-300">当前预算: {formatGold(nearCraftBudget)} 金币，计算基于“{taxMode === "0.1" ? "服务器拍卖行税 10%" : "世界交易行税 20%"}”。</p>
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 text-xs">
          {nearCraftSuggestions.length === 0 ? (
            <p className="px-2 py-2 text-slate-300">在当前预算下，没有可补差开做的目标，或关键材料缺少价格。</p>
          ) : (
            nearCraftSuggestions.slice(0, 30).map((entry) => (
              <div key={`near-${entry.recipeId}`} className="mb-2 rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  <div className="data-pill">成品: {entry.outputItemName}</div>
                  <div className="data-pill">单次补差: {formatGold(entry.missingPurchaseCostPerRun)}</div>
                  <div className="data-pill">预算内可补差次数: {entry.affordableRuns}</div>
                  <div className="data-pill">单次利润: {formatGold(entry.estimatedProfitPerRun)}</div>
                  <div
                    className={`data-pill ${
                      entry.estimatedBudgetProfit !== null && entry.estimatedBudgetProfit >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    预算内潜在利润: {formatGold(entry.estimatedBudgetProfit)}
                  </div>
                </div>
                {entry.unknownPriceRows.length > 0 ? (
                  <p className="mt-2 text-amber-300">
                    缺价格材料:
                    {entry.unknownPriceRows.map((row) => `${row.itemName}`).join("、")}
                  </p>
                ) : (
                  <p className="mt-2 text-slate-300">
                    主要缺口:
                    {entry.missingRows.map((row) => `${row.itemName}(${row.missing})`).join("、")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
        </div>
      </article>
    </div>
  );
}
