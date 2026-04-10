import { getTaskGoldReward, getTaskProgressText } from "../../../../../shared/engine";
import type { AppState, CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import { toGoldText } from "../dashboard-utils";

interface DashboardCharacterTasksPanelProps {
  visible: boolean;
  busy: boolean;
  state: AppState;
  selected: CharacterState;
  groupedTasks: Record<TaskDefinition["category"], TaskDefinition[]>;
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
            <h3 className="task-section-title">{category}任务</h3>
            <div className="flex items-center gap-2">
              <span className="task-section-meta">
                {(groupedTasks[category] ?? []).length + (category === "副本" ? 2 : 0)} 项
              </span>
              {category === "副本" ? (
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
                      <h3 className="task-title-strong">{task.title}</h3>
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
            {category === "副本" ? (
              <>
                <div className="task-card">
                  <div className="task-card-header">
                    <div className="min-w-0">
                      <h3 className="task-title-strong">圣域：卢德莱</h3>
                      <p className="mt-1 task-meta-line">挑战 4 次 · 开箱 2 次 · 开箱消耗 80 奥德</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="task-progress-pill shrink-0">
                        挑战 {selected.activities.sanctumRaidChallengeRemaining + selected.activities.sanctumRaidChallengeBonus}/
                        {4 + selected.activities.sanctumRaidChallengeBonus}
                      </span>
                      <span className="task-progress-pill shrink-0">
                        开箱 {selected.activities.sanctumRaidBoxRemaining + selected.activities.sanctumRaidBoxBonus}/
                        {2 + selected.activities.sanctumRaidBoxBonus}
                      </span>
                    </div>
                  </div>
                  <p className="task-card-note mt-2">深渊重铸补充券会额外给卢德莱 +1 次挑战和 +1 次开箱，补充次数只会落在一个角色身上。</p>
                  <div className="task-card-actions mt-2.5">
                    <div className="task-action-row">
                      <button className="task-btn task-btn-soft task-btn-compact min-w-[112px] flex-1" onClick={() => onOpenCompleteDialog("sanctum_raid", "圣域：卢德莱（挑战）")} disabled={busy}>
                        挑战完成
                      </button>
                      <button className="task-btn task-btn-soft task-btn-compact min-w-[132px] flex-1" onClick={() => onOpenCompleteDialog("sanctum_box", "圣域：卢德莱（开箱）")} disabled={busy}>
                        开箱完成(80奥德)
                      </button>
                    </div>
                  </div>
                </div>
                <div className="task-card">
                  <div className="task-card-header">
                    <div className="min-w-0">
                      <h3 className="task-title-strong">圣域：侵蚀净化所</h3>
                      <p className="mt-1 task-meta-line">挑战 4 次 · 开箱 2 次 · 开箱消耗 80 奥德</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="task-progress-pill shrink-0">
                        挑战 {selected.activities.sanctumPurifyChallengeRemaining}/4
                      </span>
                      <span className="task-progress-pill shrink-0">
                        开箱 {selected.activities.sanctumPurifyBoxRemaining}/2
                      </span>
                    </div>
                  </div>
                  <p className="task-card-note mt-2">侵蚀净化所不吃卢德莱补充券，本周按固定挑战/开箱次数处理。</p>
                  <div className="task-card-actions mt-2.5">
                    <div className="task-action-row">
                      <button className="task-btn task-btn-soft task-btn-compact min-w-[112px] flex-1" onClick={() => onOpenCompleteDialog("sanctum_purify_raid", "圣域：侵蚀净化所（挑战）")} disabled={busy}>
                        挑战完成
                      </button>
                      <button className="task-btn task-btn-soft task-btn-compact min-w-[132px] flex-1" onClick={() => onOpenCompleteDialog("sanctum_purify_box", "圣域：侵蚀净化所（开箱）")} disabled={busy}>
                        开箱完成(80奥德)
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

