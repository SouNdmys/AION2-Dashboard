import type { OperationLogEntry } from "../../../../../shared/types";
import type { DashboardMode, PriorityTodoItem, ViewMode } from "../dashboard-types";
import { DashboardCountdownPanel, DashboardHistoryPanel, DashboardPendingPanel, DashboardPriorityTodoPanel } from "./DashboardSidebarPanels";

interface CountdownItem {
  key: string;
  title: string;
  target: Date | null;
}

interface DashboardRightSidebarProps {
  busy: boolean;
  historyCount: number;
  undoSteps: string;
  onUndoStepsChange: (value: string) => void;
  onUndoSingleStep: () => void;
  onUndoMultiStep: () => void;
  onClearHistory: () => void;
  viewMode: ViewMode;
  dashboardMode: DashboardMode;
  countdownItems: CountdownItem[];
  nowMs: number;
  priorityTodoItems: PriorityTodoItem[];
  historyRows: OperationLogEntry[];
  characterNameById: Map<string, string>;
  pendingLabels: string[];
}

export function DashboardRightSidebar(props: DashboardRightSidebarProps): JSX.Element {
  const {
    busy,
    historyCount,
    undoSteps,
    onUndoStepsChange,
    onUndoSingleStep,
    onUndoMultiStep,
    onClearHistory,
    viewMode,
    dashboardMode,
    countdownItems,
    nowMs,
    priorityTodoItems,
    historyRows,
    characterNameById,
    pendingLabels,
  } = props;

  return (
    <aside className="space-y-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-auto xl:pr-1">
      <article className="glass-panel rounded-[28px] p-5">
        <p className="panel-kicker">Ops</p>
        <h3 className="panel-title !mt-1">操作中心</h3>
        <p className="mt-2 text-xs text-slate-300">历史记录 {historyCount} 条，支持撤销一步/多步。</p>
        <div className="mt-3 flex items-center gap-2">
          <button className="pill-btn" onClick={onUndoSingleStep} disabled={busy || historyCount === 0}>
            撤销一步
          </button>
          <input
            className="w-16 rounded-xl border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
            value={undoSteps}
            onChange={(event) => onUndoStepsChange(event.target.value)}
            disabled={busy || historyCount === 0}
          />
          <button className="pill-btn" onClick={onUndoMultiStep} disabled={busy || historyCount === 0}>
            撤销多步
          </button>
          <button className="pill-btn" onClick={onClearHistory} disabled={busy || historyCount === 0}>
            清空历史
          </button>
        </div>
      </article>

      <DashboardCountdownPanel visible={viewMode === "dashboard"} countdownItems={countdownItems} nowMs={nowMs} />
      <DashboardPriorityTodoPanel visible={viewMode === "dashboard"} priorityTodoItems={priorityTodoItems} />
      <DashboardHistoryPanel visible={viewMode === "dashboard"} historyRows={historyRows} characterNameById={characterNameById} />
      <DashboardPendingPanel viewMode={viewMode} dashboardMode={dashboardMode} pendingLabels={pendingLabels} />
    </aside>
  );
}
