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
  const isOverview = viewMode === "dashboard" && dashboardMode === "overview";
  const isCharacter = viewMode === "dashboard" && dashboardMode === "character";

  return (
    <aside className="space-y-4 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-auto xl:pr-1">
      <article className="glass-panel rounded-[28px] p-4">
        <p className="panel-kicker">Ops</p>
        <h3 className="panel-title !mt-1">操作中心</h3>
        <p className="mt-2 summary-note">历史记录 {historyCount} 条，支持撤销一步/多步。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="pill-btn" onClick={onUndoSingleStep} disabled={busy || historyCount === 0}>
            撤销一步
          </button>
          <input
            className="field-control-inline w-16"
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
      <DashboardPriorityTodoPanel visible={isOverview} priorityTodoItems={priorityTodoItems} />
      <DashboardPendingPanel viewMode={viewMode} dashboardMode={dashboardMode} pendingLabels={pendingLabels} />

      {isOverview ? (
        <DashboardHistoryPanel visible={viewMode === "dashboard"} historyRows={historyRows} characterNameById={characterNameById} />
      ) : isCharacter ? (
        <details className="group">
          <summary className="details-summary soft-card px-4 py-3">
            <div>
              <p className="panel-kicker">History</p>
              <h3 className="panel-title !mt-1 !text-sm">操作历史</h3>
            </div>
            <span className="pill-btn">{historyRows.length} 条</span>
          </summary>
          <div className="mt-3">
            <DashboardHistoryPanel visible={viewMode === "dashboard"} historyRows={historyRows} characterNameById={characterNameById} />
          </div>
        </details>
      ) : null}
    </aside>
  );
}
