import type { OperationLogEntry } from "../../../../../shared/types";
import type { DashboardMode, PriorityTodoItem, ViewMode } from "../dashboard-types";
import { formatDateTime, formatDuration, getPriorityToneClass } from "../dashboard-utils";

interface CountdownItem {
  key: string;
  title: string;
  target: Date | null;
}

interface DashboardCountdownPanelProps {
  visible: boolean;
  countdownItems: CountdownItem[];
  nowMs: number;
}

export function DashboardCountdownPanel(props: DashboardCountdownPanelProps): JSX.Element | null {
  const { visible, countdownItems, nowMs } = props;
  if (!visible) {
    return null;
  }

  return (
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <h3 className="text-sm font-semibold tracking-wide">下一次恢复倒计时</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {countdownItems.map((item) => {
          const remain = item.target ? Math.max(0, item.target.getTime() - nowMs) : null;
          return (
            <div key={item.key} className="data-pill">
              <p className="text-xs text-slate-300">{item.title}</p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">{remain === null ? "--:--:--" : formatDuration(remain)}</p>
              <p className="mt-1 text-xs text-slate-400">{item.target ? formatDateTime(item.target) : "未设置"}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

interface DashboardPriorityTodoPanelProps {
  visible: boolean;
  priorityTodoItems: PriorityTodoItem[];
}

export function DashboardPriorityTodoPanel(props: DashboardPriorityTodoPanelProps): JSX.Element | null {
  const { visible, priorityTodoItems } = props;
  if (!visible) {
    return null;
  }

  return (
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <h3 className="text-sm font-semibold tracking-wide">优先级待办</h3>
      <p className="mt-2 text-xs text-slate-300">按收益、溢出风险和周刷新提醒综合排序（Top 8），可在设置页调整偏好权重。</p>
      {priorityTodoItems.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">当前没有待处理高优先任务。</p>
      ) : (
        <div className="mt-3 space-y-2">
          {priorityTodoItems.map((item) => (
            <div key={item.id} className="data-pill">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getPriorityToneClass(item.tone)}`}>
                  {item.tone === "high" ? "高" : item.tone === "medium" ? "中" : "低"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

interface DashboardHistoryPanelProps {
  visible: boolean;
  historyRows: OperationLogEntry[];
  characterNameById: Map<string, string>;
}

export function DashboardHistoryPanel(props: DashboardHistoryPanelProps): JSX.Element | null {
  const { visible, historyRows, characterNameById } = props;
  if (!visible) {
    return null;
  }

  return (
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <h3 className="text-sm font-semibold tracking-wide">操作历史日志</h3>
      <p className="mt-2 text-xs text-slate-300">显示最近 20 条（最新在前）。</p>
      {historyRows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">暂无操作记录。</p>
      ) : (
        <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
          {historyRows.map((entry) => {
            const charName =
              entry.characterId === null ? "全局" : characterNameById.get(entry.characterId) ?? `角色(${entry.characterId.slice(0, 6)})`;
            return (
              <div key={entry.id} className="data-pill">
                <p className="text-xs text-slate-400">{new Date(entry.at).toLocaleString()}</p>
                <p className="mt-1 text-sm">
                  [{charName}] {entry.action}
                </p>
                {entry.description ? <p className="mt-1 text-xs text-slate-300">{entry.description}</p> : null}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

interface DashboardPendingPanelProps {
  viewMode: ViewMode;
  dashboardMode: DashboardMode;
  pendingLabels: string[];
}

export function DashboardPendingPanel(props: DashboardPendingPanelProps): JSX.Element | null {
  const { viewMode, dashboardMode, pendingLabels } = props;
  if (viewMode !== "dashboard" || dashboardMode !== "character") {
    return null;
  }

  return (
    <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
      <h3 className="text-sm font-semibold tracking-wide">待办提醒</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {pendingLabels.map((label) => (
          <span key={label} className="rounded-full border border-orange-200/25 bg-orange-100/10 px-3 py-1 text-xs">
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}
