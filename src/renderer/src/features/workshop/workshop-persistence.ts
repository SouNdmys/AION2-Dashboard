export const OCR_HOTKEY_DEFAULT_LANGUAGE = "chi_tra";
export const OCR_HOTKEY_DEFAULT_PSM = 6;
export const OCR_CAPTURE_DELAY_STORAGE_KEY = "workshop.ocr.captureDelayMs";
export const OCR_HIDE_APP_STORAGE_KEY = "workshop.ocr.hideAppBeforeCapture";
export const OCR_SAFE_MODE_STORAGE_KEY = "workshop.ocr.safeMode";
export const OCR_TRADE_PRESET_STORAGE_KEY = "workshop.ocr.tradePreset";
export const OCR_AUTO_INTERVAL_STORAGE_KEY = "workshop.ocr.autoRunIntervalSeconds";
export const OCR_AUTO_OVERLAY_STORAGE_KEY = "workshop.ocr.autoRunOverlay";
export const OCR_AUTO_FAIL_LIMIT_STORAGE_KEY = "workshop.ocr.autoRunFailLimit";
export const WORKSHOP_STAR_ITEM_IDS_STORAGE_KEY = "workshop.starItemIds";

export const serializeRawString = (value: string): string => value;
export const serializeBooleanFlag = (value: boolean): string => (value ? "1" : "0");
export const serializeStringArray = (value: string[]): string => JSON.stringify(value);

export const DEFAULT_TRADE_BOARD_PRESET = {
  rowCount: "0",
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

export const OCR_TRADE_BOARD_PRESETS = {
  custom: null,
  trade_1080p: {
    rowCount: DEFAULT_TRADE_BOARD_PRESET.rowCount,
    namesX: DEFAULT_TRADE_BOARD_PRESET.namesX,
    namesY: DEFAULT_TRADE_BOARD_PRESET.namesY,
    namesWidth: DEFAULT_TRADE_BOARD_PRESET.namesWidth,
    namesHeight: DEFAULT_TRADE_BOARD_PRESET.namesHeight,
    pricesX: DEFAULT_TRADE_BOARD_PRESET.pricesX,
    pricesY: DEFAULT_TRADE_BOARD_PRESET.pricesY,
    pricesWidth: DEFAULT_TRADE_BOARD_PRESET.pricesWidth,
    pricesHeight: DEFAULT_TRADE_BOARD_PRESET.pricesHeight,
    priceMode: DEFAULT_TRADE_BOARD_PRESET.priceMode,
    priceColumn: DEFAULT_TRADE_BOARD_PRESET.priceColumn,
    leftPriceRole: DEFAULT_TRADE_BOARD_PRESET.leftPriceRole,
    rightPriceRole: DEFAULT_TRADE_BOARD_PRESET.rightPriceRole,
  },
  trade_1440p: {
    rowCount: DEFAULT_TRADE_BOARD_PRESET.rowCount,
    namesX: DEFAULT_TRADE_BOARD_PRESET.namesX,
    namesY: DEFAULT_TRADE_BOARD_PRESET.namesY,
    namesWidth: DEFAULT_TRADE_BOARD_PRESET.namesWidth,
    namesHeight: DEFAULT_TRADE_BOARD_PRESET.namesHeight,
    pricesX: DEFAULT_TRADE_BOARD_PRESET.pricesX,
    pricesY: DEFAULT_TRADE_BOARD_PRESET.pricesY,
    pricesWidth: DEFAULT_TRADE_BOARD_PRESET.pricesWidth,
    pricesHeight: DEFAULT_TRADE_BOARD_PRESET.pricesHeight,
    priceMode: DEFAULT_TRADE_BOARD_PRESET.priceMode,
    priceColumn: DEFAULT_TRADE_BOARD_PRESET.priceColumn,
    leftPriceRole: DEFAULT_TRADE_BOARD_PRESET.leftPriceRole,
    rightPriceRole: DEFAULT_TRADE_BOARD_PRESET.rightPriceRole,
  },
} as const;

export type OcrTradePresetKey = keyof typeof OCR_TRADE_BOARD_PRESETS;

export function readStoredTradePreset(): OcrTradePresetKey {
  try {
    const raw = window.localStorage.getItem(OCR_TRADE_PRESET_STORAGE_KEY);
    if (raw === "trade_1080p" || raw === "trade_1440p" || raw === "custom") {
      return raw;
    }
  } catch {
    // ignore local storage read failures
  }
  return "trade_1440p";
}

export function readStoredCaptureDelayMs(): string {
  try {
    const raw = window.localStorage.getItem(OCR_CAPTURE_DELAY_STORAGE_KEY);
    if (raw && raw.trim()) {
      return raw.trim();
    }
  } catch {
    // ignore local storage read failures
  }
  return "600";
}

export function readStoredHideAppBeforeCapture(): boolean {
  try {
    return window.localStorage.getItem(OCR_HIDE_APP_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function readStoredOcrSafeMode(): boolean {
  try {
    return window.localStorage.getItem(OCR_SAFE_MODE_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function readStoredAutoRunIntervalSeconds(): string {
  try {
    const raw = window.localStorage.getItem(OCR_AUTO_INTERVAL_STORAGE_KEY);
    if (raw && raw.trim()) {
      return raw.trim();
    }
  } catch {
    // ignore local storage read failures
  }
  return "8";
}

export function readStoredAutoRunOverlayEnabled(): boolean {
  try {
    return window.localStorage.getItem(OCR_AUTO_OVERLAY_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function readStoredAutoRunFailLimit(): string {
  try {
    const raw = window.localStorage.getItem(OCR_AUTO_FAIL_LIMIT_STORAGE_KEY);
    if (raw && raw.trim()) {
      return raw.trim();
    }
  } catch {
    // ignore local storage read failures
  }
  return "3";
}

export function readStoredWorkshopStarItemIds(): string[] {
  try {
    const raw = window.localStorage.getItem(WORKSHOP_STAR_ITEM_IDS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(new Set(parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)));
  } catch {
    return [];
  }
}
