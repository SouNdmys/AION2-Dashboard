import type { MouseEvent as ReactMouseEvent } from "react";
import type { WorkshopScreenPreviewResult } from "../../../../shared/types";
import { type OcrTradePresetKey } from "./workshop-persistence";
import { toInt } from "./workshop-view-helpers";

interface TradeBoardPresetParseInput {
  ocrTradeRowCount: string;
  ocrTradeNamesX: string;
  ocrTradeNamesY: string;
  ocrTradeNamesWidth: string;
  ocrTradeNamesHeight: string;
  ocrTradePricesX: string;
  ocrTradePricesY: string;
  ocrTradePricesWidth: string;
  ocrTradePricesHeight: string;
  ocrTradePriceMode: "single" | "dual";
  ocrTradePriceColumn: "left" | "right";
  ocrTradeLeftPriceRole: "server" | "world";
  ocrTradeRightPriceRole: "server" | "world";
}

export function parseTradeBoardPresetOrError(input: TradeBoardPresetParseInput): {
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
  const rowCount = toInt(input.ocrTradeRowCount);
  const namesX = toInt(input.ocrTradeNamesX);
  const namesY = toInt(input.ocrTradeNamesY);
  const namesWidth = toInt(input.ocrTradeNamesWidth);
  const namesHeight = toInt(input.ocrTradeNamesHeight);
  const pricesX = toInt(input.ocrTradePricesX);
  const pricesY = toInt(input.ocrTradePricesY);
  const pricesWidth = toInt(input.ocrTradePricesWidth);
  const pricesHeight = toInt(input.ocrTradePricesHeight);
  if (
    rowCount === null ||
    rowCount < 0 ||
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
  if (rowCount > 30) {
    return { preset: null, error: "交易行可见行数需为 0~30 的整数（0=自动识别）。" };
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
      priceMode: input.ocrTradePriceMode,
      priceColumn: input.ocrTradePriceColumn,
      leftPriceRole: input.ocrTradeLeftPriceRole,
      rightPriceRole: input.ocrTradeRightPriceRole,
    },
    error: null,
  };
}

export function parseScreenCaptureOptionsOrError(input: {
  ocrCaptureDelayMs: string;
  ocrHideAppBeforeCapture: boolean;
}): {
  options: { delayMs: number; hideAppBeforeCapture: boolean } | null;
  error: string | null;
} {
  const delayMs = toInt(input.ocrCaptureDelayMs);
  if (delayMs === null || delayMs < 0) {
    return { options: null, error: "截屏延迟必须是 >=0 的整数毫秒。" };
  }
  return {
    options: {
      delayMs,
      hideAppBeforeCapture: input.ocrHideAppBeforeCapture,
    },
    error: null,
  };
}

export function parseAutoRunIntervalSecondsOrError(raw: string): { intervalSeconds: number | null; error: string | null } {
  const intervalSeconds = toInt(raw);
  if (intervalSeconds === null || intervalSeconds < 2 || intervalSeconds > 120) {
    return {
      intervalSeconds: null,
      error: "自动抓价间隔需为 2~120 秒的整数。",
    };
  }
  return {
    intervalSeconds,
    error: null,
  };
}

export function parseAutoRunFailLimitOrError(raw: string): { failLimit: number | null; error: string | null } {
  const failLimit = toInt(raw);
  if (failLimit === null || failLimit < 1 || failLimit > 10) {
    return {
      failLimit: null,
      error: "连续失败暂停阈值需为 1~10 的整数。",
    };
  }
  return {
    failLimit,
    error: null,
  };
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CreateWorkshopOcrPreviewHandlersParams {
  ocrTradePresetKey: OcrTradePresetKey;
  ocrCalibrationTarget: "names" | "prices";
  ocrTradeNamesRect: Rect | null;
  ocrTradePricesRect: Rect | null;
  ocrDragMode: "draw" | "move" | null;
  ocrDragOffset: { x: number; y: number } | null;
  ocrDragStart: { x: number; y: number } | null;
  ocrDragRect: Rect | null;
  ocrScreenPreview: WorkshopScreenPreviewResult | null;
  setOcrTradePresetKey: (key: OcrTradePresetKey) => void;
  setOcrTradeNamesRectInputs: (rect: Rect) => void;
  setOcrTradePricesRectInputs: (rect: Rect) => void;
  setOcrDragMode: (mode: "draw" | "move" | null) => void;
  setOcrDragOffset: (offset: { x: number; y: number } | null) => void;
  setOcrDragStart: (point: { x: number; y: number } | null) => void;
  setOcrDragRect: (rect: Rect | null) => void;
}

export function createWorkshopOcrPreviewHandlers(params: CreateWorkshopOcrPreviewHandlersParams): {
  onPreviewMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onPreviewMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onPreviewMouseUp: () => void;
} {
  const {
    ocrTradePresetKey,
    ocrCalibrationTarget,
    ocrTradeNamesRect,
    ocrTradePricesRect,
    ocrDragMode,
    ocrDragOffset,
    ocrDragStart,
    ocrDragRect,
    ocrScreenPreview,
    setOcrTradePresetKey,
    setOcrTradeNamesRectInputs,
    setOcrTradePricesRectInputs,
    setOcrDragMode,
    setOcrDragOffset,
    setOcrDragStart,
    setOcrDragRect,
  } = params;

  const applyCalibrationRectToTarget = (rect: Rect): void => {
    if (ocrTradePresetKey !== "custom") {
      setOcrTradePresetKey("custom");
    }
    if (ocrCalibrationTarget === "names") {
      setOcrTradeNamesRectInputs(rect);
      return;
    }
    setOcrTradePricesRectInputs(rect);
  };

  const pointInPreview = (event: ReactMouseEvent<HTMLDivElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.floor(event.clientX - rect.left)),
      y: Math.max(0, Math.floor(event.clientY - rect.top)),
    };
  };

  const pointInRect = (point: { x: number; y: number }, rect: Rect): boolean =>
    point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;

  const onPreviewMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const point = pointInPreview(event);
    const targetRect = ocrCalibrationTarget === "names" ? ocrTradeNamesRect : ocrTradePricesRect;
    if (targetRect && pointInRect(point, targetRect)) {
      setOcrDragMode("move");
      setOcrDragOffset({
        x: point.x - targetRect.x,
        y: point.y - targetRect.y,
      });
      setOcrDragRect({
        x: targetRect.x,
        y: targetRect.y,
        width: targetRect.width,
        height: targetRect.height,
      });
      return;
    }
    setOcrDragMode("draw");
    setOcrDragOffset(null);
    setOcrDragStart(point);
    setOcrDragRect({ x: point.x, y: point.y, width: 1, height: 1 });
  };

  const onPreviewMouseMove = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!ocrDragMode) {
      return;
    }
    const point = pointInPreview(event);
    if (ocrDragMode === "move") {
      const baseRect = ocrDragRect ?? (ocrCalibrationTarget === "names" ? ocrTradeNamesRect : ocrTradePricesRect);
      if (!baseRect || !ocrDragOffset || !ocrScreenPreview) {
        return;
      }
      const maxX = Math.max(0, ocrScreenPreview.width - baseRect.width);
      const maxY = Math.max(0, ocrScreenPreview.height - baseRect.height);
      const nextX = Math.max(0, Math.min(maxX, point.x - ocrDragOffset.x));
      const nextY = Math.max(0, Math.min(maxY, point.y - ocrDragOffset.y));
      setOcrDragRect({
        x: Math.floor(nextX),
        y: Math.floor(nextY),
        width: baseRect.width,
        height: baseRect.height,
      });
      return;
    }
    if (!ocrDragStart) {
      return;
    }
    const left = Math.min(ocrDragStart.x, point.x);
    const top = Math.min(ocrDragStart.y, point.y);
    const width = Math.max(1, Math.abs(point.x - ocrDragStart.x));
    const height = Math.max(1, Math.abs(point.y - ocrDragStart.y));
    setOcrDragRect({ x: left, y: top, width, height });
  };

  const onPreviewMouseUp = (): void => {
    if (ocrDragRect) {
      applyCalibrationRectToTarget(ocrDragRect);
    }
    setOcrDragStart(null);
    setOcrDragMode(null);
    setOcrDragOffset(null);
    setOcrDragRect(null);
  };

  return { onPreviewMouseDown, onPreviewMouseMove, onPreviewMouseUp };
}
