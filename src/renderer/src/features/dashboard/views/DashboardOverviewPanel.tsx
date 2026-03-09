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

interface OverviewMetricChip {
  key: string;
  label: string;
  current: number;
  total: number;
  urgent: boolean;
}

type OverviewMetricGroupKey = "urgent" | "dungeon" | "weekly" | "mission" | "leisure";

const OVERVIEW_GROUP_LABELS: Record<OverviewMetricGroupKey, string> = {
  urgent: "高优先",
  dungeon: "副本",
  weekly: "周常",
  mission: "使命",
  leisure: "休闲",
};

const OVERVIEW_GROUP_PANEL_CLASS: Record<OverviewMetricGroupKey, string> = {
  urgent: "overview-group-panel overview-group-panel-urgent",
  dungeon: "overview-group-panel overview-group-panel-dungeon",
  weekly: "overview-group-panel overview-group-panel-weekly",
  mission: "overview-group-panel overview-group-panel-mission",
  leisure: "overview-group-panel overview-group-panel-leisure",
};

const OVERVIEW_GROUP_CHIP_CLASS: Record<OverviewMetricGroupKey, string> = {
  urgent: "overview-group-chip overview-group-chip-urgent",
  dungeon: "overview-group-chip overview-group-chip-dungeon",
  weekly: "overview-group-chip overview-group-chip-weekly",
  mission: "overview-group-chip overview-group-chip-mission",
  leisure: "overview-group-chip overview-group-chip-leisure",
};

const OVERVIEW_ROW_TONE_CLASS: Record<OverviewMetricGroupKey, string> = {
  urgent: "overview-task-row overview-task-row-tone-urgent",
  dungeon: "overview-task-row overview-task-row-tone-dungeon",
  weekly: "overview-task-row overview-task-row-tone-weekly",
  mission: "overview-task-row overview-task-row-tone-mission",
  leisure: "overview-task-row overview-task-row-tone-leisure",
};

function getOverviewMetricGroupKey(metricKey: string): OverviewMetricGroupKey {
  if (["sanctum_raid", "sanctum_box", "corridor_lower", "corridor_middle"].includes(metricKey)) {
    return "urgent";
  }
  if (["expedition", "transcendence", "daily_dungeon", "nightmare", "awakening", "suppression", "abyss_lower", "abyss_middle"].includes(metricKey)) {
    return "dungeon";
  }
  if (["weekly_mission", "shop_aode", "shop_ticket", "transform_aode"].includes(metricKey)) {
    return "weekly";
  }
  if (["daily_mission"].includes(metricKey)) {
    return "mission";
  }
  return "leisure";
}

function buildOverviewMetricChips(entry: DashboardOverviewRow, isWeeklyCriticalWindow: boolean): OverviewMetricChip[] {
  return [
    { key: "expedition", label: "远征", current: entry.expeditionCurrent, total: entry.expeditionTotal, urgent: false },
    { key: "transcendence", label: "超越", current: entry.transcendenceCurrent, total: entry.transcendenceTotal, urgent: false },
    { key: "sanctum_raid", label: "圣域", current: entry.sanctumRaidCurrent, total: entry.sanctumRaidTotal, urgent: true },
    { key: "sanctum_box", label: "开箱", current: entry.sanctumBoxCurrent, total: entry.sanctumBoxTotal, urgent: true },
    { key: "daily_dungeon", label: "每日副本", current: entry.dailyDungeonCurrent, total: entry.dailyDungeonTotal, urgent: isWeeklyCriticalWindow },
    { key: "nightmare", label: "恶梦", current: entry.nightmareCurrent, total: entry.nightmareTotal, urgent: false },
    { key: "awakening", label: "觉醒", current: entry.awakeningCurrent, total: entry.awakeningTotal, urgent: isWeeklyCriticalWindow },
    { key: "suppression", label: "讨伐", current: entry.suppressionCurrent, total: entry.suppressionTotal, urgent: isWeeklyCriticalWindow },
    { key: "mini_game", label: "小游戏", current: entry.miniGameCurrent, total: entry.miniGameTotal, urgent: false },
    { key: "spirit", label: "精灵", current: entry.spiritCurrent, total: entry.spiritTotal, urgent: false },
    { key: "daily_mission", label: "每日使命", current: entry.dailyMissionCurrent, total: entry.dailyMissionTotal, urgent: true },
    { key: "weekly_mission", label: "每周指令", current: entry.weeklyMissionCurrent, total: entry.weeklyMissionTotal, urgent: isWeeklyCriticalWindow },
    { key: "abyss_lower", label: "深渊下层", current: entry.abyssLowerCurrent, total: entry.abyssLowerTotal, urgent: false },
    { key: "abyss_middle", label: "深渊中层", current: entry.abyssMiddleCurrent, total: entry.abyssMiddleTotal, urgent: false },
    { key: "corridor_lower", label: "回廊下层", current: entry.corridorLowerCurrent, total: entry.corridorLowerTotal, urgent: true },
    { key: "corridor_middle", label: "回廊中层", current: entry.corridorMiddleCurrent, total: entry.corridorMiddleTotal, urgent: true },
    { key: "shop_aode", label: "商店-奥德", current: entry.aodeShopAodePurchaseRemaining, total: entry.aodeShopPurchaseLimit, urgent: isWeeklyCriticalWindow },
    {
      key: "shop_ticket",
      label: "商店-副本券",
      current: entry.aodeShopDailyDungeonTicketPurchaseRemaining,
      total: entry.aodeShopPurchaseLimit,
      urgent: isWeeklyCriticalWindow,
    },
    { key: "transform_aode", label: "变换-奥德", current: entry.aodeTransformAodeRemaining, total: entry.aodeTransformLimit, urgent: isWeeklyCriticalWindow },
  ];
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
      <div className="mb-4">
        <div>
          <p className="panel-kicker">Role Overview</p>
          <h3 className="panel-title !text-xl">角色概览总览</h3>
        </div>
      </div>
      <div className="soft-card mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="panel-kicker !tracking-[0.08em]">Quick Entry</p>
            <h4 className="panel-title !mt-1 !text-sm">快速录入</h4>
          </div>
          <p className="summary-note">
            当前命中 {overviewRowsFiltered.length} 个角色。
            {overviewSortKey === "manual" ? " 当前支持拖拽卡片调整顺序。" : " 切到“按手动排序”后可拖拽调整顺序。"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-[1.25fr_1fr_1fr_0.8fr_auto]">
          <select className="field-control-sm" value={quickCharacterId} onChange={(event) => onQuickCharacterIdChange(event.target.value)} disabled={busy}>
            {state.characters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({accountNameById.get(item.accountId) ?? "账号"})
              </option>
            ))}
          </select>
          <select
            className="field-control-sm"
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
            className="field-control-sm"
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
          <select className="field-control-sm" value={quickAmount} onChange={(event) => onQuickAmountChange(event.target.value)} disabled={busy}>
            {quickAmountOptions.map((value) => (
              <option key={`quick-amount-${value}`} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            className="task-btn task-btn-soft px-4"
            onClick={onApplyQuickAction}
            disabled={busy || !quickCharacterId || (!quickTaskExists && !quickCorridorTask)}
          >
            提交录入
          </button>
        </div>
        {quickAction === "set_completed" ? (
          <p className="mt-2 summary-note">当前内容总量 {quickCorridorTask ? 3 : quickTaskSetCompletedTotal ?? COUNT_SELECT_MAX}，输入超过将自动按上限处理。</p>
        ) : null}
        <div className="overview-filter-row mt-3 flex flex-wrap items-center gap-2">
          <span className="summary-note">筛选</span>
          <select
            className="field-control-inline min-w-[130px]"
            value={overviewSortKey}
            onChange={(event) => onOverviewSortKeyChange(event.target.value as OverviewSortKey)}
            disabled={busy}
          >
            <option value="manual">手动排序</option>
            <option value="ready">可执行项</option>
            <option value="account">按账号</option>
            <option value="region">按大区</option>
          </select>
          <select
            className="field-control-inline min-w-[120px]"
            value={overviewTaskFilter}
            onChange={(event) => onOverviewTaskFilterChange(event.target.value as OverviewTaskFilter)}
            disabled={busy}
          >
            <option value="all">全部任务</option>
            <option value="dungeon">副本</option>
            <option value="weekly">周常</option>
            <option value="mission">使命</option>
          </select>
          <select
            className="field-control-inline min-w-[130px]"
            value={overviewAccountFilter}
            onChange={(event) => onOverviewAccountFilterChange(event.target.value)}
            disabled={busy}
          >
            <option value="all">全部账号</option>
            {state.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            className="field-control-inline min-w-[130px]"
            value={overviewRegionFilter}
            onChange={(event) => onOverviewRegionFilterChange(event.target.value)}
            disabled={busy}
          >
            <option value="all">全部大区</option>
            <option value={NO_REGION_FILTER}>未设置大区</option>
            {overviewRegionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-2">
        {overviewRowsFiltered.map((entry) => {
          const allMetrics = buildOverviewMetricChips(entry, isWeeklyCriticalWindow);
          const actionableMetrics = allMetrics
            .filter((metric) => metric.current > 0)
            .sort((left, right) => Number(right.urgent) - Number(left.urgent) || right.current - left.current || left.label.localeCompare(right.label, "zh-CN"));
          const groupedMetrics = actionableMetrics.reduce<Record<OverviewMetricGroupKey, OverviewMetricChip[]>>(
            (acc, metric) => {
              acc[getOverviewMetricGroupKey(metric.key)].push(metric);
              return acc;
            },
            {
              urgent: [],
              dungeon: [],
              weekly: [],
              mission: [],
              leisure: [],
            },
          );
          const visibleGroups = (Object.keys(groupedMetrics) as OverviewMetricGroupKey[]).filter((groupKey) => groupedMetrics[groupKey].length > 0);
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
          const spotlightMetric = actionableMetrics[0] ?? null;
          const spotlightGroupKey = spotlightMetric ? getOverviewMetricGroupKey(spotlightMetric.key) : null;
          return (
            <article
              key={entry.character.id}
              draggable={dragEnabled}
              onDragStart={() => onOverviewCardDragStart(entry.character.id)}
              onDragOver={(event) => onOverviewCardDragOver(event, entry.character.id)}
              onDrop={(event) => onOverviewCardDrop(event, entry.character.id)}
              onDragEnd={onOverviewCardDragEnd}
              className={`soft-card rounded-3xl p-4 text-left transition ${
                dragging ? "border-[rgba(15,143,111,0.38)] opacity-65" : dragOver ? "border-[rgba(15,143,111,0.28)] bg-[rgba(15,143,111,0.05)]" : ""
              } ${dragEnabled ? "cursor-move" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{entry.character.name}</p>
                  <p className="text-xs text-slate-500">
                    {entry.account.name}
                    {entry.account.regionTag ? ` (${entry.account.regionTag})` : " (未设置大区)"}
                  </p>
                  <p className="summary-note">
                    职业: {entry.character.classTag?.trim() || "未填写"} | 装分:{" "}
                    {entry.character.gearScore === undefined ? "未填写" : numberFormatter.format(entry.character.gearScore)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={getUrgentBoardToneClass(entry.aodeBaseEnergyCurrent, entry.aodeBaseEnergyCap, entry.aodeBaseEnergyOverflow)}>
                    奥德 {entry.aodeBaseEnergyCurrent}(+{entry.aodeBonusEnergyCurrent})/{entry.aodeBaseEnergyCap}
                  </span>
                  <span className="summary-note">可执行项 {filteredReadyCount}</span>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {spotlightMetric && spotlightGroupKey ? (
                  <div className="rounded-2xl border border-[rgba(15,23,42,0.06)] bg-white/72 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={OVERVIEW_GROUP_CHIP_CLASS[spotlightGroupKey]}>{OVERVIEW_GROUP_LABELS[spotlightGroupKey]}</span>
                      <span className="text-sm font-medium text-slate-900">当前最需要处理：{spotlightMetric.label}</span>
                      <span className="summary-note">剩余 {formatCounter(spotlightMetric.current, spotlightMetric.total)}</span>
                    </div>
                  </div>
                ) : null}
                {visibleGroups.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                    {visibleGroups.map((groupKey) => (
                      <section key={`${entry.character.id}-${groupKey}`} className={OVERVIEW_GROUP_PANEL_CLASS[groupKey]}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="overview-group-title">{OVERVIEW_GROUP_LABELS[groupKey]}</p>
                          <span className={OVERVIEW_GROUP_CHIP_CLASS[groupKey]}>{groupedMetrics[groupKey].length} 项</span>
                        </div>
                        <div className="overview-task-list">
                          {groupedMetrics[groupKey].map((metric) => (
                            <div key={`${entry.character.id}-${groupKey}-${metric.key}`} className={OVERVIEW_ROW_TONE_CLASS[groupKey]}>
                              <span className="overview-task-row-label">{metric.label}</span>
                              <span className={`overview-task-row-value ${metric.urgent ? "overview-task-row-value-urgent" : ""}`}>
                                {formatCounter(metric.current, metric.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="subtle-panel">
                    <span className="summary-note">当前主要项目已基本清空，可直接进入角色确认细节。</span>
                  </div>
                )}
                <div className="rounded-2xl border border-[rgba(15,23,42,0.06)] bg-white/70 px-3 py-2">
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="summary-note">副本 {entry.dungeonReadyBuckets}</span>
                    <span className="summary-note">周常 {entry.weeklyReadyBuckets}</span>
                    <span className="summary-note">使命 {entry.missionReadyBuckets}</span>
                    <span className="summary-note">明细 {actionableMetrics.length} 项</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button className="task-btn task-btn-soft" onClick={() => onSelectCharacter(entry.character.id)} disabled={busy}>
                  进入角色
                </button>
              </div>
            </article>
          );
        })}
        {overviewRowsFiltered.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white/80 p-4 text-sm text-slate-500">当前筛选条件下没有可显示角色。</div>
        ) : null}
      </div>
    </article>
  );
}
