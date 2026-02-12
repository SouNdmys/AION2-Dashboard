import { useEffect, useMemo, useState } from "react";
import {
  AODE_POINT_PER_OPERATION,
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  AODE_WEEKLY_EXTRA_CONVERT_MAX,
  AODE_WEEKLY_EXTRA_PURCHASE_MAX,
  EXPEDITION_SCHEDULE_HOURS,
  TASK_DEFINITIONS,
  TRANSCENDENCE_SCHEDULE_HOURS,
} from "../../shared/constants";
import {
  buildCharacterSummary,
  estimateCharacterGold,
  getTaskGoldReward,
  getTaskProgressText,
  getTaskRemaining,
  getTotalEnergy,
} from "../../shared/engine";
import { getNextDailyReset, getNextScheduledTick, getNextUnifiedCorridorRefresh, getNextWeeklyReset } from "../../shared/time";
import type { AppBuildInfo, AppSettings, AppState, TaskActionKind, TaskDefinition, TaskId } from "../../shared/types";

const numberFormatter = new Intl.NumberFormat("zh-CN");
type ViewMode = "dashboard" | "settings";
type DashboardMode = "overview" | "character";
type OverviewSortKey = "ready" | "account" | "region";
type OverviewTaskFilter = "all" | "dungeon" | "weekly" | "mission";
const MAX_CHARACTERS_PER_ACCOUNT = 8;
const NO_REGION_FILTER = "__none__";
const COUNT_SELECT_MAX = 100;

type DialogState =
  | { kind: "complete"; taskId: TaskId; title: string; amount: string }
  | { kind: "use_ticket"; taskId: TaskId; title: string; amount: string }
  | { kind: "set_completed"; task: TaskDefinition; amount: string }
  | { kind: "energy"; baseCurrent: string; bonusCurrent: string }
  | {
      kind: "corridor_sync";
      lowerAvailable: string;
      middleAvailable: string;
    }
  | { kind: "corridor_complete"; lane: "lower" | "middle"; amount: string }
  | {
      kind: "task_edit";
      taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game";
      title: string;
      remainingLabel: string;
      bonusLabel: string;
      remaining: string;
      bonus: string;
      boss?: string;
      bossLabel?: string;
    }
  | { kind: "sanctum_edit"; raidRemaining: string; boxRemaining: string };

interface SettingsDraft {
  expeditionGoldPerRun: string;
  transcendenceGoldPerRun: string;
  expeditionRunCap: string;
  transcendenceRunCap: string;
  nightmareRunCap: string;
  awakeningRunCap: string;
  suppressionRunCap: string;
  expeditionWarnThreshold: string;
  transcendenceWarnThreshold: string;
}

interface CorridorDraft {
  lowerAvailable: string;
  middleAvailable: string;
  completeLane: "lower" | "middle";
  completeAmount: string;
}

interface AccountEditorDraft {
  name: string;
  regionTag: string;
}

type PriorityTone = "high" | "medium" | "low";

interface PriorityTodoItem {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  score: number;
  tone: PriorityTone;
}

function getQuickActionsForTask(task: TaskDefinition): TaskActionKind[] {
  if (task.allowSetCompleted) {
    return ["set_completed"];
  }
  const actions: TaskActionKind[] = [];
  if (task.allowComplete) {
    actions.push("complete_once");
  }
  if (task.allowUseTicket) {
    actions.push("use_ticket");
  }
  return actions;
}

function toGoldText(value: number): string {
  const wanValue = value / 10_000;
  const text = Number.isInteger(wanValue) ? numberFormatter.format(wanValue) : wanValue.toFixed(1);
  return `${text} 万金币`;
}

async function loadState(): Promise<AppState> {
  if (!window.aionApi) {
    throw new Error("Preload API unavailable: window.aionApi is undefined");
  }
  return window.aionApi.getState();
}

async function loadBuildInfo(): Promise<AppBuildInfo> {
  if (!window.aionApi) {
    throw new Error("Preload API unavailable: window.aionApi is undefined");
  }
  return window.aionApi.getBuildInfo();
}

function toInt(raw: string): number | null {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return null;
  return n;
}

function toNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseOptionalCap(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = toInt(trimmed);
  if (value === null || value <= 0) {
    return "invalid";
  }
  return value;
}

function buildSettingsDraft(settings: AppSettings): SettingsDraft {
  return {
    expeditionGoldPerRun: String(settings.expeditionGoldPerRun / 10_000),
    transcendenceGoldPerRun: String(settings.transcendenceGoldPerRun / 10_000),
    expeditionRunCap: settings.expeditionRunCap === null ? "" : String(settings.expeditionRunCap),
    transcendenceRunCap: settings.transcendenceRunCap === null ? "" : String(settings.transcendenceRunCap),
    nightmareRunCap: settings.nightmareRunCap === null ? "" : String(settings.nightmareRunCap),
    awakeningRunCap: settings.awakeningRunCap === null ? "" : String(settings.awakeningRunCap),
    suppressionRunCap: settings.suppressionRunCap === null ? "" : String(settings.suppressionRunCap),
    expeditionWarnThreshold: String(settings.expeditionWarnThreshold),
    transcendenceWarnThreshold: String(settings.transcendenceWarnThreshold),
  };
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "00:00:00";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getCharacterAodeLimits(state: AppState, characterId: string): { purchaseLimit: number; convertLimit: number } {
  const character = state.characters.find((item) => item.id === characterId);
  if (!character) {
    return {
      purchaseLimit: AODE_WEEKLY_BASE_PURCHASE_MAX,
      convertLimit: AODE_WEEKLY_BASE_CONVERT_MAX,
    };
  }
  const account = state.accounts.find((item) => item.id === character.accountId);
  const isExtra = account?.extraAodeCharacterId === character.id;
  return {
    purchaseLimit: AODE_WEEKLY_BASE_PURCHASE_MAX + (isExtra ? AODE_WEEKLY_EXTRA_PURCHASE_MAX : 0),
    convertLimit: AODE_WEEKLY_BASE_CONVERT_MAX + (isExtra ? AODE_WEEKLY_EXTRA_CONVERT_MAX : 0),
  };
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBuildTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("zh-CN");
}

function buildCorridorDraft(lowerAvailable: number, middleAvailable: number): CorridorDraft {
  return {
    lowerAvailable: String(lowerAvailable),
    middleAvailable: String(middleAvailable),
    completeLane: "lower",
    completeAmount: "1",
  };
}

function formatCounter(current: number, total: number): string {
  const safeCurrent = Math.max(0, Math.floor(current));
  const safeTotal = Math.max(0, Math.floor(total));
  return `${safeCurrent}/${safeTotal}`;
}

function getBoardToneClass(current: number, total: number): string {
  if (current <= 0) {
    return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  }
  const ratio = total > 0 ? current / total : 0;
  if (ratio >= 0.5) {
    return "border-cyan-300/45 bg-cyan-400/15 text-cyan-100";
  }
  return "border-amber-300/45 bg-amber-400/15 text-amber-100";
}

function getUrgentBoardToneClass(current: number, total: number, urgent: boolean): string {
  if (urgent && current > 0) {
    return "border-rose-300/55 bg-rose-500/20 text-rose-100";
  }
  return getBoardToneClass(current, total);
}

function getPriorityToneClass(tone: PriorityTone): string {
  if (tone === "high") {
    return "border-rose-300/45 bg-rose-400/15 text-rose-100";
  }
  if (tone === "medium") {
    return "border-amber-300/45 bg-amber-400/15 text-amber-100";
  }
  return "border-cyan-300/45 bg-cyan-400/15 text-cyan-100";
}

function buildCountOptions(min: number, max: number, currentValue?: string): string[] {
  let safeMin = Math.max(0, Math.floor(min));
  let safeMax = Math.max(safeMin, Math.floor(max));
  const current = currentValue === undefined ? null : toInt(currentValue);
  if (current !== null && current > safeMax) {
    safeMax = current;
  }
  if (current !== null && current < safeMin) {
    safeMin = current;
  }
  return Array.from({ length: safeMax - safeMin + 1 }, (_, index) => String(safeMin + index));
}

export function App(): JSX.Element {
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
  const [corridorDraft, setCorridorDraft] = useState<CorridorDraft>(
    buildCorridorDraft(0, 0),
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [overviewSortKey, setOverviewSortKey] = useState<OverviewSortKey>("ready");
  const [overviewTaskFilter, setOverviewTaskFilter] = useState<OverviewTaskFilter>("all");
  const [overviewAccountFilter, setOverviewAccountFilter] = useState<string>("all");
  const [overviewRegionFilter, setOverviewRegionFilter] = useState<string>("all");
  const [quickCharacterId, setQuickCharacterId] = useState("");
  const [quickTaskId, setQuickTaskId] = useState<TaskId>("expedition");
  const [quickAction, setQuickAction] = useState<TaskActionKind>("complete_once");
  const [quickAmount, setQuickAmount] = useState("1");
  const [weeklyExpeditionCompletedInput, setWeeklyExpeditionCompletedInput] = useState("0");
  const [weeklyTranscendenceCompletedInput, setWeeklyTranscendenceCompletedInput] = useState("0");
  const [shopAodePurchaseUsedInput, setShopAodePurchaseUsedInput] = useState("0");
  const [shopDailyDungeonTicketPurchaseUsedInput, setShopDailyDungeonTicketPurchaseUsedInput] = useState("0");
  const [transformAodeUsedInput, setTransformAodeUsedInput] = useState("0");

  useEffect(() => {
    void (async () => {
      try {
        const [next, buildMeta] = await Promise.all([loadState(), loadBuildInfo()]);
        setState(next);
        setBuildInfo(buildMeta);
      } catch (err) {
        setError(err instanceof Error ? err.message : "初始化失败");
      }
    })();
  }, []);

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
  }, [state]);

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

  const quickTask = taskById.get(quickTaskId) ?? null;
  const quickActionOptions = useMemo(() => {
    if (!quickTask) return [] as TaskActionKind[];
    return getQuickActionsForTask(quickTask);
  }, [quickTask]);

  const quickAmountOptions = useMemo(() => {
    const min = quickAction === "set_completed" ? 0 : 1;
    const setCompletedMax = quickTask?.setCompletedTotal ?? COUNT_SELECT_MAX;
    const max = quickAction === "set_completed" ? Math.min(COUNT_SELECT_MAX, setCompletedMax) : COUNT_SELECT_MAX;
    return buildCountOptions(min, max, quickAmount);
  }, [quickAction, quickTask?.setCompletedTotal, quickAmount]);

  useEffect(() => {
    if (!quickTask) return;
    if (!quickActionOptions.includes(quickAction)) {
      const nextAction = quickActionOptions[0] ?? "complete_once";
      setQuickAction(nextAction);
      setQuickAmount(nextAction === "set_completed" ? "0" : "1");
    }
  }, [quickTask, quickActionOptions, quickAction]);

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
    const nextExpedition = getNextScheduledTick(now, EXPEDITION_SCHEDULE_HOURS);
    const nextTranscendence = getNextScheduledTick(now, TRANSCENDENCE_SCHEDULE_HOURS);
    const nextDailyReset = getNextDailyReset(now);
    const nextWeeklyReset = getNextWeeklyReset(now);
    const nextCorridorUnified = getNextUnifiedCorridorRefresh(now);
    return [
      { key: "expedition", title: "远征恢复", target: nextExpedition },
      { key: "transcendence", title: "超越恢复", target: nextTranscendence },
      { key: "daily", title: "每日重置", target: nextDailyReset },
      { key: "weekly", title: "每周重置", target: nextWeeklyReset },
      { key: "corridor_unified", title: "回廊刷新", target: nextCorridorUnified },
    ];
  }, [nowMs]);

  const priorityTodoItems = useMemo(() => {
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
      detail: string,
    ): void => {
      items.push({
        id: `${entry.character.id}-${taskKey}`,
        title,
        subtitle: `${entry.character.name} · ${entry.account.name}`,
        detail,
        score,
        tone,
      });
    };

    for (const entry of overviewRows) {
      const sanctumPending = entry.sanctumRaidCurrent + entry.sanctumBoxCurrent;
      if (sanctumPending > 0) {
        pushItem(
          entry,
          "sanctum",
          "圣域（周本）",
          1000 + sanctumPending,
          "high",
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
          `剩余可用 ${formatCounter(entry.aodeTransformAodeRemaining, entry.aodeTransformLimit)}`,
        );
      }

      if (entry.miniGameCurrent > 0) {
        pushItem(entry, "mini-game", "小游戏（低优先）", 240 + entry.miniGameCurrent, "low", `剩余 ${formatCounter(entry.miniGameCurrent, entry.miniGameTotal)}`);
      }
      if (entry.spiritCurrent > 0) {
        pushItem(entry, "spirit-invasion", "精灵入侵（低优先）", 220 + entry.spiritCurrent, "low", `剩余 ${formatCounter(entry.spiritCurrent, entry.spiritTotal)}`);
      }
    }

    return items.sort((left, right) => right.score - left.score).slice(0, 8);
  }, [overviewRows, nowMs]);

  const isWeeklyCriticalWindow = useMemo(() => {
    const now = new Date(nowMs);
    const nextWeeklyReset = getNextWeeklyReset(now);
    const weeklyRemainMs = Math.max(0, nextWeeklyReset.getTime() - now.getTime());
    return weeklyRemainMs <= 48 * 60 * 60 * 1000;
  }, [nowMs]);

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
    const name = newAccountName.trim();
    if (!name) return;
    const regionTag = newAccountRegion.trim();
    void sync(window.aionApi.addAccount(name, regionTag || undefined));
    setNewAccountName("");
    setNewAccountRegion("");
  }

  function onSelectAccount(accountId: string): void {
    void sync(window.aionApi.selectAccount(accountId));
  }

  function onRenameAccount(): void {
    if (!selectedAccount) return;
    const name = accountEditor.name.trim();
    if (!name) return;
    const regionTag = accountEditor.regionTag.trim();
    void sync(
      window.aionApi.renameAccount(selectedAccount.id, name, regionTag || undefined),
      "账号信息已更新",
    );
  }

  function onDeleteAccount(): void {
    if (!selectedAccount) return;
    const ok = window.confirm(`确认删除账号「${selectedAccount.name}」及其所有角色？`);
    if (!ok) return;
    void sync(window.aionApi.deleteAccount(selectedAccount.id));
  }

  function onAddCharacter(): void {
    if (!selectedAccount) return;
    if (!canAddCharacterInSelectedAccount) {
      setError(`当前账号最多 ${MAX_CHARACTERS_PER_ACCOUNT} 个角色`);
      return;
    }
    const name = newCharacterName.trim();
    if (!name) return;
    void sync(window.aionApi.addCharacter(name, selectedAccount.id));
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
    setDashboardMode("character");
    void sync(window.aionApi.selectCharacter(characterId));
  }

  function onSwitchToOverview(): void {
    setDashboardMode("overview");
  }

  function onApplyQuickAction(): void {
    if (!state) return;
    const characterId = quickCharacterId || selected?.id;
    if (!characterId) {
      setError("请选择角色");
      return;
    }
    const task = taskById.get(quickTaskId);
    if (!task) {
      setError("请选择有效内容");
      return;
    }
    const allowedActions = getQuickActionsForTask(task);
    if (!allowedActions.includes(quickAction)) {
      setError("该内容不支持当前动作");
      return;
    }

    const rawAmount = toInt(quickAmount);
    if (rawAmount === null) {
      setError("请输入有效次数");
      return;
    }

    let amount = rawAmount;
    if (quickAction === "set_completed") {
      if (amount < 0) {
        setError("已完成次数不能小于 0");
        return;
      }
      if (task.setCompletedTotal) {
        amount = Math.min(amount, task.setCompletedTotal);
      }
    } else if (amount <= 0) {
      setError("次数必须大于 0");
      return;
    }

    const characterName = characterNameById.get(characterId) ?? "角色";
    void sync(
      window.aionApi.applyTaskAction({
        characterId,
        taskId: task.id,
        action: quickAction,
        amount,
      }),
      `${characterName} ${task.title} 已录入`,
    );
  }

  function openCompleteDialog(taskId: TaskId, title: string): void {
    setDialogError(null);
    setDialog({ kind: "complete", taskId, title, amount: "1" });
  }

  function openUseTicketDialog(taskId: TaskId, title: string): void {
    setDialogError(null);
    setDialog({ kind: "use_ticket", taskId, title, amount: "1" });
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

  function openTaskEditDialog(
    taskId: "expedition" | "transcendence" | "nightmare" | "awakening" | "suppression" | "daily_dungeon" | "mini_game",
  ): void {
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
    if (taskId === "daily_dungeon") {
      setDialog({
        kind: "task_edit",
        taskId,
        title: "每日副本",
        remainingLabel: "基础次数",
        bonusLabel: "券库存",
        remaining: String(selected.activities.dailyDungeonRemaining),
        bonus: String(selected.activities.dailyDungeonTicketStored),
      });
      return;
    }
    if (taskId === "mini_game") {
      setDialog({
        kind: "task_edit",
        taskId,
        title: "小游戏",
        remainingLabel: "基础次数",
        bonusLabel: "券次数",
        remaining: String(selected.activities.miniGameRemaining),
        bonus: String(selected.activities.miniGameTicketBonus),
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

  function onSyncCorridorStatus(): void {
    setDialogError(null);
    setDialog({
      kind: "corridor_sync",
      lowerAvailable: corridorDraft.lowerAvailable,
      middleAvailable: corridorDraft.middleAvailable,
    });
  }

  function onApplyCorridorCompletion(): void {
    setDialogError(null);
    setDialog({ kind: "corridor_complete", lane: corridorDraft.completeLane, amount: corridorDraft.completeAmount });
  }

  function onApplyCorridorSettings(): void {
    if (!selectedAccount) return;
    const lowerCount = toInt(corridorDraft.lowerAvailable);
    const middleCount = toInt(corridorDraft.middleAvailable);
    if (lowerCount === null || lowerCount < 0 || lowerCount > 3 || middleCount === null || middleCount < 0 || middleCount > 3) {
      setError("回廊数量必须是 0-3");
      return;
    }
    const nextUnifiedAt = getNextUnifiedCorridorRefresh(new Date()).toISOString();
    void sync(
      window.aionApi.updateArtifactStatus(selectedAccount.id, lowerCount, nextUnifiedAt, middleCount, nextUnifiedAt),
      "已同步深渊回廊到当前账号角色",
    );
  }

  function onApplyCorridorCompletionFromSettings(): void {
    if (!selected) return;
    const completed = toInt(corridorDraft.completeAmount);
    if (completed === null || completed <= 0) {
      setError("完成次数必须大于 0");
      return;
    }
    void sync(
      window.aionApi.applyCorridorCompletion(selected.id, corridorDraft.completeLane, completed),
      "已录入深渊回廊完成次数",
    );
  }

  function onResetWeeklyStats(): void {
    const ok = window.confirm("确认重置本周收益统计？仅重置统计，不影响任务进度。");
    if (!ok) return;
    void sync(window.aionApi.resetWeeklyStats());
  }

  function onSaveWeeklyCompletions(): void {
    if (!selected) return;
    const expeditionCompleted = toInt(weeklyExpeditionCompletedInput);
    const transcendenceCompleted = toInt(weeklyTranscendenceCompletedInput);
    if (expeditionCompleted === null || transcendenceCompleted === null || expeditionCompleted < 0 || transcendenceCompleted < 0) {
      setError("周统计次数必须是大于等于 0 的整数");
      return;
    }
    void sync(
      window.aionApi.updateWeeklyCompletions(selected.id, {
        expeditionCompleted,
        transcendenceCompleted,
      }),
      "已校准当前角色周统计次数",
    );
  }

  function onSaveShopPlan(): void {
    if (!selected || !state) return;
    const shopAodePurchaseUsed = toInt(shopAodePurchaseUsedInput);
    const shopDailyDungeonTicketPurchaseUsed = toInt(shopDailyDungeonTicketPurchaseUsedInput);
    if (
      shopAodePurchaseUsed === null ||
      shopDailyDungeonTicketPurchaseUsed === null ||
      shopAodePurchaseUsed < 0 ||
      shopDailyDungeonTicketPurchaseUsed < 0
    ) {
      setError("微风商店次数必须是大于等于 0 的整数");
      return;
    }
    if (
      shopAodePurchaseUsed > selectedAodeLimits.purchaseLimit ||
      shopDailyDungeonTicketPurchaseUsed > selectedAodeLimits.purchaseLimit
    ) {
      setError(`超出本角色上限：微风商店每项最多 ${selectedAodeLimits.purchaseLimit}`);
      return;
    }
    void sync(
      window.aionApi.updateAodePlan(selected.id, {
        shopAodePurchaseUsed,
        shopDailyDungeonTicketPurchaseUsed,
      }),
      "已保存微风商店记录",
    );
  }

  function onSaveTransformPlan(): void {
    if (!selected || !state) return;
    const transformAodeUsed = toInt(transformAodeUsedInput);
    if (transformAodeUsed === null || transformAodeUsed < 0) {
      setError("变换次数必须是大于等于 0 的整数");
      return;
    }
    if (transformAodeUsed > selectedAodeLimits.convertLimit) {
      setError(`超出本角色上限：变换最多 ${selectedAodeLimits.convertLimit}`);
      return;
    }
    void sync(
      window.aionApi.updateAodePlan(selected.id, {
        transformAodeUsed,
      }),
      "已保存变换记录",
    );
  }

  function onAssignExtraAodeCharacter(assignExtra: boolean): void {
    if (!selected) return;
    void sync(
      window.aionApi.updateAodePlan(selected.id, {
        assignExtra,
      }),
      assignExtra ? "已设为本账号微风商店额外角色" : "已取消本角色额外资格",
    );
  }

  function onUndoSingleStep(): void {
    if (!state || state.history.length === 0) return;
    void sync(window.aionApi.undoOperations(1), "已撤销一步");
  }

  function onUndoMultiStep(): void {
    if (!state || state.history.length === 0) return;
    const steps = toInt(undoSteps);
    if (steps === null || steps <= 0) {
      setError("请输入有效的撤销步数");
      return;
    }
    void sync(window.aionApi.undoOperations(steps), `已撤销 ${steps} 步`);
  }

  function onClearHistory(): void {
    if (!state || state.history.length === 0) return;
    const ok = window.confirm("确认清空所有操作历史日志？该操作不可撤销。");
    if (!ok) return;
    void sync(window.aionApi.clearHistory(), "已清空操作历史");
  }

  function onSaveSettings(): void {
    if (!settingsDraft) return;
    const expeditionGoldPerRunWan = toNumber(settingsDraft.expeditionGoldPerRun);
    const transcendenceGoldPerRunWan = toNumber(settingsDraft.transcendenceGoldPerRun);
    const expeditionGoldPerRun =
      expeditionGoldPerRunWan === null ? null : Math.max(0, Math.round(expeditionGoldPerRunWan * 10_000));
    const transcendenceGoldPerRun =
      transcendenceGoldPerRunWan === null ? null : Math.max(0, Math.round(transcendenceGoldPerRunWan * 10_000));
    const expeditionWarn = toInt(settingsDraft.expeditionWarnThreshold);
    const transcendenceWarn = toInt(settingsDraft.transcendenceWarnThreshold);
    const expeditionRunCap = parseOptionalCap(settingsDraft.expeditionRunCap);
    const transcendenceRunCap = parseOptionalCap(settingsDraft.transcendenceRunCap);
    const nightmareRunCap = parseOptionalCap(settingsDraft.nightmareRunCap);
    const awakeningRunCap = parseOptionalCap(settingsDraft.awakeningRunCap);
    const suppressionRunCap = parseOptionalCap(settingsDraft.suppressionRunCap);

    if (expeditionGoldPerRun === null || expeditionGoldPerRunWan === null || expeditionGoldPerRunWan < 0) {
      setError("远征金币收益参数无效（单位: 万）");
      return;
    }
    if (transcendenceGoldPerRun === null || transcendenceGoldPerRunWan === null || transcendenceGoldPerRunWan < 0) {
      setError("超越金币收益参数无效（单位: 万）");
      return;
    }
    if (expeditionWarn === null || expeditionWarn <= 0) {
      setError("远征阈值参数无效");
      return;
    }
    if (transcendenceWarn === null || transcendenceWarn <= 0) {
      setError("超越阈值参数无效");
      return;
    }
    if (
      expeditionRunCap === "invalid" ||
      transcendenceRunCap === "invalid" ||
      nightmareRunCap === "invalid" ||
      awakeningRunCap === "invalid" ||
      suppressionRunCap === "invalid"
    ) {
      setError("次数上限参数无效，请填写正整数或留空");
      return;
    }

    void sync(
      window.aionApi.updateSettings({
        expeditionGoldPerRun,
        transcendenceGoldPerRun,
        expeditionRunCap,
        transcendenceRunCap,
        nightmareRunCap,
        awakeningRunCap,
        suppressionRunCap,
        expeditionWarnThreshold: expeditionWarn,
        transcendenceWarnThreshold: transcendenceWarn,
      }),
      "设置已保存",
    );
  }

  async function onExportData(): Promise<void> {
    setBusy(true);
    setError(null);
    setInfoMessage(null);
    try {
      const result = await window.aionApi.exportData();
      if (result.cancelled) {
        return;
      }
      setInfoMessage(`导出成功: ${result.path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function onImportData(): Promise<void> {
    setBusy(true);
    setError(null);
    setInfoMessage(null);
    try {
      const result = await window.aionApi.importData();
      if (result.cancelled) {
        return;
      }
      if (result.state) {
        setState(result.state);
      }
      setInfoMessage(`导入成功: ${result.path}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "导入失败";
      setError(message);
    } finally {
      setBusy(false);
    }
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

      if (dialog.kind === "use_ticket") {
        const amount = toInt(dialog.amount);
        if (amount === null || amount <= 0) {
          setDialogError("请输入有效的吃券数量");
          return;
        }
        const ok = await sync(
          window.aionApi.applyTaskAction({
            characterId: selected.id,
            taskId: dialog.taskId,
            action: "use_ticket",
            amount,
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

      if (dialog.kind === "corridor_sync") {
        if (!selectedAccount) {
          setDialogError("未找到当前账号");
          return;
        }
        const lowerCount = toInt(dialog.lowerAvailable);
        const middleCount = toInt(dialog.middleAvailable);
        if (
          lowerCount === null ||
          lowerCount < 0 ||
          lowerCount > 3 ||
          middleCount === null ||
          middleCount < 0 ||
          middleCount > 3
        ) {
          setDialogError("回廊数量必须是 0-3");
          return;
        }
        const nextUnifiedAt = getNextUnifiedCorridorRefresh(new Date()).toISOString();
        const ok = await sync(
          window.aionApi.updateArtifactStatus(selectedAccount.id, lowerCount, nextUnifiedAt, middleCount, nextUnifiedAt),
          "已同步深渊回廊到当前账号角色",
        );
        if (ok) {
          setCorridorDraft((prev) => ({
            ...prev,
            lowerAvailable: String(lowerCount),
            middleAvailable: String(middleCount),
          }));
          setDialog(null);
          setDialogError(null);
        }
        return;
      }

      if (dialog.kind === "corridor_complete") {
        const completed = toInt(dialog.amount);
        if (completed === null || completed <= 0) {
          setDialogError("请输入有效的完成次数");
          return;
        }
        const ok = await sync(
          window.aionApi.applyCorridorCompletion(selected.id, dialog.lane, completed),
          "已录入深渊回廊完成次数",
        );
        if (ok) {
          setCorridorDraft((prev) => ({ ...prev, completeAmount: String(completed), completeLane: dialog.lane }));
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
        } else if (dialog.taskId === "daily_dungeon") {
          ok = await sync(
            window.aionApi.updateRaidCounts(selected.id, {
              dailyDungeonRemaining: remaining,
              dailyDungeonTicketStored: bonus,
            }),
          );
        } else if (dialog.taskId === "mini_game") {
          ok = await sync(
            window.aionApi.updateRaidCounts(selected.id, {
              miniGameRemaining: remaining,
              miniGameTicketBonus: bonus,
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
        <aside className="glass-panel rounded-3xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
          <h1 className="mb-3 text-lg font-semibold tracking-wide">AION 2</h1>
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-semibold tracking-wide text-slate-200">账号管理</p>
            <div className="mt-2 space-y-2">
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
              <button className="pill-btn w-full" onClick={onAddAccount} disabled={busy || !newAccountName.trim()}>
                新增账号
              </button>
            </div>

            <div className="mt-3 max-h-40 space-y-2 overflow-auto pr-1">
              {state.accounts.map((account) => {
                const active = selectedAccount?.id === account.id;
                const count = state.characters.filter((item) => item.accountId === account.id).length;
                return (
                  <button
                    key={account.id}
                    onClick={() => onSelectAccount(account.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      active
                        ? "border-white/25 bg-white/15"
                        : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/10"
                    }`}
                    disabled={busy}
                  >
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="truncate text-xs text-slate-300">
                      {account.regionTag ? `${account.regionTag} | ` : ""}
                      角色 {count}/{MAX_CHARACTERS_PER_ACCOUNT}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedAccount ? (
              <div className="mt-3 space-y-2">
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={accountEditor.name}
                  onChange={(event) => setAccountEditor({ ...accountEditor, name: event.target.value })}
                  disabled={busy}
                  placeholder="账号名称"
                />
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={accountEditor.regionTag}
                  onChange={(event) => setAccountEditor({ ...accountEditor, regionTag: event.target.value })}
                  disabled={busy}
                  placeholder="大区(可选)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button className="pill-btn w-full" onClick={onRenameAccount} disabled={busy || !accountEditor.name.trim()}>
                    保存账号
                  </button>
                  <button
                    className="pill-btn w-full"
                    onClick={onDeleteAccount}
                    disabled={busy || state.accounts.length <= 1}
                  >
                    删除账号
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-slate-200">角色管理</p>
            <p className="text-xs text-slate-300">
              {selectedAccountCharacterCount}/{MAX_CHARACTERS_PER_ACCOUNT}
            </p>
          </div>
          <div className="mb-4 space-y-2">
            <input
              className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
              placeholder={selectedAccount ? `新增到 ${selectedAccount.name}` : "新角色名称"}
              value={newCharacterName}
              onChange={(event) => setNewCharacterName(event.target.value)}
              disabled={busy || !selectedAccount}
            />
            <button
              className="pill-btn w-full"
              onClick={onAddCharacter}
              disabled={busy || !selectedAccount || !newCharacterName.trim() || !canAddCharacterInSelectedAccount}
            >
              新增角色
            </button>
          </div>

          <div className="space-y-2">
            {accountCharacters.map((item) => {
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

        <section className="min-w-0 w-full space-y-5">
          <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-3 backdrop-blur-2xl backdrop-saturate-150">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`pill-btn ${viewMode === "dashboard" && dashboardMode === "overview" ? "bg-white/20" : ""}`}
                onClick={() => {
                  setViewMode("dashboard");
                  setDashboardMode("overview");
                }}
                disabled={busy}
              >
                角色总览
              </button>
              <button
                className={`pill-btn ${viewMode === "dashboard" && dashboardMode === "character" ? "bg-white/20" : ""}`}
                onClick={() => {
                  setViewMode("dashboard");
                  setDashboardMode("character");
                }}
                disabled={busy}
              >
                角色操作
              </button>
              <button
                className={`pill-btn ${viewMode === "settings" ? "bg-white/20" : ""}`}
                onClick={() => setViewMode("settings")}
                disabled={busy}
              >
                设置页
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-300">中栏为核心操作流，右栏承载日志与辅助信息。</p>
            {infoMessage ? <p className="mt-2 text-xs text-emerald-300">{infoMessage}</p> : null}
            {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
          </article>

          {viewMode === "dashboard" ? (
            <header className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
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
          ) : null}

          {viewMode === "dashboard" && dashboardMode === "overview" ? (
            <article className="glass-panel rounded-3xl bg-[rgba(20,20,20,0.58)] p-5 backdrop-blur-2xl backdrop-saturate-150">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Role Overview</p>
                  <h3 className="mt-1 text-xl font-semibold">角色概览总览</h3>
                </div>
                <p className="text-xs text-slate-300">按优先级筛选后可进入角色；也可先做一次快速录入</p>
              </div>
              <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs font-semibold tracking-wide text-slate-200">快速录入</p>
                <div className="mt-2 grid grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] gap-2">
                  <select
                    className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                    value={quickCharacterId}
                    onChange={(event) => setQuickCharacterId(event.target.value)}
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
                    onChange={(event) => setQuickTaskId(event.target.value as TaskId)}
                    disabled={busy}
                  >
                    {TASK_DEFINITIONS.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                    value={quickAction}
                    onChange={(event) => setQuickAction(event.target.value as TaskActionKind)}
                    disabled={busy || quickActionOptions.length === 0}
                  >
                    {quickActionOptions.map((action) => (
                      <option key={action} value={action}>
                        {action === "complete_once"
                          ? "完成次数"
                          : action === "use_ticket"
                            ? "挑战券增加"
                            : "输入已完成"}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                    value={quickAmount}
                    onChange={(event) => setQuickAmount(event.target.value)}
                    disabled={busy}
                  >
                    {quickAmountOptions.map((value) => (
                      <option key={`quick-amount-${value}`} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <button className="task-btn px-4" onClick={onApplyQuickAction} disabled={busy || !quickCharacterId || !quickTask}>
                    提交录入
                  </button>
                </div>
                {quickTask?.setCompletedTotal && quickAction === "set_completed" ? (
                  <p className="mt-2 text-xs text-slate-300">当前内容总量 {quickTask.setCompletedTotal}，输入超过将自动按上限处理。</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                <select
                  className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                  value={overviewSortKey}
                  onChange={(event) => setOverviewSortKey(event.target.value as OverviewSortKey)}
                  disabled={busy}
                >
                  <option value="ready">按可执行项排序</option>
                  <option value="account">按账号排序</option>
                  <option value="region">按大区排序</option>
                </select>
                <select
                  className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-300/60"
                  value={overviewTaskFilter}
                  onChange={(event) => setOverviewTaskFilter(event.target.value as OverviewTaskFilter)}
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
                  onChange={(event) => setOverviewAccountFilter(event.target.value)}
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
                  onChange={(event) => setOverviewRegionFilter(event.target.value)}
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
              <p className="mt-2 text-xs text-slate-300">当前命中 {overviewRowsFiltered.length} 个角色，可直接进入操作页。</p>
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
                  return (
                    <article
                      key={entry.character.id}
                      className="rounded-2xl border border-white/15 bg-white/5 p-3 text-left transition hover:border-white/30 hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{entry.character.name}</p>
                          <p className="text-xs text-slate-300">
                            {entry.account.name}
                            {entry.account.regionTag ? ` (${entry.account.regionTag})` : " (未设置大区)"}
                          </p>
                        </div>
                        <span className="text-xs text-cyan-200">
                          可执行项 {filteredReadyCount}
                          {overviewTaskFilter === "all"
                            ? ""
                            : overviewTaskFilter === "dungeon"
                              ? " / 副本"
                              : overviewTaskFilter === "weekly"
                                ? " / 周常"
                                : " / 使命"}
                        </span>
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
                  <div className="col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                    当前筛选条件下没有可显示角色。
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}

          {viewMode === "dashboard" && dashboardMode === "character" ? (
            <article className="glass-panel rounded-3xl bg-[rgba(20,20,20,0.58)] p-5 backdrop-blur-2xl backdrop-saturate-150">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Current Character</p>
                <h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>
                <p className="mt-1 text-xs text-slate-300">
                  所属账号: {selectedAccount?.name ?? "--"}
                  {selectedAccount?.regionTag ? ` (${selectedAccount.regionTag})` : ""}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  当前清空奥德预估: {toGoldText(estimateCharacterGold(selected, state.settings))}
                </p>
                <p className="mt-1 text-sm text-slate-300">本周已记录收益: {toGoldText(selected.stats.goldEarned)}</p>
                <p className="mt-1 text-sm text-slate-300">
                  下层回廊剩余: {selected.activities.corridorLowerAvailable} 次 | 中层回廊剩余: {selected.activities.corridorMiddleAvailable} 次
                </p>
              </div>
              <div className="w-56 space-y-2">
                <button className="pill-btn w-full" onClick={onSwitchToOverview} disabled={busy}>
                  返回角色总览
                </button>
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                  disabled={busy}
                />
                <button className="pill-btn w-full" onClick={onRenameCharacter} disabled={busy || !renameName.trim()}>
                  重命名当前角色
                </button>
                <button
                  className="pill-btn w-full"
                  onClick={onDeleteCharacter}
                  disabled={busy || selectedAccountCharacterCount <= 1}
                >
                  删除当前角色
                </button>
                <button className="pill-btn w-full" onClick={openEnergyDialog} disabled={busy}>
                  手动改能量
                </button>
                <button className="pill-btn w-full" onClick={onSyncCorridorStatus} disabled={busy}>
                  同步回廊(当前账号)
                </button>
                <button className="pill-btn w-full" onClick={onApplyCorridorCompletion} disabled={busy}>
                  回廊录入完成
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

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">微风商店记录</p>
                <span className="text-xs text-slate-300">
                  {selectedIsAodeExtra ? "本角色: 额外+8资格" : "本角色: 基础资格"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                奥德购买 {selected.aodePlan.shopAodePurchaseUsed}/{selectedAodeLimits.purchaseLimit}（剩余 {selectedShopAodePurchaseRemaining}） | 每日副本券购买{" "}
                {selected.aodePlan.shopDailyDungeonTicketPurchaseUsed}/{selectedAodeLimits.purchaseLimit}（剩余 {selectedShopDailyDungeonTicketPurchaseRemaining}）
              </p>
              <p className="mt-1 text-xs text-slate-300">
                基础每周每项 {AODE_WEEKLY_BASE_PURCHASE_MAX} 次，额外角色每项 +{AODE_WEEKLY_EXTRA_PURCHASE_MAX} 次。
              </p>
              {!selectedIsAodeExtra && selectedAccountExtraCharacterName ? (
                <p className="mt-1 text-xs text-amber-300">当前账号额外角色：{selectedAccountExtraCharacterName}</p>
              ) : null}
              <div className="mt-2 grid grid-cols-[1fr_1fr_auto_auto] gap-2">
                <select
                  className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={shopAodePurchaseUsedInput}
                  onChange={(event) => setShopAodePurchaseUsedInput(event.target.value)}
                  disabled={busy}
                >
                  {buildCountOptions(0, selectedAodeLimits.purchaseLimit, shopAodePurchaseUsedInput).map((value) => (
                    <option key={`shop-aode-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={shopDailyDungeonTicketPurchaseUsedInput}
                  onChange={(event) => setShopDailyDungeonTicketPurchaseUsedInput(event.target.value)}
                  disabled={busy}
                >
                  {buildCountOptions(0, selectedAodeLimits.purchaseLimit, shopDailyDungeonTicketPurchaseUsedInput).map((value) => (
                    <option key={`shop-ticket-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button className="task-btn px-4" onClick={onSaveShopPlan} disabled={busy}>
                  保存记录
                </button>
                <button
                  className="task-btn px-4"
                  onClick={() => onAssignExtraAodeCharacter(!selectedIsAodeExtra)}
                  disabled={busy}
                >
                  {selectedIsAodeExtra ? "取消额外" : "设为额外"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-semibold">变换记录</p>
              <p className="mt-1 text-xs text-slate-300">
                奥德变换 {selected.aodePlan.transformAodeUsed}/{selectedAodeLimits.convertLimit}（剩余 {selectedTransformAodeRemaining}）
              </p>
              <p className="mt-1 text-xs text-slate-300">
                单次奥德按 {AODE_POINT_PER_OPERATION} 记录；基础每周 {AODE_WEEKLY_BASE_CONVERT_MAX} 次，额外角色 +{AODE_WEEKLY_EXTRA_CONVERT_MAX} 次。
              </p>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <select
                  className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={transformAodeUsedInput}
                  onChange={(event) => setTransformAodeUsedInput(event.target.value)}
                  disabled={busy}
                >
                  {buildCountOptions(0, selectedAodeLimits.convertLimit, transformAodeUsedInput).map((value) => (
                    <option key={`transform-aode-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button className="task-btn px-4" onClick={onSaveTransformPlan} disabled={busy}>
                  保存记录
                </button>
              </div>
            </div>
            </article>
          ) : null}

          {viewMode === "dashboard" ? (
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
            <h3 className="text-sm font-semibold tracking-wide">本周金币统计</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm 2xl:grid-cols-4">
              <div className="data-pill">全角色本周收益: {toGoldText(weeklyEarned)}</div>
              <div className="data-pill">全角色远征次数: {weeklyExpeditionRuns} (阈值 {expeditionWarnThreshold})</div>
              <div className="data-pill">全角色超越次数: {weeklyTransRuns} (阈值 {transcendenceWarnThreshold})</div>
              <div className="data-pill">本轮统计起点: {new Date(selected.stats.cycleStartedAt).toLocaleString()}</div>
            </div>
            <p className="mt-2 text-xs text-slate-300">周收益统计会在每周三 05:00 自动重置，也可手动重置。</p>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-semibold tracking-wide text-slate-200">当前角色周次数校准（远征/超越）</p>
              <p className="mt-1 text-xs text-slate-300">用于误清空后回填游戏内真实已完成次数。</p>
              <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                <select
                  className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={weeklyExpeditionCompletedInput}
                  onChange={(event) => setWeeklyExpeditionCompletedInput(event.target.value)}
                  disabled={busy}
                >
                  {buildCountOptions(0, COUNT_SELECT_MAX, weeklyExpeditionCompletedInput).map((value) => (
                    <option key={`weekly-expedition-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={weeklyTranscendenceCompletedInput}
                  onChange={(event) => setWeeklyTranscendenceCompletedInput(event.target.value)}
                  disabled={busy}
                >
                  {buildCountOptions(0, COUNT_SELECT_MAX, weeklyTranscendenceCompletedInput).map((value) => (
                    <option key={`weekly-transcendence-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button className="task-btn px-4" onClick={onSaveWeeklyCompletions} disabled={busy}>
                  保存校准
                </button>
              </div>
            </div>
            {expeditionOverRewardThreshold ? (
              <p className="mt-3 text-xs text-amber-300">
                警示: 远征已超过阈值 {expeditionWarnThreshold}，后续副本奖励将进入折扣区间（金币收益会下降）。
              </p>
            ) : null}
            {transcendenceOverThreshold ? (
              <p className="mt-2 text-xs text-amber-300">
                提醒: 超越次数已超过阈值 {transcendenceWarnThreshold}，请按你的策略确认是否继续投入。
              </p>
            ) : null}
            </article>
          ) : null}

          {viewMode === "dashboard" && dashboardMode === "character"
            ? (Object.keys(groupedTasks) as TaskDefinition["category"][]).map((category) => (
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
                      className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150"
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
                          <button className="task-btn w-full" onClick={() => openSetCompletedDialog(task)} disabled={busy}>
                            输入已完成次数
                          </button>
                        ) : null}
                        {canComplete ? (
                          <button
                            className="task-btn min-w-[120px] flex-1"
                            onClick={() => openCompleteDialog(task.id, task.title)}
                            disabled={busy}
                          >
                            完成次数
                          </button>
                        ) : null}
                        {showTicket ? (
                          <button
                            className="task-btn min-w-[120px] flex-1"
                            onClick={() => openUseTicketDialog(task.id, task.title)}
                            disabled={busy}
                          >
                            挑战券增加次数
                          </button>
                        ) : null}
                        {showManualEdit ? (
                          <button
                            className="task-btn min-w-[120px] flex-1"
                            onClick={() =>
                              openTaskEditDialog(
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
                  <div className="glass-panel col-span-2 rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
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
                  </div>
                ) : null}
              </div>
            </article>
              ))
            : null}

          {viewMode === "settings" ? (
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
            <h3 className="text-sm font-semibold tracking-wide">设置页</h3>
            <p className="mt-2 text-xs text-slate-300">金币收益参数 / 次数上限参数（可选） / 提示阈值参数 / 数据导入导出</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <p className="text-xs text-slate-300">远征单次金币（万）</p>
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={settingsDraft.expeditionGoldPerRun}
                  onChange={(event) => setSettingsDraft({ ...settingsDraft, expeditionGoldPerRun: event.target.value })}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-300">超越单次金币（万）</p>
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={settingsDraft.transcendenceGoldPerRun}
                  onChange={(event) => setSettingsDraft({ ...settingsDraft, transcendenceGoldPerRun: event.target.value })}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-300">远征阈值(如84)</p>
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={settingsDraft.expeditionWarnThreshold}
                  onChange={(event) => setSettingsDraft({ ...settingsDraft, expeditionWarnThreshold: event.target.value })}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              <input
                className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={settingsDraft.expeditionRunCap}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, expeditionRunCap: event.target.value })}
                disabled={busy}
                placeholder="远征上限(可空)"
              />
              <input
                className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={settingsDraft.transcendenceRunCap}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, transcendenceRunCap: event.target.value })}
                disabled={busy}
                placeholder="超越上限(可空)"
              />
              <input
                className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={settingsDraft.nightmareRunCap}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, nightmareRunCap: event.target.value })}
                disabled={busy}
                placeholder="恶梦上限(可空)"
              />
              <input
                className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={settingsDraft.awakeningRunCap}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, awakeningRunCap: event.target.value })}
                disabled={busy}
                placeholder="觉醒上限(可空)"
              />
              <input
                className="w-full rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-xs outline-none focus:border-cyan-300/60"
                value={settingsDraft.suppressionRunCap}
                onChange={(event) => setSettingsDraft({ ...settingsDraft, suppressionRunCap: event.target.value })}
                disabled={busy}
                placeholder="讨伐上限(可空)"
              />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="space-y-2">
                <p className="text-xs text-slate-300">超越阈值</p>
                <input
                  className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={settingsDraft.transcendenceWarnThreshold}
                  onChange={(event) => setSettingsDraft({ ...settingsDraft, transcendenceWarnThreshold: event.target.value })}
                  disabled={busy}
                />
              </div>
              <button className="task-btn" onClick={onSaveSettings} disabled={busy}>
                保存设置
              </button>
              <button className="task-btn" onClick={() => void onExportData()} disabled={busy}>
                导出 JSON
              </button>
              <button className="task-btn" onClick={() => void onImportData()} disabled={busy}>
                导入 JSON
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <h4 className="text-sm font-semibold">构建信息</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
                <div className="data-pill">版本: {buildInfo?.version ? `v${buildInfo.version}` : "--"}</div>
                <div className="data-pill">构建时间: {buildInfo?.buildTime ? formatBuildTime(buildInfo.buildTime) : "--"}</div>
                <div className="data-pill">作者: {buildInfo?.author ?? "--"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <h4 className="text-sm font-semibold">深渊回廊参数（当前账号同步）</h4>
              <p className="mt-1 text-xs text-slate-300">
                规则: 上层/下层按统一刷新节奏运行（今晚 21:00 起每 48 小时），这里只需录入当前可打数量并同步到当前账号。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-300">下层数量</p>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={corridorDraft.lowerAvailable}
                    onChange={(event) => setCorridorDraft({ ...corridorDraft, lowerAvailable: event.target.value })}
                    disabled={busy}
                  >
                    {Array.from({ length: 4 }, (_, i) => (
                      <option key={`lower-count-${i}`} value={String(i)}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-300">中层数量</p>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={corridorDraft.middleAvailable}
                    onChange={(event) => setCorridorDraft({ ...corridorDraft, middleAvailable: event.target.value })}
                    disabled={busy}
                  >
                    {Array.from({ length: 4 }, (_, i) => (
                      <option key={`middle-count-${i}`} value={String(i)}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <button className="task-btn w-full" onClick={onApplyCorridorSettings} disabled={busy}>
                  同步中层/下层到当前账号角色
                </button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-slate-300">完成层级</p>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={corridorDraft.completeLane}
                    onChange={(event) =>
                      setCorridorDraft({ ...corridorDraft, completeLane: event.target.value as "lower" | "middle" })
                    }
                    disabled={busy}
                  >
                    <option value="lower">下层</option>
                    <option value="middle">中层</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-300">当前角色完成次数</p>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={corridorDraft.completeAmount}
                    onChange={(event) => setCorridorDraft({ ...corridorDraft, completeAmount: event.target.value })}
                    disabled={busy}
                  >
                    {buildCountOptions(1, COUNT_SELECT_MAX, corridorDraft.completeAmount).map((value) => (
                      <option key={`corridor-complete-amount-${value}`} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end col-span-2">
                  <button className="task-btn w-full" onClick={onApplyCorridorCompletionFromSettings} disabled={busy}>
                    录入当前角色完成（所选层级）
                  </button>
                </div>
              </div>
            </div>
            </article>
          ) : null}

        </section>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-auto xl:pr-1">
          <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
            <h3 className="text-sm font-semibold tracking-wide">操作中心</h3>
            <p className="mt-2 text-xs text-slate-300">历史记录 {state.history.length} 条，支持撤销一步/多步。</p>
            <div className="mt-3 flex items-center gap-2">
              <button className="pill-btn" onClick={onUndoSingleStep} disabled={busy || state.history.length === 0}>
                撤销一步
              </button>
              <input
                className="w-16 rounded-xl border border-white/20 bg-black/25 px-2 py-1 text-xs outline-none focus:border-cyan-300/60"
                value={undoSteps}
                onChange={(event) => setUndoSteps(event.target.value)}
                disabled={busy || state.history.length === 0}
              />
              <button className="pill-btn" onClick={onUndoMultiStep} disabled={busy || state.history.length === 0}>
                撤销多步
              </button>
              <button className="pill-btn" onClick={onClearHistory} disabled={busy || state.history.length === 0}>
                清空历史
              </button>
            </div>
          </article>

          {viewMode === "dashboard" ? (
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <h3 className="text-sm font-semibold tracking-wide">下一次恢复倒计时</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {countdownItems.map((item) => {
                  const remain = item.target ? Math.max(0, item.target.getTime() - nowMs) : null;
                  return (
                    <div key={item.key} className="data-pill">
                      <p className="text-xs text-slate-300">{item.title}</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-200">{remain === null ? "--:--:--" : formatDuration(remain)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {item.target ? formatDateTime(item.target) : "未设置"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}

          {viewMode === "dashboard" ? (
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <h3 className="text-sm font-semibold tracking-wide">优先级待办</h3>
              <p className="mt-2 text-xs text-slate-300">按收益、溢出风险和周刷新临近提醒综合排序（Top 8）。</p>
              {priorityTodoItems.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">当前没有待处理高优先任务。</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {priorityTodoItems.map((item) => (
                    <div key={item.id} className="data-pill">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-300">{item.subtitle}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getPriorityToneClass(item.tone)}`}>
                          {item.tone === "high" ? "高" : item.tone === "medium" ? "中" : "低"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{item.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ) : null}

          {viewMode === "dashboard" ? (
            <article className="glass-panel rounded-2xl bg-[rgba(20,20,20,0.58)] p-4 backdrop-blur-2xl backdrop-saturate-150">
              <h3 className="text-sm font-semibold tracking-wide">操作历史日志</h3>
              <p className="mt-2 text-xs text-slate-300">显示最近 20 条（最新在前）。</p>
              {historyRows.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">暂无操作记录。</p>
              ) : (
                <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
                  {historyRows.map((entry) => {
                    const charName =
                      entry.characterId === null
                        ? "全局"
                        : characterNameById.get(entry.characterId) ?? `角色(${entry.characterId.slice(0, 6)})`;
                    return (
                      <div key={entry.id} className="data-pill">
                        <p className="text-xs text-slate-400">{new Date(entry.at).toLocaleString()}</p>
                        <p className="mt-1 text-sm">
                          [{charName}] {entry.action}
                        </p>
                        {entry.description ? <p className="mt-1 text-xs text-slate-300">{entry.description}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          ) : null}

          {viewMode === "dashboard" && dashboardMode === "character" ? (
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
            </article>
          ) : null}
        </aside>
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
                <select
                  className="mt-3 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={dialog.amount}
                  onChange={(event) => setDialog({ ...dialog, amount: event.target.value })}
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
                  onChange={(event) => setDialog({ ...dialog, amount: event.target.value })}
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
                  输入已完成次数 - {dialog.task.title} (0-{dialog.task.setCompletedTotal})
                </h4>
                <select
                  className="mt-3 w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                  value={dialog.amount}
                  onChange={(event) => setDialog({ ...dialog, amount: event.target.value })}
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

            {dialog.kind === "corridor_sync" ? (
              <>
                <h4 className="text-base font-semibold">同步深渊回廊（当前账号）</h4>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300">下层</p>
                    <div className="grid grid-cols-1 gap-1">
                      <select
                        className="rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-sm outline-none focus:border-cyan-300/60"
                        value={dialog.lowerAvailable}
                        onChange={(event) => setDialog({ ...dialog, lowerAvailable: event.target.value })}
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
                    <p className="text-xs text-slate-300">中层</p>
                    <div className="grid grid-cols-1 gap-1">
                      <select
                        className="rounded-xl border border-white/20 bg-black/25 px-2 py-2 text-sm outline-none focus:border-cyan-300/60"
                        value={dialog.middleAvailable}
                        onChange={(event) => setDialog({ ...dialog, middleAvailable: event.target.value })}
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
                    onChange={(event) => setDialog({ ...dialog, lane: event.target.value as "lower" | "middle" })}
                    disabled={busy}
                  >
                    <option value="lower">下层</option>
                    <option value="middle">中层</option>
                  </select>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.amount}
                    onChange={(event) => setDialog({ ...dialog, amount: event.target.value })}
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
                      onChange={(event) => setDialog({ ...dialog, remaining: event.target.value })}
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
                      onChange={(event) => setDialog({ ...dialog, bonus: event.target.value })}
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
                        onChange={(event) => setDialog({ ...dialog, boss: event.target.value })}
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
                  说明: 挑战剩余 = 本周还能打几次圣域挑战（上限 4）；开箱剩余 = 本周还能开几次奖励箱（上限 2）。
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.raidRemaining}
                    onChange={(event) => setDialog({ ...dialog, raidRemaining: event.target.value })}
                    disabled={busy}
                  >
                    {buildCountOptions(0, 4, dialog.raidRemaining).map((value) => (
                      <option key={`dialog-sanctum-raid-${value}`} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-xl border border-white/20 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-300/60"
                    value={dialog.boxRemaining}
                    onChange={(event) => setDialog({ ...dialog, boxRemaining: event.target.value })}
                    disabled={busy}
                  >
                    {buildCountOptions(0, 2, dialog.boxRemaining).map((value) => (
                      <option key={`dialog-sanctum-box-${value}`} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
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
