import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserWindow, desktopCapturer, globalShortcut, screen } from "electron";
import { IPC_CHANNELS } from "../shared/ipc";
import type {
  WorkshopItemCategory,
  WorkshopOcrAutoRunConfig,
  WorkshopOcrAutoRunState,
  WorkshopOcrHotkeyConfig,
  WorkshopOcrHotkeyRunResult,
  WorkshopOcrHotkeyState,
  WorkshopScreenCaptureOptions,
  WorkshopScreenPreviewResult,
  WorkshopTradeBoardPreset,
} from "../shared/types";
import { extractWorkshopOcrText, importWorkshopOcrPrices } from "./workshop-store";

const DEFAULT_SHORTCUT = process.platform === "win32" ? "Shift+F1" : "CommandOrControl+Shift+F1";
const DEFAULT_LANGUAGE = "chi_tra";
const DEFAULT_PSM = 6;
const DEFAULT_CATEGORY: WorkshopItemCategory = "material";
const DEFAULT_AUTO_RUN_INTERVAL_SECONDS = 8;
const DEFAULT_AUTO_RUN_MAX_CONSECUTIVE_FAILURES = 3;
const AUTO_RUN_INTERVAL_MIN = 2;
const AUTO_RUN_INTERVAL_MAX = 120;
const AUTO_RUN_FAILURE_MIN = 1;
const AUTO_RUN_FAILURE_MAX = 10;
const AUTO_RUN_TOGGLE_SHORTCUT = process.platform === "win32" ? "Shift+F2" : "CommandOrControl+Shift+F2";
const AUTO_RUN_DEDUPE_SECONDS = 30;
const DEFAULT_TRADE_BOARD_PRESET: WorkshopTradeBoardPreset = {
  enabled: true,
  rowCount: 0,
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
  safeMode: true,
  autoCreateMissingItems: false,
  defaultCategory: DEFAULT_CATEGORY,
  iconCaptureEnabled: false,
  strictIconMatch: false,
  lastResult: null,
};

let tradeBoardPreset: WorkshopTradeBoardPreset | null = DEFAULT_TRADE_BOARD_PRESET;
let defaultCaptureDelayMs = 600;
let defaultHideAppBeforeCapture = true;
let running = false;
let autoRunState: WorkshopOcrAutoRunState = {
  enabled: false,
  running: false,
  intervalSeconds: DEFAULT_AUTO_RUN_INTERVAL_SECONDS,
  showOverlay: true,
  toggleShortcut: AUTO_RUN_TOGGLE_SHORTCUT,
  maxConsecutiveFailures: DEFAULT_AUTO_RUN_MAX_CONSECUTIVE_FAILURES,
  consecutiveFailureCount: 0,
  startedAt: null,
  nextRunAt: null,
  loopCount: 0,
  successCount: 0,
  failureCount: 0,
  lastResultAt: null,
  lastMessage: null,
};
let autoRunLoopId = 0;
let overlayWindow: BrowserWindow | null = null;
let overlayRefreshTimer: NodeJS.Timeout | null = null;
let autoRunToggleShortcutRegistered = false;
const OVERLAY_ENTRY_MAX = 4;
const overlayPriceFormatter = new Intl.NumberFormat("zh-CN");

function sanitizeCaptureOptions(raw?: WorkshopScreenCaptureOptions): { delayMs: number; hideAppBeforeCapture: boolean } {
  const delayRaw = raw?.delayMs;
  const delayMs =
    typeof delayRaw === "number" && Number.isFinite(delayRaw) ? Math.min(10_000, Math.max(0, Math.floor(delayRaw))) : 600;
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

function sanitizeAutoRunIntervalSeconds(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_AUTO_RUN_INTERVAL_SECONDS;
  }
  return Math.min(AUTO_RUN_INTERVAL_MAX, Math.max(AUTO_RUN_INTERVAL_MIN, Math.floor(raw)));
}

function sanitizeAutoRunMaxConsecutiveFailures(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_AUTO_RUN_MAX_CONSECUTIVE_FAILURES;
  }
  return Math.min(AUTO_RUN_FAILURE_MAX, Math.max(AUTO_RUN_FAILURE_MIN, Math.floor(raw)));
}

function getWorkshopOcrAutoRunStateSnapshot(): WorkshopOcrAutoRunState {
  return {
    enabled: autoRunState.enabled,
    running: autoRunState.running,
    intervalSeconds: autoRunState.intervalSeconds,
    showOverlay: autoRunState.showOverlay,
    toggleShortcut: autoRunState.toggleShortcut,
    maxConsecutiveFailures: autoRunState.maxConsecutiveFailures,
    consecutiveFailureCount: autoRunState.consecutiveFailureCount,
    startedAt: autoRunState.startedAt,
    nextRunAt: autoRunState.nextRunAt,
    loopCount: autoRunState.loopCount,
    successCount: autoRunState.successCount,
    failureCount: autoRunState.failureCount,
    lastResultAt: autoRunState.lastResultAt,
    lastMessage: autoRunState.lastMessage,
  };
}

function formatOverlayImportedEntryLine(entry: WorkshopOcrHotkeyRunResult["importedEntries"][number]): string {
  const price = overlayPriceFormatter.format(Math.max(0, Math.floor(entry.unitPrice)));
  const marketTag = entry.market === "server" ? " [伺服]" : entry.market === "world" ? " [世界]" : "";
  return `${entry.itemName} ${price}${marketTag}`;
}

function overlayStatusText(): {
  title: string;
  line1: string;
  line2: string;
  success: boolean;
  entriesTitle: string;
  entries: string[];
} {
  const now = Date.now();
  const nextSeconds =
    autoRunState.nextRunAt === null
      ? null
      : Math.max(0, Math.ceil((new Date(autoRunState.nextRunAt).getTime() - now) / 1000));
  const title = autoRunState.running
    ? "OCR 自动抓价: 执行中"
    : autoRunState.enabled
      ? "OCR 自动抓价: 运行中"
      : "OCR 自动抓价: 已停止";
  const lastCoverage =
    currentState.lastResult?.expectedLineCount && currentState.lastResult.expectedLineCount > 0
      ? `${currentState.lastResult.extractedLineCount}/${currentState.lastResult.expectedLineCount}`
      : `${currentState.lastResult?.extractedLineCount ?? 0}`;
  const line1 = `轮次 ${autoRunState.loopCount} | 成功 ${autoRunState.successCount} | 失败 ${autoRunState.failureCount} | 行 ${lastCoverage}`;
  const line2 = autoRunState.running
    ? "正在截图与识别..."
    : autoRunState.enabled
      ? `下一次抓取: ${nextSeconds ?? "--"}s | 连续失败 ${autoRunState.consecutiveFailureCount}/${autoRunState.maxConsecutiveFailures}`
      : autoRunState.lastMessage || "等待启动";
  const success = autoRunState.lastMessage ? autoRunState.failureCount <= autoRunState.successCount : true;
  const importedEntries = currentState.lastResult?.success ? currentState.lastResult.importedEntries ?? [] : [];
  const visibleEntries = importedEntries.slice(0, OVERLAY_ENTRY_MAX).map((entry) => formatOverlayImportedEntryLine(entry));
  const remainingCount = Math.max(0, importedEntries.length - visibleEntries.length);
  if (remainingCount > 0) {
    visibleEntries.push(`...其余 ${remainingCount} 条`);
  }
  const entriesTitle =
    importedEntries.length > 0
      ? `最近成功抓价 ${importedEntries.length} 条（显示 ${Math.min(importedEntries.length, OVERLAY_ENTRY_MAX)} 条）`
      : "最近成功抓价：暂无明细";
  return { title, line1, line2, success, entriesTitle, entries: visibleEntries };
}

function renderOverlayHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
    .wrap {
      margin: 8px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(10,14,20,0.72);
      backdrop-filter: blur(10px);
      color: #E2E8F0;
      font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
      padding: 10px 12px;
    }
    .title { font-size: 12px; font-weight: 700; color: #7DD3FC; }
    .line { font-size: 11px; margin-top: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .line.ok { color: #86EFAC; }
    .line.err { color: #FDA4AF; }
    .entries-title {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.14);
      font-size: 11px;
      color: #93C5FD;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .entries {
      margin-top: 4px;
      max-height: 78px;
      overflow: hidden;
    }
    .entry {
      font-size: 11px;
      line-height: 1.35;
      color: #E2E8F0;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .entry.empty { color: #94A3B8; }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="title" class="title">OCR 自动抓价: 已停止</div>
    <div id="line1" class="line">轮次 0 | 成功 0 | 失败 0</div>
    <div id="line2" class="line ok">等待启动</div>
    <div id="entries-title" class="entries-title">最近成功抓价：暂无明细</div>
    <div id="entries" class="entries">
      <div class="entry empty">等待第一轮成功抓价...</div>
    </div>
  </div>
  <script>
    window.__updateOverlay = function(payload) {
      var title = document.getElementById("title");
      var line1 = document.getElementById("line1");
      var line2 = document.getElementById("line2");
      var entriesTitle = document.getElementById("entries-title");
      var entries = document.getElementById("entries");
      if (title) title.textContent = payload.title || "";
      if (line1) line1.textContent = payload.line1 || "";
      if (line2) {
        line2.textContent = payload.line2 || "";
        line2.className = "line " + (payload.success ? "ok" : "err");
      }
      if (entriesTitle) entriesTitle.textContent = payload.entriesTitle || "最近成功抓价：暂无明细";
      if (entries) {
        while (entries.firstChild) {
          entries.removeChild(entries.firstChild);
        }
        var rows = Array.isArray(payload.entries) ? payload.entries : [];
        if (rows.length === 0) {
          var emptyNode = document.createElement("div");
          emptyNode.className = "entry empty";
          emptyNode.textContent = "等待第一轮成功抓价...";
          entries.appendChild(emptyNode);
        } else {
          rows.forEach(function(text) {
            var row = document.createElement("div");
            row.className = "entry";
            row.textContent = String(text || "");
            entries.appendChild(row);
          });
        }
      }
    };
  </script>
</body>
</html>`;
}

function ensureOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }
  const display = screen.getPrimaryDisplay();
  const bounds = display.workArea;
  overlayWindow = new BrowserWindow({
    width: 460,
    height: 196,
    x: bounds.x + 16,
    y: bounds.y + 16,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      sandbox: false,
      contextIsolation: false,
      nodeIntegration: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
  void overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderOverlayHtml())}`);
  return overlayWindow;
}

function hideOverlayWindow(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }
  overlayWindow.hide();
}

function refreshOverlayWindow(): void {
  if (!autoRunState.enabled || !autoRunState.showOverlay) {
    hideOverlayWindow();
    return;
  }
  const win = ensureOverlayWindow();
  const payload = overlayStatusText();
  const script = `window.__updateOverlay && window.__updateOverlay(${JSON.stringify(payload)});`;
  const runScript = (): void => {
    void win.webContents.executeJavaScript(script).catch(() => {
      // ignore overlay render failures
    });
  };
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", runScript);
  } else {
    runScript();
  }
  if (!win.isVisible()) {
    win.showInactive();
  }
}

function syncOverlayRefreshTimer(): void {
  if (autoRunState.enabled && autoRunState.showOverlay) {
    if (!overlayRefreshTimer) {
      overlayRefreshTimer = setInterval(() => {
        refreshOverlayWindow();
      }, 500);
    }
    return;
  }
  if (overlayRefreshTimer) {
    clearInterval(overlayRefreshTimer);
    overlayRefreshTimer = null;
  }
}

function emitAutoRunState(): void {
  const snapshot = getWorkshopOcrAutoRunStateSnapshot();
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.workshopOcrAutoRunState, snapshot);
    }
  });
  syncOverlayRefreshTimer();
  refreshOverlayWindow();
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
    if (
      lower === "shift+f1" ||
      lower === "control+shift+f1" ||
      lower === "commandorcontrol+shift+f1" ||
      lower === "shift+f8" ||
      lower === "control+shift+f8" ||
      lower === "commandorcontrol+shift+f8"
    ) {
      const fnKey = lower.includes("f1") ? "F1" : "F8";
      add(`Shift+${fnKey}`);
      add(`Control+Shift+${fnKey}`);
      add(`Alt+Shift+${fnKey}`);
      add(fnKey);
      add(`Control+${fnKey}`);
    }
  }
  if (list.length === 0) {
    add(DEFAULT_SHORTCUT);
  }
  return list;
}

function summarizeImportOutcome(
  extractedLineCount: number,
  expectedLineCount: number | null,
  importedCount: number,
  duplicateSkippedCount: number,
  unknownItemCount: number,
  invalidLineCount: number,
): string {
  const coverage =
    expectedLineCount && expectedLineCount > 0 ? `识别 ${extractedLineCount}/${expectedLineCount} 行` : `识别 ${extractedLineCount} 行`;
  const duplicateText = duplicateSkippedCount > 0 ? `，去重跳过 ${duplicateSkippedCount} 条` : "";
  return `快捷抓价完成：${coverage}，导入 ${importedCount} 条${duplicateText}，未匹配 ${unknownItemCount} 行，异常 ${invalidLineCount} 行。`;
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
  const rowCount = Number.isFinite(raw.rowCount) ? Math.min(30, Math.max(0, Math.floor(raw.rowCount))) : 0;
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

async function capturePrimaryDisplayImage(
  options?: WorkshopScreenCaptureOptions,
  hideOverlayBeforeCapture = true,
) {
  const captureOptions = resolveCaptureOptions(options);
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed() && win.isVisible());
  const focusedWindows = windows.filter((win) => win.isFocused());
  const shouldHideFocusedAppWindows = captureOptions.hideAppBeforeCapture && focusedWindows.length > 0;
  const overlayWasVisible = overlayWindow !== null && !overlayWindow.isDestroyed() && overlayWindow.isVisible();
  const shouldHideOverlayTemporarily = hideOverlayBeforeCapture && overlayWasVisible;
  if (shouldHideFocusedAppWindows) {
    focusedWindows.forEach((win) => {
      win.hide();
    });
  }
  if (shouldHideOverlayTemporarily) {
    overlayWindow?.hide();
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
    if (shouldHideFocusedAppWindows) {
      focusedWindows.forEach((win) => {
        win.show();
      });
    }
    if (shouldHideOverlayTemporarily && autoRunState.enabled && autoRunState.showOverlay) {
      overlayWindow?.showInactive();
    }
  }
}

async function capturePrimaryDisplayToTempFile(
  options?: WorkshopScreenCaptureOptions,
  hideOverlayBeforeCapture = true,
): Promise<string> {
  const image = await capturePrimaryDisplayImage(options, hideOverlayBeforeCapture);
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
    expectedLineCount: null,
    importedCount: 0,
    duplicateSkippedCount: 0,
    createdItemCount: 0,
    unknownItemCount: 0,
    invalidLineCount: 0,
    iconCapturedCount: 0,
    iconSkippedCount: 0,
    warnings,
    importedEntries: [],
  };
}

async function runHotkeyFlow(
  options?: WorkshopScreenCaptureOptions,
  triggerMode: "manual" | "auto" = "manual",
): Promise<WorkshopOcrHotkeyRunResult> {
  let screenshotPath: string | null = null;
  try {
    const hideOverlayBeforeCapture = triggerMode !== "auto";
    screenshotPath = await capturePrimaryDisplayToTempFile(options, hideOverlayBeforeCapture);
    const expectedLineCount = tradeBoardPreset?.enabled ? tradeBoardPreset.rowCount : null;
    const extracted = await extractWorkshopOcrText({
      imagePath: screenshotPath,
      language: currentState.language,
      psm: currentState.psm,
      safeMode: currentState.safeMode,
      tradeBoardPreset,
    });
    if (!extracted.text.trim()) {
      return buildFailureResult("OCR 未识别到有效文本。", extracted.warnings);
    }
    const imported = importWorkshopOcrPrices({
      text: extracted.text,
      tradeRows: extracted.tradeRows,
      source: "import",
      dedupeWithinSeconds: triggerMode === "auto" ? AUTO_RUN_DEDUPE_SECONDS : 0,
      autoCreateMissingItems: currentState.autoCreateMissingItems,
      defaultCategory: currentState.defaultCategory,
      strictIconMatch: false,
    });
    if (expectedLineCount && extracted.lineCount < expectedLineCount) {
      const missing = expectedLineCount - extracted.lineCount;
      const ratio = ((extracted.lineCount / expectedLineCount) * 100).toFixed(0);
      extracted.warnings.push(`识别覆盖不足：${extracted.lineCount}/${expectedLineCount}（缺失 ${missing} 行，覆盖 ${ratio}%）。`);
    }
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
        expectedLineCount,
        imported.importedCount,
        imported.duplicateSkippedCount,
        imported.unknownItemNames.length,
        imported.invalidLines.length,
      ),
      screenshotPath: null,
      extractedLineCount: extracted.lineCount,
      expectedLineCount,
      importedCount: imported.importedCount,
      duplicateSkippedCount: imported.duplicateSkippedCount,
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

async function runHotkeyFlowAndBroadcast(
  options?: WorkshopScreenCaptureOptions,
  triggerMode: "manual" | "auto" = "manual",
): Promise<WorkshopOcrHotkeyRunResult> {
  if (running) {
    return buildFailureResult("上一次快捷抓价仍在执行中，请稍后重试。");
  }
  running = true;
  try {
    const result = await runHotkeyFlow(options, triggerMode);
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

function updateAutoRunState(patch: Partial<WorkshopOcrAutoRunState>): void {
  autoRunState = {
    ...autoRunState,
    ...patch,
  };
  emitAutoRunState();
}

async function runAutoLoop(loopId: number): Promise<void> {
  while (autoRunState.enabled && loopId === autoRunLoopId) {
    const waitMs = autoRunState.intervalSeconds * 1000;
    const nextRunAt = new Date(Date.now() + waitMs).toISOString();
    updateAutoRunState({
      running: false,
      nextRunAt,
    });
    await sleep(waitMs);
    if (!autoRunState.enabled || loopId !== autoRunLoopId) {
      break;
    }
    updateAutoRunState({
      running: true,
      nextRunAt: null,
    });
    const result = await runHotkeyFlowAndBroadcast(undefined, "auto");
    const nextConsecutiveFailureCount = result.success ? 0 : autoRunState.consecutiveFailureCount + 1;
    const shouldAutoPause = !result.success && nextConsecutiveFailureCount >= autoRunState.maxConsecutiveFailures;
    const pausedMessage = shouldAutoPause
      ? `自动抓价已暂停：连续失败 ${nextConsecutiveFailureCount} 次。请检查交易行界面、框选区域与 OCR 环境后再启动。`
      : result.message;
    updateAutoRunState({
      enabled: shouldAutoPause ? false : autoRunState.enabled,
      running: false,
      loopCount: autoRunState.loopCount + 1,
      successCount: autoRunState.successCount + (result.success ? 1 : 0),
      failureCount: autoRunState.failureCount + (result.success ? 0 : 1),
      consecutiveFailureCount: nextConsecutiveFailureCount,
      nextRunAt: null,
      lastResultAt: result.at,
      lastMessage: pausedMessage,
    });
    if (shouldAutoPause) {
      break;
    }
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

function unregisterAutoRunToggleShortcut(): void {
  if (!autoRunToggleShortcutRegistered) {
    return;
  }
  try {
    globalShortcut.unregister(AUTO_RUN_TOGGLE_SHORTCUT);
  } catch {
    // ignore invalid accelerator unregistration
  }
  autoRunToggleShortcutRegistered = false;
}

function registerAutoRunToggleShortcut(): void {
  if (autoRunToggleShortcutRegistered) {
    return;
  }
  try {
    autoRunToggleShortcutRegistered = globalShortcut.register(AUTO_RUN_TOGGLE_SHORTCUT, () => {
      void configureWorkshopOcrAutoRun({
        enabled: !autoRunState.enabled,
        intervalSeconds: autoRunState.intervalSeconds,
        showOverlay: autoRunState.showOverlay,
        maxConsecutiveFailures: autoRunState.maxConsecutiveFailures,
      });
    });
  } catch {
    autoRunToggleShortcutRegistered = false;
  }
}

export function initializeWorkshopOcrAutomation(): void {
  registerAutoRunToggleShortcut();
  emitAutoRunState();
}

export function configureWorkshopOcrHotkey(config: WorkshopOcrHotkeyConfig): WorkshopOcrHotkeyState {
  const nextShortcut = sanitizeShortcut(config.shortcut);
  const nextState: WorkshopOcrHotkeyState = {
    ...currentState,
    enabled: Boolean(config.enabled),
    shortcut: nextShortcut,
    language: sanitizeLanguage(config.language),
    psm: sanitizePsm(config.psm),
    safeMode: config.safeMode ?? currentState.safeMode ?? true,
    autoCreateMissingItems: config.autoCreateMissingItems ?? false,
    defaultCategory: config.defaultCategory ?? DEFAULT_CATEGORY,
    iconCaptureEnabled: false,
    strictIconMatch: false,
  };
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
    safeMode: currentState.safeMode,
    autoCreateMissingItems: currentState.autoCreateMissingItems,
    defaultCategory: currentState.defaultCategory,
    iconCaptureEnabled: currentState.iconCaptureEnabled,
    strictIconMatch: currentState.strictIconMatch,
    lastResult: currentState.lastResult,
  };
}

export function configureWorkshopOcrAutoRun(config: WorkshopOcrAutoRunConfig): WorkshopOcrAutoRunState {
  registerAutoRunToggleShortcut();
  if (typeof config.safeMode === "boolean") {
    currentState = {
      ...currentState,
      safeMode: config.safeMode,
    };
  }
  const nextIntervalSeconds = sanitizeAutoRunIntervalSeconds(config.intervalSeconds);
  const nextShowOverlay = config.showOverlay !== false;
  const nextMaxConsecutiveFailures = sanitizeAutoRunMaxConsecutiveFailures(config.maxConsecutiveFailures);
  if (config.tradeBoardPreset !== undefined) {
    tradeBoardPreset = sanitizeTradeBoardPreset(config.tradeBoardPreset);
  }
  if (typeof config.captureDelayMs === "number" || typeof config.hideAppBeforeCapture === "boolean") {
    const options = sanitizeCaptureOptions({
      delayMs: config.captureDelayMs,
      hideAppBeforeCapture: config.hideAppBeforeCapture,
    });
    defaultCaptureDelayMs = options.delayMs;
    defaultHideAppBeforeCapture = options.hideAppBeforeCapture;
  }

  if (!config.enabled) {
    autoRunLoopId += 1;
    updateAutoRunState({
      enabled: false,
      running: false,
      showOverlay: nextShowOverlay,
      intervalSeconds: nextIntervalSeconds,
      maxConsecutiveFailures: nextMaxConsecutiveFailures,
      consecutiveFailureCount: 0,
      startedAt: null,
      nextRunAt: null,
    });
    return getWorkshopOcrAutoRunStateSnapshot();
  }

  const shouldRestartLoop = !autoRunState.enabled || autoRunState.intervalSeconds !== nextIntervalSeconds;
  let loopId = autoRunLoopId;
  if (shouldRestartLoop) {
    autoRunLoopId += 1;
    loopId = autoRunLoopId;
  }
  if (shouldRestartLoop) {
    updateAutoRunState({
      enabled: true,
      running: false,
      showOverlay: nextShowOverlay,
      intervalSeconds: nextIntervalSeconds,
      maxConsecutiveFailures: nextMaxConsecutiveFailures,
      consecutiveFailureCount: 0,
      toggleShortcut: AUTO_RUN_TOGGLE_SHORTCUT,
      startedAt: new Date().toISOString(),
      nextRunAt: null,
      loopCount: 0,
      successCount: 0,
      failureCount: 0,
      lastResultAt: null,
      lastMessage: null,
    });
  } else {
    updateAutoRunState({
      enabled: true,
      showOverlay: nextShowOverlay,
      intervalSeconds: nextIntervalSeconds,
      maxConsecutiveFailures: nextMaxConsecutiveFailures,
      toggleShortcut: AUTO_RUN_TOGGLE_SHORTCUT,
    });
  }
  if (shouldRestartLoop) {
    void runAutoLoop(loopId);
  }
  return getWorkshopOcrAutoRunStateSnapshot();
}

export function getWorkshopOcrAutoRunState(): WorkshopOcrAutoRunState {
  return getWorkshopOcrAutoRunStateSnapshot();
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
  autoRunLoopId += 1;
  autoRunState = {
    ...autoRunState,
    enabled: false,
    running: false,
    nextRunAt: null,
  };
  unregisterAutoRunToggleShortcut();
  if (overlayRefreshTimer) {
    clearInterval(overlayRefreshTimer);
    overlayRefreshTimer = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
  unregisterCurrentShortcut();
}
