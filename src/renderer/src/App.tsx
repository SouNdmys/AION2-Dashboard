import { useEffect, useMemo, useState } from "react";
import { TASK_DEFINITIONS } from "../../shared/constants";
import {
  buildCharacterSummary,
  estimateCharacterGold,
  getTaskGoldReward,
  getTaskProgressText,
  getTaskRemaining,
  getTotalEnergy,
} from "../../shared/engine";
import type { AppState, TaskDefinition, TaskId } from "../../shared/types";

const numberFormatter = new Intl.NumberFormat("zh-CN");

type DialogState =
  | { kind: "complete"; taskId: TaskId; title: string; amount: string }
  | { kind: "set_completed"; task: TaskDefinition; amount: string }
  | { kind: "energy"; baseCurrent: string; bonusCurrent: string }
  | {
      kind: "task_edit";
      taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression";
      title: string;
      remainingLabel: string;
      bonusLabel: string;
      remaining: string;
      bonus: string;
      boss?: string;
      bossLabel?: string;
    }
  | { kind: "sanctum_edit"; raidRemaining: string; boxRemaining: string };

function toGoldText(value: number): string {
  return `${numberFormatter.format(value)} 金币`;
}

async function loadState(): Promise<AppState> {
  if (!window.aionApi) {
    throw new Error("Preload API unavailable: window.aionApi is undefined");
  }
  return window.aionApi.getState();
}

function toInt(raw: string): number | null {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function App(): JSX.Element {
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const next = await loadState();
        setState(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "初始化失败");
      }
    })();
  }, []);

  const selected = useMemo(() => {
    if (!state) return null;
    return state.characters.find((item) => item.id === state.selectedCharacterId) ?? state.characters[0] ?? null;
  }, [state]);

  useEffect(() => {
    setRenameName(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  const summary = useMemo(() => {
    if (!state) return [];
    return state.characters.map((item) => buildCharacterSummary(item, state.settings));
  }, [state]);

  const taskById = useMemo(() => {
    return new Map(TASK_DEFINITIONS.map((task) => [task.id, task]));
  }, []);

  const sanctumRaidTask = taskById.get("sanctum_raid");
  const sanctumBoxTask = taskById.get("sanctum_box");

  const groupedTasks = useMemo(() => {
    return TASK_DEFINITIONS.filter((task) => task.id !== "sanctum_raid" && task.id !== "sanctum_box").reduce(
      (acc, task) => {
        if (!acc[task.category]) {
          acc[task.category] = [];
        }
        acc[task.category].push(task);
        return acc;
      },
      {} as Record<TaskDefinition["category"], TaskDefinition[]>,
    );
  }, []);

  const readyCharacters = summary.filter((item) => item.canRunExpedition).length;
  const weeklyGold = summary.reduce((acc, item) => acc + item.estimatedGoldIfClearEnergy, 0);
  const pendingDaily = summary.filter((item) => item.hasDailyMissionLeft).length;
  const pendingWeekly = summary.filter((item) => item.hasWeeklyMissionLeft).length;
  const weeklyEarned = summary.reduce((acc, item) => acc + item.weeklyGoldEarned, 0);
  const weeklyExpeditionRuns = state?.characters.reduce((acc, item) => acc + item.stats.completions.expedition, 0) ?? 0;
  const weeklyTransRuns = state?.characters.reduce((acc, item) => acc + item.stats.completions.transcendence, 0) ?? 0;
  const expeditionOverRewardThreshold = weeklyExpeditionRuns > 84;

  async function sync(action: Promise<AppState>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const next = await action;
      setState(next);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败";
      setError(message);
      setDialogError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function onAddCharacter(): void {
    const name = newCharacterName.trim();
    if (!name) return;
    void sync(window.aionApi.addCharacter(name));
    setNewCharacterName("");
  }

  function onRenameCharacter(): void {
    if (!selected) return;
    const next = renameName.trim();
    if (!next) return;
    void sync(window.aionApi.renameCharacter(selected.id, next));
  }

  function onDeleteCharacter(): void {
    if (!selected) return;
    const ok = window.confirm(`确认删除角色「${selected.name}」？`);
    if (!ok) return;
    void sync(window.aionApi.deleteCharacter(selected.id));
  }

  function onSelectCharacter(characterId: string): void {
    void sync(window.aionApi.selectCharacter(characterId));
  }

  function openCompleteDialog(taskId: TaskId, title: string): void {
    setDialogError(null);
    setDialog({ kind: "complete", taskId, title, amount: "1" });
  }

  function onUseTicket(taskId: TaskId): void {
    if (!selected) return;
    void sync(window.aionApi.applyTaskAction({ characterId: selected.id, taskId, action: "use_ticket", amount: 1 }));
  }

  function openSetCompletedDialog(task: TaskDefinition): void {
    if (!task.setCompletedTotal) return;
    setDialogError(null);
    setDialog({ kind: "set_completed", task, amount: "0" });
  }

  function openEnergyDialog(): void {
    if (!selected) return;
    setDialogError(null);
    setDialog({
      kind: "energy",
      baseCurrent: String(selected.energy.baseCurrent),
      bonusCurrent: String(selected.energy.bonusCurrent),
    });
  }

  function openTaskEditDialog(taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression"): void {
    if (!selected) return;
    setDialogError(null);
    if (taskId === "expedition") {
      setDialog({
        kind: "task_edit",
        taskId,
        title: "远征副本",
        remainingLabel: "基础次数",
        bonusLabel: "券次数",
        remaining: String(selected.activities.expeditionRemaining),
        bonus: String(selected.activities.expeditionTicketBonus),
        boss: String(selected.activities.expeditionBossRemaining),
        bossLabel: "首领次数",
      });
      return;
    }
    if (taskId === "transcendence") {
      setDialog({
        kind: "task_edit",
        taskId,
        title: "超越副本",
        remainingLabel: "基础次数",
        bonusLabel: "券次数",
        remaining: String(selected.activities.transcendenceRemaining),
        bonus: String(selected.activities.transcendenceTicketBonus),
        boss: String(selected.activities.transcendenceBossRemaining),
        bossLabel: "首领次数",
      });
      return;
    }
    if (taskId === "nightmare") {
      setDialog({
        kind: "task_edit",
        taskId,
        title: "恶梦",
        remainingLabel: "基础次数",
        bonusLabel: "券次数",
        remaining: String(selected.activities.nightmareRemaining),
        bonus: String(selected.activities.nightmareTicketBonus),
      });
      return;
    }
    if (taskId === "awakening") {
      setDialog({
        kind: "task_edit",
        taskId,
        title: "觉醒战",
        remainingLabel: "基础次数",
        bonusLabel: "券次数",
        remaining: String(selected.activities.awakeningRemaining),
        bonus: String(selected.activities.awakeningTicketBonus),
      });
      return;
    }
    setDialog({
      kind: "task_edit",
      taskId,
      title: "讨伐战",
      remainingLabel: "基础次数",
      bonusLabel: "券次数",
      remaining: String(selected.activities.suppressionRemaining),
      bonus: String(selected.activities.suppressionTicketBonus),
    });
  }

  function openSanctumEditDialog(): void {
    if (!selected) return;
    setDialogError(null);
    setDialog({
      kind: "sanctum_edit",
      raidRemaining: String(selected.activities.sanctumRaidRemaining),
      boxRemaining: String(selected.activities.sanctumBoxRemaining),
    });
  }

  function onUpdateArtifact(): void {
    if (!selected) return;
    const rawCount = window.prompt("可刷神器数量", String(selected.activities.artifactAvailable));
    if (rawCount === null) return;
    const count = Number(rawCount);
    if (Number.isNaN(count)) return;
    const rawNext = window.prompt("下次神器时间(ISO，可空)", selected.activities.artifactNextAt ?? "");
    const nextAt = rawNext?.trim() ? rawNext.trim() : null;
    void sync(window.aionApi.updateArtifactStatus(selected.id, count, nextAt));
  }

  function onResetWeeklyStats(): void {
    const ok = window.confirm("确认重置本周收益统计？仅重置统计，不影响任务进度。");
    if (!ok) return;
    void sync(window.aionApi.resetWeeklyStats());
  }

  function onConfirmDialog(): void {
    if (!selected || !dialog) return;

    void (async () => {
      if (dialog.kind === "complete") {
        const task = taskById.get(dialog.taskId);
        const requested = toInt(dialog.amount);
        if (!task || requested === null || requested <= 0) {
          setDialogError("请输入有效的完成次数");
          return;
        }
        const ok = await sync(
          window.aionApi.applyTaskAction({
            characterId: selected.id,
            taskId: dialog.taskId,
            action: "complete_once",
            amount: requested,
          }),
        );
        if (ok) {
          setDialog(null);
          setDialogError(null);
        }
        return;
      }

      if (dialog.kind === "set_completed") {
        const amount = toInt(dialog.amount);
        if (amount === null || amount < 0) {
          setDialogError("请输入有效的已完成次数");
          return;
        }
        const capped = Math.min(amount, dialog.task.setCompletedTotal ?? 0);
        const ok = await sync(
          window.aionApi.applyTaskAction({
            characterId: selected.id,
            taskId: dialog.task.id,
            action: "set_completed",
            amount: capped,
          }),
        );
        if (ok) {
          setDialog(null);
          setDialogError(null);
        }
        return;
      }

      if (dialog.kind === "energy") {
        const base = toInt(dialog.baseCurrent);
        const bonus = toInt(dialog.bonusCurrent);
        if (base === null || bonus === null || base < 0 || bonus < 0) {
          setDialogError("请输入有效的能量数值");
          return;
        }
        const ok = await sync(window.aionApi.updateEnergySegments(selected.id, base, bonus));
        if (ok) {
          setDialog(null);
          setDialogError(null);
        }
        return;
      }

      if (dialog.kind === "task_edit") {
        const remaining = toInt(dialog.remaining);
        const bonus = toInt(dialog.bonus);
        const boss = dialog.boss !== undefined ? toInt(dialog.boss) : null;
        if (
          remaining === null ||
          bonus === null ||
          remaining < 0 ||
          bonus < 0 ||
          (dialog.boss !== undefined && (boss === null || boss < 0))
        ) {
          setDialogError("请输入有效的次数");
          return;
        }
        let ok = false;
        if (dialog.taskId === "expedition") {
          ok = await sync(
            window.aionApi.updateRaidCounts(selected.id, {
              expeditionRemaining: remaining,
              expeditionTicketBonus: bonus,
              expeditionBossRemaining: boss ?? undefined,
            }),
          );
        } else if (dialog.taskId === "transcendence") {
          ok = await sync(
            window.aionApi.updateRaidCounts(selected.id, {
              transcendenceRemaining: remaining,
              transcendenceTicketBonus: bonus,
              transcendenceBossRemaining: boss ?? undefined,
            }),
          );
        } else if (dialog.taskId === "nightmare") {
          ok = await sync(
            window.aionApi.updateRaidCounts(selected.id, {
              nightmareRemaining: remaining,
              nightmareTicketBonus: bonus,
            }),
          );
        } else if (dialog.taskId === "awakening") {
          ok = await sync(
            window.aionApi.updateRaidCounts(selected.id, {
              awakeningRemaining: remaining,
              awakeningTicketBonus: bonus,
            }),
          );
        } else {
          ok = await sync(
            window.aionApi.updateRaidCounts(selected.id, {
              suppressionRemaining: remaining,
              suppressionTicketBonus: bonus,
            }),
          );
        }
        if (ok) {
          setDialog(null);
          setDialogError(null);
        }
        return;
      }

      if (dialog.kind === "sanctum_edit") {
        const raidRemaining = toInt(dialog.raidRemaining);
        const boxRemaining = toInt(dialog.boxRemaining);
        if (raidRemaining === null || boxRemaining === null || raidRemaining < 0 || boxRemaining < 0) {
          setDialogError("请输入有效的圣域次数");
          return;
        }
        const ok = await sync(
          window.aionApi.updateRaidCounts(selected.id, {
            sanctumRaidRemaining: raidRemaining,
            sanctumBoxRemaining: boxRemaining,
          }),
        );
        if (ok) {
          setDialog(null);
          setDialogError(null);
        }
      }
    })();
  }

  if (!state || !selected) {
    return (
      <main className="min-h-screen p-8 text-white">
        <div className="glass-panel mx-auto mt-20 max-w-md rounded-2xl p-6 text-center">
          <p className="text-sm text-slate-200">正在加载 AION 2 Dashboard...</p>
          {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 text-slate-100">
      <div className="grid min-h-[calc(100vh-2.5rem)] grid-cols-[300px_1fr] gap-5">
        <aside className="glass-panel rounded-3xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
          <h1 className="mb-3 text-lg font-semibold tracking-wide">AION 2</h1>
          <div className="mb-4 space-y-2">
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="新角色名称"
              value={newCharacterName}
              onChange={(event) => setNewCharacterName(event.target.value)}
              disabled={busy}
            />
            <button className="pill-btn w-full" onClick={onAddCharacter} disabled={busy || !newCharacterName.trim()}>
              新增角色
            </button>
          </div>

          <div className="space-y-2">
            {state.characters.map((item) => {
              const active = item.id === selected.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectCharacter(item.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-white/25 bg-white/15"
                      : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/10"
                  }`}
                  disabled={busy}
                >
                  <div className="avatar-ring">
                    <span className="avatar-dot">{item.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-slate-300">
                      奥德 {item.energy.baseCurrent}(+{item.energy.bonusCurrent})/{item.energy.baseCap}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-5">
          <header className="grid grid-cols-4 gap-4">
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <p className="tile-k">可远征角色</p>
              <p className="tile-v">{readyCharacters}</p>
            </article>
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <p className="tile-k">清空奥德预估</p>
              <p className="tile-v">{toGoldText(weeklyGold)}</p>
            </article>
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <p className="tile-k">每日使命未清</p>
              <p className="tile-v">{pendingDaily} 角色</p>
            </article>
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <p className="tile-k">每周指令未清</p>
              <p className="tile-v">{pendingWeekly} 角色</p>
            </article>
          </header>

          <article className="glass-panel rounded-3xl bg-[rgba(20,20,20,0.58)] p-5 backdrop-blur-2xl backdrop-saturate-150">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Current Character</p>
                <h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>
                <p className="mt-2 text-sm text-slate-300">
                  当前清空奥德预估: {toGoldText(estimateCharacterGold(selected, state.settings))}
                </p>
                <p className="mt-1 text-sm text-slate-300">本周已记录收益: {toGoldText(selected.stats.goldEarned)}</p>
              </div>
              <div className="w-56 space-y-2">
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                  disabled={busy}
                />
                <button className="pill-btn w-full" onClick={onRenameCharacter} disabled={busy || !renameName.trim()}>
                  重命名当前角色
                </button>
                <button className="pill-btn w-full" onClick={onDeleteCharacter} disabled={busy || state.characters.length <= 1}>
                  删除当前角色
                </button>
                <button className="pill-btn w-full" onClick={openEnergyDialog} disabled={busy}>
                  手动改能量
                </button>
                <button className="pill-btn w-full" onClick={onUpdateArtifact} disabled={busy}>
                  更新神器
                </button>
                <button className="pill-btn w-full" onClick={onResetWeeklyStats} disabled={busy}>
                  重置周收益
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <span>奥德能量</span>
                <span>
                  {selected.energy.baseCurrent}(+{selected.energy.bonusCurrent})/{selected.energy.baseCap}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-black/25">
                <div
                  className="flex h-full"
                  style={{
                    width: `${(getTotalEnergy(selected) / (selected.energy.baseCap + selected.energy.bonusCap)) * 100}%`,
                  }}
                >
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-cyan-300"
                    style={{
                      width: `${(selected.energy.baseCurrent / Math.max(1, getTotalEnergy(selected))) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-amber-300 to-orange-400"
                    style={{
                      width: `${(selected.energy.bonusCurrent / Math.max(1, getTotalEnergy(selected))) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">基础能量优先扣除，补充能量用于兜底。</p>
            </div>
          </article>

          <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
            <h3 className="text-sm font-semibold tracking-wide">本周金币统计</h3>
            <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
              <div className="data-pill">全角色本周收益: {toGoldText(weeklyEarned)}</div>
              <div className="data-pill">全角色远征次数: {weeklyExpeditionRuns} (84 次为满额奖励门槛)</div>
              <div className="data-pill">全角色超越次数: {weeklyTransRuns}</div>
              <div className="data-pill">本轮统计起点: {new Date(selected.stats.cycleStartedAt).toLocaleString()}</div>
            </div>
            {expeditionOverRewardThreshold ? (
              <p className="mt-3 text-xs text-amber-300">
                警示: 远征已超过 84 次，后续副本奖励将进入折扣区间（金币收益会下降）。
              </p>
            ) : null}
          </article>

          {sanctumRaidTask && sanctumBoxTask ? (
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold">圣域</h3>
                <button className="pill-btn" onClick={openSanctumEditDialog} disabled={busy}>
                  手动设定
                </button>
              </div>
              <p className="text-xs text-slate-300">
                挑战剩余 {selected.activities.sanctumRaidRemaining}/4，开箱剩余 {selected.activities.sanctumBoxRemaining}/2
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="task-btn"
                  onClick={() => openCompleteDialog("sanctum_raid", "圣域挑战")}
                  disabled={busy}
                >
                  填写挑战完成次数
                </button>
                <button
                  className="task-btn"
                  onClick={() => openCompleteDialog("sanctum_box", "圣域开箱")}
                  disabled={busy}
                >
                  填写开箱完成次数(40奥德)
                </button>
              </div>
            </article>
          ) : null}

          {(Object.keys(groupedTasks) as TaskDefinition["category"][]).map((category) => (
            <article key={category} className="space-y-3">
              <h3 className="px-1 text-sm font-semibold tracking-wide text-slate-200">{category}任务</h3>
              <div className="grid grid-cols-2 gap-4">
                {(groupedTasks[category] ?? []).map((task) => {
                  const canComplete = task.allowComplete && !task.allowSetCompleted;
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
                      className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold">{task.title}</h3>
                          <p className="mt-1 text-xs text-slate-300">{task.description}</p>
                        </div>
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs">
                          剩余 {getTaskProgressText(selected, task)}
                        </span>
                      </div>

                      <div className="mb-3 text-xs text-slate-300">
                        消耗: {task.energyCost} 奥德 {goldReward > 0 ? `| 金币收益 ${toGoldText(goldReward)}` : ""}
                        {extraLimitText ? ` | ${extraLimitText}` : ""}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          className="task-btn"
                          onClick={() => openCompleteDialog(task.id, task.title)}
                          disabled={busy || !canComplete}
                        >
                          完成次数
                        </button>
                        {task.allowUseTicket ? (
                          <button className="task-btn" onClick={() => onUseTicket(task.id)} disabled={busy}>
                            吃券 +1
                          </button>
                        ) : (
                          <div className="task-btn flex items-center justify-center opacity-45">不适用</div>
                        )}
                        {task.allowSetCompleted ? (
                          <button className="task-btn" onClick={() => openSetCompletedDialog(task)} disabled={busy}>
                            录入已完成
                          </button>
                        ) : task.allowUseTicket ? (
                          <button
                            className="task-btn"
                            onClick={() =>
                              openTaskEditDialog(task.id as "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression")
                            }
                            disabled={busy}
                          >
                            手动设定
                          </button>
                        ) : (
                          <div className="task-btn flex items-center justify-center opacity-45">不适用</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}

          <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
            <h3 className="text-sm font-semibold tracking-wide">待办提醒</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary
                .find((item) => item.characterId === selected.id)
                ?.pendingLabels.map((label) => (
                  <span key={label} className="rounded-full border border-orange-200/25 bg-orange-100/10 px-3 py-1 text-xs">
                    {label}
                  </span>
                ))}
            </div>
            {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
          </article>
        </section>
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl bg-[rgba(20,20,20,0.7)] p-5 backdrop-blur-2xl backdrop-saturate-150">
            {dialog.kind === "complete" ? (
              <>
                <h4 className="text-base font-semibold">填写完成次数 - {dialog.title}</h4>
                <p className="mt-2 text-xs text-slate-300">
                  {(() => {
                    const task = taskById.get(dialog.taskId);
                    if (!task) return "无法读取任务上限";
                    const byCount = Math.max(0, getTaskRemaining(selected, task) ?? 0);
                    const byEnergy =
                      task.energyCost > 0 ? Math.floor(getTotalEnergy(selected) / task.energyCost) : Number.MAX_SAFE_INTEGER;
                    const max = Math.max(0, Math.min(byCount, byEnergy));
                    return `当前最多可完成 ${max} 次`;
                  })()}
                </p>
                <input
                  className="mt-3 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={dialog.amount}
                  onChange={(event) => setDialog({ ...dialog, amount: event.target.value })}
                  disabled={busy}
                />
              </>
            ) : null}

            {dialog.kind === "set_completed" ? (
              <>
                <h4 className="text-base font-semibold">
                  录入已完成 - {dialog.task.title} (0-{dialog.task.setCompletedTotal})
                </h4>
                <input
                  className="mt-3 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={dialog.amount}
                  onChange={(event) => setDialog({ ...dialog, amount: event.target.value })}
                  disabled={busy}
                />
              </>
            ) : null}

            {dialog.kind === "energy" ? (
              <>
                <h4 className="text-base font-semibold">手动调整奥德能量</h4>
                <p className="mt-2 text-xs text-slate-300">
                  格式: 自然能量(+补充能量)/840，其中补充能量上限为 +{selected.energy.bonusCap}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.baseCurrent}
                    onChange={(event) => setDialog({ ...dialog, baseCurrent: event.target.value })}
                    disabled={busy}
                    placeholder="基础能量"
                  />
                  <input
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.bonusCurrent}
                    onChange={(event) => setDialog({ ...dialog, bonusCurrent: event.target.value })}
                    disabled={busy}
                    placeholder="补充能量"
                  />
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
                    <input
                      className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                      value={dialog.remaining}
                      onChange={(event) => setDialog({ ...dialog, remaining: event.target.value })}
                      disabled={busy}
                      placeholder={dialog.remainingLabel}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-300">{dialog.bonusLabel}</p>
                    <input
                      className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                      value={dialog.bonus}
                      onChange={(event) => setDialog({ ...dialog, bonus: event.target.value })}
                      disabled={busy}
                      placeholder={dialog.bonusLabel}
                    />
                  </div>
                  {dialog.boss !== undefined ? (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300">{dialog.bossLabel}</p>
                      <input
                        className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                        value={dialog.boss}
                        onChange={(event) => setDialog({ ...dialog, boss: event.target.value })}
                        disabled={busy}
                        placeholder={dialog.bossLabel}
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {dialog.kind === "sanctum_edit" ? (
              <>
                <h4 className="text-base font-semibold">圣域手动设定</h4>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.raidRemaining}
                    onChange={(event) => setDialog({ ...dialog, raidRemaining: event.target.value })}
                    disabled={busy}
                    placeholder="挑战剩余"
                  />
                  <input
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.boxRemaining}
                    onChange={(event) => setDialog({ ...dialog, boxRemaining: event.target.value })}
                    disabled={busy}
                    placeholder="开箱剩余"
                  />
                </div>
              </>
            ) : null}

            {dialogError ? <p className="mt-3 text-xs text-red-300">{dialogError}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="task-btn"
                onClick={() => {
                  setDialog(null);
                  setDialogError(null);
                }}
                disabled={busy}
              >
                取消
              </button>
              <button className="task-btn" onClick={onConfirmDialog} disabled={busy}>
                确认
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
