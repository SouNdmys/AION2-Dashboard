import type { MouseEventHandler } from "react";
import type { WorkshopOcrAutoRunState, WorkshopOcrHotkeyRunResult, WorkshopOcrHotkeyState, WorkshopScreenPreviewResult } from "../../../../../shared/types";
import { formatDateTime, formatGold, formatMarketLabel } from "../workshop-view-helpers";
import type { OcrTradePresetKey } from "../workshop-persistence";

interface OcrRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkshopOcrPanelProps {
  busy: boolean;
  ocrCaptureDelayMs: string;
  setOcrCaptureDelayMs: (value: string) => void;
  ocrHideAppBeforeCapture: boolean;
  setOcrHideAppBeforeCapture: (value: boolean) => void;
  ocrSafeMode: boolean;
  setOcrSafeMode: (value: boolean) => void;
  ocrHotkeyShortcut: string;
  setOcrHotkeyShortcut: (value: string) => void;
  onApplyOcrHotkeyConfig: (nextEnabled: boolean) => Promise<void>;
  onTriggerOcrHotkeyNow: () => Promise<void>;
  ocrAutoRunIntervalSeconds: string;
  setOcrAutoRunIntervalSeconds: (value: string) => void;
  ocrAutoRunFailLimit: string;
  setOcrAutoRunFailLimit: (value: string) => void;
  ocrAutoRunOverlayEnabled: boolean;
  setOcrAutoRunOverlayEnabled: (value: boolean) => void;
  onConfigureOcrAutoRun: (nextEnabled: boolean) => Promise<void>;
  ocrAutoRunState: WorkshopOcrAutoRunState | null;
  ocrAutoRunCountdownSeconds: number | null;
  ocrHotkeyState: WorkshopOcrHotkeyState | null;
  ocrHotkeyLastResult: WorkshopOcrHotkeyRunResult | null;
  ocrTradePresetKey: OcrTradePresetKey;
  setOcrTradePresetKey: (value: OcrTradePresetKey) => void;
  ocrCalibrationTarget: "names" | "prices";
  setOcrCalibrationTarget: (value: "names" | "prices") => void;
  ocrTradeRowCount: string;
  setOcrTradeRowCount: (value: string) => void;
  onCaptureOcrScreenPreview: () => Promise<void>;
  ocrScreenPreview: WorkshopScreenPreviewResult | null;
  onPreviewMouseDown: MouseEventHandler<HTMLDivElement>;
  onPreviewMouseMove: MouseEventHandler<HTMLDivElement>;
  onPreviewMouseUp: MouseEventHandler<HTMLDivElement>;
  ocrTradeNamesRect: OcrRect | null;
  ocrTradePricesRect: OcrRect | null;
  ocrDragRect: OcrRect | null;
}

export function WorkshopOcrPanel(props: WorkshopOcrPanelProps): JSX.Element {
  const {
    busy,
    ocrCaptureDelayMs,
    setOcrCaptureDelayMs,
    ocrHideAppBeforeCapture,
    setOcrHideAppBeforeCapture,
    ocrSafeMode,
    setOcrSafeMode,
    ocrHotkeyShortcut,
    setOcrHotkeyShortcut,
    onApplyOcrHotkeyConfig,
    onTriggerOcrHotkeyNow,
    ocrAutoRunIntervalSeconds,
    setOcrAutoRunIntervalSeconds,
    ocrAutoRunFailLimit,
    setOcrAutoRunFailLimit,
    ocrAutoRunOverlayEnabled,
    setOcrAutoRunOverlayEnabled,
    onConfigureOcrAutoRun,
    ocrAutoRunState,
    ocrAutoRunCountdownSeconds,
    ocrHotkeyState,
    ocrHotkeyLastResult,
    ocrTradePresetKey,
    setOcrTradePresetKey,
    ocrCalibrationTarget,
    setOcrCalibrationTarget,
    ocrTradeRowCount,
    setOcrTradeRowCount,
    onCaptureOcrScreenPreview,
    ocrScreenPreview,
    onPreviewMouseDown,
    onPreviewMouseMove,
    onPreviewMouseUp,
    ocrTradeNamesRect,
    ocrTradePricesRect,
    ocrDragRect,
  } = props;

  return (
    <article className="order-2 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">OCR抓价器</h4>
          <p className="mt-1 text-xs text-slate-300">默认只保留抓价主流程，自动巡航、调试警告和可视化校准收进高级设置。</p>
        </div>
        <span className="pill-btn !border-cyan-300/35 !text-cyan-100">价格输入</span>
      </div>

      <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs">
        <p className="text-cyan-200">快捷抓价（全局热键：自动截屏并完成 OCR 与导入）</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.55fr)_minmax(0,0.8fr)_auto_auto_auto]">
          <input
            className="min-w-0 px-3 py-2 text-xs"
            value={ocrCaptureDelayMs}
            onChange={(event) => setOcrCaptureDelayMs(event.target.value)}
            disabled={busy}
            placeholder="截屏延迟毫秒（建议 300~1000）"
          />
          <input
            className="min-w-0 px-3 py-2 text-xs"
            value={ocrHotkeyShortcut}
            onChange={(event) => setOcrHotkeyShortcut(event.target.value)}
            disabled={busy}
            placeholder="快捷键（Windows 建议 Shift+F1）"
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
        <p className="mt-1 text-[11px] text-slate-400">`1200` 表示按下热键后先等待 `1.2` 秒再截图；想提速可先试 `300~800`。</p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <div className="data-pill">状态: {ocrHotkeyState?.enabled ? (ocrHotkeyState.registered ? "已启用" : "注册失败") : "未启用"}</div>
          <div className="data-pill">快捷键: {ocrHotkeyState?.shortcut ?? "--"}</div>
          <div className="data-pill">延迟: {ocrCaptureDelayMs || "--"} ms</div>
          <div className="data-pill">巡航: {ocrAutoRunState?.enabled ? (ocrAutoRunState.running ? "执行中" : "运行中") : "未启动"}</div>
          <div className="data-pill">
            上次识别:{" "}
            {ocrHotkeyLastResult?.expectedLineCount && ocrHotkeyLastResult.expectedLineCount > 0
              ? `${ocrHotkeyLastResult.extractedLineCount}/${ocrHotkeyLastResult.expectedLineCount}`
              : (ocrHotkeyLastResult?.extractedLineCount ?? 0)}
          </div>
          <div className="data-pill">上次导入: {ocrHotkeyLastResult?.importedCount ?? 0}</div>
          <div className="data-pill">未匹配: {ocrHotkeyLastResult?.unknownItemCount ?? 0}</div>
          <div className="data-pill">警告: {ocrHotkeyLastResult?.warnings.length ?? 0}</div>
        </div>
        {ocrHotkeyLastResult ? (
          <p className={`mt-2 ${ocrHotkeyLastResult.success ? "text-emerald-300" : "text-rose-300"}`}>{ocrHotkeyLastResult.message}</p>
        ) : null}
      </div>

      <details className="group mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-100">高级设置</p>
            <p className="mt-1 text-[11px] text-slate-400">自动巡航、调试明细、可视化校准。</p>
          </div>
          <span className="pill-btn !border-white/15 !text-slate-200 group-open:!border-cyan-300/35 group-open:!text-cyan-100">
            <span className="group-open:hidden">展开</span>
            <span className="hidden group-open:inline">收起</span>
          </span>
        </summary>

        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-2">
            <p className="text-[11px] text-cyan-200">自动巡航抓价（常驻轮询，适合你在交易行里持续滚动列表）</p>
            <p className="mt-1 text-[11px] text-slate-400">全局切换快捷键：`Shift+F2`（开始/暂停巡航）。</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,0.28fr)_minmax(0,0.24fr)_minmax(0,0.24fr)_auto_auto_auto]">
              <input
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrAutoRunIntervalSeconds}
                onChange={(event) => setOcrAutoRunIntervalSeconds(event.target.value)}
                disabled={busy}
                placeholder="抓取间隔秒（2~120）"
              />
              <input
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrAutoRunFailLimit}
                onChange={(event) => setOcrAutoRunFailLimit(event.target.value)}
                disabled={busy}
                placeholder="连续失败暂停（1~10）"
              />
              <select
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrAutoRunOverlayEnabled ? "on" : "off"}
                onChange={(event) => setOcrAutoRunOverlayEnabled(event.target.value === "on")}
                disabled={busy}
              >
                <option value="on">浮窗状态条：开启</option>
                <option value="off">浮窗状态条：关闭</option>
              </select>
              <button className="pill-btn" onClick={() => void onConfigureOcrAutoRun(ocrAutoRunState?.enabled ?? false)} disabled={busy}>
                应用设置
              </button>
              <button className="pill-btn" onClick={() => void onConfigureOcrAutoRun(true)} disabled={busy}>
                开始巡航
              </button>
              <button className="pill-btn" onClick={() => void onConfigureOcrAutoRun(false)} disabled={busy}>
                停止巡航
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              <div className="data-pill">间隔: {ocrAutoRunState?.intervalSeconds ?? "--"} s</div>
              <div className="data-pill">下一次: {ocrAutoRunCountdownSeconds === null ? "--" : `${ocrAutoRunCountdownSeconds}s`}</div>
              <div className="data-pill">浮窗: {ocrAutoRunState?.showOverlay ? "开" : "关"}</div>
              <div className="data-pill">轮次: {ocrAutoRunState?.loopCount ?? 0}</div>
              <div className="data-pill">成功: {ocrAutoRunState?.successCount ?? 0}</div>
              <div className="data-pill">失败: {ocrAutoRunState?.failureCount ?? 0}</div>
              <div className="data-pill">
                连败: {ocrAutoRunState?.consecutiveFailureCount ?? 0}/{ocrAutoRunState?.maxConsecutiveFailures ?? "--"}
              </div>
              <div className="data-pill">最近: {ocrAutoRunState?.lastResultAt ? formatDateTime(ocrAutoRunState.lastResultAt) : "--"}</div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <select
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrHideAppBeforeCapture ? "on" : "off"}
                onChange={(event) => setOcrHideAppBeforeCapture(event.target.value === "on")}
                disabled={busy}
              >
                <option value="on">截屏前自动隐藏程序</option>
                <option value="off">截屏前不隐藏程序</option>
              </select>
              <select
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrSafeMode ? "on" : "off"}
                onChange={(event) => setOcrSafeMode(event.target.value === "on")}
                disabled={busy}
              >
                <option value="on">OCR 安全模式（CPU 优先）</option>
                <option value="off">OCR 性能模式（允许非 CPU）</option>
              </select>
              <div className="data-pill">巡航快捷键: {ocrAutoRunState?.toggleShortcut ?? "Shift+F2"}</div>
            </div>
            {ocrAutoRunState?.lastMessage ? <p className="mt-2 text-[11px] text-slate-300">{ocrAutoRunState.lastMessage}</p> : null}
          </div>

          {ocrHotkeyLastResult && ocrHotkeyLastResult.warnings.length > 0 ? (
            <details className="rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
              <summary className="cursor-pointer text-[11px] text-cyan-300">查看快捷抓价警告（调试）</summary>
              <div className="mt-2 max-h-32 overflow-auto text-[11px]">
                {ocrHotkeyLastResult.warnings.slice(0, 30).map((line, index) => (
                  <p key={`ocr-hotkey-warning-${index}`}>{line}</p>
                ))}
              </div>
            </details>
          ) : null}

          {ocrHotkeyLastResult && ocrHotkeyLastResult.importedEntries.length > 0 ? (
            <details className="rounded-lg border border-white/10 bg-black/25 p-2 text-slate-300">
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

          <div className="rounded-xl border border-white/10 bg-black/25 p-2">
            <p className="text-[11px] text-slate-300">可视化校准：拖拽可重画大小；在框内拖动可平移；可见行数可自动识别（适配不同游戏 UI 大小）。</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
              <select
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrTradePresetKey}
                onChange={(event) => setOcrTradePresetKey(event.target.value as OcrTradePresetKey)}
                disabled={busy}
              >
                <option value="trade_1080p">交易行预设: 1080p</option>
                <option value="trade_1440p">交易行预设: 1440p（默认）</option>
                <option value="custom">交易行预设: 自定义</option>
              </select>
              <select
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrCalibrationTarget}
                onChange={(event) => setOcrCalibrationTarget(event.target.value as "names" | "prices")}
                disabled={busy}
              >
                <option value="names">拖拽校准目标: 名称框</option>
                <option value="prices">拖拽校准目标: 价格框</option>
              </select>
              <select
                className="min-w-0 px-3 py-2 text-xs"
                value={ocrTradeRowCount}
                onChange={(event) => setOcrTradeRowCount(event.target.value)}
                disabled={busy}
              >
                <option value="0">可见行数: 自动识别（推荐）</option>
                <option value="6">可见行数: 6</option>
                <option value="7">可见行数: 7</option>
                <option value="8">可见行数: 8</option>
                <option value="9">可见行数: 9</option>
                <option value="10">可见行数: 10</option>
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
          </div>
        </div>
      </details>
    </article>
  );
}
