import type { Dispatch, SetStateAction } from "react";
import type { WorkshopOcrHotkeyRunResult, WorkshopPriceHistoryResult, WorkshopPriceMarket, WorkshopPriceSignalResult, WorkshopPriceSignalRow } from "../../../../../shared/types";
import {
  formatDateLabel,
  formatDateTime,
  formatGold,
  formatMarketLabel,
  HISTORY_QUICK_DAY_OPTIONS,
  toPercent,
  toSignedPercent,
  trendTagLabel,
  weekdayLabel,
  type ClassifiedItemOption,
  type DualHistoryChartModel,
  type HistoryInsightModel,
} from "../workshop-view-helpers";

interface WorkshopMarketAnalysisPanelProps {
  busy: boolean;
  historyMainCategory: string;
  setHistoryMainCategory: (value: string) => void;
  historyMainCategoryOptions: string[];
  historySubCategory: "all" | string;
  setHistorySubCategory: (value: "all" | string) => void;
  historySubCategoryOptions: string[];
  historyKeyword: string;
  setHistoryKeyword: (value: string) => void;
  historyItemId: string;
  setHistoryItemId: (value: string) => void;
  filteredHistoryItems: ClassifiedItemOption[];
  historyDaysInput: string;
  setHistoryDaysInput: (value: string) => void;
  onJumpHistoryManagerForCurrentItem: () => void;
  onToggleStarItem: (itemId: string) => void;
  isStarredItem: (itemId: string) => boolean;
  focusStarOnly: boolean;
  setFocusStarOnly: Dispatch<SetStateAction<boolean>>;
  starredHistoryItems: ClassifiedItemOption[];
  onViewHistoryCurveForItem: (itemId: string, options?: { scroll?: boolean; market?: WorkshopPriceMarket }) => void;
  historyIncludeSuspect: boolean;
  setHistoryIncludeSuspect: Dispatch<SetStateAction<boolean>>;
  activeHistoryQuickDays: number | null;
  recentOcrImportedEntries: WorkshopOcrHotkeyRunResult["importedEntries"];
  historyChartAnchorRef: { current: HTMLDivElement | null };
  historyLoading: boolean;
  historyHasLoaded: boolean;
  historyServerResult: WorkshopPriceHistoryResult | null;
  historyWorldResult: WorkshopPriceHistoryResult | null;
  historyMarketPanels: Array<{
    market: "server" | "world";
    title: string;
    result: WorkshopPriceHistoryResult | null;
    insight: HistoryInsightModel | null;
    colorClass: string;
    borderClass: string;
  }>;
  dualHistoryChartModel: DualHistoryChartModel | null;
  onJumpHistoryManagerForSnapshot: (snapshotId: string, capturedAt: string) => void;
  signalRuleEnabled: boolean;
  setSignalRuleEnabled: Dispatch<SetStateAction<boolean>>;
  signalLookbackDaysInput: string;
  setSignalLookbackDaysInput: (value: string) => void;
  signalThresholdPercentInput: string;
  setSignalThresholdPercentInput: (value: string) => void;
  onSaveSignalRule: () => Promise<void>;
  onRefreshSignals: () => Promise<void>;
  signalResult: WorkshopPriceSignalResult | null;
  triggeredSignalRows: WorkshopPriceSignalRow[];
  buyZoneRows: WorkshopPriceSignalRow[];
  sellZoneRows: WorkshopPriceSignalRow[];
}

export function WorkshopMarketAnalysisPanel(props: WorkshopMarketAnalysisPanelProps): JSX.Element {
  const {
    busy,
    historyMainCategory,
    setHistoryMainCategory,
    historyMainCategoryOptions,
    historySubCategory,
    setHistorySubCategory,
    historySubCategoryOptions,
    historyKeyword,
    setHistoryKeyword,
    historyItemId,
    setHistoryItemId,
    filteredHistoryItems,
    historyDaysInput,
    setHistoryDaysInput,
    onJumpHistoryManagerForCurrentItem,
    onToggleStarItem,
    isStarredItem,
    focusStarOnly,
    setFocusStarOnly,
    starredHistoryItems,
    onViewHistoryCurveForItem,
    historyIncludeSuspect,
    setHistoryIncludeSuspect,
    activeHistoryQuickDays,
    recentOcrImportedEntries,
    historyChartAnchorRef,
    historyLoading,
    historyHasLoaded,
    historyServerResult,
    historyWorldResult,
    historyMarketPanels,
    dualHistoryChartModel,
    onJumpHistoryManagerForSnapshot,
    signalRuleEnabled,
    setSignalRuleEnabled,
    signalLookbackDaysInput,
    setSignalLookbackDaysInput,
    signalThresholdPercentInput,
    setSignalThresholdPercentInput,
    onSaveSignalRule,
    onRefreshSignals,
    signalResult,
    triggeredSignalRows,
    buyZoneRows,
    sellZoneRows,
  } = props;

  return (
    <article className="order-3 glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">市场分析器</h4>
          <p className="mt-1 text-xs text-slate-300">默认只显示当前物品的近期价格和结论，筛选器、曲线和信号细节按需展开。</p>
        </div>
        <span className="pill-btn !border-cyan-300/35 !text-cyan-100">同步联动</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.6fr)_auto_auto]">
          <select
            className="min-w-0 px-3 py-2 text-sm"
            value={historyItemId}
            onChange={(event) => setHistoryItemId(event.target.value)}
            disabled={busy || filteredHistoryItems.length === 0}
          >
            {filteredHistoryItems.map((item) => (
              <option key={`history-item-${item.id}`} value={item.id}>
                {isStarredItem(item.id) ? "★ " : ""}[{item.subCategory}] {item.name}
              </option>
            ))}
          </select>
          <input
            className="min-w-0 px-3 py-2 text-sm"
            value={historyDaysInput}
            onChange={(event) => setHistoryDaysInput(event.target.value)}
            disabled={busy}
            placeholder="查询天数（如 30）"
          />
          <button className="pill-btn whitespace-nowrap" onClick={onJumpHistoryManagerForCurrentItem} disabled={busy || !historyItemId}>
            管理历史价格
          </button>
          <button className="pill-btn whitespace-nowrap" onClick={() => onToggleStarItem(historyItemId)} disabled={busy || !historyItemId}>
            {historyItemId && isStarredItem(historyItemId) ? "★ 取消星标" : "☆ 星标关注"}
          </button>
        </div>
      {filteredHistoryItems.length === 0 ? <p className="mt-2 text-xs text-amber-300">当前搜索条件下没有可查询物品。</p> : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="data-pill">伺服器最新: {formatGold(historyServerResult?.latestPrice ?? null)}</div>
        <div className="data-pill">世界最新: {formatGold(historyWorldResult?.latestPrice ?? null)}</div>
        <div className="data-pill text-emerald-300">进货点: {signalResult?.buyZoneCount ?? 0}</div>
        <div className="data-pill text-amber-300">出货点: {signalResult?.sellZoneCount ?? 0}</div>
      </div>
      {historyHasLoaded ? (
        <p className="mt-2 text-xs text-slate-300">
          当前查询区间内，伺服器样本 {historyServerResult?.sampleCount ?? 0} 条，世界样本 {historyWorldResult?.sampleCount ?? 0} 条。
          {signalResult?.triggeredCount ? ` 已触发 ${signalResult.triggeredCount} 条周期信号。` : " 当前没有触发中的周期信号。"}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-300">先选物品，系统会自动同步最近价格、历史样本和周期信号。</p>
      )}

      <details className="group mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-100">高级筛选与细节</p>
            <p className="mt-1 text-[11px] text-slate-400">分类筛选、星标过滤、价格曲线、信号列表。</p>
          </div>
          <span className="pill-btn !border-white/15 !text-slate-200 group-open:!border-cyan-300/35 group-open:!text-cyan-100">
            <span className="group-open:hidden">展开</span>
            <span className="hidden group-open:inline">收起</span>
          </span>
        </summary>

        <div className="mt-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <select
              className="min-w-0 px-3 py-2 text-sm"
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
              className="min-w-0 px-3 py-2 text-sm"
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
              className="min-w-0 px-3 py-2 text-sm"
              value={historyKeyword}
              onChange={(event) => setHistoryKeyword(event.target.value)}
              disabled={busy}
              placeholder="搜索物品（全物品范围）"
            />
          </div>
          {historyKeyword.trim() ? (
            <p className="mt-1 text-[11px] text-cyan-200">关键词搜索已切换为全物品范围（忽略大类/下级分类）。</p>
          ) : null}

          {starredHistoryItems.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="text-amber-200">重点关注:</span>
              {starredHistoryItems.slice(0, 12).map((item) => (
                <button
                  key={`star-item-chip-${item.id}`}
                  className="pill-btn !border-amber-300/40 !text-amber-200"
                  onClick={() => onViewHistoryCurveForItem(item.id, { scroll: false })}
                >
                  ★ {item.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className={`pill-btn whitespace-nowrap ${focusStarOnly ? "!border-amber-300/60 !text-amber-200" : ""}`}
              onClick={() => setFocusStarOnly((prev) => !prev)}
            >
              {focusStarOnly ? "仅看星标: 开" : "仅看星标: 关"}
            </button>
            <button
              className={`pill-btn whitespace-nowrap ${historyIncludeSuspect ? "!border-rose-300/70 !text-rose-200" : "!border-emerald-300/50 !text-emerald-200"}`}
              onClick={() => setHistoryIncludeSuspect((prev) => !prev)}
              disabled={busy || !historyItemId}
            >
              {historyIncludeSuspect ? "可疑点: 已包含" : "可疑点: 已过滤"}
            </button>
            {HISTORY_QUICK_DAY_OPTIONS.map((days) => {
              const active = activeHistoryQuickDays === days;
              return (
                <button
                  key={`history-quick-${days}`}
                  className={`pill-btn ${active ? "!border-cyan-300/60 !bg-cyan-300/20 !text-cyan-100" : ""}`}
                  onClick={() => {
                    setHistoryDaysInput(String(days));
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
                    <th className="px-2 py-1">市场</th>
                    <th className="px-2 py-1">价格</th>
                    <th className="px-2 py-1">时间</th>
                    <th className="px-2 py-1">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOcrImportedEntries.map((entry, index) => (
                    <tr key={`recent-ocr-import-${entry.itemId}-${entry.lineNumber}-${index}`} className="border-t border-white/10">
                      <td className="px-2 py-1">{entry.itemName}</td>
                      <td className="px-2 py-1">{formatMarketLabel(entry.market)}</td>
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

        <div ref={historyChartAnchorRef} className="relative mt-3 min-h-[780px]">
          {historyLoading ? (
            <div className="pointer-events-none absolute right-0 top-0 z-10 rounded-md border border-cyan-300/30 bg-cyan-500/15 px-2 py-1 text-[11px] text-cyan-200">
              更新中...
            </div>
          ) : null}
          {historyHasLoaded ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div className="data-pill">伺服器样本: {historyServerResult?.sampleCount ?? 0}</div>
                <div className="data-pill">伺服器可疑: {historyServerResult?.suspectCount ?? 0}</div>
                <div className="data-pill">世界样本: {historyWorldResult?.sampleCount ?? 0}</div>
                <div className="data-pill">世界可疑: {historyWorldResult?.suspectCount ?? 0}</div>
              </div>

              {dualHistoryChartModel ? (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/25 p-3">
                  <svg viewBox={`0 0 ${dualHistoryChartModel.width} ${dualHistoryChartModel.height}`} className="h-[320px] w-full min-w-[760px]">
                    {dualHistoryChartModel.yTicks.map((tick) => (
                      <g key={`dual-history-y-${tick.y}`}>
                        <line
                          x1={dualHistoryChartModel.left}
                          y1={tick.y}
                          x2={dualHistoryChartModel.width - dualHistoryChartModel.right}
                          y2={tick.y}
                          stroke="rgba(148,163,184,0.2)"
                          strokeWidth="1"
                        />
                        <text x={dualHistoryChartModel.left - 8} y={tick.y + 4} textAnchor="end" fill="#cbd5e1" fontSize="11">
                          {formatGold(tick.value)}
                        </text>
                      </g>
                    ))}
                    {dualHistoryChartModel.wednesdayMarkers.map((marker) => (
                      <line
                        key={`dual-history-wed-${marker.date}`}
                        x1={marker.x}
                        y1={dualHistoryChartModel.top}
                        x2={marker.x}
                        y2={dualHistoryChartModel.height - dualHistoryChartModel.bottom}
                        stroke="rgba(251,191,36,0.35)"
                        strokeDasharray="5 5"
                        strokeWidth="1"
                      />
                    ))}
                    <line
                      x1={dualHistoryChartModel.left}
                      y1={dualHistoryChartModel.height - dualHistoryChartModel.bottom}
                      x2={dualHistoryChartModel.width - dualHistoryChartModel.right}
                      y2={dualHistoryChartModel.height - dualHistoryChartModel.bottom}
                      stroke="rgba(148,163,184,0.55)"
                      strokeWidth="1.1"
                    />
                    {dualHistoryChartModel.serverPricePath ? (
                      <path d={dualHistoryChartModel.serverPricePath} fill="none" stroke="#22d3ee" strokeWidth="2.3" />
                    ) : null}
                    {dualHistoryChartModel.worldPricePath ? (
                      <path d={dualHistoryChartModel.worldPricePath} fill="none" stroke="#34d399" strokeWidth="2.3" />
                    ) : null}
                    {dualHistoryChartModel.serverPoints.map((point) => (
                      <circle
                        key={`dual-history-server-${point.id}`}
                        cx={point.x}
                        cy={point.y}
                        r={point.isSuspect ? "3.8" : "2.8"}
                        fill={point.isSuspect ? "#fb7185" : "#22d3ee"}
                        fillOpacity={point.isSuspect ? 0.95 : 0.72}
                        className="cursor-pointer"
                        onClick={() => onJumpHistoryManagerForSnapshot(point.id, point.capturedAt)}
                      >
                        <title>
                          {`${formatDateTime(point.capturedAt)} | ${formatGold(point.unitPrice)} | 伺服器${point.suspectReason ? ` | ${point.suspectReason}` : ""}`}
                        </title>
                      </circle>
                    ))}
                    {dualHistoryChartModel.worldPoints.map((point) => (
                      <circle
                        key={`dual-history-world-${point.id}`}
                        cx={point.x}
                        cy={point.y}
                        r={point.isSuspect ? "3.8" : "2.8"}
                        fill={point.isSuspect ? "#fb7185" : "#34d399"}
                        fillOpacity={point.isSuspect ? 0.95 : 0.72}
                        className="cursor-pointer"
                        onClick={() => onJumpHistoryManagerForSnapshot(point.id, point.capturedAt)}
                      >
                        <title>
                          {`${formatDateTime(point.capturedAt)} | ${formatGold(point.unitPrice)} | 世界${point.suspectReason ? ` | ${point.suspectReason}` : ""}`}
                        </title>
                      </circle>
                    ))}
                    {dualHistoryChartModel.latestServerPoint ? (
                      <circle
                        cx={dualHistoryChartModel.latestServerPoint.x}
                        cy={dualHistoryChartModel.latestServerPoint.y}
                        r="4.2"
                        fill="#22d3ee"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1.2"
                      />
                    ) : null}
                    {dualHistoryChartModel.latestWorldPoint ? (
                      <circle
                        cx={dualHistoryChartModel.latestWorldPoint.x}
                        cy={dualHistoryChartModel.latestWorldPoint.y}
                        r="4.2"
                        fill="#34d399"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth="1.2"
                      />
                    ) : null}
                    {dualHistoryChartModel.xTicks.map((tick) => (
                      <text key={`dual-history-x-${tick.x}`} x={tick.x} y={dualHistoryChartModel.height - 8} textAnchor="middle" fill="#cbd5e1" fontSize="11">
                        {tick.label}
                      </text>
                    ))}
                  </svg>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-300">
                    <span>青线: 伺服器价格曲线</span>
                    <span>绿线: 世界价格曲线</span>
                    <span>黄虚线: 周三重置日</span>
                    <span>红点: 可疑价（点击点位可直达历史管理）</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-300">当前区间没有价格样本，无法绘制曲线。</p>
              )}

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {historyMarketPanels.map((panel) => {
                  const result = panel.result;
                  const insight = panel.insight;
                  return (
                    <div key={`history-panel-${panel.market}`} className={`rounded-xl border p-3 text-xs ${panel.borderClass}`}>
                      <p className={`text-sm ${panel.colorClass}`}>{panel.title}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-7">
                        <div className="data-pill">样本数: {result?.sampleCount ?? 0}</div>
                        <div className="data-pill">
                          可疑点: {result?.suspectCount ?? 0}
                          {historyIncludeSuspect ? "（已包含）" : "（已过滤）"}
                        </div>
                        <div className="data-pill">最新价: {formatGold(result?.latestPrice ?? null)}</div>
                        <div className="data-pill">区间均价: {formatGold(result?.averagePrice ?? null)}</div>
                        <div className="data-pill">MA7(最新): {formatGold(result?.ma7Latest ?? null)}</div>
                        <div
                          className={`data-pill ${
                            insight?.deviationFromWeekday !== null && insight?.deviationFromWeekday !== undefined
                              ? insight.deviationFromWeekday <= 0
                                ? "text-emerald-300"
                                : "text-rose-300"
                              : ""
                          }`}
                        >
                          周内均价偏离: {toSignedPercent(insight?.deviationFromWeekday ?? null)}
                        </div>
                        <div className="data-pill">
                          最新时间: {result?.latestCapturedAt ? new Date(result.latestCapturedAt).toLocaleString() : "--"}
                        </div>
                      </div>

                      {result && result.suspectPoints.length > 0 ? (
                        <div className="mt-2 rounded-xl border border-rose-300/30 bg-rose-500/10 p-2 text-xs">
                          <p className="text-rose-200">检测到可疑价格点（{result.suspectPoints.length}）</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {result.suspectPoints.slice(0, 10).map((point) => (
                              <button
                                key={`history-suspect-${panel.market}-${point.id}`}
                                className="pill-btn !border-rose-300/50 !text-rose-200"
                                onClick={() => onJumpHistoryManagerForSnapshot(point.id, point.capturedAt)}
                                title={point.suspectReason ?? "可疑价格"}
                              >
                                {formatDateLabel(point.capturedAt)} {formatGold(point.unitPrice)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-7">
                        {(result?.weekdayAverages ?? []).map((entry) => (
                          <div key={`weekday-avg-${panel.market}-${entry.weekday}`} className="data-pill">
                            {weekdayLabel(entry.weekday)}: {formatGold(entry.averagePrice)} ({entry.sampleCount})
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
              <p className="text-slate-200">周期性波动提示</p>
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
                  placeholder="触发阈值%（建议 >=15）"
                />
                <button className="task-btn px-4" onClick={() => void onSaveSignalRule()} disabled={busy}>
                  保存规则
                </button>
                <button className="pill-btn" onClick={() => void onRefreshSignals()} disabled={busy}>
                  刷新信号
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-7">
                <div className="data-pill">规则状态: {signalResult?.ruleEnabled ? "开启" : "关闭"}</div>
                <div className="data-pill">分析天数: {signalResult?.lookbackDays ?? "--"}</div>
                <div className="data-pill">阈值(输入): {toPercent(signalResult ? signalResult.thresholdRatio : null)}</div>
                <div className="data-pill">阈值(生效): {toPercent(signalResult ? signalResult.effectiveThresholdRatio : null)}</div>
                <div className="data-pill">触发数: {signalResult?.triggeredCount ?? 0}</div>
                <div className="data-pill text-emerald-300">进货点: {signalResult?.buyZoneCount ?? 0}</div>
                <div className="data-pill text-amber-300">出货点: {signalResult?.sellZoneCount ?? 0}</div>
              </div>

              {signalResult ? (
                triggeredSignalRows.length > 0 ? (
                  <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/30 p-2">
                    {triggeredSignalRows.slice(0, 20).map((row) => (
                      <div
                        key={`signal-${row.itemId}-${row.market ?? "single"}`}
                        className={`mb-2 rounded-lg border bg-emerald-500/10 p-2 ${
                          isStarredItem(row.itemId) ? "border-amber-300/60 ring-1 ring-amber-300/40" : "border-emerald-200/30"
                        }`}
                      >
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-9">
                          <div className="data-pill">物品: {row.itemName}</div>
                          <div className="data-pill">市场: {formatMarketLabel(row.market)}</div>
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
                          <div className="data-pill text-amber-200">置信分: {row.confidenceScore}</div>
                        </div>
                        {row.reasons.length > 0 ? <p className="mt-2 text-[11px] text-slate-300">判定依据: {row.reasons.join(" | ")}</p> : null}
                        <p className="mt-2 text-slate-300">
                          最新采样: {row.latestCapturedAt ? new Date(row.latestCapturedAt).toLocaleString() : "--"}，样本数:{" "}
                          {row.sampleCount}
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button className="pill-btn !border-amber-300/40 !text-amber-200" onClick={() => onToggleStarItem(row.itemId)} disabled={busy}>
                            {isStarredItem(row.itemId) ? "★ 已星标" : "☆ 星标"}
                          </button>
                          <button className="pill-btn" onClick={() => onViewHistoryCurveForItem(row.itemId, { market: row.market })} disabled={busy}>
                            查看曲线
                          </button>
                        </div>
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
              {signalResult ? (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 p-2">
                    <p className="text-emerald-200">进货点（低于同星期均价）</p>
                    {buyZoneRows.length > 0 ? (
                      <div className="mt-2 max-h-56 overflow-auto space-y-2">
                        {buyZoneRows.slice(0, 16).map((row) => (
                          <div
                            key={`buy-zone-${row.itemId}-${row.market ?? "single"}`}
                            className={`rounded-lg border bg-black/25 p-2 ${
                              isStarredItem(row.itemId) ? "border-amber-300/60 ring-1 ring-amber-300/40" : "border-emerald-200/20"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {row.itemName} <span className="text-slate-300">[{formatMarketLabel(row.market)}]</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span>{formatGold(row.latestPrice)}</span>
                                <button
                                  className="pill-btn !border-amber-300/40 !text-amber-200"
                                  onClick={() => onToggleStarItem(row.itemId)}
                                  disabled={busy}
                                >
                                  {isStarredItem(row.itemId) ? "★" : "☆"}
                                </button>
                                <button className="pill-btn" onClick={() => onViewHistoryCurveForItem(row.itemId, { market: row.market })} disabled={busy}>
                                  曲线
                                </button>
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-300">
                              <span>星期偏离 {toSignedPercent(row.deviationRatioFromWeekdayAverage)}</span>
                              <span>MA7偏离 {toSignedPercent(row.deviationRatioFromMa7)}</span>
                              <span>置信分 {row.confidenceScore}</span>
                              <span>样本 {row.sampleCount}</span>
                            </div>
                            {row.reasons.length > 0 ? <p className="mt-1 text-[11px] text-slate-300">依据: {row.reasons.join(" | ")}</p> : null}
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
                          <div
                            key={`sell-zone-${row.itemId}-${row.market ?? "single"}`}
                            className={`rounded-lg border bg-black/25 p-2 ${
                              isStarredItem(row.itemId) ? "border-amber-300/60 ring-1 ring-amber-300/40" : "border-amber-200/20"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {row.itemName} <span className="text-slate-300">[{formatMarketLabel(row.market)}]</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span>{formatGold(row.latestPrice)}</span>
                                <button
                                  className="pill-btn !border-amber-300/40 !text-amber-200"
                                  onClick={() => onToggleStarItem(row.itemId)}
                                  disabled={busy}
                                >
                                  {isStarredItem(row.itemId) ? "★" : "☆"}
                                </button>
                                <button className="pill-btn" onClick={() => onViewHistoryCurveForItem(row.itemId, { market: row.market })} disabled={busy}>
                                  曲线
                                </button>
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-300">
                              <span>星期偏离 {toSignedPercent(row.deviationRatioFromWeekdayAverage)}</span>
                              <span>MA7偏离 {toSignedPercent(row.deviationRatioFromMa7)}</span>
                              <span>置信分 {row.confidenceScore}</span>
                              <span>样本 {row.sampleCount}</span>
                            </div>
                            {row.reasons.length > 0 ? <p className="mt-1 text-[11px] text-slate-300">依据: {row.reasons.join(" | ")}</p> : null}
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
            <div className="flex min-h-[780px] items-center justify-center">
              <p className="text-xs text-slate-300">还没有查询结果。先选物品和天数，系统会自动查询。</p>
            </div>
          )}
        </div>
        </div>
      </details>
    </article>
  );
}
