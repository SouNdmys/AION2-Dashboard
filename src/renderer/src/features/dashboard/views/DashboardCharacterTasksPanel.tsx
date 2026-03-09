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
        <article key={category} className="space-y-3">
          <h3 className="px-1 text-sm font-semibold tracking-wide text-slate-200">{category}任务</h3>
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
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

              return (
                <div
                  key={task.id}
                  className="glass-panel rounded-2xl p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{task.title}</h3>
                      <p className="mt-1 text-xs text-slate-300">{task.description}</p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs">
                      剩余 {getTaskProgressText(selected, task, state.settings)}
                    </span>
                  </div>

                  <div className="mb-3 text-xs text-slate-300">
                    消耗: {task.energyCost} 奥德 {goldReward > 0 ? `| 金币收益 ${toGoldText(goldReward)}` : ""}
                    {extraLimitText ? ` | ${extraLimitText}` : ""}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {showSetCompletedOnly ? (
                      <button className="task-btn task-btn-soft w-full" onClick={() => onOpenSetCompletedDialog(task)} disabled={busy}>
                        输入已完成次数
                      </button>
                    ) : null}
                    {canComplete ? (
                      <button className="task-btn task-btn-soft min-w-[120px] flex-1" onClick={() => onOpenCompleteDialog(task.id, task.title)} disabled={busy}>
                        完成次数
                      </button>
                    ) : null}
                    {showTicket ? (
                      <button className="task-btn task-btn-soft min-w-[120px] flex-1" onClick={() => onOpenUseTicketDialog(task.id, task.title)} disabled={busy}>
                        挑战券增加次数
                      </button>
                    ) : null}
                    {showManualEdit ? (
                      <button
                        className="task-btn task-btn-soft min-w-[120px] flex-1"
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
              );
            })}
            {category === "副本" && sanctumRaidTask && sanctumBoxTask ? (
              <div className="glass-panel col-span-2 rounded-2xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold">圣域</h3>
                  <button className="pill-btn" onClick={onOpenSanctumEditDialog} disabled={busy}>
                    手动设定
                  </button>
                </div>
                <p className="text-xs text-slate-300">
                  挑战剩余 {selected.activities.sanctumRaidRemaining}/4，开箱剩余 {selected.activities.sanctumBoxRemaining}/2
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="task-btn task-btn-soft" onClick={() => onOpenCompleteDialog("sanctum_raid", "圣域挑战")} disabled={busy}>
                    填写挑战完成次数
                  </button>
                  <button className="task-btn task-btn-soft" onClick={() => onOpenCompleteDialog("sanctum_box", "圣域开箱")} disabled={busy}>
                    填写开箱完成次数(80奥德)
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </>
  );
}

