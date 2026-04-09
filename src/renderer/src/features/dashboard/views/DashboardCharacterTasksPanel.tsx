import { getTaskGoldReward, getTaskProgressText } from "../../../../../shared/engine";
import type { AppState, CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import { toGoldText } from "../dashboard-utils";

interface DashboardCharacterTasksPanelProps {
  visible: boolean;
  busy: boolean;
  state: AppState;
  selected: CharacterState;
  groupedTasks: Record<TaskDefinition["category"], TaskDefinition[]>;
  sanctumRaidTask?: TaskDefinition;
  sanctumBoxTask?: TaskDefinition;
  onOpenSetCompletedDialog: (task: TaskDefinition) => void;
  onOpenCompleteDialog: (taskId: TaskId, title: string) => void;
  onOpenUseTicketDialog: (taskId: TaskId, title: string) => void;
  onOpenTaskEditDialog: (
    taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "daily_dungeon" | "mini_game",
  ) => void;
  onOpenSanctumEditDialog: () => void;
}

export function DashboardCharacterTasksPanel(props: DashboardCharacterTasksPanelProps): JSX.Element | null {
  const {
    visible,
    busy,
    state,
    selected,
    groupedTasks,
    sanctumRaidTask,
    sanctumBoxTask,
    onOpenSetCompletedDialog,
    onOpenCompleteDialog,
    onOpenUseTicketDialog,
    onOpenTaskEditDialog,
    onOpenSanctumEditDialog,
  } = props;
  if (!visible) {
    return null;
  }

  return (
    <>
      {(Object.keys(groupedTasks) as TaskDefinition["category"][]).map((category) => (
        <article key={category} className="task-section space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h3 className="text-sm font-semibold tracking-wide text-slate-900">{category}任务</h3>
            <div className="flex items-center gap-2">
              <span className="summary-note">
                {(groupedTasks[category] ?? []).length + (category === "副本" && sanctumRaidTask && sanctumBoxTask ? 2 : 0)} 项
              </span>
              {category === "副本" && sanctumRaidTask && sanctumBoxTask ? (
                <button className="pill-btn" onClick={onOpenSanctumEditDialog} disabled={busy}>
                  圣域设定
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {(groupedTasks[category] ?? []).map((task) => {
              const canComplete = task.allowComplete && !task.allowSetCompleted;
              const showSetCompletedOnly = task.allowSetCompleted;
              const showTicket = task.allowUseTicket;
              const showManualEdit = !task.allowSetCompleted && task.allowUseTicket;
              const goldReward = getTaskGoldReward(state.settings, task);
              const extraLimitText =
                task.id === "expedition"
                  ? `首领剩余 ${selected.activities.expeditionBossRemaining}/35`
                  : task.id === "transcendence"
                    ? `首领剩余 ${selected.activities.transcendenceBossRemaining}/28`
                    : null;
              const taskSummary = [`消耗 ${task.energyCost} 奥德`];
              if (goldReward > 0) {
                taskSummary.push(`收益 ${toGoldText(goldReward)}`);
              }
              if (extraLimitText) {
                taskSummary.push(extraLimitText);
              }

              return (
                <div key={task.id} className="task-card">
                  <div className="task-card-header">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{task.title}</h3>
                      <p className="mt-1 task-meta-line">{taskSummary.join(" · ")}</p>
                    </div>
                    <span className="task-progress-pill shrink-0">
                      剩余 {getTaskProgressText(selected, task, state.settings)}
                    </span>
                  </div>

                  <p className="task-card-note mt-2">{task.description}</p>

                  <div className="task-card-actions mt-2.5">
                    <div className="task-action-row">
                    {showSetCompletedOnly ? (
                      <button className="task-btn task-btn-soft task-btn-compact w-full" onClick={() => onOpenSetCompletedDialog(task)} disabled={busy}>
                        录入次数
                      </button>
                    ) : null}
                    {canComplete ? (
                      <button className="task-btn task-btn-soft task-btn-compact min-w-[96px] flex-1" onClick={() => onOpenCompleteDialog(task.id, task.title)} disabled={busy}>
                        完成次数
                      </button>
                    ) : null}
                    {showTicket ? (
                      <button className="task-btn task-btn-soft task-btn-compact min-w-[96px] flex-1" onClick={() => onOpenUseTicketDialog(task.id, task.title)} disabled={busy}>
                        增加券数
                      </button>
                    ) : null}
                    {showManualEdit ? (
                      <button
                        className="task-btn task-btn-soft task-btn-compact min-w-[96px] flex-1"
                        onClick={() =>
                          onOpenTaskEditDialog(
                            task.id as
                              | "expedition"
                              | "transcendence"
                              | "nightmare"
                              | "awakening"
                              | "daily_dungeon"
                              | "mini_game",
                          )
                        }
                        disabled={busy}
                      >
                        手动设定
                      </button>
                    ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {category === "副本" && sanctumRaidTask && sanctumBoxTask ? (
              <>
                <div className="task-card">
                  <div className="task-card-header">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{sanctumRaidTask.title}</h3>
                      <p className="mt-1 task-meta-line">消耗 80 奥德</p>
                    </div>
                    <span className="task-progress-pill shrink-0">剩余 {selected.activities.sanctumRaidRemaining}/2</span>
                  </div>
                  <p className="task-card-note mt-2">{sanctumRaidTask.description}</p>
                  <div className="task-card-actions mt-2.5">
                    <div className="task-action-row">
                      <button className="task-btn task-btn-soft task-btn-compact w-full" onClick={() => onOpenCompleteDialog("sanctum_raid", sanctumRaidTask.title)} disabled={busy}>
                        圣域完成
                      </button>
                    </div>
                  </div>
                </div>
                <div className="task-card">
                  <div className="task-card-header">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{sanctumBoxTask.title}</h3>
                      <p className="mt-1 task-meta-line">消耗 80 奥德</p>
                    </div>
                    <span className="task-progress-pill shrink-0">剩余 {selected.activities.sanctumBoxRemaining}/2</span>
                  </div>
                  <p className="task-card-note mt-2">{sanctumBoxTask.description}</p>
                  <div className="task-card-actions mt-2.5">
                    <div className="task-action-row">
                      <button className="task-btn task-btn-soft task-btn-compact w-full" onClick={() => onOpenCompleteDialog("sanctum_box", sanctumBoxTask.title)} disabled={busy}>
                        圣域完成
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </article>
      ))}
    </>
  );
}

