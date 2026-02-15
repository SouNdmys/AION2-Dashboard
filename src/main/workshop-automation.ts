import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserWindow, desktopCapturer, globalShortcut, screen } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type {
  WorkshopItemCategory,
  WorkshopOcrHotkeyConfig,
  WorkshopOcrIconCaptureTemplate,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopScreenCaptureOptions,
  WorkshopScreenPreviewResult,
  WorkshopTradeBoardPreset,
} from "../shared/types";
import { extractWorkshopOcrText, importWorkshopOcrPrices } from "./workshop-store";

const DEFAULT_SHORTCUT = process.platform === "win32" ? "Shift+F8" : "CommandOrControl+Shift+F8";
const DEFAULT_LANGUAGE = "chi_tra+eng";
const DEFAULT_PSM = 6;
const DEFAULT_CATEGORY: WorkshopItemCategory = "material";
const DEFAULT_ICON_CAPTURE_TEMPLATE: WorkshopOcrIconCaptureTemplate = {
  firstRowTop: 339,
  rowHeight: 135,
  nameAnchorX: 530,
  iconOffsetX: -85,
  iconTopOffset: 0,
  iconWidth: 85,
  iconHeight: 85,
};
const DEFAULT_TRADE_BOARD_PRESET: WorkshopTradeBoardPreset = {
  enabled: true,
  rowCount: 7,
  namesRect: {
    x: 426,
    y: 310,
    width: 900,
    height: 960,
  },
  pricesRect: {
    x: 1900,
    y: 240,
    width: 580,
    height: 1030,
  },
  priceMode: "dual",
  priceColumn: "left",
  leftPriceRole: "server",
  rightPriceRole: "world",
};

let currentState: WorkshopOcrHotkeyState = {
  enabled: false,
  registered: false,
  shortcut: DEFAULT_SHORTCUT,
  language: DEFAULT_LANGUAGE,
  psm: DEFAULT_PSM,
  autoCreateMissingItems: false,
  defaultCategory: DEFAULT_CATEGORY,
  iconCaptureEnabled: false,
  strictIconMatch: false,
  lastResult: null,
};

let iconCaptureTemplate: WorkshopOcrIconCaptureTemplate | null = null;
let tradeBoardPreset: WorkshopTradeBoardPreset | null = DEFAULT_TRADE_BOARD_PRESET;
let defaultCaptureDelayMs = 1200;
let defaultHideAppBeforeCapture = true;
let running = false;

function sanitizeCaptureOptions(raw?: WorkshopScreenCaptureOptions): { delayMs: number; hideAppBeforeCapture: boolean } {
  const delayRaw = raw?.delayMs;
  const delayMs =
    typeof delayRaw === "number" && Number.isFinite(delayRaw) ? Math.min(10_000, Math.max(0, Math.floor(delayRaw))) : 1200;
  const hideAppBeforeCapture = raw?.hideAppBeforeCapture !== false;
  return {
    delayMs,
    hideAppBeforeCapture,
  };
}

function resolveCaptureOptions(raw?: WorkshopScreenCaptureOptions): { delayMs: number; hideAppBeforeCapture: boolean } {
  const merged = {
    delayMs: raw?.delayMs ?? defaultCaptureDelayMs,
    hideAppBeforeCapture: raw?.hideAppBeforeCapture ?? defaultHideAppBeforeCapture,
  };
  return sanitizeCaptureOptions(merged);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeShortcut(raw: unknown): string {
  if (typeof raw !== "string") {
    return DEFAULT_SHORTCUT;
  }
  const value = raw
    .trim()
    .replace(/[＋﹢]/g, "+")
    .replace(/\s+/g, "");
  if (!value) {
    return DEFAULT_SHORTCUT;
  }
  const parts = value.split("+").filter(Boolean);
  if (parts.length === 0) {
    return DEFAULT_SHORTCUT;
  }
  const normalized = parts.map((part) => {
    const key = part.toLowerCase();
    if (key === "cmd" || key === "command") return "Command";
    if (key === "ctrl" || key === "control" || key === "ctl") return "Control";
    if (key === "commandorcontrol") return "CommandOrControl";
    if (key === "shift") return "Shift";
    if (key === "alt" || key === "option") return "Alt";
    if (/^f\d{1,2}$/u.test(key)) return key.toUpperCase();
    if (/^[a-z]$/u.test(key)) return key.toUpperCase();
    return part;
  });
  const shortcut = normalized.join("+");
  if (!shortcut) {
    return DEFAULT_SHORTCUT;
  }
  return shortcut;
}

function buildShortcutCandidates(shortcut: string): string[] {
  const list: string[] = [];
  const seen = new Set<string>();
  const add = (candidate: string): void => {
    const value = sanitizeShortcut(candidate);
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    list.push(value);
  };
  add(shortcut);
  if (process.platform === "win32") {
    add(shortcut.replace(/^CommandOrControl\+/iu, "Control+"));
    const lower = shortcut.toLowerCase();
    if (lower === "shift+f8" || lower === "control+shift+f8" || lower === "commandorcontrol+shift+f8") {
      add("Shift+F8");
      add("Control+Shift+F8");
      add("Alt+Shift+F8");
      add("F8");
      add("Control+F8");
    }
  }
  if (list.length === 0) {
    add(DEFAULT_SHORTCUT);
  }
  return list;
}

function summarizeImportOutcome(extractedLineCount: number, importedCount: number, unknownItemCount: number, invalidLineCount: number): string {
  return `快捷抓价完成：识别 ${extractedLineCount} 行，导入 ${importedCount} 条，未匹配 ${unknownItemCount} 行，异常 ${invalidLineCount} 行。`;
}

function buildImportWarnings(baseWarnings: string[], unknownItemNames: string[], invalidLineCount: number): string[] {
  const warnings = [...baseWarnings];
  if (unknownItemNames.length > 0) {
    const sample = unknownItemNames.slice(0, 8).join("、");
    warnings.push(`未匹配物品 ${unknownItemNames.length} 行：${sample}${unknownItemNames.length > 8 ? " 等" : ""}`);
    warnings.push("请优先检查名称 OCR 识别质量与框选位置，避免误识别写入价格。");
  }
  if (invalidLineCount > 0) {
    warnings.push(`存在 ${invalidLineCount} 行无法解析（通常是价格末尾不完整或 OCR 丢字）。`);
  }
  return warnings;
}

function sanitizeLanguage(raw: unknown): string {
  if (typeof raw !== "string") {
    return DEFAULT_LANGUAGE;
  }
  const value = raw.trim();
  if (!value || !/^[a-zA-Z0-9_+]+$/u.test(value)) {
    return DEFAULT_LANGUAGE;
  }
  return value;
}

function sanitizePsm(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_PSM;
  }
  return Math.min(13, Math.max(3, Math.floor(raw)));
}

function sanitizeTradeBoardPreset(raw: WorkshopOcrHotkeyConfig["tradeBoardPreset"]): WorkshopTradeBoardPreset | null {
  if (!raw || !raw.enabled) {
    return null;
  }
  const rowCount = Number.isFinite(raw.rowCount) ? Math.min(30, Math.max(1, Math.floor(raw.rowCount))) : 7;
  const normalizeRect = (rect: WorkshopTradeBoardPreset["namesRect"]) => ({
    x: Math.max(0, Math.floor(rect.x)),
    y: Math.max(0, Math.floor(rect.y)),
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  });
  return {
    enabled: true,
    rowCount,
    namesRect: normalizeRect(raw.namesRect),
    pricesRect: normalizeRect(raw.pricesRect),
    priceMode: raw.priceMode === "single" ? "single" : "dual",
    priceColumn: raw.priceColumn === "right" ? "right" : "left",
    leftPriceRole: raw.leftPriceRole === "world" ? "world" : "server",
    rightPriceRole: raw.rightPriceRole === "server" ? "server" : "world",
  };
}

async function capturePrimaryDisplayImage(options?: WorkshopScreenCaptureOptions) {
  const captureOptions = resolveCaptureOptions(options);
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed() && win.isVisible());
  if (captureOptions.hideAppBeforeCapture) {
    windows.forEach((win) => {
      win.hide();
    });
  }
  if (captureOptions.delayMs > 0) {
    await sleep(captureOptions.delayMs);
  }
  const cursorPoint = screen.getCursorScreenPoint();
  const targetDisplay = screen.getDisplayNearestPoint(cursorPoint) ?? screen.getPrimaryDisplay();
  const width = Math.max(1, Math.floor(targetDisplay.size.width * targetDisplay.scaleFactor));
  const height = Math.max(1, Math.floor(targetDisplay.size.height * targetDisplay.scaleFactor));
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
      fetchWindowIcons: false,
    });
    const target = sources.find((entry) => entry.display_id === String(targetDisplay.id)) ?? sources[0];
    if (!target || target.thumbnail.isEmpty()) {
      throw new Error("屏幕捕获失败：未获取到可用屏幕图像。");
    }
    return target.thumbnail;
  } finally {
    if (captureOptions.hideAppBeforeCapture) {
      windows.forEach((win) => {
        win.show();
      });
    }
  }
}

async function capturePrimaryDisplayToTempFile(options?: WorkshopScreenCaptureOptions): Promise<string> {
  const image = await capturePrimaryDisplayImage(options);
  const filePath = path.join(os.tmpdir(), `aion2-ocr-hotkey-${Date.now()}-${randomUUID()}.png`);
  fs.writeFileSync(filePath, image.toPNG());
  return filePath;
}

function emitHotkeyResult(result: WorkshopOcrHotkeyRunResult): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.workshopOcrHotkeyResult, result);
    }
  });
}

function buildFailureResult(message: string, warnings: string[] = []): WorkshopOcrHotkeyRunResult {
  return {
    at: new Date().toISOString(),
    success: false,
    message,
    screenshotPath: null,
    extractedLineCount: 0,
    importedCount: 0,
    createdItemCount: 0,
    unknownItemCount: 0,
    invalidLineCount: 0,
    iconCapturedCount: 0,
    iconSkippedCount: 0,
    warnings,
    importedEntries: [],
  };
}

async function runHotkeyFlow(options?: WorkshopScreenCaptureOptions): Promise<WorkshopOcrHotkeyRunResult> {
  let screenshotPath: string | null = null;
  try {
    screenshotPath = await capturePrimaryDisplayToTempFile(options);
    const extracted = extractWorkshopOcrText({
      imagePath: screenshotPath,
      language: currentState.language,
      psm: currentState.psm,
      tradeBoardPreset,
    });
    if (!extracted.text.trim()) {
      return buildFailureResult("OCR 未识别到有效文本。", extracted.warnings);
    }
    const imported = importWorkshopOcrPrices({
      text: extracted.text,
      tradeRows: extracted.tradeRows,
      source: "import",
      autoCreateMissingItems: currentState.autoCreateMissingItems,
      defaultCategory: currentState.defaultCategory,
      strictIconMatch: currentState.strictIconMatch,
      iconCapture: currentState.iconCaptureEnabled
        ? {
            screenshotPath,
            ...(iconCaptureTemplate ?? DEFAULT_ICON_CAPTURE_TEMPLATE),
          }
        : undefined,
    });
    const warnings = buildImportWarnings(
      [...extracted.warnings, ...imported.iconCaptureWarnings],
      imported.unknownItemNames,
      imported.invalidLines.length,
    );
    return {
      at: new Date().toISOString(),
      success: true,
      message: summarizeImportOutcome(
        extracted.lineCount,
        imported.importedCount,
        imported.unknownItemNames.length,
        imported.invalidLines.length,
      ),
      screenshotPath: null,
      extractedLineCount: extracted.lineCount,
      importedCount: imported.importedCount,
      createdItemCount: imported.createdItemCount,
      unknownItemCount: imported.unknownItemNames.length,
      invalidLineCount: imported.invalidLines.length,
      iconCapturedCount: imported.iconCapturedCount,
      iconSkippedCount: imported.iconSkippedCount,
      warnings,
      importedEntries: imported.importedEntries,
    };
  } catch (err) {
    return buildFailureResult(err instanceof Error ? err.message : "快捷抓价执行失败。");
  } finally {
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      try {
        fs.unlinkSync(screenshotPath);
      } catch {
        // ignore temp cleanup failure
      }
    }
  }
}

async function runHotkeyFlowAndBroadcast(options?: WorkshopScreenCaptureOptions): Promise<WorkshopOcrHotkeyRunResult> {
  if (running) {
    return buildFailureResult("上一次快捷抓价仍在执行中，请稍后重试。");
  }
  running = true;
  try {
    const result = await runHotkeyFlow(options);
    currentState = {
      ...currentState,
      lastResult: result,
    };
    emitHotkeyResult(result);
    return result;
  } finally {
    running = false;
  }
}

function unregisterCurrentShortcut(): void {
  if (currentState.shortcut) {
    try {
      globalShortcut.unregister(currentState.shortcut);
    } catch {
      // ignore invalid accelerator unregistration
    }
  }
}

function tryRegisterShortcut(shortcut: string): boolean {
  try {
    return globalShortcut.register(shortcut, () => {
      void runHotkeyFlowAndBroadcast();
    });
  } catch {
    return false;
  }
}

export function configureWorkshopOcrHotkey(config: WorkshopOcrHotkeyConfig): WorkshopOcrHotkeyState {
  const nextShortcut = sanitizeShortcut(config.shortcut);
  const nextState: WorkshopOcrHotkeyState = {
    ...currentState,
    enabled: Boolean(config.enabled),
    shortcut: nextShortcut,
    language: sanitizeLanguage(config.language),
    psm: sanitizePsm(config.psm),
    autoCreateMissingItems: config.autoCreateMissingItems ?? false,
    defaultCategory: config.defaultCategory ?? DEFAULT_CATEGORY,
    iconCaptureEnabled: Boolean(config.iconCapture),
    strictIconMatch: config.strictIconMatch ?? false,
  };
  iconCaptureTemplate = config.iconCapture
    ? {
        firstRowTop: config.iconCapture.firstRowTop,
        rowHeight: config.iconCapture.rowHeight,
        nameAnchorX: config.iconCapture.nameAnchorX,
        iconOffsetX: config.iconCapture.iconOffsetX,
        iconTopOffset: config.iconCapture.iconTopOffset,
        iconWidth: config.iconCapture.iconWidth,
        iconHeight: config.iconCapture.iconHeight,
      }
    : null;
  tradeBoardPreset = sanitizeTradeBoardPreset(config.tradeBoardPreset);
  defaultCaptureDelayMs = sanitizeCaptureOptions({ delayMs: config.captureDelayMs }).delayMs;
  defaultHideAppBeforeCapture = config.hideAppBeforeCapture !== false;

  unregisterCurrentShortcut();
  let registered = false;
  let attemptedShortcuts: string[] = [];
  if (nextState.enabled) {
    const candidates = buildShortcutCandidates(nextState.shortcut);
    attemptedShortcuts = candidates;
    for (const candidate of candidates) {
      registered = tryRegisterShortcut(candidate);
      if (registered) {
        nextState.shortcut = candidate;
        break;
      }
    }
  }
  nextState.registered = nextState.enabled ? registered : false;
  if (nextState.enabled && !registered) {
    const warnings = attemptedShortcuts.length > 0 ? [`已尝试：${attemptedShortcuts.join(" / ")}`] : [];
    nextState.lastResult = buildFailureResult(`快捷键注册失败：${nextState.shortcut}`, warnings);
  }
  currentState = nextState;
  return getWorkshopOcrHotkeyState();
}

export function getWorkshopOcrHotkeyState(): WorkshopOcrHotkeyState {
  return {
    enabled: currentState.enabled,
    registered: currentState.registered,
    shortcut: currentState.shortcut,
    language: currentState.language,
    psm: currentState.psm,
    autoCreateMissingItems: currentState.autoCreateMissingItems,
    defaultCategory: currentState.defaultCategory,
    iconCaptureEnabled: currentState.iconCaptureEnabled,
    strictIconMatch: currentState.strictIconMatch,
    lastResult: currentState.lastResult,
  };
}

export async function triggerWorkshopOcrHotkeyNow(options?: WorkshopScreenCaptureOptions): Promise<WorkshopOcrHotkeyRunResult> {
  return runHotkeyFlowAndBroadcast(options);
}

export async function captureWorkshopScreenPreview(options?: WorkshopScreenCaptureOptions): Promise<WorkshopScreenPreviewResult> {
  const image = await capturePrimaryDisplayImage(options);
  const size = image.getSize();
  return {
    capturedAt: new Date().toISOString(),
    width: size.width,
    height: size.height,
    dataUrl: image.toDataURL(),
  };
}

export function cleanupWorkshopOcrHotkey(): void {
  unregisterCurrentShortcut();
}
