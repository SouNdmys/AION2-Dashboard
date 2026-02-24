import { getNextUnifiedCorridorRefresh } from "../../../../../shared/time";
import type { AppState, CharacterState, TaskDefinition, TaskId } from "../../../../../shared/types";
import type { DialogState } from "../dashboard-types";
import { toInt } from "../dashboard-utils";

type DialogAppActions = NonNullable<Window["aionApi"]>;
type SyncRunner = (action: Promise<AppState>, successMessage?: string) => Promise<boolean>;

interface ConfirmDashboardDialogParams {
  dialog: DialogState;
  selected: CharacterState;
  selectedAccountId: string | null;
  appActions: DialogAppActions;
  taskById: Map<TaskId, TaskDefinition>;
  sync: SyncRunner;
  onDialogError: (message: string) => void;
  onDialogClose: () => void;
  onCorridorDraftSyncCounts: (lower: number, middle: number) => void;
  onCorridorDraftSyncCompletion: (completed: number, lane: "lower" | "middle") => void;
}

export async function confirmDashboardDialog(params: ConfirmDashboardDialogParams): Promise<void> {
  const {
    dialog,
    selected,
    selectedAccountId,
    appActions,
    taskById,
    sync,
    onDialogError,
    onDialogClose,
    onCorridorDraftSyncCounts,
    onCorridorDraftSyncCompletion,
  } = params;

  if (dialog.kind === "complete") {
    const task = taskById.get(dialog.taskId);
    const requested = toInt(dialog.amount);
    if (!task || requested === null || requested <= 0) {
      onDialogError("请输入有效的完成次数");
      return;
    }
    const ok = await sync(
      appActions.applyTaskAction({
        characterId: selected.id,
        taskId: dialog.taskId,
        action: "complete_once",
        amount: requested,
      }),
    );
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "use_ticket") {
    const amount = toInt(dialog.amount);
    if (amount === null || amount <= 0) {
      onDialogError("请输入有效的吃券数量");
      return;
    }
    const ok = await sync(
      appActions.applyTaskAction({
        characterId: selected.id,
        taskId: dialog.taskId,
        action: "use_ticket",
        amount,
      }),
    );
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "set_completed") {
    const amount = toInt(dialog.amount);
    if (amount === null || amount < 0) {
      onDialogError("请输入有效的已完成次数");
      return;
    }
    const capped = Math.min(amount, dialog.task.setCompletedTotal ?? 0);
    const ok = await sync(
      appActions.applyTaskAction({
        characterId: selected.id,
        taskId: dialog.task.id,
        action: "set_completed",
        amount: capped,
      }),
    );
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "energy") {
    const base = toInt(dialog.baseCurrent);
    const bonus = toInt(dialog.bonusCurrent);
    if (base === null || bonus === null || base < 0 || bonus < 0) {
      onDialogError("请输入有效的能量数值");
      return;
    }
    const ok = await sync(appActions.updateEnergySegments(selected.id, base, bonus));
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "corridor_sync") {
    if (!selectedAccountId) {
      onDialogError("未找到当前账号");
      return;
    }
    const lowerCount = toInt(dialog.lowerAvailable);
    const middleCount = toInt(dialog.middleAvailable);
    if (lowerCount === null || lowerCount < 0 || lowerCount > 3 || middleCount === null || middleCount < 0 || middleCount > 3) {
      onDialogError("回廊数量必须是 0-3");
      return;
    }
    const nextUnifiedAt = getNextUnifiedCorridorRefresh(new Date()).toISOString();
    const ok = await sync(
      appActions.updateArtifactStatus(selectedAccountId, lowerCount, nextUnifiedAt, middleCount, nextUnifiedAt),
      "已同步深渊回廊到当前账号角色",
    );
    if (ok) {
      onCorridorDraftSyncCounts(lowerCount, middleCount);
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "corridor_complete") {
    const completed = toInt(dialog.amount);
    if (completed === null || completed <= 0) {
      onDialogError("请输入有效的完成次数");
      return;
    }
    const ok = await sync(appActions.applyCorridorCompletion(selected.id, dialog.lane, completed), "已录入深渊回廊完成次数");
    if (ok) {
      onCorridorDraftSyncCompletion(completed, dialog.lane);
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "task_edit") {
    const remaining = toInt(dialog.remaining);
    const bonus = toInt(dialog.bonus);
    const boss = dialog.boss !== undefined ? toInt(dialog.boss) : null;
    if (remaining === null || bonus === null || remaining < 0 || bonus < 0 || (dialog.boss !== undefined && (boss === null || boss < 0))) {
      onDialogError("请输入有效的次数");
      return;
    }
    let ok = false;
    if (dialog.taskId === "expedition") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          expeditionRemaining: remaining,
          expeditionTicketBonus: bonus,
          expeditionBossRemaining: boss ?? undefined,
        }),
      );
    } else if (dialog.taskId === "transcendence") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          transcendenceRemaining: remaining,
          transcendenceTicketBonus: bonus,
          transcendenceBossRemaining: boss ?? undefined,
        }),
      );
    } else if (dialog.taskId === "nightmare") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          nightmareRemaining: remaining,
          nightmareTicketBonus: bonus,
        }),
      );
    } else if (dialog.taskId === "awakening") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          awakeningRemaining: remaining,
          awakeningTicketBonus: bonus,
        }),
      );
    } else if (dialog.taskId === "daily_dungeon") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          dailyDungeonRemaining: remaining,
          dailyDungeonTicketStored: bonus,
        }),
      );
    } else if (dialog.taskId === "mini_game") {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          miniGameRemaining: remaining,
          miniGameTicketBonus: bonus,
        }),
      );
    } else {
      ok = await sync(
        appActions.updateRaidCounts(selected.id, {
          suppressionRemaining: remaining,
          suppressionTicketBonus: bonus,
        }),
      );
    }
    if (ok) {
      onDialogClose();
    }
    return;
  }

  if (dialog.kind === "sanctum_edit") {
    const raidRemaining = toInt(dialog.raidRemaining);
    const boxRemaining = toInt(dialog.boxRemaining);
    if (raidRemaining === null || boxRemaining === null || raidRemaining < 0 || boxRemaining < 0) {
      onDialogError("请输入有效的圣域次数");
      return;
    }
    const ok = await sync(
      appActions.updateRaidCounts(selected.id, {
        sanctumRaidRemaining: raidRemaining,
        sanctumBoxRemaining: boxRemaining,
      }),
    );
    if (ok) {
      onDialogClose();
    }
  }
}
