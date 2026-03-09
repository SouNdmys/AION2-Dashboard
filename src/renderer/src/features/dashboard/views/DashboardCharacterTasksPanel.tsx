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
    taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game",
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
            <span className="summary-note">
              {(groupedTasks[category] ?? []).length}
              {category === "副本" && sanctumRaidTask && sanctumBoxTask ? " + 圣域" : ""} 项
            </span>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{task.title}</h3>
                      <p className="mt-1 task-meta-line">{task.description}</p>
                    </div>
                    <span className="task-progress-pill shrink-0">
                      剩余 {getTaskProgressText(selected, task, state.settings)}
                    </span>
                  </div>

                  <div className="task-card-status mt-2 task-meta-line">{taskSummary.join(" | ")}</div>

                  <div className="task-card-actions mt-3">
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
                              | "suppression"
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
              <div className="task-card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">圣域</h3>
                    <p className="task-meta-line mt-1">
                      挑战剩余 {selected.activities.sanctumRaidRemaining}/4 | 开箱剩余 {selected.activities.sanctumBoxRemaining}/2
                    </p>
                  </div>
                  <button className="pill-btn" onClick={onOpenSanctumEditDialog} disabled={busy}>
                    手动设定
                  </button>
                </div>
                <div className="task-card-actions mt-3">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)]">
                    <div className="grid gap-2">
                      <button className="task-btn task-btn-soft task-btn-compact w-full" onClick={() => onOpenCompleteDialog("sanctum_raid", "圣域挑战")} disabled={busy}>
                        挑战完成
                      </button>
                      <button className="task-btn task-btn-soft task-btn-compact w-full" onClick={() => onOpenCompleteDialog("sanctum_box", "圣域开箱")} disabled={busy}>
                        开箱完成(80奥德)
                      </button>
                    </div>
                    <div className="hidden md:block" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </>
  );
}

