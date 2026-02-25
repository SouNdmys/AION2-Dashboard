import type { WorkshopRect, WorkshopTradeBoardPreset } from "../../shared/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseIntLike(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  return Math.floor(raw);
}

function sanitizeRect(raw: unknown): WorkshopRect | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entity = raw as Partial<WorkshopRect>;
  const x = parseIntLike(entity.x);
  const y = parseIntLike(entity.y);
  const width = parseIntLike(entity.width);
  const height = parseIntLike(entity.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }
  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

export function sanitizeTradeBoardPreset(raw: unknown): WorkshopTradeBoardPreset | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entity = raw as Partial<WorkshopTradeBoardPreset>;
  if (!entity.enabled) {
    return null;
  }
  const namesRect = sanitizeRect(entity.namesRect);
  const pricesRect = sanitizeRect(entity.pricesRect);
  if (!namesRect || !pricesRect) {
    return null;
  }
  const rowCountRaw = parseIntLike(entity.rowCount);
  const rowCount = rowCountRaw === null ? 0 : clamp(rowCountRaw, 0, 30);
  return {
    enabled: true,
    rowCount,
    namesRect,
    pricesRect,
    priceMode: entity.priceMode === "single" ? "single" : "dual",
    priceColumn: entity.priceColumn === "right" ? "right" : "left",
    leftPriceRole: entity.leftPriceRole === "world" ? "world" : "server",
    rightPriceRole: entity.rightPriceRole === "server" ? "server" : "world",
  };
}
