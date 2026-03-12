import { getTaskRemaining, getTotalEnergy } from "../../../../../shared/engine";
import type { CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import { COUNT_SELECT_MAX, type DialogState } from "../dashboard-types";
import { buildCountOptions } from "../dashboard-utils";

interface DashboardDialogModalProps {
  dialog: DialogState | null;
  busy: boolean;
  dialogError: string | null;
  selected: CharacterState;
  taskById: Map<TaskId, TaskDefinition>;
  onDialogChange: (next: DialogState) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DashboardDialogModal(props: DashboardDialogModalProps): JSX.Element | null {
  const { dialog, busy, dialogError, selected, taskById, onDialogChange, onCancel, onConfirm } = props;
  if (!dialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl p-5">
        {dialog.kind === "complete" ? (
          <>
            <h4 className="text-base font-semibold">填写完成次数 - {dialog.title}</h4>
            <p className="mt-2 text-xs text-slate-300">
              {(() => {
                const task = taskById.get(dialog.taskId);
                if (!task) return "无法读取任务上限";
                const byCount = Math.max(0, getTaskRemaining(selected, task) ?? 0);
                const byEnergy = task.energyCost > 0 ? Math.floor(getTotalEnergy(selected) / task.energyCost) : Number.MAX_SAFE_INTEGER;
                const max = Math.max(0, Math.min(byCount, byEnergy));
                return `当前最多可完成 ${max} 次`;
              })()}
            </p>
            <select
              className="mt-3 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={dialog.amount}
              onChange={(event) => onDialogChange({ ...dialog, amount: event.target.value })}
              disabled={busy}
            >
              {buildCountOptions(1, COUNT_SELECT_MAX, dialog.amount).map((value) => (
                <option key={`dialog-complete-${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {dialog.kind === "use_ticket" ? (
          <>
            <h4 className="text-base font-semibold">挑战券增加次数 - {dialog.title}</h4>
            <p className="mt-2 text-xs text-slate-300">填写本次挑战券增加数量（支持大于 1 的批量录入）。</p>
            <select
              className="mt-3 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={dialog.amount}
              onChange={(event) => onDialogChange({ ...dialog, amount: event.target.value })}
              disabled={busy}
            >
              {buildCountOptions(1, COUNT_SELECT_MAX, dialog.amount).map((value) => (
                <option key={`dialog-ticket-${value}`} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {dialog.kind === "set_completed" ? (
          <>
            <h4 className="text-base font-semibold">
              输入总完成次数 - {dialog.task.title} (0-{dialog.task.setCompletedTotal})
            </h4>
            <select
              className="mt-3 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              value={dialog.amount}
              onChange={(event) => onDialogChange({ ...dialog, amount: event.target.value })}
              disabled={busy}
            >
              {buildCountOptions(0, Math.min(COUNT_SELECT_MAX, dialog.task.setCompletedTotal ?? COUNT_SELECT_MAX), dialog.amount).map(
                (value) => (
                  <option key={`dialog-set-completed-${value}`} value={value}>
                    {value}
                  </option>
                ),
              )}
            </select>
          </>
        ) : null}

        {dialog.kind === "energy" ? (
          <>
            <h4 className="text-base font-semibold">手动调整奥德能量</h4>
            <p className="mt-2 text-xs text-slate-300">格式: 自然能量(+补充能量)/840，其中补充能量上限为 +{selected.energy.bonusCap}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                value={dialog.baseCurrent}
                onChange={(event) => onDialogChange({ ...dialog, baseCurrent: event.target.value })}
                disabled={busy}
                placeholder="基础能量"
              />
              <input
                className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                value={dialog.bonusCurrent}
                onChange={(event) => onDialogChange({ ...dialog, bonusCurrent: event.target.value })}
                disabled={busy}
                placeholder="补充能量"
              />
            </div>
          </>
        ) : null}

        {dialog.kind === "corridor_sync" ? (
          <>
            <h4 className="text-base font-semibold">同步深渊回廊上限（当前账号）</h4>
            <p className="mt-2 text-xs text-slate-300">这里录入本轮神器战后该账号角色的回廊总上限，后续角色页和总览都会按这个上限计算。</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <p className="text-xs text-slate-300">下层上限</p>
                <div className="grid grid-cols-1 gap-1">
                  <select
                    className="rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.lowerAvailable}
                    onChange={(event) => onDialogChange({ ...dialog, lowerAvailable: event.target.value })}
                    disabled={busy}
                  >
                    {Array.from({ length: 4 }, (_, i) => (
                      <option key={`d-lower-count-${i}`} value={String(i)}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-300">中层上限</p>
                <div className="grid grid-cols-1 gap-1">
                  <select
                    className="rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.middleAvailable}
                    onChange={(event) => onDialogChange({ ...dialog, middleAvailable: event.target.value })}
                    disabled={busy}
                  >
                    {Array.from({ length: 4 }, (_, i) => (
                      <option key={`d-middle-count-${i}`} value={String(i)}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {dialog.kind === "corridor_complete" ? (
          <>
            <h4 className="text-base font-semibold">录入深渊回廊完成（当前角色）</h4>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                value={dialog.lane}
                onChange={(event) => onDialogChange({ ...dialog, lane: event.target.value as "lower" | "middle" })}
                disabled={busy}
              >
                <option value="lower">下层</option>
                <option value="middle">中层</option>
              </select>
              <select
                className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                value={dialog.amount}
                onChange={(event) => onDialogChange({ ...dialog, amount: event.target.value })}
                disabled={busy}
              >
                {buildCountOptions(1, COUNT_SELECT_MAX, dialog.amount).map((value) => (
                  <option key={`dialog-corridor-complete-${value}`} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {dialog.kind === "task_edit" ? (
          <>
            <h4 className="text-base font-semibold">{dialog.title} 手动设定</h4>
            <p className="mt-2 text-xs text-slate-300">
              说明: {dialog.remainingLabel} = 系统自然次数，{dialog.bonusLabel} = 吃券额外次数
              {dialog.bossLabel ? `，${dialog.bossLabel} = 本周最终可击杀次数` : ""}
            </p>
            <div className={`mt-3 grid gap-2 ${dialog.boss !== undefined ? "grid-cols-3" : "grid-cols-2"}`}>
              <div className="space-y-1">
                <p className="text-xs text-slate-300">{dialog.remainingLabel}</p>
                <select
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={dialog.remaining}
                  onChange={(event) => onDialogChange({ ...dialog, remaining: event.target.value })}
                  disabled={busy}
                >
                  {buildCountOptions(0, COUNT_SELECT_MAX, dialog.remaining).map((value) => (
                    <option key={`dialog-task-edit-remaining-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-300">{dialog.bonusLabel}</p>
                <select
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={dialog.bonus}
                  onChange={(event) => onDialogChange({ ...dialog, bonus: event.target.value })}
                  disabled={busy}
                >
                  {buildCountOptions(0, COUNT_SELECT_MAX, dialog.bonus).map((value) => (
                    <option key={`dialog-task-edit-bonus-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              {dialog.boss !== undefined ? (
                <div className="space-y-1">
                  <p className="text-xs text-slate-300">{dialog.bossLabel}</p>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.boss}
                    onChange={(event) => onDialogChange({ ...dialog, boss: event.target.value })}
                    disabled={busy}
                  >
                    {buildCountOptions(0, COUNT_SELECT_MAX, dialog.boss).map((value) => (
                      <option key={`dialog-task-edit-boss-${value}`} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {dialog.kind === "sanctum_edit" ? (
          <>
            <h4 className="text-base font-semibold">圣域手动设定</h4>
            <p className="mt-2 text-xs text-slate-300">
              说明: 卢德莱与侵蚀净化所都按独立周本处理，两个圣域本周各剩余多少次就填多少（上限都是 2）。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                value={dialog.raidRemaining}
                onChange={(event) => onDialogChange({ ...dialog, raidRemaining: event.target.value })}
                disabled={busy}
              >
                {buildCountOptions(0, 2, dialog.raidRemaining).map((value) => (
                  <option key={`dialog-sanctum-raid-${value}`} value={value}>
                    卢德莱 {value}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                value={dialog.boxRemaining}
                onChange={(event) => onDialogChange({ ...dialog, boxRemaining: event.target.value })}
                disabled={busy}
              >
                {buildCountOptions(0, 2, dialog.boxRemaining).map((value) => (
                  <option key={`dialog-sanctum-box-${value}`} value={value}>
                    侵蚀净化所 {value}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {dialogError ? <p className="mt-3 text-xs text-red-300">{dialogError}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="task-btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button className="task-btn" onClick={onConfirm} disabled={busy}>
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

