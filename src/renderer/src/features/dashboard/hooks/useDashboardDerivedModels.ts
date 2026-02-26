import { useMemo } from "react";
import {
  AODE_BASE_ENERGY_OVERFLOW_WARN_THRESHOLD,
  AODE_ENERGY_SCHEDULE_HOURS,
  AODE_WEEKLY_BASE_CONVERT_MAX,
  AODE_WEEKLY_BASE_PURCHASE_MAX,
  EXPEDITION_SCHEDULE_HOURS,
  TASK_DEFINITIONS,
  TRANSCENDENCE_SCHEDULE_HOURS,
} from "../../../../../shared/constants";
import { buildCharacterSummary } from "../../../../../shared/engine";
import { getNextDailyReset, getNextScheduledTick, getNextUnifiedCorridorRefresh, getNextWeeklyReset } from "../../../../../shared/time";
import type { AppState, TaskDefinition } from "../../../../../shared/types";
import { NO_REGION_FILTER, type OverviewSortKey, type OverviewTaskFilter, type PriorityTodoItem, type PriorityTone, type PriorityWeightKey } from "../dashboard-types";
import { formatCounter, getCharacterAodeLimits, getPriorityWeightFactor, getPriorityWeightLevel } from "../dashboard-utils";

interface UseDashboardDerivedModelsParams {
  state: AppState | null;
  nowMs: number;
  overviewSortKey: OverviewSortKey;
  overviewTaskFilter: OverviewTaskFilter;
  overviewAccountFilter: string;
  overviewRegionFilter: string;
}

export function useDashboardDerivedModels(params: UseDashboardDerivedModelsParams) {
  const { state, nowMs, overviewSortKey, overviewTaskFilter, overviewAccountFilter, overviewRegionFilter } = params;

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
            const dungeonReadyBuckets = [expeditionCurrent, transcendenceCurrent, sanctumRaidCurrent, sanctumBoxCurrent].filter(
              (value) => value > 0,
            ).length;
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
        pushItem(entry, "sanctum", "圣域（周本）", 1000 + sanctumPending, "high", "sanctum", `挑战 ${entry.sanctumRaidCurrent}/4，开箱 ${entry.sanctumBoxCurrent}/2`);
      }

      const corridorPending = entry.corridorLowerCurrent + entry.corridorMiddleCurrent;
      if (corridorPending > 0) {
        pushItem(entry, "corridor", "深渊回廊", 950 + corridorPending, "high", "corridor", `下层 ${entry.corridorLowerCurrent}/3，中层 ${entry.corridorMiddleCurrent}/3`);
      }

      if (entry.dailyMissionCurrent > 0) {
        pushItem(entry, "daily-mission", "每日 5 个使命任务", 950 + entry.dailyMissionCurrent, "high", "mission", `剩余 ${formatCounter(entry.dailyMissionCurrent, entry.dailyMissionTotal)}`);
      }

      if (weeklyCriticalWindow && entry.awakeningCurrent > 0) {
        pushItem(entry, "awakening-weekly-due", "觉醒战（周刷新前）", 1000 + entry.awakeningCurrent, "high", "weekly", `剩余 ${formatCounter(entry.awakeningCurrent, entry.awakeningTotal)}，48 小时内优先清理`);
      }

      if (weeklyCriticalWindow && entry.suppressionCurrent > 0) {
        pushItem(entry, "suppression-weekly-due", "讨伐战（周刷新前）", 995 + entry.suppressionCurrent, "high", "weekly", `剩余 ${formatCounter(entry.suppressionCurrent, entry.suppressionTotal)}，48 小时内优先清理`);
      }

      if (entry.expeditionCurrent > 0) {
        const nearCap = entry.expeditionCurrent >= Math.max(1, entry.expeditionTotal - 2);
        pushItem(entry, "expedition", nearCap ? "远征（接近满次）" : "远征（清体力收益）", (nearCap ? 860 : 820) + entry.expeditionCurrent, nearCap ? "high" : "medium", "dungeon", `剩余 ${formatCounter(entry.expeditionCurrent, entry.expeditionTotal)}`);
      }

      if (entry.transcendenceCurrent > 0) {
        const nearOverflow = entry.transcendenceCurrent >= Math.max(1, entry.transcendenceTotal - 1);
        pushItem(entry, "transcendence", nearOverflow ? "超越（溢出提醒）" : "超越", (nearOverflow ? 790 : 760) + entry.transcendenceCurrent, "medium", "dungeon", `剩余 ${formatCounter(entry.transcendenceCurrent, entry.transcendenceTotal)}`);
      }

      if (entry.nightmareCurrent > 0) {
        const nearOverflow = entry.nightmareCurrent >= Math.max(1, entry.nightmareTotal - 1);
        if (nearOverflow) {
          pushItem(entry, "nightmare-overflow", "恶梦（溢出提醒）", 780 + entry.nightmareCurrent, "medium", "weekly", `剩余 ${formatCounter(entry.nightmareCurrent, entry.nightmareTotal)}`);
        }
      }

      if (weeklyCriticalWindow && entry.dailyDungeonCurrent > 0) {
        pushItem(entry, "daily-dungeon-weekly-due", "每日副本（周刷新前）", 990 + entry.dailyDungeonCurrent, "high", "weekly", `剩余 ${formatCounter(entry.dailyDungeonCurrent, entry.dailyDungeonTotal)}，48 小时内优先清理`);
      }

      if (weeklyCriticalWindow && entry.weeklyMissionCurrent > 0) {
        pushItem(entry, "weekly-order-due", "每周指令（周刷新前）", 985 + entry.weeklyMissionCurrent, "high", "weekly", `剩余 ${formatCounter(entry.weeklyMissionCurrent, entry.weeklyMissionTotal)}，48 小时内优先完成`);
      }

      if (weeklyCriticalWindow && entry.aodeShopAodePurchaseRemaining > 0) {
        pushItem(entry, "shop-aode-weekly-due", "商店-奥德（周刷新前）", 980 + entry.aodeShopAodePurchaseRemaining, "high", "weekly", `剩余可用 ${formatCounter(entry.aodeShopAodePurchaseRemaining, entry.aodeShopPurchaseLimit)}`);
      }
      if (weeklyCriticalWindow && entry.aodeShopDailyDungeonTicketPurchaseRemaining > 0) {
        pushItem(entry, "shop-ticket-weekly-due", "商店-副本券（周刷新前）", 978 + entry.aodeShopDailyDungeonTicketPurchaseRemaining, "high", "weekly", `剩余可用 ${formatCounter(entry.aodeShopDailyDungeonTicketPurchaseRemaining, entry.aodeShopPurchaseLimit)}`);
      }
      if (weeklyCriticalWindow && entry.aodeTransformAodeRemaining > 0) {
        pushItem(entry, "transform-aode-weekly-due", "变换-奥德（周刷新前）", 976 + entry.aodeTransformAodeRemaining, "high", "weekly", `剩余可用 ${formatCounter(entry.aodeTransformAodeRemaining, entry.aodeTransformLimit)}`);
      }

      if (entry.miniGameCurrent > 0) {
        pushItem(entry, "mini-game", "小游戏（低优先）", 240 + entry.miniGameCurrent, "low", "leisure", `剩余 ${formatCounter(entry.miniGameCurrent, entry.miniGameTotal)}`);
      }
      if (entry.spiritCurrent > 0) {
        pushItem(entry, "spirit-invasion", "精灵入侵（低优先）", 220 + entry.spiritCurrent, "low", "leisure", `剩余 ${formatCounter(entry.spiritCurrent, entry.spiritTotal)}`);
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

  return {
    selected,
    selectedAccount,
    accountCharacters,
    selectedAodeLimits,
    selectedAccountExtraCharacterName,
    summary,
    overviewRows,
    overviewRegionOptions,
    overviewRowsFiltered,
    groupedTasks,
    historyRows,
    characterNameById,
    accountNameById,
    countdownItems,
    priorityTodoItems,
    isWeeklyCriticalWindow,
    selectedEstimatedGold,
    selectedPendingLabels,
    readyCharacters,
    weeklyGold,
    pendingDaily,
    pendingWeekly,
    weeklyEarned,
    weeklyExpeditionRuns,
    weeklyTransRuns,
    expeditionWarnThreshold,
    transcendenceWarnThreshold,
    expeditionOverRewardThreshold,
    transcendenceOverThreshold,
    selectedAccountCharacterCount,
    selectedIsAodeExtra,
    selectedShopAodePurchaseRemaining,
    selectedShopDailyDungeonTicketPurchaseRemaining,
    selectedTransformAodeRemaining,
  };
}
