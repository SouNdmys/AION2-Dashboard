import { type DragEvent } from "react";
import { TASK_DEFINITIONS } from "../../../../../shared/constants";
import type { AppState, TaskActionKind } from "../../../../../shared/types";
import { COUNT_SELECT_MAX, NO_REGION_FILTER, type OverviewSortKey, type OverviewTaskFilter, type QuickTaskId } from "../dashboard-types";
import { formatCounter, getUrgentBoardToneClass } from "../dashboard-utils";

const numberFormatter = new Intl.NumberFormat("zh-CN");
type OverviewAccount = AppState["accounts"][number];
type OverviewCharacter = AppState["characters"][number];

export interface DashboardOverviewRow {
  account: OverviewAccount;
  character: OverviewCharacter;
  expeditionCurrent: number;
  expeditionTotal: number;
  transcendenceCurrent: number;
  transcendenceTotal: number;
  sanctumRaidCurrent: number;
  sanctumRaidTotal: number;
  sanctumBoxCurrent: number;
  sanctumBoxTotal: number;
  dailyDungeonCurrent: number;
  dailyDungeonTotal: number;
  nightmareCurrent: number;
  nightmareTotal: number;
  awakeningCurrent: number;
  awakeningTotal: number;
  suppressionCurrent: number;
  suppressionTotal: number;
  miniGameCurrent: number;
  miniGameTotal: number;
  spiritCurrent: number;
  spiritTotal: number;
  dailyMissionCurrent: number;
  dailyMissionTotal: number;
  weeklyMissionCurrent: number;
  weeklyMissionTotal: number;
  abyssLowerCurrent: number;
  abyssLowerTotal: number;
  abyssMiddleCurrent: number;
  abyssMiddleTotal: number;
  corridorLowerCurrent: number;
  corridorLowerTotal: number;
  corridorMiddleCurrent: number;
  corridorMiddleTotal: number;
  aodeBaseEnergyCurrent: number;
  aodeBonusEnergyCurrent: number;
  aodeBaseEnergyCap: number;
  aodeBaseEnergyOverflow: boolean;
  aodeShopAodePurchaseUsed: number;
  aodeShopDailyDungeonTicketPurchaseUsed: number;
  aodeTransformAodeUsed: number;
  aodeShopAodePurchaseRemaining: number;
  aodeShopDailyDungeonTicketPurchaseRemaining: number;
  aodeTransformAodeRemaining: number;
  aodeShopPurchaseLimit: number;
  aodeTransformLimit: number;
  dungeonReadyBuckets: number;
  weeklyReadyBuckets: number;
  missionReadyBuckets: number;
  readyBuckets: number;
}

interface DashboardOverviewPanelProps {
  visible: boolean;
  busy: boolean;
  state: AppState;
  accountNameById: Map<string, string>;
  quickCharacterId: string;
  onQuickCharacterIdChange: (value: string) => void;
  quickTaskId: QuickTaskId;
  onQuickTaskIdChange: (value: QuickTaskId) => void;
  quickAction: TaskActionKind;
  onQuickActionChange: (value: TaskActionKind) => void;
  quickAmount: string;
  onQuickAmountChange: (value: string) => void;
  quickActionOptions: TaskActionKind[];
  quickAmountOptions: string[];
  onApplyQuickAction: () => void;
  quickTaskExists: boolean;
  quickTaskSetCompletedTotal: number | null;
  quickCorridorTask: { title: string; lane: "lower" | "middle" } | null;
  overviewSortKey: OverviewSortKey;
  onOverviewSortKeyChange: (value: OverviewSortKey) => void;
  overviewTaskFilter: OverviewTaskFilter;
  onOverviewTaskFilterChange: (value: OverviewTaskFilter) => void;
  overviewAccountFilter: string;
  onOverviewAccountFilterChange: (value: string) => void;
  overviewRegionFilter: string;
  onOverviewRegionFilterChange: (value: string) => void;
  overviewRegionOptions: string[];
  overviewRowsFiltered: DashboardOverviewRow[];
  draggingCharacterId: string | null;
  dragOverCharacterId: string | null;
  onOverviewCardDragStart: (characterId: string) => void;
  onOverviewCardDragOver: (event: DragEvent<HTMLElement>, targetId: string) => void;
  onOverviewCardDrop: (event: DragEvent<HTMLElement>, targetId: string) => void;
  onOverviewCardDragEnd: () => void;
  isWeeklyCriticalWindow: boolean;
  onSelectCharacter: (characterId: string) => void;
}

export function DashboardOverviewPanel(props: DashboardOverviewPanelProps): JSX.Element | null {
  const {
    visible,
    busy,
    state,
    accountNameById,
    quickCharacterId,
    onQuickCharacterIdChange,
    quickTaskId,
    onQuickTaskIdChange,
    quickAction,
    onQuickActionChange,
    quickAmount,
    onQuickAmountChange,
    quickActionOptions,
    quickAmountOptions,
    onApplyQuickAction,
    quickTaskExists,
    quickTaskSetCompletedTotal,
    quickCorridorTask,
    overviewSortKey,
    onOverviewSortKeyChange,
    overviewTaskFilter,
    onOverviewTaskFilterChange,
    overviewAccountFilter,
    onOverviewAccountFilterChange,
    overviewRegionFilter,
    onOverviewRegionFilterChange,
    overviewRegionOptions,
    overviewRowsFiltered,
    draggingCharacterId,
    dragOverCharacterId,
    onOverviewCardDragStart,
    onOverviewCardDragOver,
    onOverviewCardDrop,
    onOverviewCardDragEnd,
    isWeeklyCriticalWindow,
    onSelectCharacter,
  } = props;

  if (!visible) {
    return null;
  }

  return (
    <article className="glass-panel rounded-[30px] p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="panel-kicker">Role Overview</p>
          <h3 className="panel-title !text-xl">角色概览总览</h3>
          <p className="panel-subtitle">按优先级筛选后可进入角色；也可先做一次快速录入。</p>
        </div>
        <span className="pill-btn pill-static">批量视图</span>
      </div>
      <div className="soft-card mb-4 p-4">
        <p className="panel-kicker !tracking-[0.08em]">Quick Entry</p>
        <h4 className="panel-title !mt-1 !text-sm">快速录入</h4>
        <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-[1.25fr_1fr_1fr_0.8fr_auto]">
          <select
            className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
            value={quickCharacterId}
            onChange={(event) => onQuickCharacterIdChange(event.target.value)}
            disabled={busy}
          >
            {state.characters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({accountNameById.get(item.accountId) ?? "账号"})
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
            value={quickTaskId}
            onChange={(event) => onQuickTaskIdChange(event.target.value as QuickTaskId)}
            disabled={busy}
          >
            {TASK_DEFINITIONS.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
            <option value="corridor_lower">回廊完成(下层)</option>
            <option value="corridor_middle">回廊完成(中层)</option>
          </select>
          <select
            className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
            value={quickAction}
            onChange={(event) => onQuickActionChange(event.target.value as TaskActionKind)}
            disabled={busy || quickActionOptions.length === 0}
          >
            {quickActionOptions.map((action) => (
              <option key={action} value={action}>
                {action === "complete_once" ? "完成次数" : action === "use_ticket" ? "挑战券增加" : "输入已完成"}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
            value={quickAmount}
            onChange={(event) => onQuickAmountChange(event.target.value)}
            disabled={busy}
          >
            {quickAmountOptions.map((value) => (
              <option key={`quick-amount-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button className="task-btn px-4" onClick={onApplyQuickAction} disabled={busy || !quickCharacterId || (!quickTaskExists && !quickCorridorTask)}>
            提交录入
          </button>
        </div>
        {quickAction === "set_completed" ? (
          <p className="mt-2 text-xs text-slate-300">
            当前内容总量 {quickCorridorTask ? 3 : quickTaskSetCompletedTotal ?? COUNT_SELECT_MAX}，输入超过将自动按上限处理。
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
        <select
          className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={overviewSortKey}
          onChange={(event) => onOverviewSortKeyChange(event.target.value as OverviewSortKey)}
          disabled={busy}
        >
          <option value="manual">按手动排序</option>
          <option value="ready">按可执行项排序</option>
          <option value="account">按账号排序</option>
          <option value="region">按大区排序</option>
        </select>
        <select
          className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={overviewTaskFilter}
          onChange={(event) => onOverviewTaskFilterChange(event.target.value as OverviewTaskFilter)}
          disabled={busy}
        >
          <option value="all">任务类型: 全部</option>
          <option value="dungeon">任务类型: 副本</option>
          <option value="weekly">任务类型: 周常</option>
          <option value="mission">任务类型: 使命</option>
        </select>
        <select
          className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={overviewAccountFilter}
          onChange={(event) => onOverviewAccountFilterChange(event.target.value)}
          disabled={busy}
        >
          <option value="all">账号: 全部</option>
          {state.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
          value={overviewRegionFilter}
          onChange={(event) => onOverviewRegionFilterChange(event.target.value)}
          disabled={busy}
        >
          <option value="all">大区: 全部</option>
          <option value={NO_REGION_FILTER}>大区: 未设置</option>
          {overviewRegionOptions.map((region) => (
            <option key={region} value={region}>
              大区: {region}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-xs text-slate-300">
        当前命中 {overviewRowsFiltered.length} 个角色，可直接进入操作页。
        {overviewSortKey === "manual" ? " 当前支持拖拽卡片调整顺序。" : " 切到“按手动排序”后可拖拽调整顺序。"}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
        {overviewRowsFiltered.map((entry) => {
          const filteredReadyCount =
            overviewTaskFilter === "dungeon"
              ? entry.dungeonReadyBuckets
              : overviewTaskFilter === "weekly"
                ? entry.weeklyReadyBuckets
                : overviewTaskFilter === "mission"
                  ? entry.missionReadyBuckets
                  : entry.readyBuckets;
          const dragEnabled = overviewSortKey === "manual" && !busy;
          const dragging = draggingCharacterId === entry.character.id;
          const dragOver = dragOverCharacterId === entry.character.id && draggingCharacterId !== entry.character.id;
          return (
            <article
              key={entry.character.id}
              draggable={dragEnabled}
              onDragStart={() => onOverviewCardDragStart(entry.character.id)}
              onDragOver={(event) => onOverviewCardDragOver(event, entry.character.id)}
              onDrop={(event) => onOverviewCardDrop(event, entry.character.id)}
              onDragEnd={onOverviewCardDragEnd}
              className={`rounded-2xl border bg-white/5 p-3 text-left transition hover:border-white/30 hover:bg-white/10 ${
                dragging ? "border-cyan-300/70 opacity-65" : dragOver ? "border-cyan-200/70 bg-cyan-500/10" : "border-white/15"
              } ${dragEnabled ? "cursor-move" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{entry.character.name}</p>
                  <p className="text-xs text-slate-300">
                    {entry.account.name}
                    {entry.account.regionTag ? ` (${entry.account.regionTag})` : " (未设置大区)"}
                  </p>
                  <p className="text-xs text-slate-400">
                    职业: {entry.character.classTag?.trim() || "未填写"} | 装分:{" "}
                    {entry.character.gearScore === undefined ? "未填写" : numberFormatter.format(entry.character.gearScore)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getUrgentBoardToneClass(
                      entry.aodeBaseEnergyCurrent,
                      entry.aodeBaseEnergyCap,
                      entry.aodeBaseEnergyOverflow,
                    )}`}
                  >
                    奥德 {entry.aodeBaseEnergyCurrent}(+{entry.aodeBonusEnergyCurrent})/{entry.aodeBaseEnergyCap}
                  </span>
                  <span className="text-xs text-cyan-200">
                    可执行项 {filteredReadyCount}
                    {overviewTaskFilter === "all" ? "" : overviewTaskFilter === "dungeon" ? " / 副本" : overviewTaskFilter === "weekly" ? " / 周常" : " / 使命"}
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "远征", current: entry.expeditionCurrent, total: entry.expeditionTotal, urgent: false },
                    { label: "超越", current: entry.transcendenceCurrent, total: entry.transcendenceTotal, urgent: false },
                    { label: "圣域", current: entry.sanctumRaidCurrent, total: entry.sanctumRaidTotal, urgent: true },
                    { label: "开箱", current: entry.sanctumBoxCurrent, total: entry.sanctumBoxTotal, urgent: true },
                  ].map((metric) => (
                    <span
                      key={`dungeon-${entry.character.id}-${metric.label}`}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${getUrgentBoardToneClass(metric.current, metric.total, metric.urgent)}`}
                    >
                      {metric.label} {formatCounter(metric.current, metric.total)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "每日副本", current: entry.dailyDungeonCurrent, total: entry.dailyDungeonTotal, urgent: isWeeklyCriticalWindow },
                    { label: "恶梦", current: entry.nightmareCurrent, total: entry.nightmareTotal, urgent: false },
                    { label: "觉醒", current: entry.awakeningCurrent, total: entry.awakeningTotal, urgent: isWeeklyCriticalWindow },
                    { label: "讨伐", current: entry.suppressionCurrent, total: entry.suppressionTotal, urgent: isWeeklyCriticalWindow },
                    { label: "小游戏", current: entry.miniGameCurrent, total: entry.miniGameTotal, urgent: false },
                    { label: "精灵", current: entry.spiritCurrent, total: entry.spiritTotal, urgent: false },
                  ].map((metric) => (
                    <span
                      key={`weekly-${entry.character.id}-${metric.label}`}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${getUrgentBoardToneClass(metric.current, metric.total, metric.urgent)}`}
                    >
                      {metric.label} {formatCounter(metric.current, metric.total)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "每日使命", current: entry.dailyMissionCurrent, total: entry.dailyMissionTotal, urgent: true },
                    { label: "每周指令", current: entry.weeklyMissionCurrent, total: entry.weeklyMissionTotal, urgent: isWeeklyCriticalWindow },
                    { label: "深渊下层", current: entry.abyssLowerCurrent, total: entry.abyssLowerTotal, urgent: false },
                    { label: "深渊中层", current: entry.abyssMiddleCurrent, total: entry.abyssMiddleTotal, urgent: false },
                    { label: "回廊下层", current: entry.corridorLowerCurrent, total: entry.corridorLowerTotal, urgent: true },
                    { label: "回廊中层", current: entry.corridorMiddleCurrent, total: entry.corridorMiddleTotal, urgent: true },
                  ].map((metric) => (
                    <span
                      key={`mission-${entry.character.id}-${metric.label}`}
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${getUrgentBoardToneClass(metric.current, metric.total, metric.urgent)}`}
                    >
                      {metric.label} {formatCounter(metric.current, metric.total)}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${getUrgentBoardToneClass(
                      entry.aodeShopAodePurchaseRemaining,
                      entry.aodeShopPurchaseLimit,
                      isWeeklyCriticalWindow,
                    )}`}
                  >
                    商店-奥德 {formatCounter(entry.aodeShopAodePurchaseUsed, entry.aodeShopPurchaseLimit)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${getUrgentBoardToneClass(
                      entry.aodeShopDailyDungeonTicketPurchaseRemaining,
                      entry.aodeShopPurchaseLimit,
                      isWeeklyCriticalWindow,
                    )}`}
                  >
                    商店-副本券 {formatCounter(entry.aodeShopDailyDungeonTicketPurchaseUsed, entry.aodeShopPurchaseLimit)}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${getUrgentBoardToneClass(
                      entry.aodeTransformAodeRemaining,
                      entry.aodeTransformLimit,
                      isWeeklyCriticalWindow,
                    )}`}
                  >
                    变换-奥德 {formatCounter(entry.aodeTransformAodeUsed, entry.aodeTransformLimit)}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button className="task-btn" onClick={() => onSelectCharacter(entry.character.id)} disabled={busy}>
                  进入角色
                </button>
              </div>
            </article>
          );
        })}
        {overviewRowsFiltered.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">当前筛选条件下没有可显示角色。</div>
        ) : null}
      </div>
    </article>
  );
}
