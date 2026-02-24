import { useEffect, useMemo, useState, type DragEvent } from "react";
import {
  AODE_ENERGY_SCHEDULE_HOURS,
  AODE_BASE_ENERGY_OVERFLOW_WARN_THRESHOLD,
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  EXPEDITION_SCHEDULE_HOURS,
  TASK_DEFINITIONS,
  TRANSCENDENCE_SCHEDULE_HOURS,
} from "../../shared/constants";
import {
  buildCharacterSummary,
} from "../../shared/engine";
import { getNextDailyReset, getNextScheduledTick, getNextUnifiedCorridorRefresh, getNextWeeklyReset } from "../../shared/time";
import type { AppBuildInfo, AppState, TaskActionKind, TaskDefinition, TaskId } from "../../shared/types";
import { useAppActions } from "./features/dashboard/actions/useAppActions";
import {
  addAccountAction,
  addCharacterAction,
  deleteAccountAction,
  deleteCharacterAction,
  renameAccountAction,
  renameCharacterAction,
  saveCharacterProfileAction,
  selectAccountAction,
  selectCharacterAction,
} from "./features/dashboard/actions/accountCharacterActions";
import { confirmDashboardDialog } from "./features/dashboard/actions/confirmDashboardDialog";
import { clearHistoryAction, undoMultiStepAction, undoSingleStepAction } from "./features/dashboard/actions/historyActions";
import {
  applyQuickEntryAction,
  endOverviewCardDragAction,
  overviewCardDragOverAction,
  overviewCardDropAction,
  startOverviewCardDragAction,
} from "./features/dashboard/actions/overviewInteractionActions";
import {
  applyCorridorCompletionFromSettingsAction,
  applyCorridorSettingsAction,
  assignExtraAodeCharacterAction,
  saveShopPlanAction,
  saveTransformPlanAction,
} from "./features/dashboard/actions/resourceAndCorridorActions";
import {
  exportDashboardDataAction,
  importDashboardDataAction,
  saveDashboardSettingsAction,
} from "./features/dashboard/actions/settingsDataActions";
import { resetWeeklyStatsAction, saveWeeklyCompletionsAction } from "./features/dashboard/actions/weeklyStatsActions";
import {
  buildCompleteDialog,
  buildCorridorCompleteDialog,
  buildCorridorSyncDialog,
  buildEnergyDialog,
  buildSanctumEditDialog,
  buildSetCompletedDialog,
  buildTaskEditDialog,
  buildUseTicketDialog,
} from "./features/dashboard/actions/dialogStateBuilders";
import {
  COUNT_SELECT_MAX,
  MAX_CHARACTERS_PER_ACCOUNT,
  NO_REGION_FILTER,
  QUICK_CORRIDOR_TASKS,
  type AccountEditorDraft,
  type CorridorDraft,
  type DashboardMode,
  type DialogState,
  type OverviewSortKey,
  type OverviewTaskFilter,
  type PriorityTodoItem,
  type PriorityTone,
  type PriorityWeightKey,
  type QuickTaskId,
  type SettingsDraft,
  type ViewMode,
} from "./features/dashboard/dashboard-types";
import {
  buildCorridorDraft,
  buildCountOptions,
  buildSettingsDraft,
  formatCounter,
  getCharacterAodeLimits,
  getPriorityWeightFactor,
  getPriorityWeightLevel,
  getQuickActionsForTask,
  toGoldText,
} from "./features/dashboard/dashboard-utils";
import { DashboardOverviewSummaryCards } from "./features/dashboard/views/DashboardOverviewSummaryCards";
import { DashboardCharacterMainPanel } from "./features/dashboard/views/DashboardCharacterMainPanel";
import { DashboardCharacterModePanels } from "./features/dashboard/views/DashboardCharacterModePanels";
import { DashboardDialogModal } from "./features/dashboard/views/DashboardDialogModal";
import { DashboardLeftSidebar } from "./features/dashboard/views/DashboardLeftSidebar";
import { DashboardOverviewPanel } from "./features/dashboard/views/DashboardOverviewPanel";
import { DashboardRightSidebar } from "./features/dashboard/views/DashboardRightSidebar";
import { DashboardSettingsPanel } from "./features/dashboard/views/DashboardSettingsPanel";
import { DashboardToolbar } from "./features/dashboard/views/DashboardToolbar";
import { WorkshopView } from "./WorkshopView";

export function App(): JSX.Element {
  const appActions = useAppActions();
  const [state, setState] = useState<AppState | null>(null);
  const [buildInfo, setBuildInfo] = useState<AppBuildInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountRegion, setNewAccountRegion] = useState("");
  const [accountEditor, setAccountEditor] = useState<AccountEditorDraft>({ name: "", regionTag: "" });
  const [newCharacterName, setNewCharacterName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("overview");
  const [undoSteps, setUndoSteps] = useState("2");
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [corridorDraft, setCorridorDraft] = useState<CorridorDraft>(buildCorridorDraft(0, 0));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [overviewSortKey, setOverviewSortKey] = useState<OverviewSortKey>("manual");
  const [overviewTaskFilter, setOverviewTaskFilter] = useState<OverviewTaskFilter>("all");
  const [overviewAccountFilter, setOverviewAccountFilter] = useState<string>("all");
  const [overviewRegionFilter, setOverviewRegionFilter] = useState<string>("all");
  const [quickCharacterId, setQuickCharacterId] = useState("");
  const [quickTaskId, setQuickTaskId] = useState<QuickTaskId>("expedition");
  const [quickAction, setQuickAction] = useState<TaskActionKind>("complete_once");
  const [quickAmount, setQuickAmount] = useState("1");
  const [profileClassTagInput, setProfileClassTagInput] = useState("");
  const [profileGearScoreInput, setProfileGearScoreInput] = useState("");
  const [draggingCharacterId, setDraggingCharacterId] = useState<string | null>(null);
  const [dragOverCharacterId, setDragOverCharacterId] = useState<string | null>(null);
  const [weeklyExpeditionCompletedInput, setWeeklyExpeditionCompletedInput] = useState("0");
  const [weeklyTranscendenceCompletedInput, setWeeklyTranscendenceCompletedInput] = useState("0");
  const [shopAodePurchaseUsedInput, setShopAodePurchaseUsedInput] = useState("0");
  const [shopDailyDungeonTicketPurchaseUsedInput, setShopDailyDungeonTicketPurchaseUsedInput] = useState("0");
  const [transformAodeUsedInput, setTransformAodeUsedInput] = useState("0");
  const [workshopHistoryJumpItemId, setWorkshopHistoryJumpItemId] = useState<string | null>(null);
  const [workshopHistoryJumpSnapshotId, setWorkshopHistoryJumpSnapshotId] = useState<string | null>(null);
  const [workshopHistoryJumpNonce, setWorkshopHistoryJumpNonce] = useState(0);
  const [workshopPriceChangeNonce, setWorkshopPriceChangeNonce] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const [next, buildMeta] = await Promise.all([appActions.getState(), appActions.getBuildInfo()]);
        setState(next);
        setBuildInfo(buildMeta);
      } catch (err) {
        setError(err instanceof Error ? err.message : "初始化失败");
      }
    })();
  }, [appActions]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = useMemo(() => {
    if (!state) return null;
    const activeAccountId = state.selectedAccountId ?? state.accounts[0]?.id ?? null;
    const inAccount =
      activeAccountId === null ? state.characters : state.characters.filter((item) => item.accountId === activeAccountId);
    if (inAccount.length === 0) {
      return state.characters.find((item) => item.id === state.selectedCharacterId) ?? state.characters[0] ?? null;
    }
    return inAccount.find((item) => item.id === state.selectedCharacterId) ?? inAccount[0];
  }, [state]);

  const selectedAccount = useMemo(() => {
    if (!state) return null;
    const byState = state.accounts.find((item) => item.id === state.selectedAccountId);
    if (byState) {
      return byState;
    }
    if (selected) {
      return state.accounts.find((item) => item.id === selected.accountId) ?? state.accounts[0] ?? null;
    }
    return state.accounts[0] ?? null;
  }, [state, selected]);

  const accountCharacters = useMemo(() => {
    if (!state || !selectedAccount) {
      return [];
    }
    return state.characters.filter((item) => item.accountId === selectedAccount.id);
  }, [state, selectedAccount]);

  const selectedAodeLimits = useMemo(() => {
    if (!state || !selected) {
      return { purchaseLimit: AODE_WEEKLY_BASE_PURCHASE_MAX, convertLimit: AODE_WEEKLY_BASE_CONVERT_MAX };
    }
    return getCharacterAodeLimits(state, selected.id);
  }, [state, selected?.id]);

  const selectedAccountExtraCharacterName = useMemo(() => {
    if (!state || !selectedAccount?.extraAodeCharacterId) return null;
    return state.characters.find((item) => item.id === selectedAccount.extraAodeCharacterId)?.name ?? null;
  }, [state, selectedAccount?.extraAodeCharacterId]);

  useEffect(() => {
    setRenameName(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    setProfileClassTagInput(selected?.classTag ?? "");
    setProfileGearScoreInput(selected?.gearScore === undefined ? "" : String(selected.gearScore));
  }, [selected?.id, selected?.classTag, selected?.gearScore]);

  useEffect(() => {
    setAccountEditor({
      name: selectedAccount?.name ?? "",
      regionTag: selectedAccount?.regionTag ?? "",
    });
  }, [selectedAccount?.id, selectedAccount?.name, selectedAccount?.regionTag]);

  useEffect(() => {
    if (!state) return;
    setSettingsDraft(buildSettingsDraft(state.settings));
  }, [state?.settings]);

  useEffect(() => {
    if (!state) return;
    const fallback = selected?.id ?? state.characters[0]?.id ?? "";
    const exists = quickCharacterId ? state.characters.some((item) => item.id === quickCharacterId) : false;
    if (!exists) {
      setQuickCharacterId(fallback);
    }
  }, [state, selected?.id, quickCharacterId]);

  useEffect(() => {
    if (!selected) return;
    setCorridorDraft((prev) => ({
      ...prev,
      ...buildCorridorDraft(selected.activities.corridorLowerAvailable, selected.activities.corridorMiddleAvailable),
      completeAmount: prev.completeAmount,
    }));
  }, [
    selected?.id,
    selected?.activities.corridorLowerAvailable,
    selected?.activities.corridorMiddleAvailable,
  ]);

  useEffect(() => {
    if (!selected) return;
    setWeeklyExpeditionCompletedInput(String(selected.stats.completions.expedition));
    setWeeklyTranscendenceCompletedInput(String(selected.stats.completions.transcendence));
  }, [selected?.id, selected?.stats.completions.expedition, selected?.stats.completions.transcendence]);

  useEffect(() => {
    if (!selected) return;
    setShopAodePurchaseUsedInput(String(selected.aodePlan.shopAodePurchaseUsed));
    setShopDailyDungeonTicketPurchaseUsedInput(String(selected.aodePlan.shopDailyDungeonTicketPurchaseUsed));
    setTransformAodeUsedInput(String(selected.aodePlan.transformAodeUsed));
  }, [
    selected?.id,
    selected?.aodePlan.shopAodePurchaseUsed,
    selected?.aodePlan.shopDailyDungeonTicketPurchaseUsed,
    selected?.aodePlan.transformAodeUsed,
  ]);

  const summary = useMemo(() => {
    if (!state) return [];
    return state.characters.map((item) => buildCharacterSummary(item, state.settings));
  }, [state]);

  const characterOrderById = useMemo(() => {
    if (!state) return new Map<string, number>();
    return new Map(state.characters.map((item, index) => [item.id, index]));
  }, [state]);

  const overviewByAccount = useMemo(() => {
    if (!state) return [];
    const expeditionCap = state.settings.expeditionRunCap ?? 21;
    const transcendenceCap = state.settings.transcendenceRunCap ?? 14;
    const nightmareCap = state.settings.nightmareRunCap ?? 14;
    const awakeningCap = state.settings.awakeningRunCap ?? 3;
    const suppressionCap = state.settings.suppressionRunCap ?? 3;
    return state.accounts
      .map((account) => {
        const characters = state.characters
          .filter((item) => item.accountId === account.id)
          .map((item) => {
            const expeditionCurrent = Math.min(
              item.activities.expeditionRemaining + item.activities.expeditionTicketBonus,
              item.activities.expeditionBossRemaining,
            );
            const expeditionTotal = expeditionCap + item.activities.expeditionTicketBonus;
            const expeditionBossCurrent = item.activities.expeditionBossRemaining;
            const expeditionBossTotal = 35;
            const transcendenceCurrent = Math.min(
              item.activities.transcendenceRemaining + item.activities.transcendenceTicketBonus,
              item.activities.transcendenceBossRemaining,
            );
            const transcendenceTotal = transcendenceCap + item.activities.transcendenceTicketBonus;
            const transcendenceBossCurrent = item.activities.transcendenceBossRemaining;
            const transcendenceBossTotal = 28;

            const sanctumRaidCurrent = item.activities.sanctumRaidRemaining;
            const sanctumRaidTotal = 4;
            const sanctumBoxCurrent = item.activities.sanctumBoxRemaining;
            const sanctumBoxTotal = 2;

            const dailyDungeonCurrent = item.activities.dailyDungeonRemaining + item.activities.dailyDungeonTicketStored;
            const dailyDungeonTotal = 7 + item.activities.dailyDungeonTicketStored;
            const nightmareCurrent = item.activities.nightmareRemaining + item.activities.nightmareTicketBonus;
            const nightmareTotal = nightmareCap + item.activities.nightmareTicketBonus;
            const awakeningCurrent = item.activities.awakeningRemaining + item.activities.awakeningTicketBonus;
            const awakeningTotal = awakeningCap + item.activities.awakeningTicketBonus;
            const suppressionCurrent = item.activities.suppressionRemaining + item.activities.suppressionTicketBonus;
            const suppressionTotal = suppressionCap + item.activities.suppressionTicketBonus;
            const miniGameCurrent = item.activities.miniGameRemaining + item.activities.miniGameTicketBonus;
            const miniGameTotal = 14 + item.activities.miniGameTicketBonus;
            const spiritCurrent = item.activities.spiritInvasionRemaining;
            const spiritTotal = 7;

            const dailyMissionCurrent = item.missions.dailyRemaining;
            const dailyMissionTotal = 5;
            const weeklyMissionCurrent = item.missions.weeklyRemaining;
            const weeklyMissionTotal = 12;
            const abyssLowerCurrent = item.missions.abyssLowerRemaining;
            const abyssLowerTotal = 20;
            const abyssMiddleCurrent = item.missions.abyssMiddleRemaining;
            const abyssMiddleTotal = 5;

            const corridorLowerCurrent = item.activities.corridorLowerAvailable;
            const corridorLowerTotal = 3;
            const corridorMiddleCurrent = item.activities.corridorMiddleAvailable;
            const corridorMiddleTotal = 3;
            const aodeLimits = getCharacterAodeLimits(state, item.id);
            const aodeBaseEnergyCurrent = item.energy.baseCurrent;
            const aodeBonusEnergyCurrent = item.energy.bonusCurrent;
            const aodeBaseEnergyCap = item.energy.baseCap;
            const aodeBaseEnergyOverflow = aodeBaseEnergyCurrent > AODE_BASE_ENERGY_OVERFLOW_WARN_THRESHOLD;
            const aodeShopAodePurchaseUsed = item.aodePlan.shopAodePurchaseUsed;
            const aodeShopDailyDungeonTicketPurchaseUsed = item.aodePlan.shopDailyDungeonTicketPurchaseUsed;
            const aodeTransformAodeUsed = item.aodePlan.transformAodeUsed;
            const aodeShopAodePurchaseRemaining = Math.max(0, aodeLimits.purchaseLimit - aodeShopAodePurchaseUsed);
            const aodeShopDailyDungeonTicketPurchaseRemaining = Math.max(
              0,
              aodeLimits.purchaseLimit - aodeShopDailyDungeonTicketPurchaseUsed,
            );
            const aodeTransformAodeRemaining = Math.max(0, aodeLimits.convertLimit - aodeTransformAodeUsed);
            const dungeonReadyBuckets = [
              expeditionCurrent,
              transcendenceCurrent,
              sanctumRaidCurrent,
              sanctumBoxCurrent,
            ].filter((value) => value > 0).length;
            const weeklyReadyBuckets = [
              dailyDungeonCurrent,
              nightmareCurrent,
              awakeningCurrent,
              suppressionCurrent,
              miniGameCurrent,
              spiritCurrent,
            ].filter((value) => value > 0).length;
            const missionReadyBuckets = [
              dailyMissionCurrent,
              weeklyMissionCurrent,
              abyssLowerCurrent,
              abyssMiddleCurrent,
              corridorLowerCurrent,
              corridorMiddleCurrent,
            ].filter((value) => value > 0).length;
            const readyBuckets = dungeonReadyBuckets + weeklyReadyBuckets + missionReadyBuckets;
            return {
              character: item,
              manualOrder: characterOrderById.get(item.id) ?? Number.MAX_SAFE_INTEGER,
              expeditionCurrent,
              expeditionTotal,
              expeditionBossCurrent,
              expeditionBossTotal,
              transcendenceCurrent,
              transcendenceTotal,
              transcendenceBossCurrent,
              transcendenceBossTotal,
              sanctumRaidCurrent,
              sanctumRaidTotal,
              sanctumBoxCurrent,
              sanctumBoxTotal,
              dailyDungeonCurrent,
              dailyDungeonTotal,
              nightmareCurrent,
              nightmareTotal,
              awakeningCurrent,
              awakeningTotal,
              suppressionCurrent,
              suppressionTotal,
              miniGameCurrent,
              miniGameTotal,
              spiritCurrent,
              spiritTotal,
              dailyMissionCurrent,
              dailyMissionTotal,
              weeklyMissionCurrent,
              weeklyMissionTotal,
              abyssLowerCurrent,
              abyssLowerTotal,
              abyssMiddleCurrent,
              abyssMiddleTotal,
              corridorLowerCurrent,
              corridorLowerTotal,
              corridorMiddleCurrent,
              corridorMiddleTotal,
              aodeBaseEnergyCurrent,
              aodeBonusEnergyCurrent,
              aodeBaseEnergyCap,
              aodeBaseEnergyOverflow,
              aodeShopAodePurchaseUsed,
              aodeShopDailyDungeonTicketPurchaseUsed,
              aodeTransformAodeUsed,
              aodeShopAodePurchaseRemaining,
              aodeShopDailyDungeonTicketPurchaseRemaining,
              aodeTransformAodeRemaining,
              aodeShopPurchaseLimit: aodeLimits.purchaseLimit,
              aodeTransformLimit: aodeLimits.convertLimit,
              dungeonReadyBuckets,
              weeklyReadyBuckets,
              missionReadyBuckets,
              readyBuckets,
            };
          });
        return {
          account,
          characters,
        };
      })
      .filter((group) => group.characters.length > 0);
  }, [state, characterOrderById]);

  const overviewRows = useMemo(
    () => overviewByAccount.flatMap((group) => group.characters.map((entry) => ({ ...entry, account: group.account }))),
    [overviewByAccount],
  );

  const overviewRegionOptions = useMemo(() => {
    if (!state) return [];
    const set = new Set<string>();
    for (const account of state.accounts) {
      const value = account.regionTag?.trim();
      if (value) {
        set.add(value);
      }
    }
    return [...set].sort((left, right) => left.localeCompare(right, "zh-CN"));
  }, [state]);

  const overviewRowsFiltered = useMemo(() => {
    const getReadyCountByTaskFilter = (entry: (typeof overviewRows)[number]): number => {
      if (overviewTaskFilter === "dungeon") return entry.dungeonReadyBuckets;
      if (overviewTaskFilter === "weekly") return entry.weeklyReadyBuckets;
      if (overviewTaskFilter === "mission") return entry.missionReadyBuckets;
      return entry.readyBuckets;
    };

    const next = overviewRows.filter((entry) => {
      if (overviewAccountFilter !== "all" && entry.account.id !== overviewAccountFilter) {
        return false;
      }
      const region = entry.account.regionTag?.trim() ?? "";
      if (overviewRegionFilter === NO_REGION_FILTER && region) {
        return false;
      }
      if (overviewRegionFilter !== "all" && overviewRegionFilter !== NO_REGION_FILTER && region !== overviewRegionFilter) {
        return false;
      }
      if (overviewTaskFilter !== "all" && getReadyCountByTaskFilter(entry) <= 0) {
        return false;
      }
      return true;
    });

    return next.sort((left, right) => {
      if (overviewSortKey === "manual") {
        return left.manualOrder - right.manualOrder;
      }
      if (overviewSortKey === "ready") {
        const diff = getReadyCountByTaskFilter(right) - getReadyCountByTaskFilter(left);
        if (diff !== 0) return diff;
        return left.character.name.localeCompare(right.character.name, "zh-CN");
      }
      if (overviewSortKey === "account") {
        const accountDiff = left.account.name.localeCompare(right.account.name, "zh-CN");
        if (accountDiff !== 0) return accountDiff;
        const countDiff = getReadyCountByTaskFilter(right) - getReadyCountByTaskFilter(left);
        if (countDiff !== 0) return countDiff;
        return left.character.name.localeCompare(right.character.name, "zh-CN");
      }
      const leftRegion = left.account.regionTag?.trim() ?? "";
      const rightRegion = right.account.regionTag?.trim() ?? "";
      if (leftRegion !== rightRegion) {
        if (!leftRegion) return 1;
        if (!rightRegion) return -1;
        return leftRegion.localeCompare(rightRegion, "zh-CN");
      }
      const countDiff = getReadyCountByTaskFilter(right) - getReadyCountByTaskFilter(left);
      if (countDiff !== 0) return countDiff;
      return left.character.name.localeCompare(right.character.name, "zh-CN");
    });
  }, [overviewRows, overviewTaskFilter, overviewAccountFilter, overviewRegionFilter, overviewSortKey]);

  const taskById = useMemo(() => {
    return new Map(TASK_DEFINITIONS.map((task) => [task.id, task]));
  }, []);

  const quickTask = taskById.get(quickTaskId as TaskId) ?? null;
  const quickCorridorTask = quickTaskId === "corridor_lower" || quickTaskId === "corridor_middle" ? QUICK_CORRIDOR_TASKS[quickTaskId] : null;
  const quickActionOptions = useMemo(() => {
    if (quickCorridorTask) {
      return ["set_completed"] as TaskActionKind[];
    }
    if (!quickTask) return [] as TaskActionKind[];
    return getQuickActionsForTask(quickTask);
  }, [quickTask, quickCorridorTask]);

  const quickAmountOptions = useMemo(() => {
    const min = quickAction === "set_completed" ? 0 : 1;
    const setCompletedMax = quickCorridorTask ? 3 : quickTask?.setCompletedTotal ?? COUNT_SELECT_MAX;
    const max = quickAction === "set_completed" ? Math.min(COUNT_SELECT_MAX, setCompletedMax) : COUNT_SELECT_MAX;
    return buildCountOptions(min, max, quickAmount);
  }, [quickAction, quickTask?.setCompletedTotal, quickCorridorTask, quickAmount]);

  useEffect(() => {
    if (!quickTask && !quickCorridorTask) return;
    if (!quickActionOptions.includes(quickAction)) {
      const nextAction = quickActionOptions[0] ?? "complete_once";
      setQuickAction(nextAction);
      setQuickAmount(nextAction === "set_completed" ? "0" : "1");
    }
  }, [quickTask, quickCorridorTask, quickActionOptions, quickAction]);

  useEffect(() => {
    setDraggingCharacterId(null);
    setDragOverCharacterId(null);
  }, [overviewSortKey]);

  const sanctumRaidTask = taskById.get("sanctum_raid");
  const sanctumBoxTask = taskById.get("sanctum_box");

  const groupedTasks = useMemo(() => {
    const base = TASK_DEFINITIONS.filter((task) => task.id !== "sanctum_raid" && task.id !== "sanctum_box").reduce(
      (acc, task) => {
        if (!acc[task.category]) {
          acc[task.category] = [];
        }
        acc[task.category].push(task);
        return acc;
      },
      {} as Record<TaskDefinition["category"], TaskDefinition[]>,
    );

    const weeklyOrder: Record<string, number> = {
      daily_dungeon: 1,
      nightmare: 2,
      awakening: 3,
      suppression: 4,
      mini_game: 5,
      spirit_invasion: 6,
    };
    if (base["周常"]) {
      base["周常"] = [...base["周常"]].sort((left, right) => {
        const leftRank = weeklyOrder[left.id] ?? 999;
        const rightRank = weeklyOrder[right.id] ?? 999;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.title.localeCompare(right.title, "zh-CN");
      });
    }
    return base;
  }, []);

  const historyRows = useMemo(() => {
    if (!state) return [];
    return [...state.history].reverse().slice(0, 20);
  }, [state]);

  const characterNameById = useMemo(() => {
    if (!state) return new Map<string, string>();
    return new Map(state.characters.map((item) => [item.id, item.name]));
  }, [state]);

  const accountNameById = useMemo(() => {
    if (!state) return new Map<string, string>();
    return new Map(state.accounts.map((item) => [item.id, item.name]));
  }, [state]);

  const countdownItems = useMemo(() => {
    const now = new Date(nowMs);
    const nextAodeEnergy = getNextScheduledTick(now, AODE_ENERGY_SCHEDULE_HOURS);
    const nextExpedition = getNextScheduledTick(now, EXPEDITION_SCHEDULE_HOURS);
    const nextTranscendence = getNextScheduledTick(now, TRANSCENDENCE_SCHEDULE_HOURS);
    const nextDailyReset = getNextDailyReset(now);
    const nextWeeklyReset = getNextWeeklyReset(now);
    const nextCorridorUnified = getNextUnifiedCorridorRefresh(now);
    return [
      { key: "aode_energy", title: "奥德恢复(+15)", target: nextAodeEnergy },
      { key: "expedition", title: "远征恢复", target: nextExpedition },
      { key: "transcendence", title: "超越恢复", target: nextTranscendence },
      { key: "daily", title: "每日重置", target: nextDailyReset },
      { key: "weekly", title: "每周重置", target: nextWeeklyReset },
      { key: "corridor_unified", title: "回廊刷新", target: nextCorridorUnified },
    ];
  }, [nowMs]);

  const priorityTodoItems = useMemo(() => {
    if (!state) return [];
    const now = new Date(nowMs);
    const nextWeeklyReset = getNextWeeklyReset(now);
    const weeklyRemainMs = Math.max(0, nextWeeklyReset.getTime() - now.getTime());
    const weeklyCriticalWindow = weeklyRemainMs <= 48 * 60 * 60 * 1000;
    const items: PriorityTodoItem[] = [];

    const pushItem = (
      entry: (typeof overviewRows)[number],
      taskKey: string,
      title: string,
      score: number,
      tone: PriorityTone,
      weightKey: PriorityWeightKey,
      detail: string,
    ): void => {
      const weightFactor = getPriorityWeightFactor(getPriorityWeightLevel(state.settings, weightKey));
      items.push({
        id: `${entry.character.id}-${taskKey}`,
        title,
        subtitle: `${entry.character.name} · ${entry.account.name}`,
        detail,
        score: Math.round(score * weightFactor),
        tone,
      });
    };

    for (const entry of overviewRows) {
      if (entry.aodeBaseEnergyOverflow) {
        pushItem(
          entry,
          "aode-base-overflow",
          "奥德能量（接近满溢）",
          980 + entry.aodeBaseEnergyCurrent,
          "high",
          "aode",
          `当前 ${entry.aodeBaseEnergyCurrent}/${entry.aodeBaseEnergyCap}（阈值>${AODE_BASE_ENERGY_OVERFLOW_WARN_THRESHOLD}），建议优先清体力`,
        );
      }

      const sanctumPending = entry.sanctumRaidCurrent + entry.sanctumBoxCurrent;
      if (sanctumPending > 0) {
        pushItem(
          entry,
          "sanctum",
          "圣域（周本）",
          1000 + sanctumPending,
          "high",
          "sanctum",
          `挑战 ${entry.sanctumRaidCurrent}/4，开箱 ${entry.sanctumBoxCurrent}/2`,
        );
      }

      const corridorPending = entry.corridorLowerCurrent + entry.corridorMiddleCurrent;
      if (corridorPending > 0) {
        pushItem(
          entry,
          "corridor",
          "深渊回廊",
          950 + corridorPending,
          "high",
          "corridor",
          `下层 ${entry.corridorLowerCurrent}/3，中层 ${entry.corridorMiddleCurrent}/3`,
        );
      }

      if (entry.dailyMissionCurrent > 0) {
        pushItem(
          entry,
          "daily-mission",
          "每日 5 个使命任务",
          950 + entry.dailyMissionCurrent,
          "high",
          "mission",
          `剩余 ${formatCounter(entry.dailyMissionCurrent, entry.dailyMissionTotal)}`,
        );
      }

      if (weeklyCriticalWindow && entry.awakeningCurrent > 0) {
        pushItem(
          entry,
          "awakening-weekly-due",
          "觉醒战（周刷新前）",
          1000 + entry.awakeningCurrent,
          "high",
          "weekly",
          `剩余 ${formatCounter(entry.awakeningCurrent, entry.awakeningTotal)}，48 小时内优先清理`,
        );
      }

      if (weeklyCriticalWindow && entry.suppressionCurrent > 0) {
        pushItem(
          entry,
          "suppression-weekly-due",
          "讨伐战（周刷新前）",
          995 + entry.suppressionCurrent,
          "high",
          "weekly",
          `剩余 ${formatCounter(entry.suppressionCurrent, entry.suppressionTotal)}，48 小时内优先清理`,
        );
      }

      if (entry.expeditionCurrent > 0) {
        const nearCap = entry.expeditionCurrent >= Math.max(1, entry.expeditionTotal - 2);
        pushItem(
          entry,
          "expedition",
          nearCap ? "远征（接近满次）" : "远征（清体力收益）",
          (nearCap ? 860 : 820) + entry.expeditionCurrent,
          nearCap ? "high" : "medium",
          "dungeon",
          `剩余 ${formatCounter(entry.expeditionCurrent, entry.expeditionTotal)}`,
        );
      }

      if (entry.transcendenceCurrent > 0) {
        const nearOverflow = entry.transcendenceCurrent >= Math.max(1, entry.transcendenceTotal - 1);
        pushItem(
          entry,
          "transcendence",
          nearOverflow ? "超越（溢出提醒）" : "超越",
          (nearOverflow ? 790 : 760) + entry.transcendenceCurrent,
          "medium",
          "dungeon",
          `剩余 ${formatCounter(entry.transcendenceCurrent, entry.transcendenceTotal)}`,
        );
      }

      if (entry.nightmareCurrent > 0) {
        const nearOverflow = entry.nightmareCurrent >= Math.max(1, entry.nightmareTotal - 1);
        if (nearOverflow) {
          pushItem(
            entry,
            "nightmare-overflow",
            "恶梦（溢出提醒）",
            780 + entry.nightmareCurrent,
            "medium",
            "weekly",
            `剩余 ${formatCounter(entry.nightmareCurrent, entry.nightmareTotal)}`,
          );
        }
      }

      if (weeklyCriticalWindow && entry.dailyDungeonCurrent > 0) {
        pushItem(
          entry,
          "daily-dungeon-weekly-due",
          "每日副本（周刷新前）",
          990 + entry.dailyDungeonCurrent,
          "high",
          "weekly",
          `剩余 ${formatCounter(entry.dailyDungeonCurrent, entry.dailyDungeonTotal)}，48 小时内优先清理`,
        );
      }

      if (weeklyCriticalWindow && entry.weeklyMissionCurrent > 0) {
        pushItem(
          entry,
          "weekly-order-due",
          "每周指令（周刷新前）",
          985 + entry.weeklyMissionCurrent,
          "high",
          "weekly",
          `剩余 ${formatCounter(entry.weeklyMissionCurrent, entry.weeklyMissionTotal)}，48 小时内优先完成`,
        );
      }

      if (weeklyCriticalWindow && entry.aodeShopAodePurchaseRemaining > 0) {
        pushItem(
          entry,
          "shop-aode-weekly-due",
          "商店-奥德（周刷新前）",
          980 + entry.aodeShopAodePurchaseRemaining,
          "high",
          "weekly",
          `剩余可用 ${formatCounter(entry.aodeShopAodePurchaseRemaining, entry.aodeShopPurchaseLimit)}`,
        );
      }
      if (weeklyCriticalWindow && entry.aodeShopDailyDungeonTicketPurchaseRemaining > 0) {
        pushItem(
          entry,
          "shop-ticket-weekly-due",
          "商店-副本券（周刷新前）",
          978 + entry.aodeShopDailyDungeonTicketPurchaseRemaining,
          "high",
          "weekly",
          `剩余可用 ${formatCounter(entry.aodeShopDailyDungeonTicketPurchaseRemaining, entry.aodeShopPurchaseLimit)}`,
        );
      }
      if (weeklyCriticalWindow && entry.aodeTransformAodeRemaining > 0) {
        pushItem(
          entry,
          "transform-aode-weekly-due",
          "变换-奥德（周刷新前）",
          976 + entry.aodeTransformAodeRemaining,
          "high",
          "weekly",
          `剩余可用 ${formatCounter(entry.aodeTransformAodeRemaining, entry.aodeTransformLimit)}`,
        );
      }

      if (entry.miniGameCurrent > 0) {
        pushItem(
          entry,
          "mini-game",
          "小游戏（低优先）",
          240 + entry.miniGameCurrent,
          "low",
          "leisure",
          `剩余 ${formatCounter(entry.miniGameCurrent, entry.miniGameTotal)}`,
        );
      }
      if (entry.spiritCurrent > 0) {
        pushItem(
          entry,
          "spirit-invasion",
          "精灵入侵（低优先）",
          220 + entry.spiritCurrent,
          "low",
          "leisure",
          `剩余 ${formatCounter(entry.spiritCurrent, entry.spiritTotal)}`,
        );
      }
    }

    return items.sort((left, right) => right.score - left.score).slice(0, 8);
  }, [overviewRows, nowMs, state]);

  const isWeeklyCriticalWindow = useMemo(() => {
    const now = new Date(nowMs);
    const nextWeeklyReset = getNextWeeklyReset(now);
    const weeklyRemainMs = Math.max(0, nextWeeklyReset.getTime() - now.getTime());
    return weeklyRemainMs <= 48 * 60 * 60 * 1000;
  }, [nowMs]);

  const selectedEstimatedGold =
    (selected ? summary.find((item) => item.characterId === selected.id)?.estimatedGoldIfClearEnergy : undefined) ?? 0;
  const selectedPendingLabels = selected ? (summary.find((item) => item.characterId === selected.id)?.pendingLabels ?? []) : [];
  const readyCharacters = summary.filter((item) => item.canRunExpedition).length;
  const weeklyGold = summary.reduce((acc, item) => acc + item.estimatedGoldIfClearEnergy, 0);
  const pendingDaily = summary.filter((item) => item.hasDailyMissionLeft).length;
  const pendingWeekly = summary.filter((item) => item.hasWeeklyMissionLeft).length;
  const weeklyEarned = summary.reduce((acc, item) => acc + item.weeklyGoldEarned, 0);
  const weeklyExpeditionRuns = state?.characters.reduce((acc, item) => acc + item.stats.completions.expedition, 0) ?? 0;
  const weeklyTransRuns = state?.characters.reduce((acc, item) => acc + item.stats.completions.transcendence, 0) ?? 0;
  const expeditionWarnThreshold = state?.settings.expeditionWarnThreshold ?? 84;
  const transcendenceWarnThreshold = state?.settings.transcendenceWarnThreshold ?? 56;
  const expeditionOverRewardThreshold = weeklyExpeditionRuns > expeditionWarnThreshold;
  const transcendenceOverThreshold = weeklyTransRuns > transcendenceWarnThreshold;
  const selectedAccountCharacterCount = accountCharacters.length;
  const canAddCharacterInSelectedAccount = selectedAccountCharacterCount < MAX_CHARACTERS_PER_ACCOUNT;
  const selectedIsAodeExtra = selectedAccount?.extraAodeCharacterId === selected?.id;
  const selectedShopAodePurchaseRemaining = selected
    ? Math.max(0, selectedAodeLimits.purchaseLimit - selected.aodePlan.shopAodePurchaseUsed)
    : 0;
  const selectedShopDailyDungeonTicketPurchaseRemaining = selected
    ? Math.max(0, selectedAodeLimits.purchaseLimit - selected.aodePlan.shopDailyDungeonTicketPurchaseUsed)
    : 0;
  const selectedTransformAodeRemaining = selected
    ? Math.max(0, selectedAodeLimits.convertLimit - selected.aodePlan.transformAodeUsed)
    : 0;

  async function sync(action: Promise<AppState>, successMessage?: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    if (successMessage) {
      setInfoMessage(null);
    }
    try {
      const next = await action;
      setState(next);
      if (successMessage) {
        setInfoMessage(successMessage);
      }
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

  function onAddAccount(): void {
    addAccountAction({
      newAccountName,
      newAccountRegion,
      appActions,
      sync,
      onInputCleared: () => {
        setNewAccountName("");
        setNewAccountRegion("");
      },
    });
  }

  function onSelectAccount(accountId: string): void {
    selectAccountAction({
      accountId,
      appActions,
      sync,
    });
  }

  function onRenameAccount(): void {
    renameAccountAction({
      selectedAccount,
      accountNameInput: accountEditor.name,
      accountRegionInput: accountEditor.regionTag,
      appActions,
      sync,
    });
  }

  function onDeleteAccount(): void {
    deleteAccountAction({
      selectedAccount,
      appActions,
      sync,
      confirm: window.confirm,
    });
  }

  function onAddCharacter(): void {
    addCharacterAction({
      selectedAccount,
      canAddCharacterInSelectedAccount,
      newCharacterName,
      appActions,
      sync,
      onError: setError,
      onInputCleared: () => setNewCharacterName(""),
    });
  }

  function onRenameCharacter(): void {
    renameCharacterAction({
      selectedCharacter: selected,
      renameInput: renameName,
      appActions,
      sync,
    });
  }

  function onSaveCharacterProfile(): void {
    saveCharacterProfileAction({
      selectedCharacter: selected,
      profileClassTagInput,
      profileGearScoreInput,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onDeleteCharacter(): void {
    deleteCharacterAction({
      selectedCharacter: selected,
      appActions,
      sync,
      confirm: window.confirm,
    });
  }

  function onSelectCharacter(characterId: string): void {
    selectCharacterAction({
      characterId,
      appActions,
      sync,
      onBeforeSelect: () => setDashboardMode("character"),
    });
  }

  function onOverviewCardDragStart(characterId: string): void {
    startOverviewCardDragAction({
      overviewSortKey,
      busy,
      characterId,
      onDraggingCharacterChange: setDraggingCharacterId,
      onDragOverCharacterChange: setDragOverCharacterId,
    });
  }

  function onOverviewCardDragOver(event: DragEvent<HTMLElement>, characterId: string): void {
    overviewCardDragOverAction({
      event,
      overviewSortKey,
      draggingCharacterId,
      characterId,
      dragOverCharacterId,
      onDragOverCharacterChange: setDragOverCharacterId,
    });
  }

  function onOverviewCardDrop(event: DragEvent<HTMLElement>, targetCharacterId: string): void {
    overviewCardDropAction({
      event,
      overviewSortKey,
      state,
      draggingCharacterId,
      targetCharacterId,
      appActions,
      sync,
      onDragStateReset: () => {
        setDraggingCharacterId(null);
        setDragOverCharacterId(null);
      },
    });
  }

  function onOverviewCardDragEnd(): void {
    endOverviewCardDragAction({
      onDragStateReset: () => {
        setDraggingCharacterId(null);
        setDragOverCharacterId(null);
      },
    });
  }

  function onSwitchToOverview(): void {
    setDashboardMode("overview");
  }

  function onApplyQuickAction(): void {
    applyQuickEntryAction({
      state,
      selectedCharacterId: selected?.id ?? null,
      quickCharacterId,
      quickTaskId,
      quickAction,
      quickAmountInput: quickAmount,
      quickCorridorTask,
      characterNameById,
      taskById,
      appActions,
      sync,
      onError: setError,
    });
  }

  function openCompleteDialog(taskId: TaskId, title: string): void {
    setDialogError(null);
    setDialog(buildCompleteDialog(taskId, title));
  }

  function openUseTicketDialog(taskId: TaskId, title: string): void {
    setDialogError(null);
    setDialog(buildUseTicketDialog(taskId, title));
  }

  function openSetCompletedDialog(task: TaskDefinition): void {
    const nextDialog = buildSetCompletedDialog(task);
    if (!nextDialog) return;
    setDialogError(null);
    setDialog(nextDialog);
  }

  function openEnergyDialog(): void {
    if (!selected) return;
    setDialogError(null);
    setDialog(buildEnergyDialog(selected));
  }

  function openTaskEditDialog(
    taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game",
  ): void {
    if (!selected) return;
    setDialogError(null);
    setDialog(buildTaskEditDialog(selected, taskId));
  }

  function openSanctumEditDialog(): void {
    if (!selected) return;
    setDialogError(null);
    setDialog(buildSanctumEditDialog(selected));
  }

  function onSyncCorridorStatus(): void {
    setDialogError(null);
    setDialog(buildCorridorSyncDialog(corridorDraft));
  }

  function onApplyCorridorCompletion(): void {
    setDialogError(null);
    setDialog(buildCorridorCompleteDialog(corridorDraft));
  }

  function onApplyCorridorSettings(): void {
    void applyCorridorSettingsAction({
      selectedAccountId: selectedAccount?.id ?? null,
      corridorDraft,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onApplyCorridorCompletionFromSettings(): void {
    void applyCorridorCompletionFromSettingsAction({
      selectedCharacterId: selected?.id ?? null,
      corridorDraft,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onResetWeeklyStats(): void {
    void resetWeeklyStatsAction({
      appActions,
      sync,
      confirm: window.confirm,
    });
  }

  function onSaveWeeklyCompletions(): void {
    void saveWeeklyCompletionsAction({
      selectedCharacterId: selected?.id ?? null,
      weeklyExpeditionCompletedInput,
      weeklyTranscendenceCompletedInput,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onSaveShopPlan(): void {
    void saveShopPlanAction({
      selectedCharacterId: selected?.id ?? null,
      shopAodePurchaseUsedInput,
      shopDailyDungeonTicketPurchaseUsedInput,
      purchaseLimit: selectedAodeLimits.purchaseLimit,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onSaveTransformPlan(): void {
    void saveTransformPlanAction({
      selectedCharacterId: selected?.id ?? null,
      transformAodeUsedInput,
      convertLimit: selectedAodeLimits.convertLimit,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onAssignExtraAodeCharacter(assignExtra: boolean): void {
    void assignExtraAodeCharacterAction({
      selectedCharacterId: selected?.id ?? null,
      assignExtra,
      appActions,
      sync,
    });
  }

  function onUndoSingleStep(): void {
    void undoSingleStepAction({
      state,
      appActions,
      sync,
    });
  }

  function onUndoMultiStep(): void {
    void undoMultiStepAction({
      state,
      undoStepsInput: undoSteps,
      appActions,
      sync,
      onError: setError,
    });
  }

  function onClearHistory(): void {
    void clearHistoryAction({
      state,
      appActions,
      sync,
      confirm: window.confirm,
    });
  }

  function onSaveSettings(): void {
    void saveDashboardSettingsAction({
      settingsDraft,
      appActions,
      sync,
      onError: setError,
    });
  }

  async function onExportData(): Promise<void> {
    await exportDashboardDataAction({
      appActions,
      onBusyChange: setBusy,
      onError: setError,
      onInfoMessage: setInfoMessage,
    });
  }

  async function onImportData(): Promise<void> {
    await importDashboardDataAction({
      appActions,
      onBusyChange: setBusy,
      onError: setError,
      onInfoMessage: setInfoMessage,
      onStateImported: setState,
    });
  }

  function onConfirmDialog(): void {
    if (!selected || !dialog) return;

    void (async () => {
      await confirmDashboardDialog({
        dialog,
        selected,
        selectedAccountId: selectedAccount?.id ?? null,
        appActions,
        taskById,
        sync,
        onDialogError: setDialogError,
        onDialogClose: () => {
          setDialog(null);
          setDialogError(null);
        },
        onCorridorDraftSyncCounts: (lower, middle) => {
          setCorridorDraft((prev) => ({
            ...prev,
            lowerAvailable: String(lower),
            middleAvailable: String(middle),
          }));
        },
        onCorridorDraftSyncCompletion: (completed, lane) => {
          setCorridorDraft((prev) => ({ ...prev, completeAmount: String(completed), completeLane: lane }));
        },
      });
    })();
  }

  if (!state || !settingsDraft) {
    return (
      <main className="min-h-screen p-8 text-white">
        <div className="glass-panel mx-auto mt-20 max-w-md rounded-2xl p-6 text-center">
          <p className="text-sm text-slate-200">正在加载 AION 2 Dashboard...</p>
          {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  if (!selected) {
    return (
      <main className="min-h-screen p-8 text-slate-100">
        <div className="glass-panel mx-auto mt-16 max-w-xl rounded-3xl bg-[rgba(20,20,20,0.58)] p-6 backdrop-blur-2xl backdrop-saturate-150">
          <h1 className="text-xl font-semibold">AION 2 Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">当前没有任何账号或角色数据。请先创建你的第一个账号。</p>
          <div className="mt-4 space-y-2">
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="新账号名称"
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              disabled={busy}
            />
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder="大区(可选)"
              value={newAccountRegion}
              onChange={(event) => setNewAccountRegion(event.target.value)}
              disabled={busy}
            />
            <button className="task-btn w-full" onClick={onAddAccount} disabled={busy || !newAccountName.trim()}>
              创建第一个账号
            </button>
          </div>
          {infoMessage ? <p className="mt-3 text-xs text-emerald-300">{infoMessage}</p> : null}
          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5 text-slate-100">
      <div className="grid min-h-[calc(100vh-2.5rem)] w-full grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px] 2xl:grid-cols-[340px_minmax(0,1fr)_400px] 2xl:gap-5">
        <DashboardLeftSidebar
          busy={busy}
          state={state}
          selectedAccount={selectedAccount}
          selected={selected}
          newAccountName={newAccountName}
          newAccountRegion={newAccountRegion}
          onNewAccountNameChange={setNewAccountName}
          onNewAccountRegionChange={setNewAccountRegion}
          onAddAccount={onAddAccount}
          accountEditor={accountEditor}
          onAccountEditorChange={setAccountEditor}
          onRenameAccount={onRenameAccount}
          onDeleteAccount={onDeleteAccount}
          onSelectAccount={onSelectAccount}
          maxCharactersPerAccount={MAX_CHARACTERS_PER_ACCOUNT}
          selectedAccountCharacterCount={selectedAccountCharacterCount}
          newCharacterName={newCharacterName}
          onNewCharacterNameChange={setNewCharacterName}
          onAddCharacter={onAddCharacter}
          canAddCharacterInSelectedAccount={canAddCharacterInSelectedAccount}
          accountCharacters={accountCharacters}
          onSelectCharacter={onSelectCharacter}
        />

        <section className="min-w-0 w-full space-y-5">
          <DashboardToolbar
            busy={busy}
            viewMode={viewMode}
            dashboardMode={dashboardMode}
            infoMessage={infoMessage}
            error={error}
            onSwitchOverview={() => {
              setViewMode("dashboard");
              setDashboardMode("overview");
            }}
            onSwitchCharacter={() => {
              setViewMode("dashboard");
              setDashboardMode("character");
            }}
            onSwitchSettings={() => setViewMode("settings")}
            onSwitchWorkshop={() => setViewMode("workshop")}
          />

          <DashboardOverviewSummaryCards
            visible={viewMode === "dashboard"}
            readyCharacters={readyCharacters}
            weeklyGoldText={toGoldText(weeklyGold)}
            pendingDaily={pendingDaily}
            pendingWeekly={pendingWeekly}
          />

          <DashboardOverviewPanel
            visible={viewMode === "dashboard" && dashboardMode === "overview"}
            busy={busy}
            state={state}
            accountNameById={accountNameById}
            quickCharacterId={quickCharacterId}
            onQuickCharacterIdChange={setQuickCharacterId}
            quickTaskId={quickTaskId}
            onQuickTaskIdChange={setQuickTaskId}
            quickAction={quickAction}
            onQuickActionChange={setQuickAction}
            quickAmount={quickAmount}
            onQuickAmountChange={setQuickAmount}
            quickActionOptions={quickActionOptions}
            quickAmountOptions={quickAmountOptions}
            onApplyQuickAction={onApplyQuickAction}
            quickTaskExists={Boolean(quickTask)}
            quickTaskSetCompletedTotal={quickTask?.setCompletedTotal ?? null}
            quickCorridorTask={quickCorridorTask}
            overviewSortKey={overviewSortKey}
            onOverviewSortKeyChange={setOverviewSortKey}
            overviewTaskFilter={overviewTaskFilter}
            onOverviewTaskFilterChange={setOverviewTaskFilter}
            overviewAccountFilter={overviewAccountFilter}
            onOverviewAccountFilterChange={setOverviewAccountFilter}
            overviewRegionFilter={overviewRegionFilter}
            onOverviewRegionFilterChange={setOverviewRegionFilter}
            overviewRegionOptions={overviewRegionOptions}
            overviewRowsFiltered={overviewRowsFiltered}
            draggingCharacterId={draggingCharacterId}
            dragOverCharacterId={dragOverCharacterId}
            onOverviewCardDragStart={onOverviewCardDragStart}
            onOverviewCardDragOver={onOverviewCardDragOver}
            onOverviewCardDrop={onOverviewCardDrop}
            onOverviewCardDragEnd={onOverviewCardDragEnd}
            isWeeklyCriticalWindow={isWeeklyCriticalWindow}
            onSelectCharacter={onSelectCharacter}
          />

          <DashboardCharacterMainPanel
            visible={viewMode === "dashboard" && dashboardMode === "character"}
            busy={busy}
            selected={selected}
            accountName={selectedAccount?.name ?? "--"}
            accountRegionTag={selectedAccount?.regionTag ?? null}
            estimatedGoldText={toGoldText(selectedEstimatedGold)}
            classTag={selected.classTag?.trim() || "未填写"}
            gearScore={selected.gearScore}
            weeklyGoldEarnedText={toGoldText(selected.stats.goldEarned)}
            corridorLowerAvailable={selected.activities.corridorLowerAvailable}
            corridorMiddleAvailable={selected.activities.corridorMiddleAvailable}
            renameName={renameName}
            profileClassTagInput={profileClassTagInput}
            profileGearScoreInput={profileGearScoreInput}
            canDeleteCharacter={selectedAccountCharacterCount > 1}
            selectedAodeLimits={selectedAodeLimits}
            selectedIsAodeExtra={selectedIsAodeExtra}
            selectedAccountExtraCharacterName={selectedAccountExtraCharacterName}
            selectedShopAodePurchaseRemaining={selectedShopAodePurchaseRemaining}
            selectedShopDailyDungeonTicketPurchaseRemaining={selectedShopDailyDungeonTicketPurchaseRemaining}
            selectedTransformAodeRemaining={selectedTransformAodeRemaining}
            shopAodePurchaseUsedInput={shopAodePurchaseUsedInput}
            shopDailyDungeonTicketPurchaseUsedInput={shopDailyDungeonTicketPurchaseUsedInput}
            transformAodeUsedInput={transformAodeUsedInput}
            onSwitchToOverview={onSwitchToOverview}
            onRenameNameChange={setRenameName}
            onProfileClassTagInputChange={setProfileClassTagInput}
            onProfileGearScoreInputChange={setProfileGearScoreInput}
            onSaveCharacterProfile={onSaveCharacterProfile}
            onRenameCharacter={onRenameCharacter}
            onDeleteCharacter={onDeleteCharacter}
            onOpenEnergyDialog={openEnergyDialog}
            onSyncCorridorStatus={onSyncCorridorStatus}
            onApplyCorridorCompletion={onApplyCorridorCompletion}
            onResetWeeklyStats={onResetWeeklyStats}
            onShopAodePurchaseUsedInputChange={setShopAodePurchaseUsedInput}
            onShopDailyDungeonTicketPurchaseUsedInputChange={setShopDailyDungeonTicketPurchaseUsedInput}
            onTransformAodeUsedInputChange={setTransformAodeUsedInput}
            onSaveShopPlan={onSaveShopPlan}
            onAssignExtraAodeCharacter={onAssignExtraAodeCharacter}
            onSaveTransformPlan={onSaveTransformPlan}
          />

          <DashboardCharacterModePanels
            weeklyVisible={viewMode === "dashboard"}
            characterVisible={viewMode === "dashboard" && dashboardMode === "character"}
            busy={busy}
            weeklyEarnedText={toGoldText(weeklyEarned)}
            weeklyExpeditionRuns={weeklyExpeditionRuns}
            expeditionWarnThreshold={expeditionWarnThreshold}
            weeklyTransRuns={weeklyTransRuns}
            transcendenceWarnThreshold={transcendenceWarnThreshold}
            cycleStartedAt={selected.stats.cycleStartedAt}
            weeklyExpeditionCompletedInput={weeklyExpeditionCompletedInput}
            weeklyTranscendenceCompletedInput={weeklyTranscendenceCompletedInput}
            onWeeklyExpeditionCompletedInputChange={setWeeklyExpeditionCompletedInput}
            onWeeklyTranscendenceCompletedInputChange={setWeeklyTranscendenceCompletedInput}
            onSaveWeeklyCompletions={onSaveWeeklyCompletions}
            expeditionOverRewardThreshold={expeditionOverRewardThreshold}
            transcendenceOverThreshold={transcendenceOverThreshold}
            state={state}
            selected={selected}
            groupedTasks={groupedTasks}
            sanctumRaidTask={sanctumRaidTask}
            sanctumBoxTask={sanctumBoxTask}
            onOpenSetCompletedDialog={openSetCompletedDialog}
            onOpenCompleteDialog={openCompleteDialog}
            onOpenUseTicketDialog={openUseTicketDialog}
            onOpenTaskEditDialog={openTaskEditDialog}
            onOpenSanctumEditDialog={openSanctumEditDialog}
          />

          {viewMode === "workshop" ? (
            <WorkshopView
              externalPriceChangeNonce={workshopPriceChangeNonce}
              onJumpToHistoryManager={({ itemId, snapshotId }) => {
                setViewMode("workshop");
                setWorkshopHistoryJumpItemId(itemId);
                setWorkshopHistoryJumpSnapshotId(snapshotId ?? null);
                setWorkshopHistoryJumpNonce((prev) => prev + 1);
              }}
            />
          ) : null}

          <DashboardSettingsPanel
            visible={viewMode === "settings"}
            busy={busy}
            settingsDraft={settingsDraft}
            corridorDraft={corridorDraft}
            buildInfo={buildInfo}
            onSettingsDraftChange={setSettingsDraft}
            onCorridorDraftChange={setCorridorDraft}
            onSaveSettings={onSaveSettings}
            onExportData={onExportData}
            onImportData={onImportData}
            onApplyCorridorSettings={onApplyCorridorSettings}
            onApplyCorridorCompletionFromSettings={onApplyCorridorCompletionFromSettings}
          />

        </section>

        <DashboardRightSidebar
          busy={busy}
          historyCount={state.history.length}
          undoSteps={undoSteps}
          onUndoStepsChange={setUndoSteps}
          onUndoSingleStep={onUndoSingleStep}
          onUndoMultiStep={onUndoMultiStep}
          onClearHistory={onClearHistory}
          viewMode={viewMode}
          dashboardMode={dashboardMode}
          workshopHistoryJumpItemId={workshopHistoryJumpItemId}
          workshopHistoryJumpSnapshotId={workshopHistoryJumpSnapshotId}
          workshopHistoryJumpNonce={workshopHistoryJumpNonce}
          onWorkshopPriceDataChanged={() => setWorkshopPriceChangeNonce((prev) => prev + 1)}
          countdownItems={countdownItems}
          nowMs={nowMs}
          priorityTodoItems={priorityTodoItems}
          historyRows={historyRows}
          characterNameById={characterNameById}
          pendingLabels={selectedPendingLabels}
        />
      </div>

      <DashboardDialogModal
        dialog={dialog}
        busy={busy}
        dialogError={dialogError}
        selected={selected}
        taskById={taskById}
        onDialogChange={(next) => setDialog(next)}
        onCancel={() => {
          setDialog(null);
          setDialogError(null);
        }}
        onConfirm={onConfirmDialog}
      />
    </main>
  );
}

