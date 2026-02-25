import type { WorkshopOcrExtractTextResult, WorkshopRect } from "../../shared/types";
import type { OcrTsvWord, PaddleOcrOutcome } from "./ocr-paddle-payload";

type TradePriceRole = "server" | "world";
type TradeRows = NonNullable<WorkshopOcrExtractTextResult["tradeRows"]>;

interface ResolveDualPriceRolesInput {
  imagePath: string;
  pricesRect: WorkshopRect;
  headerLanguage: string;
  safeMode: boolean;
  fallbackLeftRole: TradePriceRole;
  fallbackRightRole: TradePriceRole;
  warnings: string[];
}

interface ResolveDualPriceRolesDeps {
  clamp: (value: number, min: number, max: number) => number;
  cropImageToTempFile: (imagePath: string, rect: WorkshopRect, scale?: number) => string;
  cleanupTempFile: (filePath: string | null) => void;
  runPaddleExtract: (imagePath: string, language: string, safeMode?: boolean) => Promise<PaddleOcrOutcome>;
  detectTradePriceRoleByHeaderText: (rawText: string) => TradePriceRole | null;
}

interface BuildTradeRowsInput {
  effectiveRowCount: number;
  nameRows: Array<string | null>;
  leftValues: Array<number | null>;
  rightValues: Array<number | null>;
  effectiveLeftRole: TradePriceRole;
  effectiveRightRole: TradePriceRole;
}

interface BuildPrimaryTextLinesInput {
  tradeRows: TradeRows;
  priceColumn: "left" | "right";
  effectiveLeftRole: TradePriceRole;
  effectiveRightRole: TradePriceRole;
}

interface BuildRawTextInput {
  namesRawText: string;
  rawPriceSection: string;
  namesWords: OcrTsvWord[];
  rawPriceTsvSection: string;
  stringifyOcrWords: (words: OcrTsvWord[]) => string;
}

export async function resolveDualPriceRolesByHeader(
  input: ResolveDualPriceRolesInput,
  deps: ResolveDualPriceRolesDeps,
): Promise<{ leftRole: TradePriceRole; rightRole: TradePriceRole }> {
  const headerHeight = deps.clamp(Math.floor(input.pricesRect.height * 0.16), 40, 180);
  const leftWidth = Math.max(1, Math.floor(input.pricesRect.width / 2));
  const rightWidth = Math.max(1, input.pricesRect.width - leftWidth);
  const leftRect: WorkshopRect = {
    x: input.pricesRect.x,
    y: input.pricesRect.y,
    width: leftWidth,
    height: headerHeight,
  };
  const rightRect: WorkshopRect = {
    x: input.pricesRect.x + leftWidth,
    y: input.pricesRect.y,
    width: rightWidth,
    height: headerHeight,
  };

  const readHeaderText = async (rect: WorkshopRect, label: "左列" | "右列"): Promise<string> => {
    let tempPath: string | null = null;
    try {
      tempPath = deps.cropImageToTempFile(input.imagePath, rect, 2);
      const extract = await deps.runPaddleExtract(tempPath, input.headerLanguage, input.safeMode);
      if (!extract.ok) {
        input.warnings.push(`${label}表头识别失败：${extract.errorMessage ?? "未知错误"}`);
        return "";
      }
      return extract.rawText;
    } catch (err) {
      input.warnings.push(`${label}表头识别失败：${err instanceof Error ? err.message : "未知异常"}`);
      return "";
    } finally {
      deps.cleanupTempFile(tempPath);
    }
  };

  const [leftHeaderText, rightHeaderText] = await Promise.all([
    readHeaderText(leftRect, "左列"),
    readHeaderText(rightRect, "右列"),
  ]);
  const leftDetected = deps.detectTradePriceRoleByHeaderText(leftHeaderText);
  const rightDetected = deps.detectTradePriceRoleByHeaderText(rightHeaderText);

  if (leftDetected && rightDetected && leftDetected !== rightDetected) {
    return {
      leftRole: leftDetected,
      rightRole: rightDetected,
    };
  }
  if (leftDetected && !rightDetected) {
    return {
      leftRole: leftDetected,
      rightRole: leftDetected === "server" ? "world" : "server",
    };
  }
  if (!leftDetected && rightDetected) {
    return {
      leftRole: rightDetected === "server" ? "world" : "server",
      rightRole: rightDetected,
    };
  }
  input.warnings.push("价格表头自动识别失败，已回退到手动列角色预设。");
  return {
    leftRole: input.fallbackLeftRole,
    rightRole: input.fallbackRightRole,
  };
}

export function buildTradeRows(input: BuildTradeRowsInput): TradeRows {
  const tradeRows: TradeRows = [];
  for (let index = 0; index < input.effectiveRowCount; index += 1) {
    const itemName = input.nameRows[index];
    if (!itemName) {
      continue;
    }
    const leftPrice = input.leftValues[index] ?? null;
    const rightPrice = input.rightValues[index] ?? null;
    const serverPrice =
      input.effectiveLeftRole === "server"
        ? leftPrice
        : input.effectiveRightRole === "server"
          ? rightPrice
          : null;
    const worldPrice =
      input.effectiveLeftRole === "world"
        ? leftPrice
        : input.effectiveRightRole === "world"
          ? rightPrice
          : null;
    if (serverPrice === null && worldPrice === null) {
      continue;
    }
    tradeRows.push({
      lineNumber: index + 1,
      itemName,
      serverPrice,
      worldPrice,
    });
  }
  return tradeRows;
}

export function buildTradeBoardPrimaryTextLines(input: BuildPrimaryTextLinesInput): string[] {
  return input.tradeRows
    .map((row) => {
      const primary =
        input.priceColumn === "right"
          ? input.effectiveRightRole === "server"
            ? row.serverPrice ?? row.worldPrice
            : row.worldPrice ?? row.serverPrice
          : input.effectiveLeftRole === "server"
            ? row.serverPrice ?? row.worldPrice
            : row.worldPrice ?? row.serverPrice;
      if (primary === null) {
        return null;
      }
      return `${row.itemName} ${primary}`;
    })
    .filter((entry): entry is string => entry !== null);
}

export function buildTradeBoardRawText(input: BuildRawTextInput): string {
  return `${input.namesRawText}\n\n---PRICE---\n\n${input.rawPriceSection}\n\n---NAMES_WORDS---\n\n${input.stringifyOcrWords(
    input.namesWords,
  )}\n\n---PRICES_WORDS---\n\n${input.rawPriceTsvSection}`;
}
