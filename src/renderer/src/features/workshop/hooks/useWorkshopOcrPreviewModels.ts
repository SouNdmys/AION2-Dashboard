import { useMemo } from "react";
import { createWorkshopOcrPreviewHandlers } from "../workshop-ocr-handlers";
import type { OcrTradePresetKey } from "../workshop-persistence";
import { toInt } from "../workshop-view-helpers";
import type { WorkshopScreenPreviewResult } from "../../../../../shared/types";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseWorkshopOcrPreviewModelsParams {
  ocrTradePresetKey: OcrTradePresetKey;
  ocrCalibrationTarget: "names" | "prices";
  ocrTradeNamesX: string;
  ocrTradeNamesY: string;
  ocrTradeNamesWidth: string;
  ocrTradeNamesHeight: string;
  ocrTradePricesX: string;
  ocrTradePricesY: string;
  ocrTradePricesWidth: string;
  ocrTradePricesHeight: string;
  ocrDragMode: "draw" | "move" | null;
  ocrDragOffset: { x: number; y: number } | null;
  ocrDragStart: { x: number; y: number } | null;
  ocrDragRect: Rect | null;
  ocrScreenPreview: WorkshopScreenPreviewResult | null;
  setOcrTradePresetKey: (value: OcrTradePresetKey) => void;
  setOcrTradeNamesX: (value: string) => void;
  setOcrTradeNamesY: (value: string) => void;
  setOcrTradeNamesWidth: (value: string) => void;
  setOcrTradeNamesHeight: (value: string) => void;
  setOcrTradePricesX: (value: string) => void;
  setOcrTradePricesY: (value: string) => void;
  setOcrTradePricesWidth: (value: string) => void;
  setOcrTradePricesHeight: (value: string) => void;
  setOcrDragMode: (value: "draw" | "move" | null) => void;
  setOcrDragOffset: (value: { x: number; y: number } | null) => void;
  setOcrDragStart: (value: { x: number; y: number } | null) => void;
  setOcrDragRect: (value: Rect | null) => void;
}

interface WorkshopOcrPreviewModels {
  ocrTradeNamesRect: Rect | null;
  ocrTradePricesRect: Rect | null;
  onPreviewMouseDown: ReturnType<typeof createWorkshopOcrPreviewHandlers>["onPreviewMouseDown"];
  onPreviewMouseMove: ReturnType<typeof createWorkshopOcrPreviewHandlers>["onPreviewMouseMove"];
  onPreviewMouseUp: ReturnType<typeof createWorkshopOcrPreviewHandlers>["onPreviewMouseUp"];
}

export function useWorkshopOcrPreviewModels(params: UseWorkshopOcrPreviewModelsParams): WorkshopOcrPreviewModels {
  const {
    ocrTradePresetKey,
    ocrCalibrationTarget,
    ocrTradeNamesX,
    ocrTradeNamesY,
    ocrTradeNamesWidth,
    ocrTradeNamesHeight,
    ocrTradePricesX,
    ocrTradePricesY,
    ocrTradePricesWidth,
    ocrTradePricesHeight,
    ocrDragMode,
    ocrDragOffset,
    ocrDragStart,
    ocrDragRect,
    ocrScreenPreview,
    setOcrTradePresetKey,
    setOcrTradeNamesX,
    setOcrTradeNamesY,
    setOcrTradeNamesWidth,
    setOcrTradeNamesHeight,
    setOcrTradePricesX,
    setOcrTradePricesY,
    setOcrTradePricesWidth,
    setOcrTradePricesHeight,
    setOcrDragMode,
    setOcrDragOffset,
    setOcrDragStart,
    setOcrDragRect,
  } = params;

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

  const { onPreviewMouseDown, onPreviewMouseMove, onPreviewMouseUp } = createWorkshopOcrPreviewHandlers({
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
    setOcrTradeNamesRectInputs: (rect) => {
      setOcrTradeNamesX(String(rect.x));
      setOcrTradeNamesY(String(rect.y));
      setOcrTradeNamesWidth(String(rect.width));
      setOcrTradeNamesHeight(String(rect.height));
    },
    setOcrTradePricesRectInputs: (rect) => {
      setOcrTradePricesX(String(rect.x));
      setOcrTradePricesY(String(rect.y));
      setOcrTradePricesWidth(String(rect.width));
      setOcrTradePricesHeight(String(rect.height));
    },
    setOcrDragMode,
    setOcrDragOffset,
    setOcrDragStart,
    setOcrDragRect,
  });

  return {
    ocrTradeNamesRect,
    ocrTradePricesRect,
    onPreviewMouseDown,
    onPreviewMouseMove,
    onPreviewMouseUp,
  };
}
